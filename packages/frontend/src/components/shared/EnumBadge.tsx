import { useTranslation } from "react-i18next";
import { Badge, type BadgeVariant } from "../../routes/app/ui";

export const ENUM_COLORS: Record<string, BadgeVariant> = {
  // Green — positive final states
  ACTIVE: "green",
  INDEXED: "green",
  WON: "green",
  DONE: "green",
  SETTLED: "green",
  PAID: "green",
  DECIDED: "green",
  // Blue — active in-progress states
  IN_PROGRESS: "blue",
  ISSUED: "blue",
  PARTIALLY_PAID: "blue",
  EVIDENCE: "blue",
  EXPERT: "blue",
  PLEADING: "blue",
  MEDIUM: "blue",
  // Amber — waiting/pending states
  PENDING: "amber",
  PROCESSING: "amber",
  SUSPENDED: "amber",
  INVITED: "amber",
  LOW: "amber",
  POSTPONED: "amber",
  PARTIAL_RULING: "amber",
  ADJOURNED: "amber",
  MEDIATION: "amber",
  // Red — negative/error states
  OVERDUE: "red",
  FAILED: "red",
  LOST: "red",
  CANCELLED: "red",
  VOID: "red",
  REVOKED: "red",
  EXPIRED: "red",
  HIGH: "red",
  URGENT: "red",
  // Gray — neutral terminal states
  CLOSED: "gray",
  ARCHIVED: "gray",
  DRAFT: "gray",
  // Purple — internal review
  REVIEW: "purple"
};

interface EnumBadgeProps {
  enumName: string;
  value: string | null | undefined;
}

export function EnumBadge({ enumName, value }: EnumBadgeProps) {
  const { t } = useTranslation("app");
  if (!value) return null;
  const key = `enums.${enumName}.${value}`;
  const translated = t(key);
  const label = translated === key ? value : translated;
  const variant: BadgeVariant = ENUM_COLORS[value] ?? "default";
  return <Badge variant={variant}>{label}</Badge>;
}
