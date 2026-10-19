/**
 * Interaction logging types for tracking student cataloguing behaviour.
 *
 * Events capture structural actions (created entity X, connected X→Y via property Z,
 * searched for "query") rather than literal content. This provides insight into
 * cataloguing workflow without capturing sensitive bibliographic content.
 */

/**
 * What a reader of the log needs to interpret it: which build produced it and
 * how the application was set up (cataloguing style, display settings), since
 * the same action looks different with identifiers hidden or shown.
 */
export interface SessionContext {
  appVersion: string;
  preferences: Record<string, boolean | string>;
}

export interface LogSession {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  endpointUrl: string;
  language: string;
  /** Absent in logs recorded before it was added. */
  context?: SessionContext;
  events: LogEvent[];
}

interface BaseEvent {
  timestamp: string;
  sequenceNumber: number;
}

export interface EntityCreatedEvent extends BaseEvent {
  type: "entity_created";
  classUri: string;
  entityUri: string;
}

export interface EntitySavedEvent extends BaseEvent {
  type: "entity_saved";
  entityUri: string;
  classUri: string;
  isNew: boolean;
  /** Properties the save wrote (URIs only, never the values); absent in older logs. */
  properties?: string[];
}

export interface EntitySaveFailedEvent extends BaseEvent {
  type: "entity_save_failed";
  /** The entity being saved; null for a new one whose identifier was not yet chosen. */
  entityUri: string | null;
  classUri: string;
  isNew: boolean;
  /** uri_in_use: the identifier is taken; conflict: someone else changed it; error: the write failed. */
  reason: "uri_in_use" | "conflict" | "error";
  /** Error code of a failed write, when the server gave one. */
  code?: string;
  /** Properties someone else had changed, for a conflict. */
  properties?: string[];
}

export interface EntityDeletedEvent extends BaseEvent {
  type: "entity_deleted";
  entityUri: string;
  classUri: string;
}

export interface EntityDeleteFailedEvent extends BaseEvent {
  type: "entity_delete_failed";
  entityUri: string;
  classUri: string;
  code?: string;
}

export interface EntitySelectedEvent extends BaseEvent {
  type: "entity_selected";
  entityUri: string;
  classUri: string;
  source: "browser" | "search";
}

export interface ClassSelectedEvent extends BaseEvent {
  type: "class_selected";
  classUri: string;
}

export interface EditModeEnteredEvent extends BaseEvent {
  type: "edit_mode_entered";
  entityUri: string | null;
  classUri: string;
}

export interface EditCancelledEvent extends BaseEvent {
  type: "edit_cancelled";
  entityUri: string | null;
  classUri: string;
  /** Whether unsaved changes were thrown away. */
  hadChanges: boolean;
}

/**
 * A change to a property that is not a relationship: a row added or removed, values
 * reordered (relationships too), a value's language set, the labels saved. The values
 * themselves are never recorded.
 */
export interface PropertyEditedEvent extends BaseEvent {
  type: "property_edited";
  entityUri: string | null;
  classUri: string;
  propertyUri: string;
  action: "added" | "removed" | "reordered" | "language_changed" | "labels_changed";
}

export interface RelationshipAddedEvent extends BaseEvent {
  type: "relationship_added";
  sourceEntityUri: string;
  propertyUri: string;
  targetEntityUri: string;
  section: string;
}

export interface RelationshipRemovedEvent extends BaseEvent {
  type: "relationship_removed";
  sourceEntityUri: string;
  propertyUri: string;
  targetEntityUri: string;
  section: string;
  /** The link was one the database inferred (stated from the other side) rather than stored here. */
  inferred?: boolean;
}

/** Search tab an event happened in: publications, content or works. */
export type SearchMode = "manifestation" | "expression" | "work";

export interface SearchPerformedEvent extends BaseEvent {
  type: "search_performed";
  query: string;
  mode: SearchMode;
}

