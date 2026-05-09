import { extractApiValidationError } from "./validationErrors";

export type FormValidationResult = {
  message: string;
  fieldErrors: Record<string, string>;
  isValidationError: boolean;
};

export function resolveFormValidationError(
  error: unknown,
  fallbackMessage: string
): FormValidationResult {
  const validation = extractApiValidationError(error);
  if (validation) {
    return {
      message: validation.message,
      fieldErrors: validation.fieldErrors,
      isValidationError: true
    };
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return {
      message: error.message,
      fieldErrors: {},
      isValidationError: false
    };
  }

  return {
    message: fallbackMessage,
    fieldErrors: {},
    isValidationError: false
  };
}
