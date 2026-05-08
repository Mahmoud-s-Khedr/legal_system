export const LOOKUP_ENTITIES = [
  "CaseType",
  "CourtLevel",
  "PartyRole",
  "DocumentType",
  "HearingOutcome",
  "PaymentMethod",
  "FeeType",
  "ExpenseCategory",
  "LibraryDocType"
] as const;

export type LookupEntity = (typeof LOOKUP_ENTITIES)[number];
