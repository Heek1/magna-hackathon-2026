import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Backend for the /api proxy. Locally it is :8000; inside docker compose set API_TARGET=http://backend:8000.
const apiTarget = process.env.API_TARGET ?? "http://localhost:8000";
const proxy = { "/api": { target: apiTarget, changeOrigin: true } };

export default defineConfig({
  plugins: [
    react(),
    // Installable app: add to the phone's home screen, opens without browser chrome.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "OEE Engine",
        short_name: "OEE Engine",
        description: "Which errors happen when, which cost the most, and how to fix them.",
        theme_color: "#F3F4F7",
        background_color: "#F3F4F7",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App shell only; live data (/api, including the SSE stream) always goes to the network.
        globPatterns: ["**/*.{js,css,html,png,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
