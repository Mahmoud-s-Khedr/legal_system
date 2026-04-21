import { normalizeArabic } from "./arabic.js";

function dedupe(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function expandArabicVariants(seed: string) {
  const variants = [seed];
  const pairs: Array<[from: string, to: string]> = [
    ["ا", "أ"],
    ["ا", "إ"],
    ["ا", "آ"],
    ["أ", "ا"],
    ["إ", "ا"],
    ["آ", "ا"],
    ["ه", "ة"],
    ["ة", "ه"],
    ["ي", "ى"],
    ["ى", "ي"]
  ];

  for (const [from, to] of pairs) {
    if (seed.includes(from)) {
      variants.push(seed.replaceAll(from, to));
    }
  }

  return variants;
}

export function buildFuzzySearchCandidates(rawQuery: string | undefined): string[] {
  const trimmed = rawQuery?.trim();
  if (!trimmed) return [];

  const collapsed = trimmed.replace(/\s+/g, " ");
  const normalizedArabic = normalizeArabic(collapsed).replace(/\u0640/g, "");
  const seeds = dedupe([collapsed, normalizedArabic]);
  const expanded = dedupe(seeds.flatMap(expandArabicVariants));
  return expanded.slice(0, 12);
}

export function stringMatchesFuzzyQuery(value: string, rawQuery: string | undefined): boolean {
  const candidates = buildFuzzySearchCandidates(rawQuery);
  if (candidates.length === 0) return true;

  const loweredValue = value.toLowerCase();
  const normalizedValue = normalizeArabic(value).toLowerCase();

  return candidates.some((candidate) => {
    const loweredCandidate = candidate.toLowerCase();
    if (loweredValue.includes(loweredCandidate)) return true;
    if (normalizedValue.includes(normalizeArabic(candidate).toLowerCase())) return true;

    const tokens = loweredCandidate.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
      return tokens.every((token) => loweredValue.includes(token) || normalizedValue.includes(normalizeArabic(token).toLowerCase()));
    }

    return false;
  });
}
