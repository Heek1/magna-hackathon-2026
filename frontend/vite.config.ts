import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Backend for the /api proxy. Locally it is :8000; inside docker compose set API_TARGET=http://backend:8000.
const apiTarget = process.env.API_TARGET ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: { "/api": { target: apiTarget, changeOrigin: true } },
  },
});
