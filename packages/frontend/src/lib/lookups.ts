import { useQuery } from "@tanstack/react-query";
import type { LookupOptionListResponseDto } from "@elms/shared";
import { apiFetch } from "./api";

export function useLookupOptions(entity: string) {
  return useQuery({
    queryKey: ["lookups", entity],
    queryFn: () => apiFetch<LookupOptionListResponseDto>(`/api/lookups/${entity}`),
    staleTime: 5 * 60 * 1000 // 5 minutes — lookup options change rarely
  });
}
