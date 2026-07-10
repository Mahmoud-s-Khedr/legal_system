import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => {
  const defaultBackendUrl = `http://127.0.0.1:${process.env.BACKEND_PORT ?? 7854}`;

  return {
    base: "/",
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["fonts/**/*"],
        manifest: {
          name: "ELMS – Egyptian Legal Management System",
          short_name: "ELMS",
          description: "Legal practice management for Egyptian law firms",
          theme_color: "#1d4ed8",
          background_color: "#f8f7f4",
          display: "standalone",
          start_url: "/app/dashboard",
          icons: [
            {
              src: "/icons/icon-192.png",
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: "/icons/icon-512.png",
              sizes: "512x512",
              type: "image/png"
            },
            {
              src: "/icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable"
            }
          ]
        },
        workbox: {
          // CI currently emits a main app chunk slightly above 3 MiB.
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^\/api\//,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                networkTimeoutSeconds: 5,
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes("/i18n/locales/ar/")) {
              return "locale-ar";
            }

            if (id.includes("/i18n/locales/fr/")) {
              return "locale-fr";
            }

            if (id.includes("node_modules/pdfjs-dist")) {
              return "vendor-pdf";
            }
          }
        }
      }
    },
    server: {
      host: "0.0.0.0",
      port: Number(process.env.FRONTEND_PORT ?? 5173),
      proxy: {
        "/api": {
          target: process.env.BACKEND_URL ?? defaultBackendUrl,
          changeOrigin: true
        }
      }
    }
  };
});
