import { describe, expect, it } from "vitest";
import { getEgyptGovernorateOptions, withLegacyGovernorateOption } from "./egyptGovernorates";

describe("egyptGovernorates", () => {
  it("returns all 27 governorates in stable order", () => {
    const options = getEgyptGovernorateOptions("ar");
    expect(options).toHaveLength(27);
    expect(options.map((option) => option.value)).toEqual([
      "القاهرة",
      "الجيزة",
      "الإسكندرية",
      "الدقهلية",
      "البحيرة",
      "الشرقية",
      "المنوفية",
      "الغربية",
      "القليوبية",
      "كفر الشيخ",
      "دمياط",
      "بورسعيد",
      "الإسماعيلية",
      "السويس",
      "شمال سيناء",
      "جنوب سيناء",
      "الفيوم",
      "بني سويف",
      "المنيا",
      "أسيوط",
      "سوهاج",
      "قنا",
      "الأقصر",
      "أسوان",
      "البحر الأحمر",
      "الوادي الجديد",
      "مطروح"
    ]);
  });

  it("localizes labels by language", () => {
    expect(getEgyptGovernorateOptions("en")[0]?.label).toBe("Cairo");
    expect(getEgyptGovernorateOptions("fr")[0]?.label).toBe("Le Caire");
    expect(getEgyptGovernorateOptions("ar-EG")[0]?.label).toBe("القاهرة");
  });

  it("prepends legacy governorate values when not found", () => {
    const options = getEgyptGovernorateOptions("en");
    const merged = withLegacyGovernorateOption(options, "Alex");
    expect(merged[0]).toEqual({ value: "Alex", label: "Alex" });
    expect(merged).toHaveLength(options.length + 1);
  });
});
