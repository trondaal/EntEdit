import React, { useState } from "react";
import {
  Box,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Link,
  Typography,
} from "@mui/material";
import { Cancel } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { capitalizeFirstLetter } from "../utils/textFormatters";
import {
  LINK_SELECTION,
  hasFilters,
  parseSelectionKey,
  selectionKey,
  type FacetValue,
  type Facets,
  type FilterField,
  type SearchFilters as Filters,
} from "../utils/searchFilters";
import type { LinkTarget } from "../utils/searchLink";

/** Values shown per category before "show all". */
const SHOWN_VALUES = 6;

interface SearchFiltersProps {
  /** Fields offered, in display order */
  fields: readonly FilterField[];
  /** Values and hit counts of the current result set */
  facets: Facets;
  /** Category labels by IRI */
  labels: Map<string, string>;
  filters: Filters;
  /** Selections, oldest first (`selectionKey`, `LINK_SELECTION`) */
  order: readonly string[];
  /** A followed link limiting the search */
  link?: LinkTarget | null;
  onToggle: (field: FilterField, value: string) => void;
  onClearLink: () => void;
  /** Clears the filters and the link */
  onClear: () => void;
  /** Counts are being refreshed */
  updating?: boolean;
}

/** Last segment of an IRI, for a category without a label. */
const localName = (iri: string): string => iri.replace(/[/#]$/, "").split(/[/#]/).pop() ?? iri;

interface Selection {
  key: string;
  label: string;
  onDelete: () => void;
  link?: boolean;
}

/**
 * Checkbox filters for a search: one group per category, each value with the
 * number of hits it has in the current result set. Only values that occur are
 * listed; a checked value stays visible (with 0 when other filters exclude it)
 * so it can be unchecked again.
 *
 * Next to the checkboxes, every selection is also a removable chip, in the
 * order chosen, together with a followed link. Chips and checkboxes show the
 * same state: removing a chip unchecks its box.
 */
const SearchFilters: React.FC<SearchFiltersProps> = ({
  fields,
  facets,
  labels,
  filters,
  order,
  link = null,
  onToggle,
  onClearLink,
  onClear,
  updating = false,
}) => {
  const { t, i18n } = useTranslation();
  const [showAll, setShowAll] = useState<Partial<Record<FilterField, boolean>>>({});
  const locale = i18n.language === "no" ? "nb-NO" : "en";
  const valueLabel = (value: string) => capitalizeFirstLetter(labels.get(value) ?? localName(value)) ?? value;

  const groups = fields.map((field) => {
    const values: FacetValue[] = [...(facets[field] ?? [])];
    for (const value of filters[field] ?? []) {
      if (!values.some((v) => v.value === value)) values.push({ value, count: 0 });
    }
    return { field, values };
  }).filter(({ values }) => values.length > 0);

  // Selections in the order they were made, oldest first; anything selected
  // without a recorded position (should not happen) goes last
  const selections: Selection[] = [];
  const listed = new Set<string>();
  const add = (key: string) => {
    if (listed.has(key)) return;
    if (key === LINK_SELECTION) {
      if (!link) return;
      selections.push({ key, label: link.label, onDelete: onClearLink, link: true });
    } else {
      const selection = parseSelectionKey(key);
      if (!selection || !(filters[selection.field] ?? []).includes(selection.value)) return;
      selections.push({
        key,
        label: valueLabel(selection.value),
        onDelete: () => onToggle(selection.field, selection.value),
      });
    }
    listed.add(key);
  };
  order.forEach(add);
  add(LINK_SELECTION);
  fields.forEach((field) => (filters[field] ?? []).forEach((value) => add(selectionKey(field, value))));

  if (groups.length === 0 && selections.length === 0) return null;

  return (
    <Box sx={{ opacity: updating ? 0.6 : 1, transition: "opacity 0.2s" }}>
      {/* Two columns: title and checkboxes, "Clear all" and chips */}
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 2, mb: 1 }}>
        <Typography variant="subtitle2" component="h3" sx={{ flex: "1 1 55%", minWidth: 0 }}>
          {t("search.filters.title")}
        </Typography>
        <Box sx={{ flex: "0 1 45%", minWidth: 0 }}>
          {(hasFilters(filters) || link) && (
            <Link component="button" variant="caption" onClick={onClear}>
              {t("search.filters.clear")}
            </Link>
          )}
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        <Box sx={{ flex: "1 1 55%", minWidth: 0 }}>
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
                          {valueLabel(value)}{" "}
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

        {/* Always present, so checking a box does not shift the columns */}
        <Box
          component="ul"
          aria-label={t("search.filters.selected")}
          sx={{
            flex: "0 1 45%",
            minWidth: 0,
            listStyle: "none",
            m: 0,
            p: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 0.75,
          }}
        >
          {selections.map(({ key, label, onDelete, link: isLink }) => (
            <Box component="li" key={key} sx={{ maxWidth: "100%" }}>
              <Chip
                size="small"
                variant="outlined"
                color={isLink ? "primary" : "default"}
                label={label}
                title={label}
                onDelete={onDelete}
                deleteIcon={
                  <Cancel aria-label={isLink ? t("search.removeLink") : t("search.filters.remove", { label })} />
                }
                sx={{ maxWidth: "100%" }}
              />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default SearchFilters;
