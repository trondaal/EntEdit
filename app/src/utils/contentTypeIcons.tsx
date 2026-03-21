import React from "react";
import {
  // Content type icons (symbolic — represent the nature of the content)
  Article,           // text
  Brush,             // still image
  MusicNote,         // performed music
  Hearing,           // sounds
  Mic,               // spoken word
  Theaters,          // moving image
  DirectionsRun,     // performed/notated movement
  Public,            // cartographic
  QueueMusic,        // notated music
  DataObject,        // computer program
  Storage,           // computer dataset
  ThreeDRotation,    // three-dimensional form
  TouchApp,          // tactile
  // Carrier type icons (literal — represent the physical medium)
  MenuBook,
  Language,
  Computer,
  Album,
  Tv,
  Movie,
  Description,
  ViewInAr,
  ZoomIn,
  Image,
  // Media type icons
  Headphones,
  // Fallback
  Category,
} from "@mui/icons-material";
import type { SvgIconProps } from "@mui/material";

/**
 * Maps RDA content type URIs to symbolic MUI icons.
 * These represent the abstract nature of the content (text, sound, image, etc.)
 * rather than any physical form.
 * @see http://rdaregistry.info/termList/RDAContentType/
 */
const contentTypeIconMap: Record<string, React.ComponentType<SvgIconProps>> = {
  "http://rdaregistry.info/termList/RDAContentType/1020": Article,          // text
  "http://rdaregistry.info/termList/RDAContentType/1014": Brush,            // still image
  "http://rdaregistry.info/termList/RDAContentType/1011": MusicNote,        // performed music
  "http://rdaregistry.info/termList/RDAContentType/1012": Hearing,          // sounds
  "http://rdaregistry.info/termList/RDAContentType/1013": Mic,              // spoken word
  "http://rdaregistry.info/termList/RDAContentType/1023": Theaters,         // two-dimensional moving image
  "http://rdaregistry.info/termList/RDAContentType/1022": Theaters,         // three-dimensional moving image
  "http://rdaregistry.info/termList/RDAContentType/1024": DirectionsRun,    // performed movement
  "http://rdaregistry.info/termList/RDAContentType/1002": Public,           // cartographic image
  "http://rdaregistry.info/termList/RDAContentType/1003": Public,           // cartographic moving image
  "http://rdaregistry.info/termList/RDAContentType/1004": Public,           // cartographic tactile image
  "http://rdaregistry.info/termList/RDAContentType/1005": Public,           // cartographic tactile three-dimensional form
  "http://rdaregistry.info/termList/RDAContentType/1006": Public,           // cartographic three-dimensional form
  "http://rdaregistry.info/termList/RDAContentType/1001": Public,           // cartographic dataset
  "http://rdaregistry.info/termList/RDAContentType/1010": QueueMusic,       // notated music
  "http://rdaregistry.info/termList/RDAContentType/1009": DirectionsRun,    // notated movement
  "http://rdaregistry.info/termList/RDAContentType/1008": DataObject,       // computer program
  "http://rdaregistry.info/termList/RDAContentType/1007": Storage,          // computer dataset
  "http://rdaregistry.info/termList/RDAContentType/1021": ThreeDRotation,   // three-dimensional form
  "http://rdaregistry.info/termList/RDAContentType/1018": TouchApp,         // tactile text
  "http://rdaregistry.info/termList/RDAContentType/1015": TouchApp,         // tactile image
  "http://rdaregistry.info/termList/RDAContentType/1016": TouchApp,         // tactile notated music
  "http://rdaregistry.info/termList/RDAContentType/1017": TouchApp,         // tactile notated movement
  "http://rdaregistry.info/termList/RDAContentType/1019": TouchApp,         // tactile three-dimensional form
};

/**
 * Maps RDA carrier type URIs to MUI icons.
 * Used for manifestation-level search results.
 * @see http://rdaregistry.info/termList/RDACarrierType/
 */
