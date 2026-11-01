import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useRelationshipList, useRelationshipUsage } from "../hooks/useRelationshipChoices";
import { formatCountExact } from "../utils/formatCount";
import { withHidden } from "../utils/relationshipFilter";
import {
  filterRelationships,
  groupRelationships,
  RELATIONSHIP_LEVELS,
  type RelationshipEntry,
} from "../utils/relationshipList";
import type { SparqlEndpointConfig } from "../types/sparql";

interface RelationshipVisibilityDialogProps {
  open: boolean;
  onClose: () => void;
  /** The database the relationships and their counts are read from */
  config: SparqlEndpointConfig;
  language: string;
  /** The relationship properties whose lines the search results leave out */
  hidden: readonly string[];
  onChange: (hidden: string[]) => void;
}

/**
 * Chooses which relationships the search results show. The list is long (the profile has
 * about 270 relationships between works, expressions or manifestations), so it is its own
 * dialog: a tab per level, the common relationships first, a filter, and for each the
 * number of entities that have it in this database, so that the ones nobody uses can be
 * ignored. A change takes effect at once; the caller stores it.
 */
const RelationshipVisibilityDialog: React.FC<RelationshipVisibilityDialogProps> = ({
  open,
  onClose,
  config,
  language,
  hidden,
  onChange,
}) => {
  const { t, i18n } = useTranslation();
  const [levelIndex, setLevelIndex] = useState(0);
  const [filter, setFilter] = useState("");
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);

  // One list per level, so that every tab can say how many it hides
  const lists = [
    useRelationshipList(config, RELATIONSHIP_LEVELS[0].classUri, language, open),
    useRelationshipList(config, RELATIONSHIP_LEVELS[1].classUri, language, open),
    useRelationshipList(config, RELATIONSHIP_LEVELS[2].classUri, language, open),
  ];
  const { level, classUri } = RELATIONSHIP_LEVELS[levelIndex];
  const list = lists[levelIndex];
  const entries = list.data ?? [];
  const usage = useRelationshipUsage(
    config,
    classUri,
    entries.map((entry) => entry.uri),
    open && list.isSuccess,
  );

  // At most a few hundred entries: grouping them again on a keystroke costs nothing
  const { common, others } = groupRelationships(entries, level);
  const shownCommon = filterRelationships(common, filter);
  const shownOthers = filterRelationships(others, filter);
  const listed = [...shownCommon, ...shownOthers];
  const filtering = filter.trim() !== "";

  const hiddenIn = (index: number) =>
    (lists[index].data ?? []).filter((entry) => hiddenSet.has(entry.uri)).length;

  const toggle = (entry: RelationshipEntry) =>
    onChange(withHidden(hidden, [entry.uri], !hiddenSet.has(entry.uri)));
  const setListed = (hide: boolean) =>
    onChange(withHidden(hidden, listed.map((entry) => entry.uri), hide));

  const renderEntry = (entry: RelationshipEntry) => {
    const count = usage.data?.get(entry.uri);
    const labelId = `relationship-${entry.uri}`;
    return (
      <ListItem key={entry.uri} disablePadding>
        <ListItemButton dense onClick={() => toggle(entry)} sx={{ py: 0 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Checkbox
              edge="start"
              size="small"
              checked={!hiddenSet.has(entry.uri)}
              tabIndex={-1}
              disableRipple
              slotProps={{ input: { "aria-labelledby": labelId } }}
            />
          </ListItemIcon>
          <ListItemText
            id={labelId}
            primary={entry.label}
            slotProps={{ primary: { variant: "body2" } }}
          />
          {count !== undefined && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ ml: 2, fontStyle: count === 0 ? "italic" : "normal", whiteSpace: "nowrap" }}
            >
              {count === 0 ? t("relationshipChoice.unused") : formatCountExact(count, i18n.language)}
            </Typography>
          )}
        </ListItemButton>
      </ListItem>
    );
  };

  const subheader = (text: string) => (
    <ListSubheader disableSticky sx={{ lineHeight: "32px", bgcolor: "transparent" }}>
      {text}
    </ListSubheader>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="relationship-choice-title"
    >
      <DialogTitle id="relationship-choice-title" sx={{ pb: 0.5 }}>
        {t("relationshipChoice.title")}
      </DialogTitle>
      <Box sx={{ px: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t("relationshipChoice.description")}
        </Typography>
        <Tabs
          value={levelIndex}
          onChange={(_event, value: number) => setLevelIndex(value)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          {RELATIONSHIP_LEVELS.map(({ level: tabLevel }, index) => {
            const count = hiddenIn(index);
            return (
              <Tab
                key={tabLevel}
                sx={{ textTransform: "none" }}
                label={
                  <Box>
                    {t(`relationshipChoice.level.${tabLevel}`)}
                    {count > 0 && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", lineHeight: 1.2 }}
                      >
                        {t("relationshipChoice.hiddenCount", { count })}
                      </Typography>
                    )}
                  </Box>
                }
              />
            );
          })}
        </Tabs>
      </Box>

      <DialogContent sx={{ pt: 1.5, minHeight: 320 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1, flexWrap: "wrap" }}>
          <TextField
            size="small"
            label={t("relationshipChoice.filter")}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            sx={{ flex: "1 1 200px" }}
          />
          <Button size="small" onClick={() => setListed(false)} disabled={listed.length === 0}>
            {filtering ? t("relationshipChoice.showThese") : t("relationshipChoice.showAll")}
          </Button>
          <Button size="small" onClick={() => setListed(true)} disabled={listed.length === 0}>
            {filtering ? t("relationshipChoice.hideThese") : t("relationshipChoice.hideAll")}
          </Button>
        </Box>

        {list.isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {list.isError && <Alert severity="error">{t("relationshipChoice.loadFailed")}</Alert>}
        {list.isSuccess && entries.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t("relationshipChoice.noneInProfile")}
          </Typography>
        )}
        {list.isSuccess && entries.length > 0 && (
          <>
            <Box sx={{ display: "flex", justifyContent: "space-between", px: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {t("relationshipChoice.visible")}
              </Typography>
              <Tooltip title={t("relationshipChoice.usageTooltip")}>
                <Typography variant="caption" color="text.secondary">
                  {t("relationshipChoice.usageHeader")}
                  {usage.isFetching && <CircularProgress size={10} sx={{ ml: 0.75 }} />}
                </Typography>
              </Tooltip>
            </Box>
            {usage.isError && (
              <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
                {t("relationshipChoice.countsFailed")}
              </Typography>
            )}
            {listed.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
                {t("relationshipChoice.empty")}
              </Typography>
            ) : (
              <List dense disablePadding>
                {shownCommon.length > 0 && subheader(t("relationshipChoice.common"))}
                {shownCommon.map(renderEntry)}
                {shownOthers.length > 0 && subheader(t("relationshipChoice.all"))}
                {shownOthers.map(renderEntry)}
              </List>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={() => onChange([])} disabled={hidden.length === 0} sx={{ mr: "auto" }}>
          {t("relationshipChoice.reset")}
        </Button>
        <Button variant="contained" onClick={onClose}>
          {t("relationshipChoice.done")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RelationshipVisibilityDialog;
