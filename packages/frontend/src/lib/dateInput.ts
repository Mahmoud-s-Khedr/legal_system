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
