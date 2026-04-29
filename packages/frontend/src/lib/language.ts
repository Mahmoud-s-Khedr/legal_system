export function isArabicLanguage(language: string | null | undefined): boolean {
  return (language ?? "").toLowerCase().startsWith("ar");
}

export function resolveLocale(language: string | null | undefined): string {
  if (isArabicLanguage(language)) return "ar-EG";
  if ((language ?? "").toLowerCase().startsWith("fr")) return "fr-FR";
  return "en-US";
}
