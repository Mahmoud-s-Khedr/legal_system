import { generateKeyPairSync } from "node:crypto";
import { z } from "zod";
import { AuthMode } from "@elms/shared";

const booleanish = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off", ""].includes(normalized)) {
      return false;
    }
  }
  return value;
}, z.boolean());

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AUTH_MODE: z.nativeEnum(AuthMode).default(AuthMode.LOCAL),
  STORAGE_DRIVER: z.string().default("local"),
  HOST: z.string().default("0.0.0.0"),
  BACKEND_PORT: z.coerce.number().default(7854),
  FRONTEND_PORT: z.coerce.number().default(5173),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  COOKIE_DOMAIN: z.string().default("localhost"),
  FRONTEND_APP_URL: z.string().default("http://localhost:5173"),
  SAAS_BILLING_MODE: z.enum(["manual", "stripe", "disabled"]).default("manual"),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  LOCAL_SESSION_TTL_HOURS: z.coerce.number().default(12),
  LOCAL_SESSION_STORE_PATH: z.string().optional(),
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),
  OPERATOR_JWT_PRIVATE_KEY: z.string().optional(),
  OPERATOR_JWT_PUBLIC_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  ELMS_ENABLE_SWAGGER: booleanish.default(false),
  // Documents / Storage
  MAX_UPLOAD_BYTES: z.coerce.number().default(50 * 1024 * 1024),
  LOCAL_STORAGE_PATH: z.string().default("./uploads"),
  DOCX_PREVIEW_ENABLED: booleanish.default(true),
  DOCX_PREVIEW_BIN: z.string().default("libreoffice"),
  DOCX_PREVIEW_TIMEOUT_MS: z.coerce.number().default(60000),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_DOMAIN: z.string().optional(),
  // OCR
  OCR_BACKEND: z.enum(["tesseract", "google_vision"]).default("tesseract"),
  GOOGLE_VISION_API_KEY: z.string().optional(),
  OCR_EMBEDDED_PDF_MAX_PAGES: z.coerce.number().int().positive().default(2500),
  OCR_EMBEDDED_DOCX_MAX_IMAGES: z.coerce.number().int().positive().default(3000),
  OCR_EMBEDDED_IMAGE_MAX_BYTES: z.coerce.number().int().positive().default(1000 * 1024 * 1024),
  // CORS — comma-separated list of allowed origins for production (e.g. https://elms.firm.com)
  ALLOWED_ORIGINS: z.string().default(""),
  // Email (SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("noreply@elms.app"),
  // SMS (stub — replace with provider credentials)
  SMS_PROVIDER: z.enum(["twilio", "none"]).default("none"),
  SMS_ACCOUNT_SID: z.string().optional(),
  SMS_AUTH_TOKEN: z.string().optional(),
  SMS_FROM_NUMBER: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // AI Research
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  AI_MONTHLY_LIMIT: z.coerce.number().default(500),
  // Google Calendar integration
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),
  GOOGLE_OAUTH_ENCRYPTION_KEY: z.string().optional(),
  PERFORMANCE_LOGGING_ENABLED: booleanish.default(false),
  PERFORMANCE_DB_SLOW_QUERY_MS: z.coerce.number().default(200),
  EXTRACTION_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(3),
  EXTRACTION_QUEUE_ATTEMPTS: z.coerce.number().int().positive().default(3),
  EXTRACTION_QUEUE_BACKOFF_MS: z.coerce.number().int().positive().default(5000),
  RESEARCH_USAGE_CACHE_TTL_MS: z.coerce.number().int().positive().default(30000),
  DASHBOARD_CACHE_TTL_MS: z.coerce.number().int().positive().default(5000)
});

export type AppEnv = z.infer<typeof baseSchema> & {
  JWT_PRIVATE_KEY: string;
  JWT_PUBLIC_KEY: string;
  OPERATOR_JWT_PRIVATE_KEY: string;
  OPERATOR_JWT_PUBLIC_KEY: string;
};

let cachedEnv: AppEnv | null = null;

function getDevelopmentKeys() {
  const pair = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });

  return {
    JWT_PRIVATE_KEY: pair.privateKey,
    JWT_PUBLIC_KEY: pair.publicKey
  };
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = baseSchema.parse(source);
  const normalizedAuthMode = parsed.AUTH_MODE;

  if (parsed.NODE_ENV === "production") {
    if (!parsed.JWT_PRIVATE_KEY || !parsed.JWT_PUBLIC_KEY) {
      throw new Error("JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set in production");
    }
    if (!parsed.OPERATOR_JWT_PRIVATE_KEY || !parsed.OPERATOR_JWT_PUBLIC_KEY) {
      throw new Error("OPERATOR_JWT_PRIVATE_KEY and OPERATOR_JWT_PUBLIC_KEY must be set in production");
    }

    cachedEnv = {
      ...parsed,
      AUTH_MODE: normalizedAuthMode
    } as AppEnv;
  } else {
    const generatedKeys = getDevelopmentKeys();
    const generatedOperatorKeys = getDevelopmentKeys();
    cachedEnv = {
      ...parsed,
      AUTH_MODE: normalizedAuthMode,
      JWT_PRIVATE_KEY: parsed.JWT_PRIVATE_KEY || generatedKeys.JWT_PRIVATE_KEY,
      JWT_PUBLIC_KEY: parsed.JWT_PUBLIC_KEY || generatedKeys.JWT_PUBLIC_KEY,
      OPERATOR_JWT_PRIVATE_KEY:
        parsed.OPERATOR_JWT_PRIVATE_KEY || generatedOperatorKeys.JWT_PRIVATE_KEY,
      OPERATOR_JWT_PUBLIC_KEY:
        parsed.OPERATOR_JWT_PUBLIC_KEY || generatedOperatorKeys.JWT_PUBLIC_KEY
    };
  }

  return cachedEnv;
}
