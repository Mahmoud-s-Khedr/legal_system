import type { TFunction } from "i18next";

/**
 * Translates an enum value using the `enums.<EnumName>.<VALUE>` key pattern.
 * Safe to use inside useMemo, .map(), and SelectField option arrays.
 * Falls back to the raw value if the translation key is missing.
 */
export function getEnumLabel(
  t: TFunction<"app">,
  enumName: string,
  value: string | null | undefined
): string {
  if (!value) return "—";
  const key = `enums.${enumName}.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}
