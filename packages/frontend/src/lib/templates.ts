import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDownload, apiFetch } from "./api";
import { saveBlobToDownloads } from "./desktopDownloads";

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
  renderedHtml: string;
  renderedText: string;
  rendered: string;
  variables: Record<string, string>;
}

export type TemplateExportMode = "template" | "rendered";

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

export async function exportTemplateDocx(
  templateId: string,
  mode: TemplateExportMode,
  caseId?: string
): Promise<string | null> {
  const body = mode === "rendered" ? { caseId } : {};
  const { blob, filename } = await apiDownload(`/api/templates/${templateId}/export?format=docx&mode=${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  return saveBlobToDownloads(blob, filename ?? `template-${templateId}.docx`);
}
