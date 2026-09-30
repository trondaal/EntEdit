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
import ManifestationResultSet from "./ManifestationResultSet";
import { useLogging } from "../hooks/useLogging";

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
  const [searchMode, setSearchMode] = useState<'expression' | 'manifestation'>('expression');
  // Each search tab keeps its own category filters
  const [filtersByMode, setFiltersByMode] = useState<Record<'expression' | 'manifestation', Filters>>({
    expression: {},
    manifestation: {},
  });
  const filters = filtersByMode[searchMode];
  const setFilters = (update: (current: Filters) => Filters) =>
    setFiltersByMode((all) => ({ ...all, [searchMode]: update(all[searchMode]) }));
  // A link followed in a search tab, until the search text is edited
  const [linkTarget, setLinkTarget] = useState<(LinkTarget & { mode: 'expression' | 'manifestation' }) | null>(null);
  // Order of the selections per tab, oldest first, for the filter panel's chips
  const [orderByMode, setOrderByMode] = useState<Record<'expression' | 'manifestation', string[]>>({
    expression: [],
    manifestation: [],
  });
  const setOrder = (update: (current: string[]) => string[]) =>
    setOrderByMode((all) => ({ ...all, [searchMode]: update(all[searchMode]) }));
  const clearLink = () => {
    setLinkTarget(null);
    setOrderByMode((all) => ({
      expression: all.expression.filter((key) => key !== LINK_SELECTION),
      manifestation: all.manifestation.filter((key) => key !== LINK_SELECTION),
    }));
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
  const expressionQuery = searchMode === 'expression' ? currentQuery : '';
  const manifestationQuery = searchMode === 'manifestation' ? currentQuery : '';
  const expressionFilters = searchMode === 'expression' ? filters : {};
  const manifestationFilters = searchMode === 'manifestation' ? filters : {};
  const searchIndex: SearchIndex = searchMode === 'expression' ? 'expressionsIndex' : 'manifestationsIndex';

  const {
    data: searchData,
    isLoading: searchLoading,
    error: searchError,
    hasNextPage: searchHasNextPage,
    isFetchingNextPage: searchIsFetchingNextPage,
    fetchNextPage: searchFetchNextPage,
  } = useSearchExpressions(
    config, expressionQuery, selectedLanguage, expressionFilters,
    searchMode === 'expression' ? linkQuery : undefined,
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
    config, manifestationQuery, selectedLanguage, manifestationFilters,
    searchMode === 'manifestation' ? linkQuery : undefined,
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
      expression: all.expression.filter((key) => key !== LINK_SELECTION),
      manifestation: all.manifestation.filter((key) => key !== LINK_SELECTION),
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
                value={searchMode === 'expression' ? 0 : 1}
                onChange={(_, newValue) => setSearchMode(newValue === 0 ? 'expression' : 'manifestation')}
                sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab label={t("search.expressionSearch")} />
                <Tab label={t("search.manifestationSearch")} />
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
          {searchMode === 'expression' ? (
            <ResultSet
              searchQuery={expressionQuery}
              filtered={filtered}
              searchResults={searchResults}
              totalCount={searchData?.pages[0]?.total ?? 0}
              fuzzy={searchData?.pages[0]?.fuzzy ?? false}
              searchLoading={searchLoading}
              searchError={searchError as Error | null}
              onSelectResult={(uri: string) => {
                if (isRecording) {
                  logEvent({ type: "search_result_selected", resultUri: uri, query: debouncedQuery, mode: "expression" });
                }
              }}
              config={config}
              selectedLanguage={selectedLanguage}
              hasNextPage={searchHasNextPage}
              isFetchingNextPage={searchIsFetchingNextPage}
              onFetchNextPage={searchFetchNextPage}
              onEntitySearch={handleEntitySearch}
            />
          ) : (
            <ManifestationResultSet
              searchQuery={manifestationQuery}
              filtered={filtered}
              searchResults={manifestationSearchResults}
              totalCount={manifestationSearchData?.pages[0]?.total ?? 0}
              fuzzy={manifestationSearchData?.pages[0]?.fuzzy ?? false}
              searchLoading={manifestationSearchLoading}
              searchError={manifestationSearchError as Error | null}
              onSelectResult={(uri: string) => {
                if (isRecording) {
                  logEvent({ type: "search_result_selected", resultUri: uri, query: debouncedQuery, mode: "manifestation" });
                }
              }}
              config={config}
              selectedLanguage={selectedLanguage}
              hasNextPage={manifestationHasNextPage}
              isFetchingNextPage={manifestationIsFetchingNextPage}
              onFetchNextPage={manifestationFetchNextPage}
              onEntitySearch={handleEntitySearch}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default SearchInterface;