export interface SearchFilterChangedEvent extends BaseEvent {
  type: "search_filter_changed";
  /** Index field: mediaType, carrierType, language, contentType, workType or genre */
  field: string;
  /** Category IRI */
  value: string;
  selected: boolean;
  query: string;
  mode: SearchMode;
}

export interface SearchLinkFollowedEvent extends BaseEvent {
  type: "search_link_followed";
  /** Name or title that was clicked, now the search text */
  label: string;
  uri?: string;
  kind?: "expression" | "work" | "agent";
  mode: SearchMode;
}

export interface SearchModeChangedEvent extends BaseEvent {
  type: "search_mode_changed";
  from: SearchMode;
  to: SearchMode;
  /** The search text, which now runs against the other index. */
  query: string;
}

export interface SearchLinkClearedEvent extends BaseEvent {
  type: "search_link_cleared";
  /** The link's label, as shown on its chip. */
  label: string;
  uri?: string;
  kind?: "expression" | "work" | "agent";
  mode: SearchMode;
}

/** Something opened inside a search result: the part that loads more of the entity. */
export interface SearchResultExpandedEvent extends BaseEvent {
  type: "search_result_expanded";
  /**
   * expressions: a work's expressions; publications: an expression's publications;
   * contents: a publication's contents; relationships: a collapsed relationship's
   * targets; note: a publication's whole note
   */
  section: "expressions" | "publications" | "contents" | "relationships" | "note";
  /** The work, expression or publication opened (the one holding the collapsed relationship). */
  uri?: string;
  /** The collapsed relationship's property, for `relationships`. */
  property?: string;
}

export interface SearchFiltersClearedEvent extends BaseEvent {
  type: "search_filters_cleared";
  query: string;
  mode: SearchMode;
}

export interface SearchResultSelectedEvent extends BaseEvent {
  type: "search_result_selected";
  resultUri: string;
  query: string;
  mode: SearchMode;
}

export interface TabSwitchedEvent extends BaseEvent {
  type: "tab_switched";
  tab: "entityBrowser" | "search";
}

export interface DataImportedEvent extends BaseEvent {
  type: "data_imported";
  success: boolean;
  /** File extension, e.g. ".ttl"; the file name is not recorded. */
  format: string;
  sizeBytes: number;
  graph: string;
}

/** The graph visualization opened for an entity, in the GraphDB Workbench. */
export interface GraphVisualizationOpenedEvent extends BaseEvent {
  type: "graph_visualization_opened";
  entityUri: string;
  /** The editor's entity menu, or a search result's graph icon. */
  source: "editor" | "search";
}

export interface DataRefreshedEvent extends BaseEvent {
  type: "data_refreshed";
  savedFirst: boolean;
  discardedEdits: boolean;
}

/** A setting changed: the language, a cataloguing or display preference, the endpoint. */
export interface SettingChangedEvent extends BaseEvent {
  type: "setting_changed";
  setting: string;
  /** The new value; "changed" for the endpoint and data graph, whose addresses are not recorded. */
  value: string | boolean;
}

export type LogEvent =
  | EntityCreatedEvent
  | EntitySavedEvent
  | EntitySaveFailedEvent
  | EntityDeletedEvent
  | EntityDeleteFailedEvent
  | EntitySelectedEvent
  | ClassSelectedEvent
  | EditModeEnteredEvent
  | EditCancelledEvent
  | PropertyEditedEvent
  | RelationshipAddedEvent
  | RelationshipRemovedEvent
  | SearchPerformedEvent
  | SearchModeChangedEvent
  | SearchFilterChangedEvent
  | SearchFiltersClearedEvent
  | SearchLinkFollowedEvent
  | SearchLinkClearedEvent
  | SearchResultSelectedEvent
  | SearchResultExpandedEvent
  | DataImportedEvent
  | GraphVisualizationOpenedEvent
  | DataRefreshedEvent
  | SettingChangedEvent
  | TabSwitchedEvent;

export type LogEventInput = {
  [K in LogEvent["type"]]: Omit<Extract<LogEvent, { type: K }>, "timestamp" | "sequenceNumber">;
}[LogEvent["type"]];
