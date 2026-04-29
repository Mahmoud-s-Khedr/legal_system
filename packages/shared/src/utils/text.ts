const DIGIT_MAP: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9"
};

/**
 * Normalize Arabic-Indic and Eastern Arabic digits to ASCII digits.
 *
 * This keeps user-entered numbers searchable and comparable even when the
 * keyboard layout produces locale-specific digit glyphs.
 */
export function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => DIGIT_MAP[digit] ?? digit);
}

export function normalizePhoneNumber(value: string): string {
  return normalizeDigits(value).trim();
}

export function isValidPhoneNumber(value: string): boolean {
  const normalized = normalizePhoneNumber(value);
  return /^\+?[0-9]{7,15}$/.test(normalized);
}
