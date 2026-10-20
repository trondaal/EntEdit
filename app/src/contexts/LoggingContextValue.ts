import { createContext } from "react";
import type { LogSession, LogEventInput, SessionContext } from "../types/logging";

/**
 * The context object and its value type, apart from the provider component: a file
 * that exports a component and anything else cannot be hot-reloaded by fast refresh.
 */
export interface LoggingContextValue {
  isRecording: boolean;
  sessionDuration: number;
  startSession: (endpointUrl: string, language: string, context?: SessionContext) => void;
  stopSession: () => LogSession | null;
  logEvent: (event: LogEventInput) => void;
  getSession: () => LogSession | null;
  hasOrphanedSession: () => boolean;
  recoverOrphanedSession: () => LogSession | null;
  discardOrphanedSession: () => void;
}

export const LoggingContext = createContext<LoggingContextValue | null>(null);
