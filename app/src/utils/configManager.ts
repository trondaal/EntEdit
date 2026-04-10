import type { SparqlEndpointConfig } from "../types/sparql";
import { SUPPORTED_LANGUAGES } from "./sparqlFragments";

const CONFIG_STORAGE_KEY = "entEdit.config";
const CREDENTIALS_STORAGE_KEY = "entEdit.credentials";
const LANGUAGE_STORAGE_KEY = "entEdit.language";
const PREFERENCES_STORAGE_KEY = "entEdit.preferences";
const DEFAULT_LANGUAGE = "en";

/** Validate that a language value is one of the supported languages */
const validateLanguage = (language: string | null): string =>
  language && (SUPPORTED_LANGUAGES as readonly string[]).includes(language)
    ? language
    : DEFAULT_LANGUAGE;

export interface AppConfiguration {
  endpoint: SparqlEndpointConfig;
  language: string;
  isConfigured: boolean;
  warnAutoUri: boolean;
  warnAutoLabel: boolean;
}

/**
 * Save configuration.
 * URL and language persist in localStorage across sessions.
 * Credentials (username/password) are stored in sessionStorage and
 * cleared automatically when the browser tab is closed.
 */
export const saveConfiguration = (
  config: SparqlEndpointConfig,
  language: string,
  preferences?: { warnAutoUri: boolean; warnAutoLabel: boolean },
): void => {
  try {
    // Persist non-sensitive settings in localStorage
    localStorage.setItem(
      CONFIG_STORAGE_KEY,
      JSON.stringify({ url: config.url }),
    );
    localStorage.setItem(LANGUAGE_STORAGE_KEY, validateLanguage(language));

    // Persist user preferences in localStorage
    if (preferences) {
      localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify(preferences),
      );
    }

    // Store credentials in sessionStorage (cleared on tab close)
    if (config.username || config.password) {
      sessionStorage.setItem(
        CREDENTIALS_STORAGE_KEY,
        JSON.stringify({
          username: config.username || "",
          password: config.password || "",
        }),
      );
    } else {
      sessionStorage.removeItem(CREDENTIALS_STORAGE_KEY);
    }
  } catch (error) {
    console.warn("Failed to save configuration:", error);
  }
};

/**
 * Load configuration.
 * Merges the persisted URL from localStorage with credentials from sessionStorage.
 */
export const loadConfiguration = (): AppConfiguration | null => {
  try {
    const configStr = localStorage.getItem(CONFIG_STORAGE_KEY);
    const language = localStorage.getItem(LANGUAGE_STORAGE_KEY);

    if (!configStr) {
      return null;
    }

    const config = JSON.parse(configStr) as {
      url: string;
      username?: string;
      password?: string;
    };

    // Validate that we have at least a URL
    if (!config.url) {
      return null;
    }

    // Migrate: if old localStorage config contains credentials, move them to
    // sessionStorage and strip them from localStorage
    if (config.username || config.password) {
      sessionStorage.setItem(
        CREDENTIALS_STORAGE_KEY,
        JSON.stringify({
          username: config.username || "",
          password: config.password || "",
        }),
      );
      localStorage.setItem(
        CONFIG_STORAGE_KEY,
        JSON.stringify({ url: config.url }),
      );
    }

    // Load credentials from sessionStorage
    let username = "";
    let password = "";
    const credentialsStr = sessionStorage.getItem(CREDENTIALS_STORAGE_KEY);
    if (credentialsStr) {
      const credentials = JSON.parse(credentialsStr) as {
        username: string;
        password: string;
      };
      username = credentials.username || "";
      password = credentials.password || "";
    }

    // Load user preferences from localStorage (default to true)
    let warnAutoUri = false;
    let warnAutoLabel = false;
    const preferencesStr = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (preferencesStr) {
      const preferences = JSON.parse(preferencesStr) as {
        warnAutoUri?: boolean;
        warnAutoLabel?: boolean;
      };
      warnAutoUri = preferences.warnAutoUri === true;
      warnAutoLabel = preferences.warnAutoLabel === true;
    }

    return {
      endpoint: {
        url: config.url,
        username,
        password,
      },
      language: validateLanguage(language),
      isConfigured: true,
      warnAutoUri,
      warnAutoLabel,
    };
  } catch (error) {
    console.warn("Failed to load configuration:", error);
    return null;
  }
};

/**
 * Clear stored configuration
 */
export const clearConfiguration = (): void => {
  try {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    localStorage.removeItem(PREFERENCES_STORAGE_KEY);
    sessionStorage.removeItem(CREDENTIALS_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear configuration:", error);
  }
};

/**
 * Check if the application is properly configured
 */
export const isConfigured = (): boolean => {
  const config = loadConfiguration();
  return config?.isConfigured === true && !!config.endpoint.url;
};

/**
 * Get default configuration for first-time setup
 */
export const getDefaultConfiguration = (): AppConfiguration => {
  return {
    endpoint: {
      url: "http://localhost/graphdb/repositories/EntEdit",
      username: "",
      password: "",
    },
    language: "en",
    isConfigured: false,
    warnAutoUri: false,
    warnAutoLabel: false,
  };
};
