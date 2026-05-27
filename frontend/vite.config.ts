import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Backend FastAPI roda em :8000. Em dev, fazemos proxy de /api e /ranges.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/ranges": "http://localhost:8000",
    },
  },
  build: {
    // Servido pelo FastAPI a partir de frontend/dist
    outDir: "dist",
    emptyOutDir: true,
  },
});
