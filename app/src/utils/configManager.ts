import type { SparqlEndpointConfig } from "../types/sparql";

const CONFIG_STORAGE_KEY = "entEdit.config";
const LANGUAGE_STORAGE_KEY = "entEdit.language";

export interface AppConfiguration {
  endpoint: SparqlEndpointConfig;
  language: string;
  isConfigured: boolean;
}

/**
 * Save configuration to localStorage
 */
export const saveConfiguration = (
  config: SparqlEndpointConfig,
  language: string,
): void => {
  try {
    const configToSave = {
      url: config.url,
      username: config.username || undefined,
      password: config.password || undefined,
    };

    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configToSave));
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    console.warn("Failed to save configuration to localStorage:", error);
  }
};

/**
 * Load configuration from localStorage
 */
export const loadConfiguration = (): AppConfiguration | null => {
  try {
    const configStr = localStorage.getItem(CONFIG_STORAGE_KEY);
    const language = localStorage.getItem(LANGUAGE_STORAGE_KEY);

    if (!configStr) {
      return null;
    }

    const config = JSON.parse(configStr) as SparqlEndpointConfig;

    // Validate that we have at least a URL
    if (!config.url) {
      return null;
    }

    return {
      endpoint: config,
      language: language || "en",
      isConfigured: true,
    };
  } catch (error) {
    console.warn("Failed to load configuration from localStorage:", error);
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
  } catch (error) {
    console.warn("Failed to clear configuration from localStorage:", error);
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
  };
};
