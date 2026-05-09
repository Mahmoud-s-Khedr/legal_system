import { describe, expect, it } from "vitest";
import {
  getLookupLabel,
  normalizeLookupLanguage,
  toLookupSelectOption,
  toLookupSelectOptions
} from "./lookupLabel";

const option = {
  key: "CASE_TYPE_CIVIL",
  labelAr: "مدني",
  labelEn: "Civil",
  labelFr: "Civil FR"
};

describe("lookupLabel", () => {
  it("normalizes supported language codes", () => {
    expect(normalizeLookupLanguage("ar-EG")).toBe("ar");
    expect(normalizeLookupLanguage("en-US")).toBe("en");
    expect(normalizeLookupLanguage("fr-FR")).toBe("fr");
    expect(normalizeLookupLanguage("de")).toBeNull();
  });

  it("resolves label by active language first", () => {
    expect(getLookupLabel(option, "en")).toBe("Civil");
    expect(getLookupLabel(option, "fr")).toBe("Civil FR");
  });

  it("falls back as active -> ar -> en -> fr -> key", () => {
    const sparse = {
      key: "OUTCOME_UNKNOWN",
      labelAr: "",
      labelEn: "",
      labelFr: "Ajourne"
    };

    expect(getLookupLabel(sparse, "en")).toBe("Ajourne");
    expect(getLookupLabel(sparse, "de")).toBe("Ajourne");

    const empty = {
      key: "OUTCOME_EMPTY",
      labelAr: "",
      labelEn: "",
      labelFr: ""
    };
    expect(getLookupLabel(empty, "ar")).toBe("OUTCOME_EMPTY");
  });

  it("builds select option with multilingual search text", () => {
    const mapped = toLookupSelectOption(option, "en");

    expect(mapped.value).toBe("CASE_TYPE_CIVIL");
    expect(mapped.label).toBe("Civil");
    expect(mapped.searchText).toContain("CASE_TYPE_CIVIL");
    expect(mapped.searchText).toContain("مدني");
    expect(mapped.searchText).toContain("Civil FR");
  });

  it("maps arrays safely", () => {
    expect(toLookupSelectOptions(undefined, "ar")).toEqual([]);
    expect(toLookupSelectOptions([option], "ar")[0]?.label).toBe("مدني");
  });
});
