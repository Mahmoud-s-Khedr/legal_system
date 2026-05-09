import { useQuery } from "@tanstack/react-query";
import type {
  CityLookupListResponseDto,
  GovernorateLookupListResponseDto
} from "@elms/shared";
import { apiFetch } from "./api";

function normalizeLanguage(language: string): "ar" | "en" | "fr" {
  const lower = language.toLowerCase();
  if (lower.startsWith("ar")) return "ar";
  if (lower.startsWith("fr")) return "fr";
  return "en";
}

function resolveLocationLabel(
  row: { value: string; labelAr: string; labelEn: string; labelFr: string },
  language: string
): string {
  const active = normalizeLanguage(language);
  const byLanguage: Record<"ar" | "en" | "fr", string> = {
    ar: row.labelAr,
    en: row.labelEn,
    fr: row.labelFr
  };
  const order: Array<"ar" | "en" | "fr"> = [active, "ar", "en", "fr"];

  for (const lang of Array.from(new Set(order))) {
    const candidate = byLanguage[lang]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  return row.value;
}

export function useGovernorateLookups() {
  return useQuery({
    queryKey: ["location-lookups", "governorates"],
    queryFn: () => apiFetch<GovernorateLookupListResponseDto>("/api/location-lookups/governorates"),
    staleTime: 5 * 60 * 1000
  });
}

export function useCityLookups(governorateValue: string | null | undefined) {
  return useQuery({
    queryKey: ["location-lookups", "cities", governorateValue ?? ""],
    queryFn: () =>
      apiFetch<CityLookupListResponseDto>(
        `/api/location-lookups/cities/${encodeURIComponent(governorateValue ?? "")}`
      ),
    enabled: Boolean(governorateValue?.trim()),
    staleTime: 5 * 60 * 1000
  });
}

export function toLocalizedLocationOptions<
  T extends { value: string; labelAr: string; labelEn: string; labelFr: string }
>(
  rows: T[] | undefined,
  language: string
): Array<{ value: string; label: string }> {
  if (!rows?.length) return [];

  return rows.map((row) => ({
    value: row.value,
    label: resolveLocationLabel(row, language)
  }));
}

export function withLegacyLocationOption(
  options: Array<{ value: string; label: string }>,
  currentValue: string | null | undefined
): Array<{ value: string; label: string }> {
  const normalizedValue = currentValue?.trim();
  if (!normalizedValue) return options;
  if (options.some((option) => option.value === normalizedValue)) return options;
  return [{ value: normalizedValue, label: normalizedValue }, ...options];
}
