const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? "";
const isDesktopShell = import.meta.env.VITE_DESKTOP_SHELL === "true";
const desktopRuntimeVariant = (import.meta.env.VITE_DESKTOP_RUNTIME_VARIANT as string | undefined) ?? "embedded";
const DESKTOP_EMBEDDED_FALLBACK_BASE_URL = "http://127.0.0.1:7854";
const LOCAL_SESSION_STORAGE_KEY = "elms.localSessionToken";
const DESKTOP_BACKEND_BASE_URL_CACHE_KEY = "elms.desktopBackendBaseUrl";
const DESKTOP_CONNECTIVITY_SNAPSHOT_KEY = "elms.desktopBackendConnectivity";
const DESKTOP_HEALTH_PROBE_TIMEOUT_MS = 1200;
const DESKTOP_BOOTSTRAP_READY_TIMEOUT_MS = 15000;
const DESKTOP_BOOTSTRAP_POLL_INTERVAL_MS = 350;

interface DesktopBackendConnection {
  baseUrl: string | null;
}

interface DesktopSetBackendConnectionResult {
  ok: boolean;
  code?: string | null;
}

interface DesktopBootstrapStatus {
  phase: "starting" | "ready" | "recovering" | "failed";
  message?: string | null;
  failureCode?: string | null;
}

interface DesktopRuntimeBackendUrl {
  baseUrl: string;
}

let desktopApiBaseUrlOverride = readDesktopBackendBaseUrlCache();
let desktopRuntimeBaseUrl: string | null = normalizeBaseUrl(apiBaseUrl);
let desktopRuntimeBaseUrlPromise: Promise<void> | null = null;
let desktopBackendConnectionPromise: Promise<void> | null = null;
let desktopBackendConnectionValidatedPromise: Promise<void> | null = null;
let desktopBackendFallbackToastShown = false;

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export interface ApiDownloadResult {
  blob: Blob;
  filename?: string;
  contentType: string | null;
}

async function parseErrorPayload(response: Response) {
  const payload = await response
    .json()
    .catch(() => ({ message: response.statusText || "Request failed" }));

  const message =
    typeof payload?.message === "string" && payload.message.trim().length > 0
      ? payload.message
      : "Request failed";

  throw new ApiError(message, response.status, payload);
}

