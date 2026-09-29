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
  useLinkedExpressions,
  useSearchExpressions,
  useSearchFacets,
  useSearchManifestations,
} from "../hooks/useSearchQueries";
import {
  INDEX_FILTER_FIELDS,
  hasFilters,
  toggleFilter,
  type FilterField,
  type SearchFilters as Filters,
  type SearchIndex,
} from "../utils/searchFilters";
import SearchFilters from "./SearchFilters";
import { toNameQuery, type EntitySearchHandler, type LinkTarget } from "../utils/searchLink";
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
  // A link followed in the content search, until the search text is edited
  const [linkTarget, setLinkTarget] = useState<LinkTarget | null>(null);

  // Debounce the search query to avoid firing expensive SPARQL queries on every keystroke
  const debouncedQuery = useDebouncedValue(searchInput, 500);

  // Only fire the query for the active search tab to avoid unnecessary SPARQL queries.
  // A followed link searches for its label at once, without the typing delay;
  // an agent's name is searched as a phrase in the names field only.
  const contentLink = searchMode === 'expression' ? linkTarget : null;
  const expressionQuery = searchMode === 'expression' ? (contentLink?.label ?? debouncedQuery) : '';
  const agentQuery = contentLink?.kind === 'agent' ? toNameQuery(contentLink.label) : undefined;
  const manifestationQuery = searchMode === 'manifestation' ? debouncedQuery : '';
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
  } = useSearchExpressions(config, expressionQuery, selectedLanguage, expressionFilters, agentQuery);
  const { data: linkedExpressions, isLoading: linkedLoading } = useLinkedExpressions(
    config, contentLink, selectedLanguage,
  );

  // Counts for the current search; with neither text nor filters, for the
  // whole collection. The collection's values also decide which labels to load.
  const { data: facets, isPlaceholderData: facetsUpdating } = useSearchFacets(
    config, searchIndex, searchMode === 'expression' ? expressionQuery : debouncedQuery, filters, true, agentQuery,
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
  } = useSearchManifestations(config, manifestationQuery, selectedLanguage, manifestationFilters);

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
    setLinkTarget(null);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setLinkTarget(null);
  };

  const handleToggleFilter = (field: FilterField, value: string) => {
    const selected = !(filters[field] ?? []).includes(value);
    setFilters((current) => toggleFilter(current, field, value));
    if (isRecording) {
      logEvent({ type: "search_filter_changed", field, value, selected, query: debouncedQuery, mode: searchMode });
    }
  };

  const handleClearFilters = () => {
    setFilters(() => ({}));
    if (isRecording) {
      logEvent({ type: "search_filters_cleared", query: debouncedQuery, mode: searchMode });
    }
  };

  // A clicked name or title goes into the search field. In the content search
  // the entry it points to is also looked up by URI and shown first, since the
  // label's words alone rank related entries (that repeat them) as high.
  const handleEntitySearch: EntitySearchHandler = (label, target) => {
    setSearchInput(label);
    setLinkTarget(searchMode === 'expression' && target ? { label, ...target } : null);
    if (isRecording) {
      logEvent({ type: "search_link_followed", label, uri: target?.uri, kind: target?.kind, mode: searchMode });
    }
    // A followed link starts a new search: filters chosen for the previous
    // one (a language, a genre) would otherwise hide the entity it points to
    if (hasFilters(filters)) handleClearFilters();
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
                    onToggle={handleToggleFilter}
                    onClear={handleClearFilters}
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
              linked={contentLink ? (linkedExpressions ?? []) : []}
              linkedLoading={Boolean(contentLink) && linkedLoading}
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
              searchQuery={debouncedQuery}
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
