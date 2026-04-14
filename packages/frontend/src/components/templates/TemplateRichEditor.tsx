import { useEffect, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { useTranslation } from "react-i18next";
import {
  getTemplateDirection,
  normalizeTemplateHtml,
  TEMPLATE_PLACEHOLDERS,
  type PlaceholderDefinition
} from "../../lib/templateEditor";

const PlaceholderToken = Node.create({
  name: "placeholderToken",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      key: { default: "" }
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-placeholder-key]",
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) {
            return false;
          }
          return {
            key: node.getAttribute("data-placeholder-key") ?? ""
          };
        }
      }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const key = String(HTMLAttributes.key ?? "");
    return [
      "span",
      {
        "data-placeholder-key": key,
        class: "template-placeholder-chip",
        contenteditable: "false"
      },
      `{{${key}}}`
    ];
  }
});

interface Props {
  value: string;
  language: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function ToolbarButton({
  active,
  label,
  onClick,
  disabled
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-accent bg-accent text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {label}
    </button>
  );
}

export function TemplateRichEditor({ value, language, onChange, disabled = false }: Props) {
  const { t } = useTranslation("app");
  const dir = getTemplateDirection(language);

  const placeholders = useMemo(
    () =>
      TEMPLATE_PLACEHOLDERS.map((item: PlaceholderDefinition) => ({
        ...item,
        label: t(item.labelKey)
      })),
    [t]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"]
      }),
      PlaceholderToken
    ],
    content: normalizeTemplateHtml(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "template-editor-content",
        dir
      }
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChange(normalizeTemplateHtml(nextEditor.getHTML()));
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const next = normalizeTemplateHtml(value);
    if (next !== normalizeTemplateHtml(editor.getHTML())) {
      editor.commands.setContent(next, false);
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.view.dom.setAttribute("dir", dir);
  }, [editor, dir]);

  if (!editor) {
    return (
      <div className="template-editor-shell">
        <div className="template-editor-loading">{t("labels.loading")}</div>
      </div>
    );
  }

  return (
    <div className="template-editor-shell" dir={dir}>
      <div className="template-editor-toolbar">
        <ToolbarButton
          label={t("templates.toolbar.bold")}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled}
        />
        <ToolbarButton
          label={t("templates.toolbar.italic")}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled}
        />
        <ToolbarButton
          label={t("templates.toolbar.underline")}
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={disabled}
        />
        <ToolbarButton
          label={t("templates.toolbar.h1")}
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          disabled={disabled}
        />
        <ToolbarButton
          label={t("templates.toolbar.h2")}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={disabled}
        />
        <ToolbarButton
          label={t("templates.toolbar.bulletList")}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={disabled}
        />
        <ToolbarButton
          label={t("templates.toolbar.numberedList")}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={disabled}
        />
        <ToolbarButton
          label={t("templates.toolbar.alignLeft")}
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          disabled={disabled}
        />
        <ToolbarButton
          label={t("templates.toolbar.alignCenter")}
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          disabled={disabled}
        />
        <ToolbarButton
          label={t("templates.toolbar.alignRight")}
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          disabled={disabled}
        />
        <ToolbarButton
          label={t("templates.toolbar.undo")}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={disabled || !editor.can().chain().focus().undo().run()}
        />
        <ToolbarButton
          label={t("templates.toolbar.redo")}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={disabled || !editor.can().chain().focus().redo().run()}
        />
        <ToolbarButton
          label={t("templates.toolbar.clear")}
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          disabled={disabled}
        />
        <select
          className="template-editor-placeholder-select"
          aria-label={t("templates.insertPlaceholder")}
          disabled={disabled}
          defaultValue=""
          onChange={(event) => {
            const key = event.target.value;
            if (!key) {
              return;
            }

            editor
              .chain()
              .focus()
              .insertContent({ type: "placeholderToken", attrs: { key } })
              .insertContent(" ")
              .run();
            event.target.value = "";
          }}
        >
          <option value="">{t("templates.insertPlaceholder")}</option>
          {placeholders.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="template-editor-canvas">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
