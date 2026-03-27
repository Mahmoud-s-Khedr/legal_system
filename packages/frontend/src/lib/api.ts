const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const isDesktopShell = import.meta.env.VITE_DESKTOP_SHELL === "true";
const LOCAL_SESSION_STORAGE_KEY = "elms.localSessionToken";

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

export function resolveApiUrl(input: string) {
  if (!apiBaseUrl || /^https?:\/\//.test(input)) {
    return input;
  }

  return `${apiBaseUrl}${input.startsWith("/") ? input : `/${input}`}`;
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
