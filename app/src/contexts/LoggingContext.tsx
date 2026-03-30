import React, { createContext, useRef, useState, useCallback, useEffect } from "react";
import type { LogSession, LogEventInput } from "../types/logging";

const SESSION_STORAGE_KEY = "entEdit.activeLogSession";

interface LoggingContextValue {
  isRecording: boolean;
  sessionDuration: number;
  startSession: (endpointUrl: string, language: string) => void;
  stopSession: () => LogSession | null;
  logEvent: (event: LogEventInput) => void;
  getSession: () => LogSession | null;
  hasOrphanedSession: () => boolean;
  recoverOrphanedSession: () => LogSession | null;
  discardOrphanedSession: () => void;
}

export const LoggingContext = createContext<LoggingContextValue | null>(null);

export const LoggingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const sessionRef = useRef<LogSession | null>(null);
  const sequenceRef = useRef(0);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backupRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (backupRef.current) clearInterval(backupRef.current);
    };
  }, []);

  const startSession = useCallback((endpointUrl: string, language: string) => {
    const session: LogSession = {
      sessionId: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      endedAt: null,
      endpointUrl,
      language,
      events: [],
    };
    sessionRef.current = session;
    sequenceRef.current = 0;
    setIsRecording(true);
    setSessionDuration(0);

    // Duration timer (updates every second)
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    // Backup to sessionStorage every 30 seconds
    backupRef.current = setInterval(() => {
      if (sessionRef.current) {
        try {
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionRef.current));
        } catch {
          // sessionStorage full or unavailable — silently ignore
        }
      }
    }, 30000);

    // Immediate backup
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // ignore
    }
  }, []);

  const stopSession = useCallback((): LogSession | null => {
    if (!sessionRef.current) return null;

    sessionRef.current.endedAt = new Date().toISOString();
    const session = { ...sessionRef.current, events: [...sessionRef.current.events] };

    // Clean up
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (backupRef.current) {
      clearInterval(backupRef.current);
      backupRef.current = null;
    }
    sessionRef.current = null;
    sequenceRef.current = 0;
    setIsRecording(false);
    setSessionDuration(0);

    // Remove backup
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }

    return session;
  }, []);

  const logEvent = useCallback((event: LogEventInput) => {
    if (!sessionRef.current) return;

    const fullEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      sequenceNumber: ++sequenceRef.current,
    } as LogEventInput & { timestamp: string; sequenceNumber: number };

    sessionRef.current.events.push(fullEvent);
  }, []);

  const getSession = useCallback((): LogSession | null => {
    return sessionRef.current;
  }, []);

  const hasOrphanedSession = useCallback((): boolean => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      return stored !== null;
    } catch {
      return false;
    }
  }, []);

  const recoverOrphanedSession = useCallback((): LogSession | null => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;
      const session = JSON.parse(stored) as LogSession;
      session.endedAt = new Date().toISOString();
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return session;
    } catch {
      return null;
    }
  }, []);

  const discardOrphanedSession = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return (
    <LoggingContext.Provider
      value={{
        isRecording,
        sessionDuration,
        startSession,
        stopSession,
        logEvent,
        getSession,
        hasOrphanedSession,
        recoverOrphanedSession,
        discardOrphanedSession,
      }}
    >
      {children}
    </LoggingContext.Provider>
  );
};
