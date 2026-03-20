import React from "react";
import {
  MenuBook,
  Image,
  MusicNote,
  GraphicEq,
  RecordVoiceOver,
  Movie,
  Map,
  QueueMusic,
  Code,
  ViewInAr,
  TouchApp,
  Language,
  Computer,
  Headphones,
  Tv,
  Album,
  Description,
  ZoomIn,
  Category,
} from "@mui/icons-material";
import type { SvgIconProps } from "@mui/material";

/**
 * Maps RDA content type labels (English, lowercase) to MUI icons.
 * Used for expression-level search results.
 */
const contentTypeIconMap: Record<string, React.ComponentType<SvgIconProps>> = {
  "text": MenuBook,
  "still image": Image,
  "performed music": MusicNote,
  "sounds": GraphicEq,
  "spoken word": RecordVoiceOver,
  "moving image": Movie,
  "cartographic image": Map,
  "cartographic moving image": Map,
  "cartographic tactile image": Map,
  "cartographic three-dimensional form": Map,
  "cartographic dataset": Map,
  "notated music": QueueMusic,
  "notated movement": QueueMusic,
  "computer program": Code,
  "computer dataset": Code,
  "three-dimensional form": ViewInAr,
  "tactile text": TouchApp,
  "tactile image": TouchApp,
  "tactile notated music": TouchApp,
  "tactile notated movement": TouchApp,
  "tactile three-dimensional form": TouchApp,
};

/**
 * Maps RDA carrier type labels (English, lowercase) to MUI icons.
 * Used for manifestation-level search results.
 */
const carrierTypeIconMap: Record<string, React.ComponentType<SvgIconProps>> = {
  "volume": MenuBook,
  "online resource": Language,
  "computer disc": Computer,
  "computer chip cartridge": Computer,
  "audio disc": Album,
  "audio cartridge": Album,
  "audio roll": Album,
  "audio cylinder": Album,
  "audiocassette": Album,
  "audio cassette": Album,
  "sound-track reel": Album,
  "videodisc": Tv,
  "videocassette": Tv,
  "video cartridge": Tv,
  "film reel": Movie,
  "film roll": Movie,
  "filmstrip": Movie,
  "filmstrip cartridge": Movie,
  "filmslip": Movie,
  "sheet": Description,
  "card": Description,
  "flipchart": Description,
  "roll": Description,
  "object": ViewInAr,
  "microfilm reel": ZoomIn,
  "microfilm cartridge": ZoomIn,
  "microfilm cassette": ZoomIn,
  "microfilm slip": ZoomIn,
  "microfiche": ZoomIn,
  "microfiche cassette": ZoomIn,
  "microopaque": ZoomIn,
  "aperture card": ZoomIn,
  "overhead transparency": Image,
  "slide": Image,
  "stereograph card": Image,
  "stereograph disc": Image,
};

/**
 * Maps RDA media type labels (English, lowercase) to MUI icons.
 * Used as fallback when carrier type is not available.
 */
const mediaTypeIconMap: Record<string, React.ComponentType<SvgIconProps>> = {
  "unmediated": MenuBook,
  "computer": Computer,
  "audio": Headphones,
  "video": Tv,
  "microform": ZoomIn,
  "projected": Image,
  "microscopic": ZoomIn,
  "stereographic": Image,
};

/**
 * Returns an icon component for the given content type string.
 * Matches against the first semicolon-separated value (primary content type).
 */
export function getContentTypeIcon(
  contentType: string | undefined
): React.ComponentType<SvgIconProps> {
  if (!contentType) return Category;
  const primary = contentType.split(";")[0].trim().toLowerCase();
  return contentTypeIconMap[primary] ?? Category;
}

/**
 * Returns an icon component for the given carrier type or media type string.
 * Tries carrier type first, then falls back to media type.
 */
export function getCarrierTypeIcon(
  carrierType: string | undefined,
  mediaType?: string | undefined
): React.ComponentType<SvgIconProps> {
  if (carrierType) {
    const primary = carrierType.split("|")[0].split(";")[0].trim().toLowerCase();
    const icon = carrierTypeIconMap[primary];
    if (icon) return icon;
  }
  if (mediaType) {
    const primary = mediaType.split("|")[0].split(";")[0].trim().toLowerCase();
    const icon = mediaTypeIconMap[primary];
    if (icon) return icon;
  }
  return Category;
}

/**
 * Common sx props for content/carrier type icons used as leading indicators
 * in search result titles.
 */
export const typeIconSx = {
  fontSize: "1.25rem",
  color: "text.secondary",
  mr: 1,
  mt: "2px",
  flexShrink: 0,
} as const;

/**
 * Smaller sx props for nested/indented result icons.
 */
export const typeIconSmallSx = {
  fontSize: "1.125rem",
  color: "text.disabled",
  mr: 1,
  mt: "1px",
  flexShrink: 0,
} as const;
