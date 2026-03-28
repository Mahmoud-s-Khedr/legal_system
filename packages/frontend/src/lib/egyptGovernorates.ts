export interface EgyptGovernorate {
  value: string;
  ar: string;
  en: string;
  fr: string;
}

const EGYPT_GOVERNORATES: EgyptGovernorate[] = [
  { value: "القاهرة", ar: "القاهرة", en: "Cairo", fr: "Le Caire" },
  { value: "الجيزة", ar: "الجيزة", en: "Giza", fr: "Gizeh" },
  { value: "الإسكندرية", ar: "الإسكندرية", en: "Alexandria", fr: "Alexandrie" },
  { value: "الدقهلية", ar: "الدقهلية", en: "Dakahlia", fr: "Dakahlie" },
  { value: "البحيرة", ar: "البحيرة", en: "Beheira", fr: "Beheira" },
  { value: "الشرقية", ar: "الشرقية", en: "Sharqia", fr: "Charqia" },
  { value: "المنوفية", ar: "المنوفية", en: "Monufia", fr: "Monufia" },
  { value: "الغربية", ar: "الغربية", en: "Gharbia", fr: "Gharbia" },
  { value: "القليوبية", ar: "القليوبية", en: "Qalyubia", fr: "Qalyubia" },
  { value: "كفر الشيخ", ar: "كفر الشيخ", en: "Kafr El Sheikh", fr: "Kafr El-Cheikh" },
  { value: "دمياط", ar: "دمياط", en: "Damietta", fr: "Damiette" },
  { value: "بورسعيد", ar: "بورسعيد", en: "Port Said", fr: "Port-Said" },
  { value: "الإسماعيلية", ar: "الإسماعيلية", en: "Ismailia", fr: "Ismailia" },
  { value: "السويس", ar: "السويس", en: "Suez", fr: "Suez" },
  { value: "شمال سيناء", ar: "شمال سيناء", en: "North Sinai", fr: "Sinaï Nord" },
  { value: "جنوب سيناء", ar: "جنوب سيناء", en: "South Sinai", fr: "Sinaï Sud" },
  { value: "الفيوم", ar: "الفيوم", en: "Fayoum", fr: "Fayoum" },
  { value: "بني سويف", ar: "بني سويف", en: "Beni Suef", fr: "Beni Souef" },
  { value: "المنيا", ar: "المنيا", en: "Minya", fr: "Minya" },
  { value: "أسيوط", ar: "أسيوط", en: "Assiut", fr: "Assiout" },
  { value: "سوهاج", ar: "سوهاج", en: "Sohag", fr: "Sohag" },
  { value: "قنا", ar: "قنا", en: "Qena", fr: "Qena" },
  { value: "الأقصر", ar: "الأقصر", en: "Luxor", fr: "Louxor" },
  { value: "أسوان", ar: "أسوان", en: "Aswan", fr: "Assouan" },
  { value: "البحر الأحمر", ar: "البحر الأحمر", en: "Red Sea", fr: "Mer Rouge" },
  { value: "الوادي الجديد", ar: "الوادي الجديد", en: "New Valley", fr: "Nouvelle Vallée" },
  { value: "مطروح", ar: "مطروح", en: "Matrouh", fr: "Marsa Matrouh" }
];

function normalizeLanguage(language: string): "ar" | "en" | "fr" {
  if (language.startsWith("ar")) return "ar";
  if (language.startsWith("fr")) return "fr";
  return "en";
}

export function getEgyptGovernorateOptions(language: string): Array<{ value: string; label: string }> {
  const locale = normalizeLanguage(language.toLowerCase());
  return EGYPT_GOVERNORATES.map((governorate) => ({
    value: governorate.value,
    label: governorate[locale]
  }));
}

export function withLegacyGovernorateOption(
  options: Array<{ value: string; label: string }>,
  currentValue: string | null | undefined
): Array<{ value: string; label: string }> {
  const normalizedValue = currentValue?.trim();
  if (!normalizedValue) return options;
  if (options.some((option) => option.value === normalizedValue)) return options;
  return [{ value: normalizedValue, label: normalizedValue }, ...options];
}
