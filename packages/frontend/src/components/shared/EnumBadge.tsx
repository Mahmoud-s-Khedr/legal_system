import { useTranslation } from "react-i18next";
import { Badge, type BadgeVariant } from "../../routes/app/ui";

const ENUM_COLORS: Record<string, BadgeVariant> = {
  // Green — positive final states
  ACTIVE: "green",
  INDEXED: "green",
  WON: "green",
  DONE: "green",
  // Blue — active in-progress states
  IN_PROGRESS: "blue",
  ISSUED: "blue",
  PARTIALLY_PAID: "blue",
  // Amber — waiting/pending states
  PENDING: "amber",
  PROCESSING: "amber",
  SUSPENDED: "amber",
  INVITED: "amber",
  // Red — negative/error states
  OVERDUE: "red",
  FAILED: "red",
  LOST: "red",
  CANCELLED: "red",
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
