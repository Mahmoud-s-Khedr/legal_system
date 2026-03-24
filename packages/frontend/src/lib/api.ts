const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export function resolveApiUrl(input: string) {
  if (!apiBaseUrl || /^https?:\/\//.test(input)) {
    return input;
  }

  return `${apiBaseUrl}${input.startsWith("/") ? input : `/${input}`}`;
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
  const shouldSetJsonContentType =
    restInit.body != null && !(restInit.body instanceof FormData) && !hasContentTypeHeader(initHeaders);

  const response = await fetch(resolveApiUrl(input), {
    credentials: "include",
    headers: shouldSetJsonContentType
      ? {
          "Content-Type": "application/json",
          ...(initHeaders ?? {})
        }
      : initHeaders,
    signal,
    ...restInit
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(payload.message ?? "Request failed");
  }

  return (await response.json()) as T;
}

/** Use for multipart/form-data uploads — omits Content-Type so the browser sets the boundary. */
export async function apiFormFetch<T>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const { signal, ...restInit } = init ?? {};
  const response = await fetch(resolveApiUrl(input), {
    credentials: "include",
    signal,
    ...restInit
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(payload.message ?? "Request failed");
  }

  return (await response.json()) as T;
}
