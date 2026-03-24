/**
 * Normalize Arabic text before indexing:
 * - Strip harakat/tashkeel (U+064B–U+065F, U+0670)
 * - Normalize hamza variants (أ إ آ → ا)
 * - Normalize alef-maqsura (ى → ي)
 * - Normalize teh-marbuta (ة → ه)
 * - Collapse repeated whitespace
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}
