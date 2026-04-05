import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useUnsavedChanges } from "../../lib/useUnsavedChanges";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClientType, Language, type ClientDto, type CreateClientDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEgyptGovernorateOptions, withLegacyGovernorateOption } from "../../lib/egyptGovernorates";
import { getEnumLabel } from "../../lib/enumLabel";
import { EmptyState, Field, FormExitActions, PageHeader, SectionCard, SelectField } from "./ui";

function toNullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isIdentityType(type: ClientType) {
  return type === ClientType.INDIVIDUAL || type === ClientType.GOVERNMENT;
}

function normalizePayload(form: CreateClientDto): CreateClientDto {
  return {
    ...form,
    name: form.name.trim(),
    phone: toNullable(form.phone),
    email: toNullable(form.email),
    governorate: toNullable(form.governorate),
    nationalId: isIdentityType(form.type) ? toNullable(form.nationalId) : null,
    commercialRegister: form.type === ClientType.COMPANY ? toNullable(form.commercialRegister) : null,
    taxNumber: form.type === ClientType.COMPANY ? toNullable(form.taxNumber) : null
  };
}

export function ClientEditPage() {
  const { t, i18n } = useTranslation("app");
  const { clientId } = useParams({ from: "/app/clients/$clientId/edit" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const clientTypeOptions = Object.values(ClientType).map((v) => ({
    value: v,
    label: getEnumLabel(t, "ClientType", v)
  }));
  const languageOptions = Object.values(Language).map((v) => ({
    value: v,
    label: getEnumLabel(t, "Language", v)
  }));

  const clientQuery = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => apiFetch<ClientDto>(`/api/clients/${clientId}`)
  });

  const [form, setForm] = useState<CreateClientDto>({
    name: "",
    type: ClientType.INDIVIDUAL,
    phone: "",
    email: "",
    governorate: "",
    preferredLanguage: Language.AR,
    nationalId: "",
    commercialRegister: "",
    taxNumber: "",
    contacts: []
  });
  const loadedFormRef = useRef<CreateClientDto | null>(null);
  useUnsavedChanges(loadedFormRef.current !== null && JSON.stringify(form) !== JSON.stringify(loadedFormRef.current));

  const governorateOptions = withLegacyGovernorateOption(
    getEgyptGovernorateOptions(i18n.resolvedLanguage ?? i18n.language ?? "en"),
    form.governorate
  );

  useEffect(() => {
    if (clientQuery.data) {
      const c = clientQuery.data;
      const loaded: CreateClientDto = {
        name: c.name,
        type: c.type,
        phone: c.phone ?? "",
        email: c.email ?? "",
        governorate: c.governorate ?? "",
        preferredLanguage: c.preferredLanguage,
        nationalId: c.nationalId ?? "",
        commercialRegister: c.commercialRegister ?? "",
        taxNumber: c.taxNumber ?? "",
        contacts: c.contacts ?? []
      };
      setForm(loaded);
      if (!loadedFormRef.current) loadedFormRef.current = loaded;
    }
  }, [clientQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: CreateClientDto) =>
      apiFetch(`/api/clients/${clientId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      void navigate({ to: "/app/clients/$clientId", params: { clientId } });
    }
  });

  if (!clientQuery.data && !clientQuery.isLoading) {
    return <EmptyState title={t("empty.noClientSelected")} description={t("empty.noClientSelectedHelp")} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("clients.profileEyebrow")}
        title={clientQuery.data?.name ?? "..."}
        description={t("clients.editHelp")}
      />
      <SectionCard title={t("clients.editTitle")} description={t("clients.editHelp")}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            updateMutation.mutate(normalizePayload(form));
          }}
        >
          <Field
            label={t("labels.name")}
            onChange={(value) => setForm({ ...form, name: value })}
            required
            value={form.name}
          />
          <SelectField
            label={t("labels.type")}
            onChange={(value) => setForm({ ...form, type: value as ClientType })}
            options={clientTypeOptions}
            required
            value={form.type}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              dir="ltr"
              label={t("labels.email")}
              onChange={(value) => setForm({ ...form, email: value })}
              type="email"
              value={form.email ?? ""}
            />
            <Field
              dir="ltr"
              label={t("labels.phone")}
              onChange={(value) => setForm({ ...form, phone: value })}
              value={form.phone ?? ""}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label={t("labels.governorate")}
              onChange={(value) => setForm({ ...form, governorate: value })}
              options={[
                { value: "", label: "-" },
                ...governorateOptions
              ]}
              value={form.governorate ?? ""}
            />
            <SelectField
              label={t("labels.language")}
              onChange={(value) => setForm({ ...form, preferredLanguage: value as Language })}
              options={languageOptions}
              value={form.preferredLanguage ?? Language.AR}
            />
          </div>
          {isIdentityType(form.type) ? (
            <Field
              dir="ltr"
              label={t("labels.nationalId")}
              onChange={(value) => setForm({ ...form, nationalId: value })}
              value={form.nationalId ?? ""}
            />
          ) : null}
          {form.type === ClientType.COMPANY ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                dir="ltr"
                label={t("labels.commercialRegister")}
                onChange={(value) => setForm({ ...form, commercialRegister: value })}
                value={form.commercialRegister ?? ""}
              />
              <Field
                dir="ltr"
                label={t("labels.taxNumber")}
                onChange={(value) => setForm({ ...form, taxNumber: value })}
                value={form.taxNumber ?? ""}
              />
            </div>
          ) : null}
          <FormExitActions
            cancelTo="/app/clients/$clientId"
            cancelParams={{ clientId }}
            cancelLabel={t("actions.cancel")}
            submitLabel={t("actions.saveChanges")}
            savingLabel={t("labels.saving")}
            submitting={updateMutation.isPending}
          />
          {updateMutation.error ? (
            <p className="text-sm text-red-600">{(updateMutation.error as Error).message}</p>
          ) : null}
        </form>
      </SectionCard>
    </div>
  );
}
