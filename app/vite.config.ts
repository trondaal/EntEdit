import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
