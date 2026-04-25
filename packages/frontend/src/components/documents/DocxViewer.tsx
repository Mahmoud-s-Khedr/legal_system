import { useEffect, useRef, useState } from "react";
import mammoth from "mammoth";
import { useTranslation } from "react-i18next";

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "span",
  "strong",
  "em",
  "u",
  "b",
  "i",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "blockquote",
  "pre",
  "code",
  "a",
  "img"
]);

const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "title"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan"]),
  "*": new Set([])
};

function isSafeUrl(value: string, tagName: string, attrName: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) {
    return true;
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === "http:" || protocol === "https:" || protocol === "mailto:" || protocol === "tel:") {
      return true;
    }
    if (
      tagName === "img" &&
      attrName === "src" &&
      protocol === "data:" &&
      /^data:image\//i.test(trimmed)
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function sanitizeDocxHtml(input: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, "text/html");
  const nodes = Array.from(doc.body.querySelectorAll<HTMLElement>("*"));

  nodes.forEach((node) => {
    const tagName = node.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }

    const allowedForTag = new Set([
      ...(ALLOWED_ATTRIBUTES["*"] ?? []),
      ...(ALLOWED_ATTRIBUTES[tagName] ?? [])
    ]);

    for (const attr of Array.from(node.attributes)) {
      const attrName = attr.name.toLowerCase();
      if (attrName.startsWith("on") || attrName === "style") {
        node.removeAttribute(attr.name);
        continue;
      }
      if (!allowedForTag.has(attrName)) {
        node.removeAttribute(attr.name);
        continue;
      }
      if (
        (attrName === "href" || attrName === "src") &&
        !isSafeUrl(attr.value, tagName, attrName)
      ) {
        node.removeAttribute(attr.name);
      }
    }

    if (tagName === "a") {
      node.setAttribute("rel", "noopener noreferrer");
      node.setAttribute("target", "_blank");
    }
  });

  return doc.body.innerHTML;
}

interface DocxViewerProps {
  blob: Blob;
}

export function DocxViewer({ blob }: DocxViewerProps) {
  const { t } = useTranslation("app");
  const containerRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        setLoading(true);
        setError(null);
        setHtml(null);

        const arrayBuffer = await blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (cancelled) return;

        setHtml(sanitizeDocxHtml(result.value));
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("documents.docxRenderFailed")
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [blob, t]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-sm text-slate-500">{t("documents.loadingDocx")}</p>
      ) : null}
      <div
        ref={containerRef}
        className="max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 text-sm leading-relaxed prose prose-sm max-w-none"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={
          html ? { __html: html } : undefined
        }
      />
    </div>
  );
}
