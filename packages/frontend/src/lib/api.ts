import i18n from "../i18n";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? "";

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
  contentLength?: number | null;
}

type ValidationMessageKey =
  | "VALIDATION_REQUIRED"
  | "VALIDATION_INVALID_TYPE"
  | "VALIDATION_INVALID_UUID"
  | "VALIDATION_INVALID_EMAIL"
  | "VALIDATION_INVALID_DATE"
  | "VALIDATION_INVALID_DATETIME"
  | "VALIDATION_INVALID_STRING_FORMAT"
  | "VALIDATION_INVALID_ENUM"
  | "VALIDATION_TOO_SMALL"
  | "VALIDATION_TOO_BIG"
  | "VALIDATION_INVALID_VALUE";

type ApiValidationIssueParams = {
  minimum?: number;
  maximum?: number;
  inclusive?: boolean;
  exact?: boolean;
  expected?: string;
  received?: string;
  format?: string;
  origin?: string;
};

type ApiValidationIssuePayload = {
  path?: unknown;
  code?: unknown;
  message?: unknown;
  messageKey?: unknown;
  params?: unknown;
};

type ApiValidationPayload = {
  code?: unknown;
  message?: unknown;
  messageKey?: unknown;
  issues?: unknown;
};

function toValidationParams(value: unknown): ApiValidationIssueParams {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const candidate = value as Record<string, unknown>;
  return {
    minimum: typeof candidate.minimum === "number" ? candidate.minimum : undefined,
    maximum: typeof candidate.maximum === "number" ? candidate.maximum : undefined,
    inclusive: typeof candidate.inclusive === "boolean" ? candidate.inclusive : undefined,
    exact: typeof candidate.exact === "boolean" ? candidate.exact : undefined,
    expected: typeof candidate.expected === "string" ? candidate.expected : undefined,
    received: typeof candidate.received === "string" ? candidate.received : undefined,
    format: typeof candidate.format === "string" ? candidate.format : undefined,
    origin: typeof candidate.origin === "string" ? candidate.origin : undefined
  };
}

function localizeValidationIssueMessage(
  messageKey: ValidationMessageKey,
  fallback?: string,
  rawParams?: unknown
) {
  const params = toValidationParams(rawParams);
  const minimum = params.minimum;
  const maximum = params.maximum;
  const format = params.format;

  switch (messageKey) {
    case "VALIDATION_REQUIRED":
      return i18n.t("errors.validation.issue.required", "This field is required.");
    case "VALIDATION_INVALID_TYPE":
      return i18n.t("errors.validation.issue.invalidType", "The provided value has an invalid type.");
    case "VALIDATION_INVALID_UUID":
      return i18n.t("errors.validation.issue.invalidUuid", "Enter a valid identifier.");
    case "VALIDATION_INVALID_EMAIL":
      return i18n.t("errors.validation.issue.invalidEmail", "Enter a valid email address.");
    case "VALIDATION_INVALID_DATE":
      return i18n.t("errors.validation.issue.invalidDate", "Enter a valid date.");
    case "VALIDATION_INVALID_DATETIME":
      return i18n.t("errors.validation.issue.invalidDatetime", "Enter a valid date and time.");
    case "VALIDATION_INVALID_STRING_FORMAT":
      return i18n.t(
        "errors.validation.issue.invalidFormat",
        { format: format ?? "", defaultValue: "Invalid format." }
      );
    case "VALIDATION_INVALID_ENUM":
      return i18n.t("errors.validation.issue.invalidOption", "Choose a valid option.");
    case "VALIDATION_TOO_SMALL":
      return i18n.t(
        "errors.validation.issue.tooSmall",
        { minimum: minimum ?? "", defaultValue: fallback ?? "Value is below the allowed minimum." }
      );
    case "VALIDATION_TOO_BIG":
      return i18n.t(
        "errors.validation.issue.tooBig",
        { maximum: maximum ?? "", defaultValue: "Value exceeds the allowed maximum." }
      );
    case "VALIDATION_INVALID_VALUE":
      return i18n.t("errors.validation.issue.invalidValue", fallback ?? "Invalid value.");
    default:
      return fallback ?? i18n.t("errors.validation.issue.invalidValue", "Invalid value.");
  }
}

