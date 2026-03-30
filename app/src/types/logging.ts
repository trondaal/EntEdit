/**
 * Interaction logging types for tracking student cataloguing behaviour.
 *
 * Events capture structural actions (created entity X, connected X→Y via property Z,
 * searched for "query") rather than literal content. This provides insight into
 * cataloguing workflow without capturing sensitive bibliographic content.
 */

export interface LogSession {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  endpointUrl: string;
  language: string;
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
}

export interface EntityDeletedEvent extends BaseEvent {
  type: "entity_deleted";
  entityUri: string;
  classUri: string;
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
}

export interface SearchPerformedEvent extends BaseEvent {
  type: "search_performed";
  query: string;
  mode: "expression" | "manifestation";
}

export interface SearchResultSelectedEvent extends BaseEvent {
  type: "search_result_selected";
  resultUri: string;
  query: string;
  mode: "expression" | "manifestation";
}

export interface TabSwitchedEvent extends BaseEvent {
  type: "tab_switched";
  tab: "entityBrowser" | "search";
}

export type LogEvent =
  | EntityCreatedEvent
  | EntitySavedEvent
  | EntityDeletedEvent
  | EntitySelectedEvent
  | ClassSelectedEvent
  | EditModeEnteredEvent
  | RelationshipAddedEvent
  | RelationshipRemovedEvent
  | SearchPerformedEvent
  | SearchResultSelectedEvent
  | TabSwitchedEvent;
