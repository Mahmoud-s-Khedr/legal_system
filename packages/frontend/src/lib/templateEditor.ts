export interface PlaceholderDefinition {
  key: string;
  labelKey: string;
}

export const TEMPLATE_PLACEHOLDERS: PlaceholderDefinition[] = [
  { key: "caseName", labelKey: "templates.placeholder.caseName" },
  { key: "caseNumber", labelKey: "templates.placeholder.caseNumber" },
  { key: "legalReference", labelKey: "templates.placeholder.internalReference" },
  { key: "clientName", labelKey: "templates.placeholder.clientName" },
  { key: "clientNameAr", labelKey: "templates.placeholder.clientNameAr" },
  { key: "courtName", labelKey: "templates.placeholder.courtName" },
  { key: "courtLevel", labelKey: "templates.placeholder.courtLevel" },
  { key: "hearingDate", labelKey: "templates.placeholder.hearingDate" },
  { key: "today", labelKey: "templates.placeholder.today" },
  { key: "todayEn", labelKey: "templates.placeholder.todayEn" }
];

export const PLACEHOLDER_KEY_SET = new Set(TEMPLATE_PLACEHOLDERS.map((item) => item.key));
const FORBIDDEN_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "form",
  "input",
  "button",
  "textarea",
  "select"
]);

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function convertLegacyTextToHtml(text: string): string {
  const lines = text.split(/\r?\n/);
  return lines
    .map((line) => (line.trim().length > 0 ? `<p>${escapeHtml(line)}</p>` : "<p><br/></p>"))
    .join("");
}

export function getTemplateDirection(language?: string): "rtl" | "ltr" {
  return (language ?? "AR").toUpperCase() === "AR" ? "rtl" : "ltr";
}

function createPlaceholderNode(doc: Document, key: string): HTMLSpanElement {
  const chip = doc.createElement("span");
  chip.setAttribute("data-placeholder-key", key);
  chip.className = "template-placeholder-chip";
  chip.textContent = `{{${key}}}`;
  return chip;
}

function normalizePlaceholderSpans(doc: Document): void {
  const nodes = doc.querySelectorAll<HTMLElement>("[data-placeholder-key]");
  nodes.forEach((node) => {
    const key = node.getAttribute("data-placeholder-key")?.trim() ?? "";
    if (!PLACEHOLDER_KEY_SET.has(key)) {
      node.removeAttribute("data-placeholder-key");
      node.classList.remove("template-placeholder-chip");
      return;
    }
    node.setAttribute("data-placeholder-key", key);
    node.classList.add("template-placeholder-chip");
    node.textContent = `{{${key}}}`;
  });
}

function replaceTextNodeWithChips(textNode: Text): void {
  const parent = textNode.parentElement;
  if (!parent || parent.closest("[data-placeholder-key]")) {
    return;
  }

  const value = textNode.nodeValue ?? "";
  const pattern = /\{\{(\w+)\}\}/g;
  let match = pattern.exec(value);
  if (!match) {
    return;
  }

  const fragment = textNode.ownerDocument.createDocumentFragment();
  let cursor = 0;

  while (match) {
    const [token, rawKey] = match;
    const key = rawKey.trim();
    const idx = match.index;

    if (idx > cursor) {
      fragment.appendChild(textNode.ownerDocument.createTextNode(value.slice(cursor, idx)));
    }

    if (PLACEHOLDER_KEY_SET.has(key)) {
      fragment.appendChild(createPlaceholderNode(textNode.ownerDocument, key));
    } else {
      fragment.appendChild(textNode.ownerDocument.createTextNode(token));
    }

    cursor = idx + token.length;
    match = pattern.exec(value);
  }

  if (cursor < value.length) {
    fragment.appendChild(textNode.ownerDocument.createTextNode(value.slice(cursor)));
  }

  textNode.replaceWith(fragment);
}

function replaceRawTokensWithChips(doc: Document): void {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  textNodes.forEach((node) => replaceTextNodeWithChips(node));
}

function isUnsafeUrlAttribute(name: string, value: string): boolean {
  if (!["href", "src", "xlink:href"].includes(name.toLowerCase())) {
    return false;
  }

  return /^javascript:/i.test(value.trim());
}

function sanitizeTemplateDocument(doc: Document): void {
  const nodes = Array.from(doc.body.querySelectorAll<HTMLElement>("*"));
  nodes.forEach((node) => {
    if (FORBIDDEN_TAGS.has(node.tagName.toLowerCase())) {
      node.remove();
      return;
    }

    for (const attr of Array.from(node.attributes)) {
      const attrName = attr.name.toLowerCase();
      const attrValue = attr.value;

      if (attrName.startsWith("on") || attrName === "srcdoc") {
        node.removeAttribute(attr.name);
        continue;
      }

      if (attrName === "data-placeholder-key") {
        const key = attrValue.trim();
        if (!PLACEHOLDER_KEY_SET.has(key)) {
          node.removeAttribute(attr.name);
          node.classList.remove("template-placeholder-chip");
        }
        continue;
      }

      if (isUnsafeUrlAttribute(attrName, attrValue)) {
        node.removeAttribute(attr.name);
      }
    }
  });
}

export function normalizeTemplateHtml(input: string): string {
  const baseHtml = looksLikeHtml(input) ? input : convertLegacyTextToHtml(input);
  const parser = new DOMParser();
  const doc = parser.parseFromString(baseHtml, "text/html");

  normalizePlaceholderSpans(doc);
  replaceRawTokensWithChips(doc);
  sanitizeTemplateDocument(doc);

  return doc.body.innerHTML;
}

export function sanitizeTemplateHtml(input: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(looksLikeHtml(input) ? input : convertLegacyTextToHtml(input), "text/html");
  sanitizeTemplateDocument(doc);
  return doc.body.innerHTML;
}

export function isTemplateHtmlEmpty(input: string): boolean {
  const parser = new DOMParser();
  const doc = parser.parseFromString(looksLikeHtml(input) ? input : convertLegacyTextToHtml(input), "text/html");
  sanitizeTemplateDocument(doc);
  const hasPlaceholder = TEMPLATE_PLACEHOLDERS.some(
    ({ key }) => doc.querySelector(`[data-placeholder-key="${key}"]`) !== null
  );
  const text = (doc.body.textContent ?? "").replace(/\s+/g, "").trim();
  return !hasPlaceholder && text.length === 0;
}
