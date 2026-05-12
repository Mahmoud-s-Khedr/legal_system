import { extractApiValidationError } from "./validationErrors";
import { isValidDateTimeInput } from "./dateInput";

export type FormValidationResult = {
  message: string;
  fieldErrors: Record<string, string>;
  isValidationError: boolean;
};

export type ClientFormValidationResult = {
  isValid: boolean;
  message: string | null;
  fieldErrors: Record<string, string>;
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

export function validateRequiredDateTimeField(
  value: string | null | undefined,
  fieldKey: string,
  requiredMessage: string
): ClientFormValidationResult {
  if (isValidDateTimeInput(value)) {
    return {
      isValid: true,
      message: null,
      fieldErrors: {}
    };
  }

  return {
    isValid: false,
    message: requiredMessage,
    fieldErrors: {
      [fieldKey]: requiredMessage
    }
  };
}

export function validateLaterDateTimeField(
  earlierValue: string | null | undefined,
  laterValue: string | null | undefined,
  fieldKey: string,
  message: string
): ClientFormValidationResult {
  if (!laterValue) {
    return {
      isValid: true,
      message: null,
      fieldErrors: {}
    };
  }

  if (!isValidDateTimeInput(earlierValue) || !isValidDateTimeInput(laterValue)) {
    return {
      isValid: true,
      message: null,
      fieldErrors: {}
    };
  }

  if (Date.parse(laterValue) > Date.parse(earlierValue as string)) {
    return {
      isValid: true,
      message: null,
      fieldErrors: {}
    };
  }

  return {
    isValid: false,
    message,
    fieldErrors: {
      [fieldKey]: message
    }
  };
}
