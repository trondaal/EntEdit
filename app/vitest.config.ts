import { defineConfig } from "vitest/config";

// Standalone Vitest config (does not load vite.config.ts / the React plugin).
// The current suite covers pure utility modules and the network client, none
// of which need a DOM, so the default `node` environment is sufficient.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
