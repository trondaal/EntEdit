import React, { useCallback } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import { DragIndicator, ArrowUpward, ArrowDownward } from "@mui/icons-material";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "react-i18next";

interface SortableItemProps {
  id: string;
  index: number;
  total: number;
  isEditing: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  children: React.ReactNode;
}

const SortableItem: React.FC<SortableItemProps> = ({
  id,
  index,
  total,
  isEditing,
  onMoveUp,
  onMoveDown,
  children,
}) => {
  const { t } = useTranslation("entityEditor");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        mb: 0.5,
      }}
    >
      {isEditing && total > 1 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0 }}>
          <Tooltip title={t("tooltips.dragToReorder")}>
            <Box
              component="span"
              {...attributes}
              {...listeners}
              sx={{
                display: "flex",
                alignItems: "center",
                cursor: "grab",
                color: "text.disabled",
                "&:hover": { color: "text.secondary" },
                "&:active": { cursor: "grabbing" },
              }}
            >
              <DragIndicator sx={{ fontSize: "1.1rem" }} />
            </Box>
          </Tooltip>
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            <IconButton
              size="small"
              onClick={onMoveUp}
              disabled={index === 0}
              sx={{ p: 0, "& .MuiSvgIcon-root": { fontSize: "0.75rem" } }}
              aria-label={t("tooltips.moveUp")}
            >
              <ArrowUpward />
            </IconButton>
            <IconButton
              size="small"
              onClick={onMoveDown}
              disabled={index === total - 1}
              sx={{ p: 0, "& .MuiSvgIcon-root": { fontSize: "0.75rem" } }}
              aria-label={t("tooltips.moveDown")}
            >
              <ArrowDownward />
            </IconButton>
          </Box>
        </Box>
      )}
      <Box sx={{ flex: 1 }}>{children}</Box>
    </Box>
  );
};

interface OrderableValueListProps {
  propertyUri: string;
  itemIds: string[];
  isEditing: boolean;
  onReorder: (propertyUri: string, fromIndex: number, toIndex: number) => void;
  children: (index: number) => React.ReactNode;
}

const OrderableValueList: React.FC<OrderableValueListProps> = ({
  propertyUri,
  itemIds,
  isEditing,
  onReorder,
  children,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const fromIndex = itemIds.indexOf(String(active.id));
        const toIndex = itemIds.indexOf(String(over.id));
        if (fromIndex !== -1 && toIndex !== -1) {
          onReorder(propertyUri, fromIndex, toIndex);
        }
      }
    },
    [itemIds, onReorder, propertyUri],
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index > 0) onReorder(propertyUri, index, index - 1);
    },
    [onReorder, propertyUri],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index < itemIds.length - 1) onReorder(propertyUri, index, index + 1);
    },
    [onReorder, propertyUri, itemIds.length],
  );

  if (itemIds.length <= 1 || !isEditing) {
    // No reordering needed for single values or read-only mode
    return (
      <>
        {itemIds.map((_, index) => (
          <Box key={itemIds[index]} sx={{ mb: 0.5 }}>
            {children(index)}
          </Box>
        ))}
      </>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {itemIds.map((id, index) => (
          <SortableItem
            key={id}
            id={id}
            index={index}
            total={itemIds.length}
            isEditing={isEditing}
            onMoveUp={() => handleMoveUp(index)}
            onMoveDown={() => handleMoveDown(index)}
          >
            {children(index)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
};

export default React.memo(OrderableValueList);
