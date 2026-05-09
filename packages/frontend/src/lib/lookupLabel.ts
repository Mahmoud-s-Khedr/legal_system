import type { LookupOptionDto } from "@elms/shared";

export type SupportedLookupLanguage = "ar" | "en" | "fr";

export type LookupSelectOption = {
  value: string;
  label: string;
  searchText: string;
};

export function normalizeLookupLanguage(
  language: string | null | undefined
): SupportedLookupLanguage | null {
  const normalized = (language ?? "").trim().toLowerCase();
  if (normalized.startsWith("ar")) return "ar";
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("fr")) return "fr";
  return null;
}

function pickFirstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

export function getLookupLabel(
  option: Pick<LookupOptionDto, "labelAr" | "labelEn" | "labelFr" | "key">,
  language: string | null | undefined
): string {
  const activeLanguage = normalizeLookupLanguage(language);
  const languageOrder: Array<SupportedLookupLanguage | null> = [
    activeLanguage,
    "ar",
    "en",
    "fr"
  ];

  const labelsByLanguage: Record<SupportedLookupLanguage, string> = {
    ar: option.labelAr,
    en: option.labelEn,
    fr: option.labelFr
  };

  const orderedLabels = Array.from(
    new Set(
      languageOrder.filter(
        (lang): lang is SupportedLookupLanguage => lang !== null
      )
    )
  ).map((lang) => labelsByLanguage[lang]);

  return pickFirstNonEmpty(orderedLabels) ?? option.key;
}

export function buildLookupSearchText(
  option: Pick<LookupOptionDto, "key" | "labelAr" | "labelEn" | "labelFr">,
  resolvedLabel: string
): string {
  return [
    option.key,
    resolvedLabel,
    option.labelAr,
    option.labelEn,
    option.labelFr
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

export function toLookupSelectOption(
  option: Pick<LookupOptionDto, "key" | "labelAr" | "labelEn" | "labelFr">,
  language: string | null | undefined
): LookupSelectOption {
  const label = getLookupLabel(option, language);

  return {
    value: option.key,
    label,
    searchText: buildLookupSearchText(option, label)
  };
}

export function toLookupSelectOptions(
  options: Array<Pick<LookupOptionDto, "key" | "labelAr" | "labelEn" | "labelFr">> | undefined,
  language: string | null | undefined
): LookupSelectOption[] {
  if (!options?.length) {
    return [];
  }

  return options.map((option) => toLookupSelectOption(option, language));
}