function localizeApiValidationPayload(payload: unknown) {
  if (typeof payload !== "object" || payload === null) {
    return payload;
  }

  const candidate = payload as ApiValidationPayload;
  if (candidate.code !== "VALIDATION_ERROR") {
    return payload;
  }

  const localizedTopLevel = i18n.t(
    "errors.validation.summary",
    "Please review the highlighted fields and try again."
  );

  const normalizedIssues = Array.isArray(candidate.issues)
    ? candidate.issues.map((issue) => {
        if (typeof issue !== "object" || issue === null) {
          return issue;
        }
        const entry = issue as ApiValidationIssuePayload;
        const messageKey =
          typeof entry.messageKey === "string" ? (entry.messageKey as ValidationMessageKey) : null;
        const fallbackMessage =
          typeof entry.message === "string" && entry.message.trim().length > 0
            ? entry.message
            : undefined;

        return {
          ...entry,
          message: messageKey
            ? localizeValidationIssueMessage(messageKey, fallbackMessage, entry.params)
            : fallbackMessage ??
              i18n.t("errors.validation.issue.invalidValue", "Invalid value.")
        };
      })
    : candidate.issues;

  return {
    ...candidate,
    message: localizedTopLevel,
    issues: normalizedIssues
  };
}

async function parseErrorPayload(response: Response) {
  const payload = await response
    .json()
    .catch(() => ({ message: response.statusText || "Request failed" }));

  const normalizedPayload = localizeApiValidationPayload(payload);

  const message =
    typeof normalizedPayload === "object" &&
    normalizedPayload !== null &&
    (
      ("message" in normalizedPayload &&
        typeof (normalizedPayload as { message?: unknown }).message === "string" &&
        (normalizedPayload as { message: string }).message.trim().length > 0) ||
      ("error" in normalizedPayload &&
        typeof (normalizedPayload as { error?: unknown }).error === "string" &&
        (normalizedPayload as { error: string }).error.trim().length > 0)
    )
      ? (
          (typeof (normalizedPayload as { message?: unknown }).message === "string" &&
          (normalizedPayload as { message: string }).message.trim().length > 0
            ? (normalizedPayload as { message: string }).message
            : (normalizedPayload as { error: string }).error)
        )
      : "Request failed";

  throw new ApiError(message, response.status, normalizedPayload);
}

function buildBackendUnreachableError(message = "Unable to reach the ELMS backend service.", details: Record<string, unknown> = {}) {
  return new ApiError(message, 503, {
    code: "BACKEND_UNREACHABLE",
    ...details
  });
}

function isNetworkFailure(error: unknown) {
  return error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError");
}

export function resolveApiUrl(input: string) {
  if (/^https?:\/\//.test(input)) {
    return input;
  }

  const baseUrl = apiBaseUrl.trim();
  if (!baseUrl) {
    return input;
  }

  // Always use only the origin (scheme + host + port). Any path suffix stored in
  // the base URL is intentionally discarded because the backend is always mounted
  // at root, never under a sub-path.
  const inputPath = input.startsWith("/") ? input : `/${input}`;

  if (/^https?:\/\//i.test(baseUrl)) {
    try {
      const parsedBase = new URL(baseUrl);
      return `${parsedBase.origin}${inputPath}`;
    } catch {
      return inputPath;
    }
  }

  return inputPath;
}

function mapTransportError(error: unknown, input: string) {
  if (error instanceof ApiError) {
    return error;
  }

  if (!isNetworkFailure(error)) {
    return error;
  }

  const resolvedUrl = resolveApiUrl(input);
  return buildBackendUnreachableError(undefined, {
    requestUrl: resolvedUrl,
    apiBaseUrl: apiBaseUrl || null
  });
}

function buildAuthHeaders(initHeaders?: HeadersInit) {
  return new Headers(initHeaders);
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

  let response: Response;
  try {
    response = await fetch(resolveApiUrl(input), {
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
  const { signal, headers: initHeaders, ...restInit } = init ?? {};
  const headers = buildAuthHeaders(initHeaders);

  let response: Response;
  try {
    response = await fetch(resolveApiUrl(input), {
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
  const { headers: initHeaders, signal, ...restInit } = init ?? {};
  const headers = buildAuthHeaders(initHeaders);
  const requestInit: RequestInit = {
    credentials: "include",
    headers,
    signal,
    ...restInit
  };

  let response: Response;
  try {
    response = await fetch(resolveApiUrl(input), requestInit);
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
    contentType: response.headers.get("Content-Type"),
    contentLength: Number(response.headers.get("Content-Length") ?? "") || null
  };
}
