import React, { type PropsWithChildren } from "react";
import ReactDOM from "react-dom/client";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import * as Sentry from "@sentry/react";
import { router } from "./router";
// Custom @font-face — self-hosted woff files with woff-first for WebKitGTK
import "./fonts.css";
import "antd/dist/reset.css";
import "./styles.css";
import "./i18n";
import { DirectionProvider } from "./components/shared/DirectionProvider";
import { DesktopBootstrapGate } from "./components/shared/DesktopBootstrapGate";
import { ToastContainer } from "./components/shared/Toast";
import { PpoScreenshotEventBridge } from "./components/shared/PpoScreenshotEventBridge";
import { OfflineBanner } from "./pwa/offlineBanner";
import { startSyncQueueReplay } from "./pwa/syncQueue";
import { ErrorFallback } from "./components/ErrorFallback";
import { ApiError } from "./lib/api";
import { useToastStore } from "./store/toastStore";
import { AntdProvider } from "./components/shared/AntdProvider";

function formatQueryError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data !== undefined) {
        return;
      }

      useToastStore.getState().addToast(formatQueryError(error), "error");
    }
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      useToastStore.getState().addToast(formatQueryError(error), "error");
    }
  })
});

const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|authorization|cookie|nationalid|fullname|name|email|phone|case|document|content|body)/i;

interface StartupBoundaryState {
  error: Error | null;
}

class StartupErrorBoundary extends React.Component<PropsWithChildren, StartupBoundaryState> {
  state: StartupBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): StartupBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[frontend-startup] React tree crashed", {
      error,
      componentStack: info.componentStack
    });
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

function scrub(value: unknown, depth = 0): unknown {
  if (value == null || depth > 6) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrub(item, depth + 1));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : scrub(nested, depth + 1);
    }
    return output;
  }

  return value;
}

function scrubHeaders(headers: Record<string, unknown>) {
  const output = { ...headers };
  for (const key of Object.keys(output)) {
    if (/^(authorization|cookie|set-cookie|x-api-key)$/i.test(key)) {
      output[key] = "[REDACTED]";
    }
  }
  return output;
}

// Start sync queue replay for cloud (non-Tauri) environments
if (!("__TAURI_INTERNALS__" in window)) {
  startSyncQueueReplay();
}

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    beforeSend(event) {
      if (!event) {
        return null;
      }

      const next = scrub(event) as Sentry.ErrorEvent;
      if (next.request?.headers) {
        next.request.headers = scrubHeaders(next.request.headers as Record<string, unknown>) as Record<string, string>;
      }
      return next;
    }
  });
}

window.addEventListener("error", (event) => {
  console.error("[frontend-startup] window error", {
    message: event.message,
    source: event.filename,
    line: event.lineno,
    column: event.colno,
    error: event.error
  });
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[frontend-startup] unhandled rejection", event.reason);
});

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <StartupErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AntdProvider>
          <DirectionProvider>
            <DesktopBootstrapGate>
              <ToastContainer />
              <PpoScreenshotEventBridge />
              <OfflineBanner />
              <RouterProvider router={router} />
            </DesktopBootstrapGate>
          </DirectionProvider>
        </AntdProvider>
      </QueryClientProvider>
    </StartupErrorBoundary>
  </React.StrictMode>
);
