import { useQuery } from "@tanstack/react-query";
import type { LookupOptionListResponseDto } from "@elms/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "./api";
import {
  getLookupLabel,
  toLookupSelectOptions,
  type LookupSelectOption
} from "./lookupLabel";

export function useLookupOptions(entity: string) {
  return useQuery({
    queryKey: ["lookups", entity],
    queryFn: () => apiFetch<LookupOptionListResponseDto>(`/api/lookups/${entity}`),
    staleTime: 5 * 60 * 1000 // 5 minutes — lookup options change rarely
  });
}

export function useLocalizedLookupOptions(
  entity: string,
  options?: {
    prependOption?: LookupSelectOption;
  }
) {
  const { i18n } = useTranslation("app");
  const query = useLookupOptions(entity);
  const language = i18n?.resolvedLanguage ?? i18n?.language ?? "ar";

  const mappedOptions = useMemo(() => {
    const localized = toLookupSelectOptions(query.data?.items, language);
    if (!options?.prependOption) {
      return localized;
    }

    return [options.prependOption, ...localized];
  }, [language, options?.prependOption, query.data?.items]);

  return {
    ...query,
    options: mappedOptions,
    getLabel: (key: string | null | undefined) => {
      const option = query.data?.items.find((item) => item.key === key);
      if (!option || !key) {
        return key ?? "—";
      }

      return getLookupLabel(option, language);
    }
  };
}
