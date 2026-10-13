import React, { useId, useMemo } from "react";
import { Box, Button, ButtonBase, Typography } from "@mui/material";
import { ChevronRight, ExpandMore } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import OrderableValueList from "./OrderableValueList";
import { usePropertyView } from "../hooks/usePropertyView";
import { SHOW_MORE_STEP, showMoreTarget, visibleCount } from "../utils/propertyView";

interface PropertyValuesProps {
  propertyUri: string;
  label: string;
  itemIds: string[];
  isEditing: boolean;
  onReorder: (propertyUri: string, fromIndex: number, toIndex: number) => void;
  children: (index: number) => React.ReactNode;
}

/**
 * One property of an entity: its heading and values. Reading, the heading
 * collapses the values and a long list is cut to its first few with a
 * "show more" button (utils/propertyView.ts); editing shows everything.
 */
const PropertyValues: React.FC<PropertyValuesProps> = ({
  propertyUri,
  label,
  itemIds,
  isEditing,
  onReorder,
  children,
}) => {
  const { t } = useTranslation("entityEditor");
  const view = usePropertyView();
  const panelId = useId();

  const total = itemIds.length;
  const collapsed = !isEditing && view.collapsed.has(propertyUri);
  const visible = visibleCount(total, view.shown.get(propertyUri), { isEditing, collapsed });
  const visibleIds = useMemo(() => itemIds.slice(0, visible), [itemIds, visible]);
  const hidden = total - visible;

  const heading = (
    <>
      {/* Editing keeps the chevron's place, so the heading does not move between modes */}
      {collapsed ? (
        <ChevronRight fontSize="small" sx={{ visibility: isEditing ? "hidden" : "visible" }} />
      ) : (
        <ExpandMore fontSize="small" sx={{ visibility: isEditing ? "hidden" : "visible" }} />
      )}
      <Typography variant="body2" color="text.secondary" component="span">
        {label}
        {total > 1 && !isEditing ? ` (${total})` : ""}
      </Typography>
    </>
  );

  return (
    <>
      {isEditing ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, mb: 0.5, ml: -0.5 }}>
          {heading}
        </Box>
      ) : (
        <ButtonBase
          onClick={() => view.toggle(propertyUri)}
          aria-expanded={!collapsed}
          aria-controls={panelId}
          aria-label={t(collapsed ? "values.expand" : "values.collapse", { property: label })}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.25,
            mb: 0.5,
            ml: -0.5,
            pr: 0.5,
            borderRadius: 1,
            textAlign: "left",
            color: "text.secondary",
            "&:hover": { backgroundColor: "action.hover" },
          }}
        >
          {heading}
        </ButtonBase>
      )}

      <Box id={panelId}>
        {visible > 0 && (
          <OrderableValueList
            propertyUri={propertyUri}
            itemIds={visibleIds}
            isEditing={isEditing}
            onReorder={onReorder}
          >
            {children}
          </OrderableValueList>
        )}
        {!isEditing && !collapsed && hidden > 0 && (
          <Button
            size="small"
            onClick={() => view.setShown(propertyUri, showMoreTarget(visible))}
            sx={{ mb: 0.5, textTransform: "none" }}
          >
            {t("values.showMore", { count: Math.min(SHOW_MORE_STEP, hidden), left: hidden })}
          </Button>
        )}
      </Box>
    </>
  );
};

export default React.memo(PropertyValues);
