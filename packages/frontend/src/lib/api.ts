const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const isDesktopShell = import.meta.env.VITE_DESKTOP_SHELL === "true";
const desktopRuntimeVariant = (import.meta.env.VITE_DESKTOP_RUNTIME_VARIANT as string | undefined) ?? "embedded";
const LOCAL_SESSION_STORAGE_KEY = "elms.localSessionToken";
const DESKTOP_BACKEND_BASE_URL_CACHE_KEY = "elms.desktopBackendBaseUrl";

interface DesktopBackendConnection {
  baseUrl: string | null;
}

interface DesktopSetBackendConnectionResult {
  ok: boolean;
  code?: string | null;
}

let desktopApiBaseUrlOverride = readDesktopBackendBaseUrlCache();
let desktopBackendConnectionPromise: Promise<void> | null = null;

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

  const trimmed = value.trim().replace(/\/+$/, "");
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
  } catch {
    return null;
  }

  return trimmed;
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

async function ensureDesktopBackendConnectionLoaded() {
  if (!isDesktopShell) {
    return;
  }

  if (!desktopBackendConnectionPromise) {
    desktopBackendConnectionPromise = loadDesktopBackendConnection().finally(() => {
      desktopBackendConnectionPromise = null;
    });
  }

  await desktopBackendConnectionPromise;
}

export async function getEffectiveApiBaseUrl() {
  await ensureDesktopBackendConnectionLoaded();
  return desktopApiBaseUrlOverride ?? apiBaseUrl;
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

  const baseUrl = desktopApiBaseUrlOverride ?? apiBaseUrl;
  if (!baseUrl) {
    return input;
  }

  return `${baseUrl}${input.startsWith("/") ? input : `/${input}`}`;
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
  const { headers: initHeaders, signal, ...restInit } = init ?? {};
  const headers = buildAuthHeaders(initHeaders);
  const shouldSetJsonContentType =
    restInit.body != null && !(restInit.body instanceof FormData) && !hasContentTypeHeader(headers);

  if (shouldSetJsonContentType) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(resolveApiUrl(input), {
    credentials: "include",
    headers,
    signal,
    ...restInit
  });

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

  const response = await fetch(resolveApiUrl(input), {
    credentials: "include",
    headers,
    signal,
    ...restInit
  });

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

  const response = await fetch(resolveApiUrl(input), {
    credentials: "include",
    headers,
    signal,
    ...restInit
  });

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