function readDesktopLocalSessionToken() {
  if (!isDesktopShell) {
    return null;
  }

  try {
    return window.localStorage.getItem(LOCAL_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function persistDesktopLocalSessionToken(token?: string | null) {
  if (!isDesktopShell) {
    return;
  }

  try {
    if (token && token.trim().length > 0) {
      window.localStorage.setItem(LOCAL_SESSION_STORAGE_KEY, token);
      return;
    }

    window.localStorage.removeItem(LOCAL_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures and rely on in-memory flow.
  }
}

export function clearDesktopLocalSessionToken() {
  persistDesktopLocalSessionToken(null);
}

function normalizeBaseUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.host) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function readDesktopBackendBaseUrlCache() {
  if (!isDesktopShell) {
    return null;
  }

  try {
    return normalizeBaseUrl(window.localStorage.getItem(DESKTOP_BACKEND_BASE_URL_CACHE_KEY));
  } catch {
    return null;
  }
}

function writeDesktopConnectivitySnapshot(snapshot: Record<string, unknown>) {
  if (!isDesktopShell) {
    return;
  }

  try {
    window.localStorage.setItem(
      DESKTOP_CONNECTIVITY_SNAPSHOT_KEY,
      JSON.stringify({
        checkedAt: new Date().toISOString(),
        ...snapshot
      })
    );
  } catch {
    // Ignore local storage failures in desktop/webview.
  }
}

function writeDesktopBackendBaseUrlCache(value: string | null) {
  if (!isDesktopShell) {
    return;
  }

  try {
    if (!value) {
      window.localStorage.removeItem(DESKTOP_BACKEND_BASE_URL_CACHE_KEY);
      return;
    }

    window.localStorage.setItem(DESKTOP_BACKEND_BASE_URL_CACHE_KEY, value);
  } catch {
    // Ignore storage failures in desktop/webview.
  }
}

async function invokeDesktop<T>(command: string, args?: Record<string, unknown>) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

function isEmbeddedDesktopRuntime() {
  return isDesktopShell && desktopRuntimeVariant !== "dummy";
}

function getDesktopDefaultApiBaseUrl() {
  if (desktopRuntimeBaseUrl) {
    return desktopRuntimeBaseUrl;
  }

  if (isEmbeddedDesktopRuntime()) {
    return DESKTOP_EMBEDDED_FALLBACK_BASE_URL;
  }

  return null;
}

function buildBackendUnreachableError(message = "Unable to reach the local ELMS backend service.", details: Record<string, unknown> = {}) {
  return new ApiError(message, 503, {
    code: "BACKEND_UNREACHABLE",
    ...details
  });
}

function isNetworkFailure(error: unknown) {
  return error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError");
}

async function probeBackendHealth(baseUrl: string, timeoutMs = DESKTOP_HEALTH_PROBE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      return false;
    }

    const payload = await response.json().catch(() => null);
    return Boolean(payload && typeof payload === "object" && (payload as { ok?: boolean }).ok === true);
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function showDesktopBackendFallbackToast() {
  if (desktopBackendFallbackToastShown) {
    return;
  }

  desktopBackendFallbackToastShown = true;
  try {
    const { useToastStore } = await import("../store/toastStore");
    useToastStore
      .getState()
      .addToast("Custom backend URL is unreachable. Reverted to local runtime.", "info");
  } catch {
    // Swallow toast errors; connectivity behavior should still continue.
  }
}

async function persistDesktopBackendConnectionOverride(baseUrl: string | null) {
  if (!isDesktopShell) {
    return;
  }

  try {
    await invokeDesktop<DesktopSetBackendConnectionResult>("desktop_set_backend_connection", { baseUrl });
  } catch {
    // Ignore command errors; local in-memory fallback remains effective.
  }
}

async function validateDesktopBackendConnection() {
  if (!isEmbeddedDesktopRuntime()) {
    return;
  }

  const savedOverride = desktopApiBaseUrlOverride;
  const defaultBaseUrl = getDesktopDefaultApiBaseUrl();

  if (!savedOverride || !defaultBaseUrl || savedOverride === defaultBaseUrl) {
    writeDesktopConnectivitySnapshot({
      selectedBaseUrl: savedOverride ?? defaultBaseUrl,
      overrideUsed: Boolean(savedOverride),
      fallbackApplied: false
    });
    return;
  }

  const overrideReachable = await probeBackendHealth(savedOverride);
  if (overrideReachable) {
    writeDesktopConnectivitySnapshot({
      selectedBaseUrl: savedOverride,
      overrideUsed: true,
      overrideReachable: true,
      fallbackApplied: false
    });
    return;
  }

  const defaultReachable = await probeBackendHealth(defaultBaseUrl);
  if (defaultReachable) {
    desktopApiBaseUrlOverride = null;
    writeDesktopBackendBaseUrlCache(null);
    await persistDesktopBackendConnectionOverride(null);
    await showDesktopBackendFallbackToast();
    writeDesktopConnectivitySnapshot({
      selectedBaseUrl: defaultBaseUrl,
      overrideUsed: false,
      overrideReachable: false,
      defaultReachable: true,
      fallbackApplied: true
    });
    return;
  }

  writeDesktopConnectivitySnapshot({
    selectedBaseUrl: savedOverride,
    overrideUsed: true,
    overrideReachable: false,
    defaultReachable: false,
    fallbackApplied: false
  });
}

function isAuthApiPath(input: string) {
  if (/^https?:\/\//.test(input)) {
    try {
      const path = new URL(input).pathname;
      return path.startsWith("/api/auth/");
    } catch {
      return false;
    }
  }

  return input.startsWith("/api/auth/") || input.startsWith("api/auth/");
}

async function waitForDesktopBootstrapReady() {
  if (!isEmbeddedDesktopRuntime()) {
    return;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < DESKTOP_BOOTSTRAP_READY_TIMEOUT_MS) {
    try {
      const status = await invokeDesktop<DesktopBootstrapStatus>("desktop_bootstrap_status");
      if (status.phase === "ready") {
        return;
      }
      if (status.phase === "failed") {
        throw buildBackendUnreachableError(
          "Desktop runtime startup failed. Repair startup and try again.",
          {
            reason: "BOOTSTRAP_FAILED",
            bootstrapPhase: status.phase,
            bootstrapMessage: status.message ?? null,
            bootstrapFailureCode: status.failureCode ?? null
          }
        );
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw buildBackendUnreachableError("Unable to query desktop runtime status.", {
        reason: "BOOTSTRAP_STATUS_UNAVAILABLE"
      });
    }

    await new Promise((resolve) => window.setTimeout(resolve, DESKTOP_BOOTSTRAP_POLL_INTERVAL_MS));
  }

  throw buildBackendUnreachableError(
    "Desktop runtime is still starting. Wait a moment and try again.",
    {
      reason: "BOOTSTRAP_TIMEOUT"
    }
  );
}

function resolveRequestUrl(input: string) {
  return resolveApiUrl(input);
}

function mapTransportError(error: unknown, input: string) {
  if (error instanceof ApiError) {
    return error;
  }

  if (!isNetworkFailure(error)) {
    return error;
  }

  const resolvedUrl = resolveRequestUrl(input);
  const activeBaseUrl = desktopApiBaseUrlOverride ?? getDesktopDefaultApiBaseUrl() ?? (apiBaseUrl || null);
  return buildBackendUnreachableError(undefined, {
    requestUrl: resolvedUrl,
    apiBaseUrl: activeBaseUrl,
    isDesktopShell,
    desktopRuntimeVariant,
    isEmbeddedDesktopRuntime: isEmbeddedDesktopRuntime()
  });
}

async function loadDesktopBackendConnection() {
  if (!isDesktopShell) {
    return;
  }

  try {
    const result = await invokeDesktop<DesktopBackendConnection>("desktop_get_backend_connection");
    desktopApiBaseUrlOverride = normalizeBaseUrl(result.baseUrl);
    writeDesktopBackendBaseUrlCache(desktopApiBaseUrlOverride);
  } catch {
    // Keep cached or fallback value on command failure.
  }
}

async function loadDesktopRuntimeBackendUrl() {
  if (!isEmbeddedDesktopRuntime()) {
    return;
  }

  try {
    const result = await invokeDesktop<DesktopRuntimeBackendUrl>("desktop_get_runtime_backend_url");
    const normalized = normalizeBaseUrl(result.baseUrl);
    if (normalized) {
      desktopRuntimeBaseUrl = normalized;
      return;
    }
  } catch {
    // Fall back to configured default below.
  }

  if (!desktopRuntimeBaseUrl) {
    desktopRuntimeBaseUrl = DESKTOP_EMBEDDED_FALLBACK_BASE_URL;
  }
}

async function ensureDesktopBackendConnectionLoaded() {
  if (!isDesktopShell) {
    return;
  }

  if (!desktopRuntimeBaseUrlPromise) {
    desktopRuntimeBaseUrlPromise = loadDesktopRuntimeBackendUrl().finally(() => {
      desktopRuntimeBaseUrlPromise = null;
    });
  }
  await desktopRuntimeBaseUrlPromise;

  if (!desktopBackendConnectionPromise) {
    desktopBackendConnectionPromise = loadDesktopBackendConnection().finally(() => {
      desktopBackendConnectionPromise = null;
    });
  }

  await desktopBackendConnectionPromise;

  if (!desktopBackendConnectionValidatedPromise) {
    desktopBackendConnectionValidatedPromise = validateDesktopBackendConnection().finally(() => {
      desktopBackendConnectionValidatedPromise = null;
    });
  }
  await desktopBackendConnectionValidatedPromise;
}

export async function getEffectiveApiBaseUrl() {
  await ensureDesktopBackendConnectionLoaded();
  return desktopApiBaseUrlOverride ?? getDesktopDefaultApiBaseUrl() ?? apiBaseUrl;
}

export async function setApiBaseUrlOverride(baseUrl: string | null) {
  const normalized = normalizeBaseUrl(baseUrl);

  if (isDesktopShell) {
    const result = await invokeDesktop<DesktopSetBackendConnectionResult>(
      "desktop_set_backend_connection",
      { baseUrl: normalized }
    );

    if (!result.ok) {
      const code = result.code ?? "BACKEND_URL_INVALID";
      throw new ApiError(code, 400, { code });
    }
  }

  desktopApiBaseUrlOverride = normalized;
  writeDesktopBackendBaseUrlCache(normalized);
  return normalized;
}

export function isDummyDesktopRuntime() {
  return isDesktopShell && desktopRuntimeVariant === "dummy";
}

export function resolveApiUrl(input: string) {
  if (/^https?:\/\//.test(input)) {
    return input;
  }

  const baseUrl = (desktopApiBaseUrlOverride ?? getDesktopDefaultApiBaseUrl() ?? apiBaseUrl).trim();
  if (!baseUrl) {
    return input;
  }

  const inputPath = input.startsWith("/") ? input : `/${input}`;
  const normalizeBasePath = (pathValue: string) => {
    const cleaned = pathValue.trim().replace(/\/+$/, "");
    if (!cleaned || cleaned === "/") {
      return "";
    }

    return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  };
  const mergeBasePath = (basePath: string, requestPath: string) => {
    if (!basePath) {
      return requestPath;
    }
    if (requestPath === basePath || requestPath.startsWith(`${basePath}/`)) {
      return requestPath;
    }
    return `${basePath}${requestPath}`;
  };

  if (/^https?:\/\//i.test(baseUrl)) {
    try {
      const parsedBase = new URL(baseUrl);
      const mergedPath = mergeBasePath(normalizeBasePath(parsedBase.pathname), inputPath);
      return `${parsedBase.origin}${mergedPath}`;
    } catch {
      return inputPath;
    }
  }

  const mergedPath = mergeBasePath(normalizeBasePath(baseUrl), inputPath);
  return mergedPath || inputPath;
}

function buildAuthHeaders(initHeaders?: HeadersInit) {
  const headers = new Headers(initHeaders);
  const desktopLocalSessionToken = readDesktopLocalSessionToken();
  if (desktopLocalSessionToken) {
    headers.set("x-elms-session", desktopLocalSessionToken);
  }
  return headers;
}

function parseFilenameFromContentDisposition(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const utf8Match = value.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return utf8Match[1].trim().replace(/^"|"$/g, "");
    }
  }

  const asciiMatch = value.match(/filename\s*=\s*("?)([^";]+)\1/i);
  if (asciiMatch?.[2]) {
    return asciiMatch[2].trim();
  }

  return undefined;
}

function hasContentTypeHeader(headers: HeadersInit | undefined) {
  if (!headers) {
    return false;
  }

  if (headers instanceof Headers) {
    return headers.has("Content-Type");
  }

  if (Array.isArray(headers)) {
    return headers.some(([key]) => key.toLowerCase() === "content-type");
  }

  return Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
}

export async function apiFetch<T>(
  input: string,
  init?: RequestInit
): Promise<T> {
  await ensureDesktopBackendConnectionLoaded();
  if (isAuthApiPath(input)) {
    await waitForDesktopBootstrapReady();
  }
  const { headers: initHeaders, signal, ...restInit } = init ?? {};
  const headers = buildAuthHeaders(initHeaders);
  const shouldSetJsonContentType =
    restInit.body != null && !(restInit.body instanceof FormData) && !hasContentTypeHeader(headers);

  if (shouldSetJsonContentType) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(resolveRequestUrl(input), {
      credentials: "include",
      headers,
      signal,
      ...restInit
    });
  } catch (error) {
    throw mapTransportError(error, input);
  }

  if (!response.ok) {
    await parseErrorPayload(response);
  }

  return (await response.json()) as T;
}

