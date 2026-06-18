import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// LIQO Sales Assistant PWA — tablet-first, installable on Android + iOS,
// full-screen kiosk, offline app-shell. The pure engine is aliased so the
// app can run recommendations client-side in offline/demo mode.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png", "icons/*.svg"],
      manifest: {
        name: "LIQO Sales Assistant",
        short_name: "LIQO",
        description: "In-store product recommendations — Good, Better, Best.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "fullscreen",
        display_override: ["fullscreen", "standalone", "minimal-ui"],
        orientation: "any",
        background_color: "#1F3864",
        theme_color: "#1F3864",
        categories: ["shopping", "business"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            // App-shell data: stale-while-revalidate so it works offline.
            urlPattern: ({ url }) => /\/(questionnaire|config|stores|sample-inventory)\.json$/.test(url.pathname),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "liqo-data" }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: { cacheName: "liqo-api", networkTimeoutSeconds: 3 }
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: { cacheName: "liqo-fonts", expiration: { maxEntries: 20 } }
          }
        ]
      },
      devOptions: { enabled: false }
    })
  ],
  resolve: {
    alias: {
      "@engine": fileURLToPath(new URL("../src/engine", import.meta.url))
    }
  },
  // App uses plain CSS. Pin an empty PostCSS config so the build never walks up
  // to the legacy AiEZ postcss.config.mjs at the repo root.
  css: { postcss: {} },
  server: { host: true, port: 5173 }
});