const carrierTypeIconMap: Record<string, React.ComponentType<SvgIconProps>> = {
  "http://rdaregistry.info/termList/RDACarrierType/1049": MenuBook,    // volume
  "http://rdaregistry.info/termList/RDACarrierType/1018": Language,    // online resource
  "http://rdaregistry.info/termList/RDACarrierType/1013": Computer,    // computer disc
  "http://rdaregistry.info/termList/RDACarrierType/1014": Computer,    // computer disc cartridge
  "http://rdaregistry.info/termList/RDACarrierType/1012": Computer,    // computer chip cartridge
  "http://rdaregistry.info/termList/RDACarrierType/1011": Computer,    // computer card
  "http://rdaregistry.info/termList/RDACarrierType/1015": Computer,    // computer tape cartridge
  "http://rdaregistry.info/termList/RDACarrierType/1016": Computer,    // computer tape cassette
  "http://rdaregistry.info/termList/RDACarrierType/1017": Computer,    // computer tape reel
  "http://rdaregistry.info/termList/RDACarrierType/1004": Album,       // audio disc
  "http://rdaregistry.info/termList/RDACarrierType/1002": Album,       // audio cartridge
  "http://rdaregistry.info/termList/RDACarrierType/1006": Album,       // audio roll
  "http://rdaregistry.info/termList/RDACarrierType/1003": Album,       // audio cylinder
  "http://rdaregistry.info/termList/RDACarrierType/1007": Album,       // audiocassette
  "http://rdaregistry.info/termList/RDACarrierType/1008": Album,       // audiotape reel
  "http://rdaregistry.info/termList/RDACarrierType/1005": Album,       // sound-track reel
  "http://rdaregistry.info/termList/RDACarrierType/1070": Album,       // audio belt
  "http://rdaregistry.info/termList/RDACarrierType/1071": Album,       // audio wire reel
  "http://rdaregistry.info/termList/RDACarrierType/1060": Tv,          // videodisc
  "http://rdaregistry.info/termList/RDACarrierType/1052": Tv,          // videocassette
  "http://rdaregistry.info/termList/RDACarrierType/1051": Tv,          // video cartridge
  "http://rdaregistry.info/termList/RDACarrierType/1053": Tv,          // videotape reel
  "http://rdaregistry.info/termList/RDACarrierType/1034": Movie,       // film reel
  "http://rdaregistry.info/termList/RDACarrierType/1069": Movie,       // film roll
  "http://rdaregistry.info/termList/RDACarrierType/1036": Movie,       // filmstrip
  "http://rdaregistry.info/termList/RDACarrierType/1037": Movie,       // filmstrip cartridge
  "http://rdaregistry.info/termList/RDACarrierType/1035": Movie,       // filmslip
  "http://rdaregistry.info/termList/RDACarrierType/1032": Movie,       // film cartridge
  "http://rdaregistry.info/termList/RDACarrierType/1033": Movie,       // film cassette
  "http://rdaregistry.info/termList/RDACarrierType/1048": Description, // sheet
  "http://rdaregistry.info/termList/RDACarrierType/1045": Description, // card
  "http://rdaregistry.info/termList/RDACarrierType/1046": Description, // flipchart
  "http://rdaregistry.info/termList/RDACarrierType/1047": Description, // roll
  "http://rdaregistry.info/termList/RDACarrierType/1059": ViewInAr,    // object
  "http://rdaregistry.info/termList/RDACarrierType/1026": ZoomIn,      // microfilm reel
  "http://rdaregistry.info/termList/RDACarrierType/1024": ZoomIn,      // microfilm cartridge
  "http://rdaregistry.info/termList/RDACarrierType/1025": ZoomIn,      // microfilm cassette
  "http://rdaregistry.info/termList/RDACarrierType/1027": ZoomIn,      // microfilm slip
  "http://rdaregistry.info/termList/RDACarrierType/1056": ZoomIn,      // microfilm roll
  "http://rdaregistry.info/termList/RDACarrierType/1022": ZoomIn,      // microfiche
  "http://rdaregistry.info/termList/RDACarrierType/1023": ZoomIn,      // microfiche cassette
  "http://rdaregistry.info/termList/RDACarrierType/1028": ZoomIn,      // microopaque
  "http://rdaregistry.info/termList/RDACarrierType/1021": ZoomIn,      // aperture card
  "http://rdaregistry.info/termList/RDACarrierType/1030": ZoomIn,      // microscope slide
  "http://rdaregistry.info/termList/RDACarrierType/1039": Image,       // overhead transparency
  "http://rdaregistry.info/termList/RDACarrierType/1040": Image,       // slide
  "http://rdaregistry.info/termList/RDACarrierType/1042": Image,       // stereograph card
  "http://rdaregistry.info/termList/RDACarrierType/1043": Image,       // stereograph disc
};

/**
 * Maps RDA media type URIs to MUI icons.
 * Used as fallback when carrier type is not available.
 * @see http://rdaregistry.info/termList/RDAMediaType/
 */
const mediaTypeIconMap: Record<string, React.ComponentType<SvgIconProps>> = {
  "http://rdaregistry.info/termList/RDAMediaType/1007": MenuBook,  // unmediated
  "http://rdaregistry.info/termList/RDAMediaType/1003": Computer,  // computer
  "http://rdaregistry.info/termList/RDAMediaType/1001": Headphones, // audio
  "http://rdaregistry.info/termList/RDAMediaType/1008": Tv,        // video
  "http://rdaregistry.info/termList/RDAMediaType/1002": ZoomIn,    // microform
  "http://rdaregistry.info/termList/RDAMediaType/1005": Image,     // projected
  "http://rdaregistry.info/termList/RDAMediaType/1004": ZoomIn,    // microscopic
  "http://rdaregistry.info/termList/RDAMediaType/1006": Image,     // stereographic
};

/**
 * Returns an icon component for the given content type URI.
 * Matches against the first semicolon-separated value (primary content type).
 */
export function getContentTypeIcon(
  contentTypeUri: string | undefined
): React.ComponentType<SvgIconProps> {
  if (!contentTypeUri) return Category;
  const primary = contentTypeUri.split(";")[0].trim();
  return contentTypeIconMap[primary] ?? Category;
}

/**
 * Returns an icon component for the given carrier type or media type URI.
 * Tries carrier type first, then falls back to media type.
 */
export function getCarrierTypeIcon(
  carrierTypeUri: string | undefined,
  mediaTypeUri?: string | undefined
): React.ComponentType<SvgIconProps> {
  if (carrierTypeUri) {
    const primary = carrierTypeUri.split("|")[0].split(";")[0].trim();
    const icon = carrierTypeIconMap[primary];
    if (icon) return icon;
  }
  if (mediaTypeUri) {
    const primary = mediaTypeUri.split("|")[0].split(";")[0].trim();
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
