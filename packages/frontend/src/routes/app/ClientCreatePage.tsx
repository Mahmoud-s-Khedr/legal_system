import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  useUnsavedChanges,
  useUnsavedChangesBypass
} from "../../lib/useUnsavedChanges";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClientType,
  Language,
  type ClientListResponseDto,
  type CreateClientDto
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { getEgyptGovernorateOptions } from "../../lib/egyptGovernorates";
import { getEnumLabel } from "../../lib/enumLabel";
import { useMutationFeedback } from "../../lib/feedback";
import {
  Field,
  FormAlert,
  FormExitActions,
  PageHeader,
  SectionCard,
  SelectField
} from "./ui";

type ClientFormState = Omit<CreateClientDto, "type"> & {
  type: ClientType | "";
};

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
    commercialRegister:
      form.type === ClientType.COMPANY
        ? toNullable(form.commercialRegister)
        : null,
    taxNumber:
      form.type === ClientType.COMPANY ? toNullable(form.taxNumber) : null,
    poaNumber: toNullable(form.poaNumber),
    contacts: []
  };
}

export function ClientCreatePage() {
  const { t, i18n } = useTranslation("app");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const feedback = useMutationFeedback();
  const { bypassRef, allowNextNavigation } = useUnsavedChangesBypass();

  const clientTypeOptions = Object.values(ClientType).map((v) => ({
    value: v,
    label: getEnumLabel(t, "ClientType", v)
  }));
  const languageOptions = Object.values(Language).map((v) => ({
    value: v,
    label: getEnumLabel(t, "Language", v)
  }));
  const governorateOptions = getEgyptGovernorateOptions(
    i18n.resolvedLanguage ?? i18n.language ?? "en"
  );

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
    poaNumber: "",
    contacts: []
  });
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null
  );
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  useUnsavedChanges(form.name !== "" || form.type !== "", {
    bypassBlockRef: bypassRef
  });

  const dupCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dupCheckSeq = useRef(0);

  const checkDuplicate = useCallback(
    async (q: string, seq: number) => {
      if (!q.trim()) return;
      const result = await apiFetch<ClientListResponseDto>(
        `/api/clients?q=${encodeURIComponent(q.trim())}&limit=1`
      );
      if (seq !== dupCheckSeq.current) {
        return;
      }
      if (result.items.length > 0) {
        setDuplicateWarning(
          t("clients.duplicateWarning", { name: result.items[0].name })
        );
      } else {
        setDuplicateWarning(null);
      }
    },
    [t]
  );

  function scheduleCheck(q: string) {
    if (dupCheckTimer.current) clearTimeout(dupCheckTimer.current);
    setDuplicateWarning(null);
    dupCheckSeq.current += 1;
    const seq = dupCheckSeq.current;
    dupCheckTimer.current = setTimeout(() => {
      void checkDuplicate(q, seq);
    }, 500);
  }

  useEffect(() => {
    return () => {
      if (dupCheckTimer.current) {
        clearTimeout(dupCheckTimer.current);
      }
      dupCheckSeq.current += 1;
    };
  }, []);

  const createMutation = useMutation({
    mutationFn: (payload: CreateClientDto) =>
      apiFetch("/api/clients", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      feedback.success("messages.clientCreated");
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      allowNextNavigation();
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
      <SectionCard
        title={t("clients.createTitle")}
        description={t("clients.createHelp")}
      >
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
            onChange={(value) => {
              setForm({ ...form, name: value });
              scheduleCheck(value);
            }}
            required
            value={form.name}
          />
          <SelectField
            label={t("labels.type")}
            onChange={(value) =>
              setForm({ ...form, type: value as ClientType | "" })
            }
            options={[
              { value: "", label: t("labels.selectType") },
              ...clientTypeOptions
            ]}
            required
            value={form.type}
          />
          {form.type ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  dir="ltr"
                  label={t("labels.email")}
                  onChange={(value) => {
                    setForm({ ...form, email: value });
                    scheduleCheck(value);
                  }}
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
                  options={[{ value: "", label: "-" }, ...governorateOptions]}
                  value={form.governorate ?? ""}
                />
                <SelectField
                  label={t("labels.language")}
                  onChange={(value) =>
                    setForm({ ...form, preferredLanguage: value as Language })
                  }
                  options={languageOptions}
                  value={form.preferredLanguage ?? Language.AR}
                />
              </div>
              {isIdentityType(form.type) ? (
                <Field
                  dir="ltr"
                  label={t("labels.nationalId")}
                  onChange={(value) => {
                    setForm({ ...form, nationalId: value });
                  }}
                  value={form.nationalId ?? ""}
                />
              ) : null}
              {form.type === ClientType.COMPANY ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    dir="ltr"
                    label={t("labels.commercialRegister")}
                    onChange={(value) =>
                      setForm({ ...form, commercialRegister: value })
                    }
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
              <Field
                dir="ltr"
                label={t("labels.poaNumber")}
                onChange={(value) => setForm({ ...form, poaNumber: value })}
                value={form.poaNumber ?? ""}
              />
            </>
          ) : null}
          {duplicateWarning ? (
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>{duplicateWarning}</span>
              <button
                type="button"
                className="shrink-0 text-amber-500 hover:text-amber-700"
                onClick={() => setDuplicateWarning(null)}
                aria-label={t("actions.dismiss")}
              >
                ✕
              </button>
            </div>
          ) : null}
          <FormExitActions
            cancelTo="/app/clients"
            cancelLabel={t("actions.cancel")}
            submitLabel={t("actions.createClient")}
            savingLabel={t("labels.saving")}
            submitting={createMutation.isPending}
          />
          {validationMessage ? <FormAlert message={validationMessage} /> : null}
          {createMutation.error ? (
            <FormAlert message={(createMutation.error as Error).message} />
          ) : null}
        </form>
      </SectionCard>
    </div>
  );
}
