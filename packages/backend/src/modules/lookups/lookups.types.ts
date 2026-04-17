export const LOOKUP_ENTITIES = [
  "CaseType",
  "CourtLevel",
  "PartyRole",
  "DocumentType",
  "PaymentMethod",
  "FeeType",
  "ExpenseCategory",
  "LibraryDocType"
] as const;

export type LookupEntity = (typeof LOOKUP_ENTITIES)[number];
