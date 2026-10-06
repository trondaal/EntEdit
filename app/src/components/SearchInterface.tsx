import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Paper,
  Typography,
  TextField,
  Box,
  InputAdornment,
  IconButton,
  Tabs,
  Tab,
} from "@mui/material";
import { Search, Clear } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type { SparqlEndpointConfig } from "../types/sparql";
import {
  useFacetLabels,
  useSearchExpressions,
  useSearchFacets,
  useSearchManifestations,
  useSearchWorks,
} from "../hooks/useSearchQueries";
import {
  INDEX_FILTER_FIELDS,
  LINK_SELECTION,
  hasFilters,
  selectionKey,
  toggleFilter,
  type FilterField,
  type SearchFilters as Filters,
  type SearchIndex,
} from "../utils/searchFilters";
import SearchFilters from "./SearchFilters";
import { toLinkQuery, type EntitySearchHandler, type LinkTarget } from "../utils/searchLink";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import ResultSet from "./ResultSet";
import Expression from "./Expression";
import ManifestationSearchResult from "./ManifestationSearchResult";
import Work from "./Work";
import { useLogging } from "../hooks/useLogging";
import type { SearchMode } from "../types/logging";

/** Search tabs in display order: publications, content, works. */
const SEARCH_MODES: readonly SearchMode[] = ["manifestation", "expression", "work"];

const SEARCH_INDEX: Record<SearchMode, SearchIndex> = {
  manifestation: "manifestationsIndex",
  expression: "expressionsIndex",
  work: "worksIndex",
};

const perMode = <T,>(value: () => T): Record<SearchMode, T> => ({
  manifestation: value(),
  expression: value(),
  work: value(),
});

/** The selection orders with a followed link taken out, in every tab. */
const withoutLink = (all: Record<SearchMode, string[]>): Record<SearchMode, string[]> => ({
  manifestation: all.manifestation.filter((key) => key !== LINK_SELECTION),
  expression: all.expression.filter((key) => key !== LINK_SELECTION),
  work: all.work.filter((key) => key !== LINK_SELECTION),
});

interface SearchInterfaceProps {
  config: SparqlEndpointConfig;
  selectedLanguage: string;
}

