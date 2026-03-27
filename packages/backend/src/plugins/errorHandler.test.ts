import { describe, expect, it, vi } from "vitest";

const captureBackendException = vi.fn();

vi.mock("../monitoring/sentry.js", () => ({ captureBackendException }));

const { registerErrorHandler } = await import("./errorHandler.js");

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
        message: "Raw query failed. Code: 42703. Message: column firm_id does not exist"
      },
      request,
      reply
    );

    expect(replyState.statusCode).toBe(500);
    expect(replyState.payload).toEqual({ message: "Internal server error" });
    expect(request.log.error).toHaveBeenCalled();
    expect(captureBackendException).toHaveBeenCalled();
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
