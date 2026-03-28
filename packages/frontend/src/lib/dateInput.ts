import dayjs, { type Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

export const DATE_PICKER_DATE_FORMAT = "YYYY-MM-DD";
export const DATE_PICKER_DATETIME_FORMAT = "YYYY-MM-DDTHH:mm";

export function isValidDateTimeInput(value: string | null | undefined) {
  if (!value) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

export function toIsoOrEmpty(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "";
  }
  return new Date(timestamp).toISOString();
}

export function toDatePickerValue(
  value: string | null | undefined,
  type: "date" | "datetime-local"
): Dayjs | null {
  if (!value) {
    return null;
  }

  const format = type === "date" ? DATE_PICKER_DATE_FORMAT : DATE_PICKER_DATETIME_FORMAT;
  const parsed = dayjs(value, format, true);
  if (parsed.isValid()) {
    return parsed;
  }

  const fallback = dayjs(value);
  return fallback.isValid() ? fallback : null;
}

export function fromDatePickerValue(
  value: Dayjs | null,
  type: "date" | "datetime-local"
): string {
  if (!value) {
    return "";
  }

  if (type === "date") {
    return value.format(DATE_PICKER_DATE_FORMAT);
  }

  return value.format(DATE_PICKER_DATETIME_FORMAT);
}
