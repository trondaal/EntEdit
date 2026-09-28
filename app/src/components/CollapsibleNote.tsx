import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Box, Link, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

/** Lines a collapsed note may take, the "show the whole note" link included. */
const COLLAPSED_LINES = 2;

interface CollapsibleNoteProps {
  text: string;
}

/**
 * A note shown in at most two lines. A longer note is cut at a word so that
 * the text, an ellipsis and a "show the whole note" link fit in those two
 * lines; the link expands it in place.
 *
 * CSS line clamping cannot keep the link inside the clamped lines, so the
 * cut is measured: a hidden copy with the same width and type is filled with
 * ever shorter prefixes (binary search) until it fits. It is measured again
 * whenever the width changes.
 */
const CollapsibleNote: React.FC<CollapsibleNoteProps> = ({ text }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  /** Characters shown while collapsed; null when the whole note fits. */
  const [cut, setCut] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const probeTextRef = useRef<HTMLSpanElement>(null);
  const probeMoreRef = useRef<HTMLSpanElement>(null);

  const measure = useCallback(() => {
    const probe = probeRef.current;
    const probeText = probeTextRef.current;
    const probeMore = probeMoreRef.current;
    if (!probe || !probeText || !probeMore) return;
    const lineHeight = parseFloat(getComputedStyle(probe).lineHeight);
    const maxHeight = lineHeight * COLLAPSED_LINES + 1;
    const fits = (length: number | null) => {
      probeText.textContent = length === null ? text : `${text.slice(0, length).trimEnd()}… `;
      probeMore.hidden = length === null;
      return probe.getBoundingClientRect().height <= maxHeight;
    };

    if (fits(null)) {
      setCut(null);
      return;
    }
    let low = 0;
    let high = text.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (fits(mid)) low = mid;
      else high = mid - 1;
    }
    // Break at the last space, unless that would throw away most of the line
    const space = text.lastIndexOf(" ", low);
    setCut(space > low * 0.8 ? space : low);
  }, [text]);

  useLayoutEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    return () => observer.disconnect();
  }, [measure]);

  const toggle = (e: React.MouseEvent) => {
    // The note sits inside a clickable search result
    e.stopPropagation();
    setExpanded((value) => !value);
  };

  const linkLabel = expanded ? t("search.showLessOfNote") : t("search.showWholeNote");
  const collapsed = cut !== null && !expanded;

  return (
    <Box ref={containerRef} sx={{ position: "relative" }}>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.4 }}>
        {collapsed ? `${text.slice(0, cut).trimEnd()}… ` : text}
        {cut !== null && (
          <>
            {expanded && " "}
            <Link
              component="button"
              variant="caption"
              onClick={toggle}
              aria-expanded={expanded}
              sx={{ verticalAlign: "baseline", lineHeight: "inherit" }}
            >
              {linkLabel}
            </Link>
          </>
        )}
      </Typography>

      {/* Hidden copy used to find the cut; same width and type as the note */}
      <Typography
        variant="caption"
        component="span"
        aria-hidden
        ref={probeRef}
        sx={{
          lineHeight: 1.4,
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        <span ref={probeTextRef} />
        <span ref={probeMoreRef}>{t("search.showWholeNote")}</span>
      </Typography>
    </Box>
  );
};

export default CollapsibleNote;
