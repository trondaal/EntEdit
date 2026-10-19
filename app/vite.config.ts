import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The build the interaction log says it was recorded with
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    chunkSizeWarningLimit: 600,
  },
  base: "/entedit/", // Set this to your subfolder name
  server: {
    proxy: {
      "/graphdb": {
        target: "http://localhost:7200",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/graphdb/, ""),
      },
    },
  },
});
