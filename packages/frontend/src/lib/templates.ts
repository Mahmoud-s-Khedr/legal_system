import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";

export interface TemplateDto {
  id: string;
  firmId: string | null;
  name: string;
  language: string;
  body: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateDto {
  name: string;
  language?: string;
  body: string;
}

export interface UpdateTemplateDto {
  name?: string;
  language?: string;
  body?: string;
}

export interface RenderResultDto {
  rendered: string;
  variables: Record<string, string>;
}

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: () => apiFetch<TemplateDto[]>("/api/templates")
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: ["templates", id],
    queryFn: () => apiFetch<TemplateDto>(`/api/templates/${id}`),
    enabled: !!id
  });
}

export function useTemplateRender(templateId: string) {
  return useMutation({
    mutationFn: (dto: { caseId: string }) =>
      apiFetch<RenderResultDto>(`/api/templates/${templateId}/render`, {
        method: "POST",
        body: JSON.stringify(dto)
      })
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTemplateDto) =>
      apiFetch<TemplateDto>("/api/templates", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] })
  });
}

export function useUpdateTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateTemplateDto) =>
      apiFetch<TemplateDto>(`/api/templates/${id}`, { method: "PUT", body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] })
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] })
  });
}