const SearchInterface: React.FC<SearchInterfaceProps> = ({
  config,
  selectedLanguage,
}) => {
  const { t } = useTranslation();
  const { logEvent, isRecording } = useLogging();
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchMode, setSearchMode] = useState<SearchMode>(SEARCH_MODES[0]);
  // Each search tab keeps its own category filters
  const [filtersByMode, setFiltersByMode] = useState<Record<SearchMode, Filters>>(() => perMode(() => ({})));
  const filters = filtersByMode[searchMode];
  const setFilters = (update: (current: Filters) => Filters) =>
    setFiltersByMode((all) => ({ ...all, [searchMode]: update(all[searchMode]) }));
  // A link followed in a search tab, until the search text is edited
  const [linkTarget, setLinkTarget] = useState<(LinkTarget & { mode: SearchMode }) | null>(null);
  // Order of the selections per tab, oldest first, for the filter panel's chips
  const [orderByMode, setOrderByMode] = useState<Record<SearchMode, string[]>>(() => perMode(() => []));
  const setOrder = (update: (current: string[]) => string[]) =>
    setOrderByMode((all) => ({ ...all, [searchMode]: update(all[searchMode]) }));
  const clearLink = () => {
    setLinkTarget(null);
    setOrderByMode(withoutLink);
  };

  // Debounce the search query to avoid firing expensive SPARQL queries on every keystroke
  const debouncedQuery = useDebouncedValue(searchInput, 500);

  // Only fire the query for the active search tab to avoid unnecessary SPARQL queries.
  // A followed link searches at once, without the typing delay, with the
  // link's own Lucene query (limited to the linked expression or work, or an
  // agent's name as a phrase; see utils/searchLink.ts).
  const activeLink = linkTarget?.mode === searchMode ? linkTarget : null;
  const linkQuery = activeLink ? toLinkQuery(activeLink) : undefined;
  const currentQuery = activeLink?.label ?? debouncedQuery;
  const queryFor = (mode: SearchMode) => (searchMode === mode ? currentQuery : '');
  const filtersFor = (mode: SearchMode) => (searchMode === mode ? filters : {});
  const linkQueryFor = (mode: SearchMode) => (searchMode === mode ? linkQuery : undefined);
  const searchIndex = SEARCH_INDEX[searchMode];

  const {
    data: searchData,
    isLoading: searchLoading,
    error: searchError,
    hasNextPage: searchHasNextPage,
    isFetchingNextPage: searchIsFetchingNextPage,
    fetchNextPage: searchFetchNextPage,
  } = useSearchExpressions(
    config, queryFor('expression'), selectedLanguage, filtersFor('expression'), linkQueryFor('expression'),
  );

  // Counts for the current search; with neither text nor filters, for the
  // whole collection. The collection's values also decide which labels to load.
  const { data: facets, isPlaceholderData: facetsUpdating } = useSearchFacets(
    config, searchIndex, currentQuery, filters, true, linkQuery,
  );
  const { data: collectionFacets } = useSearchFacets(config, searchIndex, "", {});
  const facetIris = useMemo(
    () => [...Object.values(collectionFacets ?? {}), ...Object.values(facets ?? {})]
      .flat()
      .map((v) => v.value),
    [collectionFacets, facets],
  );
  const { data: facetLabels } = useFacetLabels(config, facetIris, selectedLanguage);
  const filtered = hasFilters(filters);

  const {
    data: manifestationSearchData,
    isLoading: manifestationSearchLoading,
    error: manifestationSearchError,
    hasNextPage: manifestationHasNextPage,
    isFetchingNextPage: manifestationIsFetchingNextPage,
    fetchNextPage: manifestationFetchNextPage,
  } = useSearchManifestations(
    config, queryFor('manifestation'), selectedLanguage, filtersFor('manifestation'), linkQueryFor('manifestation'),
  );

  const {
    data: workSearchData,
    isLoading: workSearchLoading,
    error: workSearchError,
    hasNextPage: workHasNextPage,
    isFetchingNextPage: workIsFetchingNextPage,
    fetchNextPage: workFetchNextPage,
  } = useSearchWorks(
    config, queryFor('work'), selectedLanguage, filtersFor('work'), linkQueryFor('work'),
  );

  // Flatten infinite query pages into flat arrays
  const searchResults = useMemo(
    () => searchData?.pages.flatMap((page) => page.results) ?? [],
    [searchData],
  );

  const manifestationSearchResults = useMemo(
    () => manifestationSearchData?.pages.flatMap((page) => page.results) ?? [],
    [manifestationSearchData],
  );

  const workSearchResults = useMemo(
    () => workSearchData?.pages.flatMap((page) => page.results) ?? [],
    [workSearchData],
  );

  // Log search when the debounced query fires
  const prevDebouncedRef = useRef(debouncedQuery);
  useEffect(() => {
    if (isRecording && debouncedQuery && debouncedQuery !== prevDebouncedRef.current) {
      logEvent({ type: "search_performed", query: debouncedQuery, mode: searchMode });
    }
    prevDebouncedRef.current = debouncedQuery;
  }, [debouncedQuery, searchMode, isRecording, logEvent]);

  const handleSearch = (value: string) => {
    setSearchInput(value);
    if (linkTarget) clearLink();
  };

  const handleClearSearch = () => {
    setSearchInput("");
    if (linkTarget) clearLink();
  };

  const handleToggleFilter = (field: FilterField, value: string) => {
    const selected = !(filters[field] ?? []).includes(value);
    setFilters((current) => toggleFilter(current, field, value));
    const key = selectionKey(field, value);
    setOrder((current) => (selected ? [...current.filter((k) => k !== key), key] : current.filter((k) => k !== key)));
    if (isRecording) {
      logEvent({ type: "search_filter_changed", field, value, selected, query: debouncedQuery, mode: searchMode });
    }
  };

  const handleClearFilters = () => {
    setFilters(() => ({}));
    setOrder((current) => current.filter((key) => key === LINK_SELECTION));
    if (isRecording) {
      logEvent({ type: "search_filters_cleared", query: debouncedQuery, mode: searchMode });
    }
  };

  const handleSelectResult = (uri: string) => {
    if (isRecording) {
      logEvent({ type: "search_result_selected", resultUri: uri, query: debouncedQuery, mode: searchMode });
    }
  };

  // "Clear all" in the filter panel: the filters and a followed link
  const handleClearAll = () => {
    if (hasFilters(filters)) handleClearFilters();
    if (activeLink) clearLink();
  };

  // A clicked name or title goes into the search field, and the search is
  // limited to what the link points to (see `linkQuery`) until the link is
  // removed or the text edited: the label's words alone rank related entries,
  // that repeat them, as high as the target.
  const handleEntitySearch: EntitySearchHandler = (label, target) => {
    setSearchInput(label);
    if (isRecording) {
      logEvent({ type: "search_link_followed", label, uri: target?.uri, kind: target?.kind, mode: searchMode });
    }
    // A followed link starts a new search: filters chosen for the previous
    // one (a language, a genre) would otherwise hide the entity it points to
    if (hasFilters(filters)) handleClearFilters();
    setLinkTarget(target ? { label, ...target, mode: searchMode } : null);
    setOrderByMode((all) => ({
      ...withoutLink(all),
      ...(target ? { [searchMode]: [LINK_SELECTION] } : {}),
    }));
  };

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          gap: 3,
          flexDirection: { xs: "column", md: "row" },
          flexWrap: { xs: "wrap", md: "nowrap" },
          height: { xs: "auto", md: "calc(100vh - 160px)" },
        }}
      >
        {/* Search Input Section */}
        <Box
          sx={{
            flex: "1 1 400px",
            minWidth: 400,
            display: "flex",
            flexDirection: "column",
            height: { xs: "auto", md: "100%" },
            overflow: { xs: "visible", md: "hidden" },
          }}
        >
          <Paper
            elevation={1}
            sx={{
              height: { xs: "auto", md: "100%" },
              display: "flex",
              flexDirection: "column",
              overflow: { xs: "visible", md: "hidden" },
            }}
          >
            <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
              <Typography
                variant="h6"
                sx={{ display: "flex", alignItems: "center", mb: 2 }}
              >
                <Search sx={{ mr: 1 }} />
                {t("search.fullTextSearch")}
              </Typography>

              {/* Search Mode Tabs */}
              <Tabs
                value={searchMode}
                onChange={(_, mode: SearchMode) => setSearchMode(mode)}
                sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab value="manifestation" label={t("search.manifestationSearch")} />
                <Tab value="expression" label={t("search.expressionSearch")} />
                <Tab value="work" label={t("search.workSearch")} />
              </Tabs>

              <TextField
                fullWidth
                variant="outlined"
                placeholder={t("search.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: searchInput && (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleClearSearch}
                          edge="end"
                          size="small"
                        >
                          <Clear />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            <Box sx={{ p: 2, flex: 1, overflowY: { xs: "visible", md: "auto" } }}>
              <Typography variant="body2" color="text.secondary">
                {t("search.searchHelp")}
              </Typography>
              {facets && (
                <Box sx={{ mt: 3 }}>
                  <SearchFilters
                    fields={INDEX_FILTER_FIELDS[searchIndex]}
                    facets={facets}
                    labels={facetLabels ?? new Map()}
                    filters={filters}
                    order={orderByMode[searchMode]}
                    link={activeLink}
                    onToggle={handleToggleFilter}
                    onClearLink={clearLink}
                    onClear={handleClearAll}
                    updating={facetsUpdating}
                  />
                </Box>
              )}
            </Box>
          </Paper>
        </Box>

        {/* Search Results Section */}
        <Box
          sx={{
            flex: "1 1 600px",
            minWidth: 600,
            display: "flex",
            flexDirection: "column",
            height: { xs: "auto", md: "100%" },
            overflow: { xs: "visible", md: "hidden" },
          }}
        >
          {searchMode === 'manifestation' && (
            <ResultSet
              searchQuery={currentQuery}
              filtered={filtered}
              searchResults={manifestationSearchResults}
              totalCount={manifestationSearchData?.pages[0]?.total ?? 0}
              fuzzy={manifestationSearchData?.pages[0]?.fuzzy ?? false}
              searchLoading={manifestationSearchLoading}
              searchError={manifestationSearchError as Error | null}
              emptyPrompt={t("search.enterSearchQueryManifestations")}
              renderResult={(result) => (
                <ManifestationSearchResult
                  result={result}
                  onSelect={handleSelectResult}
                  selectedLanguage={selectedLanguage}
                  config={config}
                  onEntitySearch={handleEntitySearch}
                />
              )}
              hasNextPage={manifestationHasNextPage}
              isFetchingNextPage={manifestationIsFetchingNextPage}
              onFetchNextPage={manifestationFetchNextPage}
            />
          )}
          {searchMode === 'expression' && (
            <ResultSet
              searchQuery={currentQuery}
              filtered={filtered}
              searchResults={searchResults}
              totalCount={searchData?.pages[0]?.total ?? 0}
              fuzzy={searchData?.pages[0]?.fuzzy ?? false}
              searchLoading={searchLoading}
              searchError={searchError as Error | null}
              emptyPrompt={t("search.enterSearchQuery")}
              renderResult={(result) => (
                <Expression
                  result={result}
                  onSelect={handleSelectResult}
                  config={config}
                  selectedLanguage={selectedLanguage}
                  onEntitySearch={handleEntitySearch}
                />
              )}
              hasNextPage={searchHasNextPage}
              isFetchingNextPage={searchIsFetchingNextPage}
              onFetchNextPage={searchFetchNextPage}
            />
          )}
          {searchMode === 'work' && (
            <ResultSet
              searchQuery={currentQuery}
              filtered={filtered}
              searchResults={workSearchResults}
              totalCount={workSearchData?.pages[0]?.total ?? 0}
              fuzzy={workSearchData?.pages[0]?.fuzzy ?? false}
              searchLoading={workSearchLoading}
              searchError={workSearchError as Error | null}
              emptyPrompt={t("search.enterSearchQueryWorks")}
              renderResult={(result) => (
                <Work
                  result={result}
                  onSelect={handleSelectResult}
                  config={config}
                  selectedLanguage={selectedLanguage}
                  onEntitySearch={handleEntitySearch}
                />
              )}
              hasNextPage={workHasNextPage}
              isFetchingNextPage={workIsFetchingNextPage}
              onFetchNextPage={workFetchNextPage}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default SearchInterface;
