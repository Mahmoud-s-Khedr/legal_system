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
  const locale = normalizeLanguage(language);
  if (!rows?.length) return [];

  return rows.map((row) => ({
    value: row.value,
    label: locale === "ar" ? row.labelAr : locale === "fr" ? row.labelFr : row.labelEn
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