/** Use for multipart/form-data uploads — omits Content-Type so the browser sets the boundary. */
export async function apiFormFetch<T>(
  input: string,
  init?: RequestInit
): Promise<T> {
  await ensureDesktopBackendConnectionLoaded();
  const { signal, headers: initHeaders, ...restInit } = init ?? {};
  const headers = buildAuthHeaders(initHeaders);

  let response: Response;
  try {
    response = await fetch(resolveRequestUrl(input), {
      credentials: "include",
      headers,
      signal,
      ...restInit
    });
  } catch (error) {
    throw mapTransportError(error, input);
  }

  if (!response.ok) {
    await parseErrorPayload(response);
  }

  return (await response.json()) as T;
}

export async function apiDownload(
  input: string,
  init?: RequestInit
): Promise<ApiDownloadResult> {
  await ensureDesktopBackendConnectionLoaded();
  const { headers: initHeaders, signal, ...restInit } = init ?? {};
  const headers = buildAuthHeaders(initHeaders);

  let response: Response;
  try {
    response = await fetch(resolveRequestUrl(input), {
      credentials: "include",
      headers,
      signal,
      ...restInit
    });
  } catch (error) {
    throw mapTransportError(error, input);
  }

  if (!response.ok) {
    await parseErrorPayload(response);
  }

  const contentDisposition = response.headers.get("Content-Disposition");
  const filename = parseFilenameFromContentDisposition(contentDisposition);

  return {
    blob: await response.blob(),
    filename,
    contentType: response.headers.get("Content-Type")
  };
}
