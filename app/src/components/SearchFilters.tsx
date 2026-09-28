import React, { useState } from "react";
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Link,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { capitalizeFirstLetter } from "../utils/textFormatters";
import {
  FILTER_FIELDS,
  hasFilters,
  type FacetValue,
  type Facets,
  type FilterField,
  type SearchFilters as Filters,
} from "../utils/searchFilters";

/** Values shown per category before "show all". */
const SHOWN_VALUES = 6;

interface SearchFiltersProps {
  /** Values and hit counts of the current result set */
  facets: Facets;
  /** Category labels by IRI */
  labels: Map<string, string>;
  filters: Filters;
  onToggle: (field: FilterField, value: string) => void;
  onClear: () => void;
  /** Counts are being refreshed */
  updating?: boolean;
}

/** Last segment of an IRI, for a category without a label. */
const localName = (iri: string): string => iri.replace(/[/#]$/, "").split(/[/#]/).pop() ?? iri;

/**
 * Checkbox filters for the content search: one group per category, each
 * value with the number of hits it has in the current result set. Only
 * values that occur are listed; a checked value stays visible (with 0 when
 * other filters exclude it) so it can be unchecked again.
 */
const SearchFilters: React.FC<SearchFiltersProps> = ({
  facets,
  labels,
  filters,
  onToggle,
  onClear,
  updating = false,
}) => {
  const { t, i18n } = useTranslation();
  const [showAll, setShowAll] = useState<Partial<Record<FilterField, boolean>>>({});
  const locale = i18n.language === "no" ? "nb-NO" : "en";

  const groups = FILTER_FIELDS.map((field) => {
    const values: FacetValue[] = [...(facets[field] ?? [])];
    for (const value of filters[field] ?? []) {
      if (!values.some((v) => v.value === value)) values.push({ value, count: 0 });
    }
    return { field, values };
  }).filter(({ values }) => values.length > 0);

  if (groups.length === 0) return null;

  return (
    <Box sx={{ opacity: updating ? 0.6 : 1, transition: "opacity 0.2s" }}>
      <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="subtitle2" component="h3">
          {t("search.filters.title")}
        </Typography>
        {hasFilters(filters) && (
          <Link component="button" variant="caption" onClick={onClear}>
            {t("search.filters.clear")}
          </Link>
        )}
      </Box>

      {groups.map(({ field, values }) => {
        const selected = filters[field] ?? [];
        const expanded = showAll[field] ?? false;
        const shown = expanded
          ? values
          : values.filter((v, i) => i < SHOWN_VALUES || selected.includes(v.value));
        return (
          <FormControl key={field} component="fieldset" variant="standard" sx={{ display: "block", mb: 1.5 }}>
            <FormLabel
              component="legend"
              sx={{ typography: "caption", fontWeight: 600, color: "text.secondary", mb: 0.25 }}
            >
              {t(`search.filters.${field}`)}
            </FormLabel>
            <FormGroup>
              {shown.map(({ value, count }) => (
                <FormControlLabel
                  key={value}
                  sx={{ ml: -0.5, mr: 0 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={selected.includes(value)}
                      onChange={() => onToggle(field, value)}
                      sx={{ p: 0.5 }}
                    />
                  }
                  label={
                    <Typography variant="body2" component="span">
                      {capitalizeFirstLetter(labels.get(value) ?? localName(value))}{" "}
                      <Typography component="span" variant="caption" color="text.secondary">
                        ({count.toLocaleString(locale)})
                      </Typography>
                    </Typography>
                  }
                />
              ))}
            </FormGroup>
            {values.length > SHOWN_VALUES && (
              <Link
                component="button"
                variant="caption"
                onClick={() => setShowAll((all) => ({ ...all, [field]: !expanded }))}
                aria-expanded={expanded}
              >
                {expanded
                  ? t("search.filters.showFewer")
                  : t("search.filters.showAll", { count: values.length })}
              </Link>
            )}
          </FormControl>
        );
      })}
    </Box>
  );
};

export default SearchFilters;
