import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => {
  const isDesktopShell = process.env.VITE_DESKTOP_SHELL === "true";
  const disableWorkspaceIsolation =
    /^(1|true|yes|on)$/i.test(process.env.ELMS_DISABLE_WORKSPACE_DEV_ISOLATION ?? "");
  const defaultDesktopBackendUrl = disableWorkspaceIsolation
    ? "http://127.0.0.1:7854"
    : "http://127.0.0.1:17854";

  return {
    base: isDesktopShell ? "./" : "/",
    plugins: [
      react(),
      // Desktop Tauri builds do not need PWA/service worker behavior.
      ...(isDesktopShell
        ? []
        : [
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
          ])
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
          target: process.env.DESKTOP_BACKEND_URL ?? defaultDesktopBackendUrl,
          changeOrigin: true
        }
      }
    }
  };
});
