import type { CaseDto } from "@elms/shared";
import type { TFunction } from "i18next";
import { getEnumLabel } from "./enumLabel";

export type ClientSelectSource = {
  id: string;
  name: string;
  type?: string | null;
  poaNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  nationalId?: string | null;
  commercialRegister?: string | null;
  taxNumber?: string | null;
};

export type ClientSelectOption = {
  value: string;
  label: string;
  searchText: string;
};

export type CaseSelectOption = {
  value: string;
  label: string;
  searchText: string;
};

export function toCaseSelectOption(
  t: TFunction<"app">,
  caseItem: CaseDto
): CaseSelectOption {
  const statusLabel = getEnumLabel(t, "CaseStatus", caseItem.status);
  return {
    value: caseItem.id,
    label: `${caseItem.title} - ${caseItem.caseNumber} - ${statusLabel}`,
    searchText: buildCaseSearchText(caseItem, statusLabel)
  };
}

export function toClientSelectOption(
  t: TFunction<"app">,
  client: ClientSelectSource
): ClientSelectOption {
  const typeLabel = getEnumLabel(t, "ClientType", client.type);
  const poaLabel = t("labels.poaNumber");
  const poaValue = client.poaNumber?.trim() || "—";

  return {
    value: client.id,
    label: `${client.name} — ${typeLabel} — ${poaLabel}: ${poaValue}`,
    searchText: [
      client.name,
      client.type,
      typeLabel,
      client.poaNumber,
      client.phone,
      client.email,
      client.nationalId,
      client.commercialRegister,
      client.taxNumber,
      client.id
    ]
      .filter(Boolean)
      .join(" ")
  };
}

function buildCaseSearchText(caseItem: CaseDto, statusLabel: string): string {
  const clientNames = uniqueValues(
    caseItem.parties
      .filter((party) => party.partyType === "CLIENT")
      .map((party) => party.name)
  );

  const courtNames = uniqueValues(
    caseItem.courts.map((court) => court.courtName)
  );

  return [
    caseItem.title,
    caseItem.caseNumber,
    caseItem.status,
    statusLabel,
    caseItem.judicialYear?.toString(),
    ...courtNames,
    ...clientNames
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value?.trim())))
  );
}
