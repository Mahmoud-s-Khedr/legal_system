export class AppError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;

  constructor(message: string, statusCode: number, options?: { code?: string; details?: unknown }) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = options?.code;
    this.details = options?.details;
  }
}

export function appError(
  message: string,
  statusCode: number,
  options?: { code?: string; details?: unknown }
): AppError {
  return new AppError(message, statusCode, options);
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
