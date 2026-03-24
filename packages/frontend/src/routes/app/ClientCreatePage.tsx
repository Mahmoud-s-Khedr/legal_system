import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClientType, Language, type CreateClientDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEnumLabel } from "../../lib/enumLabel";
import { Field, PageHeader, PrimaryButton, SectionCard, SelectField } from "./ui";

type ClientFormState = Omit<CreateClientDto, "type"> & { type: ClientType | "" };

function toNullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isIdentityType(type: ClientType | "") {
  return type === ClientType.INDIVIDUAL || type === ClientType.GOVERNMENT;
}

function normalizePayload(form: ClientFormState): CreateClientDto {
  return {
    name: form.name.trim(),
    type: form.type as ClientType,
    phone: toNullable(form.phone),
    email: toNullable(form.email),
    governorate: toNullable(form.governorate),
    preferredLanguage: form.preferredLanguage ?? Language.AR,
    nationalId: isIdentityType(form.type) ? toNullable(form.nationalId) : null,
    commercialRegister: form.type === ClientType.COMPANY ? toNullable(form.commercialRegister) : null,
    taxNumber: form.type === ClientType.COMPANY ? toNullable(form.taxNumber) : null,
    contacts: []
  };
}

export function ClientCreatePage() {
  const { t } = useTranslation("app");
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

  const [form, setForm] = useState<ClientFormState>({
    name: "",
    type: "",
    phone: "",
    email: "",
    governorate: "",
    preferredLanguage: Language.AR,
    nationalId: "",
    commercialRegister: "",
    taxNumber: "",
    contacts: []
  });
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: CreateClientDto) =>
      apiFetch("/api/clients", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      void navigate({ to: "/app/clients" });
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("clients.eyebrow")}
        title={t("clients.createTitle")}
        description={t("clients.createHelp")}
      />
      <SectionCard title={t("clients.createTitle")} description={t("clients.createHelp")}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.name.trim() || !form.type) {
              setValidationMessage(t("errors.requiredNameAndType"));
              return;
            }

            setValidationMessage(null);
            createMutation.mutate(normalizePayload(form));
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
            onChange={(value) => setForm({ ...form, type: value as ClientType | "" })}
            options={[{ value: "", label: t("labels.selectType") }, ...clientTypeOptions]}
            required
            value={form.type}
          />
          {form.type ? (
            <>
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
                <Field
                  label={t("labels.governorate")}
                  onChange={(value) => setForm({ ...form, governorate: value })}
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
            </>
          ) : null}
          <PrimaryButton type="submit">{t("actions.createClient")}</PrimaryButton>
          {validationMessage ? (
            <p className="text-sm text-red-600">{validationMessage}</p>
          ) : null}
          {createMutation.error ? (
            <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
          ) : null}
        </form>
      </SectionCard>
    </div>
  );
}
