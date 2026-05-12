import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const captureBackendException = vi.fn();

vi.mock("../monitoring/sentry.js", () => ({ captureBackendException }));

const { registerErrorHandler } = await import("./errorHandler.js");
const { appError } = await import("../errors/appError.js");

type RegisteredErrorHandler = (
  error: unknown,
  request: { log: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> } },
  reply: { status: (code: number) => { send: (payload: unknown) => unknown } }
) => unknown;

function setup() {
  let handler: RegisteredErrorHandler | null = null;
  const app = {
    setErrorHandler: vi.fn((cb: RegisteredErrorHandler) => {
      handler = cb;
    })
  };

  registerErrorHandler(app as never);

  if (!handler) {
    throw new Error("Expected error handler to be registered");
  }

  const request = {
    log: {
      warn: vi.fn(),
      error: vi.fn()
    }
  };

  const replyState = { statusCode: 200, payload: undefined as unknown };
  const reply = {
    status: vi.fn((code: number) => {
      replyState.statusCode = code;
      return {
        send: (payload: unknown) => {
          replyState.payload = payload;
          return payload;
        }
      };
    })
  };

  return { handler, request, reply, replyState };
}

describe("registerErrorHandler", () => {
  it("maps zod validation errors to structured validation payload", () => {
    const { handler, request, reply, replyState } = setup();
    const invokeHandler = handler as RegisteredErrorHandler;
    const schema = z.object({ title: z.string() });

    let validationError: unknown = null;
    try {
      schema.parse({});
    } catch (error) {
      validationError = error;
    }

    invokeHandler(validationError, request, reply);

    expect(replyState.statusCode).toBe(400);
    expect(replyState.payload).toEqual({
      message: "Please review the highlighted fields and try again.",
      messageKey: "VALIDATION_SUMMARY",
      code: "VALIDATION_ERROR",
      issues: [
        {
          path: "title",
          pathSegments: ["title"],
          code: "invalid_type",
          message: "This field is required.",
          messageKey: "VALIDATION_REQUIRED"
        }
      ]
    });
  });

  it("maps invalid email to localized invalid email issue", () => {
    const { handler, request, reply, replyState } = setup();
    const invokeHandler = handler as RegisteredErrorHandler;
    const schema = z.object({ email: z.string().email() });

    let validationError: unknown = null;
    try {
      schema.parse({ email: "not-an-email" });
    } catch (error) {
      validationError = error;
    }

    invokeHandler(validationError, request, reply);

    expect(replyState.statusCode).toBe(400);
    expect(replyState.payload).toEqual({
      message: "Please review the highlighted fields and try again.",
      messageKey: "VALIDATION_SUMMARY",
      code: "VALIDATION_ERROR",
      issues: [
        {
          path: "email",
          pathSegments: ["email"],
          code: "invalid_format",
          message: "Enter a valid email address.",
          messageKey: "VALIDATION_INVALID_EMAIL",
          params: { format: "email" }
        }
      ]
    });
  });

  it("maps invalid date format to localized invalid date issue", () => {
    const { handler, request, reply, replyState } = setup();
    const invokeHandler = handler as RegisteredErrorHandler;
    const schema = z.object({ date: z.string().date() });

    let validationError: unknown = null;
    try {
      schema.parse({ date: "not-a-date" });
    } catch (error) {
      validationError = error;
    }

    invokeHandler(validationError, request, reply);

    expect(replyState.statusCode).toBe(400);
    expect(replyState.payload).toEqual({
      message: "Please review the highlighted fields and try again.",
      messageKey: "VALIDATION_SUMMARY",
      code: "VALIDATION_ERROR",
      issues: [
        {
          path: "date",
          pathSegments: ["date"],
          code: "invalid_format",
          message: "Enter a valid date.",
          messageKey: "VALIDATION_INVALID_DATE",
          params: { format: "date" }
        }
      ]
    });
  });

  it("maps invalid enum to localized invalid enum issue", () => {
    const { handler, request, reply, replyState } = setup();
    const invokeHandler = handler as RegisteredErrorHandler;
    const schema = z.object({ role: z.enum(["admin", "viewer"]) });

    let validationError: unknown = null;
    try {
      schema.parse({ role: "owner" });
    } catch (error) {
      validationError = error;
    }

    invokeHandler(validationError, request, reply);

    expect(replyState.statusCode).toBe(400);
    expect(replyState.payload).toEqual({
      message: "Please review the highlighted fields and try again.",
      messageKey: "VALIDATION_SUMMARY",
      code: "VALIDATION_ERROR",
      issues: [
        {
          path: "role",
          pathSegments: ["role"],
          code: "invalid_value",
          message: "Choose a valid option.",
          messageKey: "VALIDATION_INVALID_ENUM",
          params: { expected: "admin, viewer" }
        }
      ]
    });
  });

  it("maps string min(1) failures to required message", () => {
    const { handler, request, reply, replyState } = setup();
    const invokeHandler = handler as RegisteredErrorHandler;
    const schema = z.object({ title: z.string().min(1) });

    let validationError: unknown = null;
    try {
      schema.parse({ title: "" });
    } catch (error) {
      validationError = error;
    }

    invokeHandler(validationError, request, reply);

    expect(replyState.statusCode).toBe(400);
    expect(replyState.payload).toEqual({
      message: "Please review the highlighted fields and try again.",
      messageKey: "VALIDATION_SUMMARY",
      code: "VALIDATION_ERROR",
      issues: [
        {
          path: "title",
          pathSegments: ["title"],
          code: "too_small",
          message: "This field is required.",
          messageKey: "VALIDATION_REQUIRED"
        }
      ]
    });
  });

  it("maps string min(n) failures to too_small params", () => {
    const { handler, request, reply, replyState } = setup();
    const invokeHandler = handler as RegisteredErrorHandler;
    const schema = z.object({ title: z.string().min(2) });

    let validationError: unknown = null;
    try {
      schema.parse({ title: "x" });
    } catch (error) {
      validationError = error;
    }

    invokeHandler(validationError, request, reply);

    expect(replyState.statusCode).toBe(400);
    expect(replyState.payload).toMatchObject({
      code: "VALIDATION_ERROR",
      issues: [
        {
          path: "title",
          messageKey: "VALIDATION_TOO_SMALL",
          params: { minimum: 2, origin: "string" }
        }
      ]
    });
  });

  it("maps uuid format failures to dedicated message key", () => {
    const { handler, request, reply, replyState } = setup();
    const invokeHandler = handler as RegisteredErrorHandler;
    const schema = z.object({ id: z.string().uuid() });

    let validationError: unknown = null;
    try {
      schema.parse({ id: "not-uuid" });
    } catch (error) {
      validationError = error;
    }

    invokeHandler(validationError, request, reply);

    expect(replyState.statusCode).toBe(400);
    expect(replyState.payload).toMatchObject({
      code: "VALIDATION_ERROR",
      issues: [
        {
          path: "id",
          messageKey: "VALIDATION_INVALID_UUID",
          params: { format: "uuid" }
        }
      ]
    });
  });

  it("maps P2002 to 409 with safe message", () => {
    const { handler, request, reply, replyState } = setup();
    const invokeHandler = handler as RegisteredErrorHandler;

    invokeHandler({ code: "P2002", message: "Unique constraint failed" }, request, reply);

    expect(replyState.statusCode).toBe(409);
    expect(replyState.payload).toEqual({ message: "Resource already exists" });
    expect(request.log.warn).toHaveBeenCalled();
  });

  it("maps P2010 to sanitized 500 and reports exception", () => {
    const { handler, request, reply, replyState } = setup();
    const invokeHandler = handler as RegisteredErrorHandler;

    invokeHandler(
      {
        code: "P2010",
        message: "Raw query failed. Code: 2201X. Message: invalid regular expression"
      },
      request,
      reply
    );

    expect(replyState.statusCode).toBe(500);
    expect(replyState.payload).toEqual({ message: "Internal server error" });
    expect(request.log.error).toHaveBeenCalled();
    expect(captureBackendException).toHaveBeenCalled();
  });

  it("maps database unavailable errors to 503 with stable code", () => {
    const { handler, request, reply, replyState } = setup();
    const invokeHandler = handler as RegisteredErrorHandler;

    invokeHandler(
      {
        message: "Can't reach database server at `127.0.0.1:5433`"
      },
      request,
      reply
    );

    expect(replyState.statusCode).toBe(503);
    expect(replyState.payload).toEqual({
      message: "Database unavailable",
      code: "DATABASE_UNAVAILABLE"
    });
    expect(request.log.error).toHaveBeenCalled();
    expect(captureBackendException).toHaveBeenCalled();
  });

  it("maps schema mismatch errors to 503 with stable code", () => {
    const { handler, request, reply, replyState } = setup();
    const invokeHandler = handler as RegisteredErrorHandler;

    invokeHandler(
      {
        code: "P2010",
        message:
          "Raw query failed. Code: 42703. Message: column firm_id does not exist"
      },
      request,
      reply
    );

    expect(replyState.statusCode).toBe(503);
    expect(replyState.payload).toEqual({
      message: "Database schema mismatch. Run migrations and retry.",
      code: "DATABASE_SCHEMA_MISMATCH"
    });
    expect(request.log.error).toHaveBeenCalled();
    expect(captureBackendException).toHaveBeenCalled();
  });

  it("preserves framework 4xx errors such as unsupported media type", () => {
    const { handler, request, reply, replyState } = setup();
    const invokeHandler = handler as RegisteredErrorHandler;
    const priorCapturedCalls = captureBackendException.mock.calls.length;

    invokeHandler(
      {
        statusCode: 415,
        code: "FST_ERR_CTP_INVALID_MEDIA_TYPE",
        message: "Unsupported Media Type"
      },
      request,
      reply
    );

    expect(replyState.statusCode).toBe(415);
    expect(replyState.payload).toEqual({ message: "Unsupported Media Type" });
    expect(request.log.error).not.toHaveBeenCalled();
    expect(captureBackendException.mock.calls.length).toBe(priorCapturedCalls);
  });

  it("maps AppError validation payload with issues", () => {
    const { handler, request, reply, replyState } = setup();
    const invokeHandler = handler as RegisteredErrorHandler;

    invokeHandler(
      appError("Please review next session.", 422, {
        code: "VALIDATION_ERROR",
        details: {
          issues: [
            {
              path: "nextSessionAt",
              code: "custom",
              message: "Next session must be later than session date and time."
            }
          ]
        }
      }),
      request,
      reply
    );

    expect(replyState.statusCode).toBe(422);
    expect(replyState.payload).toEqual({
      message: "Please review next session.",
      messageKey: "VALIDATION_SUMMARY",
      code: "VALIDATION_ERROR",
      issues: [
        {
          path: "nextSessionAt",
          code: "custom",
          message: "Next session must be later than session date and time."
        }
      ]
    });
  });

  it("sanitizes unknown server errors", () => {
    const { handler, request, reply, replyState } = setup();
    const invokeHandler = handler as RegisteredErrorHandler;

    invokeHandler(new Error("Sensitive database details"), request, reply);

    expect(replyState.statusCode).toBe(500);
    expect(replyState.payload).toEqual({ message: "Internal server error" });
    expect(captureBackendException).toHaveBeenCalled();
  });
});
