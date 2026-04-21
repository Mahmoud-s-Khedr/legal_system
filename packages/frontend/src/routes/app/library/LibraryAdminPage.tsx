import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  PrimaryButton,
  SectionCard,
  SelectField
} from "../ui";

function FieldWrap({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

interface CategoryNode {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  children: CategoryNode[];
}

const EMPTY_FORM = {
  nameAr: "",
  nameEn: "",
  nameFr: "",
  slug: "",
  parentId: ""
};

export function LibraryAdminPage() {
  const { t } = useTranslation("app");
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ["library-categories"],
    queryFn: () => apiFetch<CategoryNode[]>("/api/library/categories")
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) =>
      apiFetch("/api/library/categories", {
        method: "POST",
        body: JSON.stringify({
          nameAr: data.nameAr,
          nameEn: data.nameEn,
          nameFr: data.nameFr,
          slug: data.slug,
          parentId: data.parentId || undefined
        })
      }),
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setShowForm(false);
      void queryClient.invalidateQueries({ queryKey: ["library-categories"] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof EMPTY_FORM }) =>
      apiFetch(`/api/library/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          nameAr: data.nameAr || undefined,
          nameEn: data.nameEn || undefined,
          nameFr: data.nameFr || undefined,
          slug: data.slug,
          parentId: data.parentId || null
        })
      }),
    onSuccess: () => {
      setEditingId(null);
      setForm(EMPTY_FORM);
      void queryClient.invalidateQueries({ queryKey: ["library-categories"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/library/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["library-categories"] });
    }
  });

  function flattenCategories(
    nodes: CategoryNode[],
    depth = 0,
    parentId = ""
  ): { node: CategoryNode; depth: number; parentId: string }[] {
    return nodes.flatMap((node) => [
      { node, depth, parentId },
      ...flattenCategories(node.children, depth + 1, node.id)
    ]);
  }

  function startEdit(node: CategoryNode, parentId?: string) {
    setEditingId(node.id);
    setForm({
      nameAr: node.nameAr,
      nameEn: node.nameEn,
      nameFr: node.nameFr,
      slug: node.slug,
      parentId: parentId ?? ""
    });
    setShowForm(false);
  }

  const allCategories = categoriesQuery.data ?? [];
  const flat = flattenCategories(allCategories);
  const selectableParents = flat.map(({ node, depth }) => ({
    id: node.id,
    nameEn: `${"\u00A0".repeat(depth * 2)}${node.nameEn}`
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("library.adminDescription")}
        eyebrow={t("library.eyebrow")}
        title={t("library.adminTitle")}
        actions={
          <PrimaryButton
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setForm(EMPTY_FORM);
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            {t("library.newCategory")}
          </PrimaryButton>
        }
      />

      {/* Create form */}
      {showForm && (
        <SectionCard title={t("library.newCategory")}>
          <CategoryForm
            allCategories={selectableParents}
            form={form}
            isPending={createMutation.isPending}
            submitLabel={t("actions.create")}
            t={t}
            onChange={setForm}
            onCancel={() => setShowForm(false)}
            onSubmit={() => createMutation.mutate(form)}
          />
        </SectionCard>
      )}

      <SectionCard title={t("library.categories")}>
        {categoriesQuery.isLoading ? (
          <p className="text-sm text-slate-500">{t("labels.loading")}</p>
        ) : null}
        {categoriesQuery.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={
              (categoriesQuery.error as Error)?.message ?? t("errors.fallback")
            }
            retryLabel={t("errors.reload")}
            onRetry={() => void categoriesQuery.refetch()}
          />
        ) : null}
        {!categoriesQuery.isLoading &&
        !categoriesQuery.isError &&
        !flat.length ? (
          <EmptyState
            description={t("empty.noCategoriesHelp")}
            title={t("empty.noCategories")}
          />
        ) : !categoriesQuery.isLoading && !categoriesQuery.isError ? (
          <div className="space-y-2">
            {flat.map(({ node, depth, parentId }) => (
              <div key={node.id}>
                {editingId === node.id ? (
                  <div className="rounded-2xl border border-accent/30 bg-accentSoft p-4">
                    <CategoryForm
                      allCategories={selectableParents.filter(
                        (category) => category.id !== node.id
                      )}
                      form={form}
                      isPending={updateMutation.isPending}
                      submitLabel={t("actions.save")}
                      t={t}
                      onChange={setForm}
                      onCancel={() => setEditingId(null)}
                      onSubmit={() =>
                        updateMutation.mutate({ id: node.id, data: form })
                      }
                    />
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                    style={{ marginInlineStart: `${depth * 24}px` }}
                  >
                    <div className="flex-1">
                      <p className="font-medium">{node.nameEn}</p>
                      <p className="text-sm text-slate-500" dir="rtl">
                        {node.nameAr}
                      </p>
                      <p className="text-xs text-slate-400">{node.nameFr}</p>
                    </div>
                    <code className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {node.slug}
                    </code>
                    <button
                      aria-label={t("actions.edit")}
                      className="rounded-lg p-1 text-slate-400 hover:text-accent"
                      onClick={() => startEdit(node, parentId)}
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      aria-label={t("actions.delete")}
                      className="rounded-lg p-1 text-slate-400 hover:text-red-500"
                      onClick={() => deleteMutation.mutate(node.id)}
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

function CategoryForm({
  form,
  allCategories,
  submitLabel,
  isPending,
  t,
  onChange,
  onSubmit,
  onCancel
}: {
  form: {
    nameAr: string;
    nameEn: string;
    nameFr: string;
    slug: string;
    parentId: string;
  };
  allCategories: { id: string; nameEn: string }[];
  submitLabel: string;
  isPending: boolean;
  t: (key: string) => string;
  onChange: (form: {
    nameAr: string;
    nameEn: string;
    nameFr: string;
    slug: string;
    parentId: string;
  }) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <FieldWrap label={t("library.categoryNameAr")}>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
            dir="rtl"
            type="text"
            value={form.nameAr}
            onChange={(e) => onChange({ ...form, nameAr: e.target.value })}
          />
        </FieldWrap>
        <FieldWrap label={t("library.categoryNameEn")}>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
            type="text"
            value={form.nameEn}
            onChange={(e) => onChange({ ...form, nameEn: e.target.value })}
          />
        </FieldWrap>
        <FieldWrap label={t("library.categoryNameFr")}>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
            type="text"
            value={form.nameFr}
            onChange={(e) => onChange({ ...form, nameFr: e.target.value })}
          />
        </FieldWrap>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldWrap label={t("library.categorySlug")}>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-accent"
            type="text"
            value={form.slug}
            onChange={(e) => onChange({ ...form, slug: e.target.value })}
          />
        </FieldWrap>
        <SelectField
          label={t("library.parentCategory")}
          value={form.parentId}
          onChange={(value) => onChange({ ...form, parentId: value })}
          options={[
            { value: "", label: t("library.noParent") },
            ...allCategories.map((category) => ({
              value: category.id,
              label: category.nameEn
            }))
          ]}
        />
      </div>
      <div className="flex gap-2">
        <PrimaryButton
          disabled={
            !form.nameAr.trim() ||
            !form.nameEn.trim() ||
            !form.nameFr.trim() ||
            !form.slug.trim() ||
            isPending
          }
          onClick={onSubmit}
        >
          {submitLabel}
        </PrimaryButton>
        <button
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          onClick={onCancel}
        >
          {t("actions.cancel")}
        </button>
      </div>
    </div>
  );
}
