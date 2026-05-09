import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Power, RotateCcw } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  PrimaryButton,
  SectionCard,
  SelectField
} from "../ui";

interface LibraryType {
  id: string;
  code: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  isActive: boolean;
  isDefault: boolean;
}

interface CategoryNode {
  id: string;
  slug: string;
  typeId: string | null;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  children: CategoryNode[];
}

const EMPTY_TYPE_FORM = {
  code: "",
  slug: "",
  nameAr: "",
  nameEn: "",
  nameFr: "",
  isActive: true
};

const EMPTY_CATEGORY_FORM = {
  typeId: "",
  nameAr: "",
  nameEn: "",
  nameFr: "",
  slug: "",
  parentId: ""
};

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

export function LibraryAdminPage() {
  const { t, i18n } = useTranslation("app");
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState("");
  const [typeForm, setTypeForm] = useState(EMPTY_TYPE_FORM);
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  const typesQuery = useQuery({
    queryKey: ["library-types"],
    queryFn: () => apiFetch<LibraryType[]>("/api/library/types")
  });

  const categoriesQuery = useQuery({
    enabled: Boolean(selectedType),
    queryKey: ["library-categories", selectedType],
    queryFn: () => apiFetch<CategoryNode[]>(`/api/library/categories?typeId=${encodeURIComponent(selectedType)}`)
  });

  React.useEffect(() => {
    if (!selectedType && (typesQuery.data?.length ?? 0) > 0) {
      setSelectedType(typesQuery.data![0].id);
      setCategoryForm((current) => ({ ...current, typeId: typesQuery.data![0].id }));
    }
  }, [typesQuery.data, selectedType]);

  const createTypeMutation = useMutation({
    mutationFn: (data: typeof EMPTY_TYPE_FORM) =>
      apiFetch("/api/library/types", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      setTypeForm(EMPTY_TYPE_FORM);
      setShowTypeForm(false);
      void queryClient.invalidateQueries({ queryKey: ["library-types"] });
    }
  });

  const updateTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof EMPTY_TYPE_FORM> }) =>
      apiFetch(`/api/library/types/${id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      setEditingTypeId(null);
      setTypeForm(EMPTY_TYPE_FORM);
      void queryClient.invalidateQueries({ queryKey: ["library-types"] });
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: typeof EMPTY_CATEGORY_FORM) =>
      apiFetch("/api/library/categories", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          parentId: data.parentId || undefined
        })
      }),
    onSuccess: () => {
      setCategoryForm({ ...EMPTY_CATEGORY_FORM, typeId: selectedType });
      setShowCategoryForm(false);
      void queryClient.invalidateQueries({ queryKey: ["library-categories", selectedType] });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof EMPTY_CATEGORY_FORM }) =>
      apiFetch(`/api/library/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...data,
          parentId: data.parentId || null
        })
      }),
    onSuccess: () => {
      setEditingCategoryId(null);
      setCategoryForm({ ...EMPTY_CATEGORY_FORM, typeId: selectedType });
      void queryClient.invalidateQueries({ queryKey: ["library-categories", selectedType] });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/library/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["library-categories", selectedType] });
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

  const flatCategories = flattenCategories(categoriesQuery.data ?? []);
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en";
  const isArabic = locale.startsWith("ar");
  const isFrench = locale.startsWith("fr");

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("library.adminDescription")}
        eyebrow={t("library.eyebrow")}
        title={t("library.adminTitle")}
        actions={
          <div className="flex gap-2">
            <PrimaryButton onClick={() => setShowTypeForm((s) => !s)}>
              <Plus className="size-4" />
              {t("library.newType")}
            </PrimaryButton>
            <PrimaryButton
              onClick={() => {
                setShowCategoryForm((s) => !s);
                setCategoryForm((current) => ({ ...current, typeId: selectedType }));
              }}
            >
              <Plus className="size-4" />
              {t("library.newCategory")}
            </PrimaryButton>
          </div>
        }
      />

      <SectionCard title={t("library.typesManager")}>
        {showTypeForm ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={t("library.typeCode")} value={typeForm.code} onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase() })} />
            <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={t("library.categorySlug")} value={typeForm.slug} onChange={(e) => setTypeForm({ ...typeForm, slug: e.target.value })} />
            <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={t("library.categoryNameEn")} value={typeForm.nameEn} onChange={(e) => setTypeForm({ ...typeForm, nameEn: e.target.value })} />
            <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={t("library.categoryNameAr")} value={typeForm.nameAr} onChange={(e) => setTypeForm({ ...typeForm, nameAr: e.target.value })} />
            <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={t("library.categoryNameFr")} value={typeForm.nameFr} onChange={(e) => setTypeForm({ ...typeForm, nameFr: e.target.value })} />
            <div className="flex gap-2">
              <PrimaryButton onClick={() => createTypeMutation.mutate(typeForm)} disabled={!typeForm.code || !typeForm.slug || !typeForm.nameEn || !typeForm.nameAr || !typeForm.nameFr}>{t("actions.create")}</PrimaryButton>
              <button
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                onClick={() => {
                  setShowTypeForm(false);
                  setTypeForm(EMPTY_TYPE_FORM);
                }}
                type="button"
              >
                {t("actions.cancel")}
              </button>
            </div>
          </div>
        ) : null}

        {typesQuery.isError ? (
          <ErrorState title={t("errors.title")} description={(typesQuery.error as Error)?.message ?? t("errors.fallback")} />
        ) : (
          <div className="mt-3 space-y-2">
            {(typesQuery.data ?? []).map((type) => (
              <div key={type.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex-1">
                  <p className="font-medium">{isArabic ? type.nameAr : isFrench ? type.nameFr : type.nameEn}</p>
                  <p className="text-xs text-slate-500">{type.code} · {type.slug}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${type.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{type.isActive ? t("labels.active") : t("labels.inactive")}</span>
                <button className="rounded-lg p-1 text-slate-500 hover:text-accent" onClick={() => {
                  setEditingTypeId(type.id);
                  setTypeForm({
                    code: type.code,
                    slug: type.slug,
                    nameAr: type.nameAr,
                    nameEn: type.nameEn,
                    nameFr: type.nameFr,
                    isActive: type.isActive
                  });
                }}><Pencil className="size-4" /></button>
                <button className="rounded-lg p-1 text-slate-500 hover:text-amber-600" onClick={() => updateTypeMutation.mutate({ id: type.id, data: { isActive: !type.isActive } })}>{type.isActive ? <Power className="size-4" /> : <RotateCcw className="size-4" />}</button>
              </div>
            ))}
            {editingTypeId ? (
              <div className="rounded-xl border border-accent/30 bg-accentSoft p-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={typeForm.code} onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase() })} />
                  <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={typeForm.slug} onChange={(e) => setTypeForm({ ...typeForm, slug: e.target.value })} />
                  <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={typeForm.nameEn} onChange={(e) => setTypeForm({ ...typeForm, nameEn: e.target.value })} />
                </div>
                <div className="mt-2 flex gap-2">
                  <PrimaryButton onClick={() => updateTypeMutation.mutate({ id: editingTypeId, data: typeForm })}>{t("actions.save")}</PrimaryButton>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </SectionCard>

      <SectionCard title={t("library.categories")}> 
        <SelectField
          label={t("library.type")}
          value={selectedType}
          onChange={(value) => {
            setSelectedType(value);
            setCategoryForm((current) => ({ ...current, typeId: value, parentId: "" }));
          }}
          options={(typesQuery.data ?? []).filter((type) => type.isActive).map((type) => ({
            value: type.id,
            label: isArabic ? type.nameAr : isFrench ? type.nameFr : type.nameEn
          }))}
        />

        {showCategoryForm ? (
          <div className="mt-3">
            <CategoryForm
              allCategories={flatCategories.map(({ node, depth }) => ({
                id: node.id,
                label: `${"\u00A0".repeat(depth * 2)}${isArabic ? node.nameAr : isFrench ? node.nameFr : node.nameEn}`
              }))}
              form={categoryForm}
              submitLabel={t("actions.create")}
              isPending={createCategoryMutation.isPending}
              t={t}
              onChange={setCategoryForm}
              onCancel={() => setShowCategoryForm(false)}
              onSubmit={() => createCategoryMutation.mutate(categoryForm)}
            />
          </div>
        ) : null}

        {categoriesQuery.isLoading ? <p className="mt-3 text-sm text-slate-500">{t("library.categoriesLoading")}</p> : null}
        {categoriesQuery.isError ? <ErrorState title={t("errors.title")} description={(categoriesQuery.error as Error)?.message ?? t("errors.fallback")} /> : null}
        {!categoriesQuery.isLoading && !categoriesQuery.isError && !flatCategories.length ? <EmptyState title={t("empty.noCategories")} description={t("empty.noCategoriesHelp")} /> : null}

        <div className="mt-3 space-y-2">
          {flatCategories.map(({ node, depth, parentId }) => (
            <div key={node.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3" style={{ marginInlineStart: `${depth * 16}px` }}>
              <div className="flex-1">
                <p className="font-medium">{isArabic ? node.nameAr : isFrench ? node.nameFr : node.nameEn}</p>
                <p className="text-xs text-slate-500">{node.slug}</p>
              </div>
              <button className="rounded-lg p-1 text-slate-500 hover:text-accent" onClick={() => {
                setEditingCategoryId(node.id);
                setCategoryForm({
                  typeId: selectedType,
                  nameAr: node.nameAr,
                  nameEn: node.nameEn,
                  nameFr: node.nameFr,
                  slug: node.slug,
                  parentId: parentId ?? ""
                });
              }}><Pencil className="size-4" /></button>
              <button className="rounded-lg p-1 text-slate-500 hover:text-red-500" onClick={() => deleteCategoryMutation.mutate(node.id)}><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>

        {editingCategoryId ? (
          <div className="mt-3 rounded-2xl border border-accent/30 bg-accentSoft p-4">
            <CategoryForm
              allCategories={flatCategories
                .filter(({ node }) => node.id !== editingCategoryId)
                .map(({ node, depth }) => ({
                  id: node.id,
                  label: `${"\u00A0".repeat(depth * 2)}${isArabic ? node.nameAr : isFrench ? node.nameFr : node.nameEn}`
                }))}
              form={categoryForm}
              submitLabel={t("actions.save")}
              isPending={updateCategoryMutation.isPending}
              t={t}
              onChange={setCategoryForm}
              onCancel={() => setEditingCategoryId(null)}
              onSubmit={() => updateCategoryMutation.mutate({ id: editingCategoryId, data: categoryForm })}
            />
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
    typeId: string;
    nameAr: string;
    nameEn: string;
    nameFr: string;
    slug: string;
    parentId: string;
  };
  allCategories: { id: string; label: string }[];
  submitLabel: string;
  isPending: boolean;
  t: (key: string) => string;
  onChange: (form: {
    typeId: string;
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
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent" dir="rtl" type="text" value={form.nameAr} onChange={(e) => onChange({ ...form, nameAr: e.target.value })} />
        </FieldWrap>
        <FieldWrap label={t("library.categoryNameEn")}>
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent" type="text" value={form.nameEn} onChange={(e) => onChange({ ...form, nameEn: e.target.value })} />
        </FieldWrap>
        <FieldWrap label={t("library.categoryNameFr")}>
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent" type="text" value={form.nameFr} onChange={(e) => onChange({ ...form, nameFr: e.target.value })} />
        </FieldWrap>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldWrap label={t("library.categorySlug")}>
          <input className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-accent" type="text" value={form.slug} onChange={(e) => onChange({ ...form, slug: e.target.value })} />
        </FieldWrap>
        <SelectField
          label={t("library.parentCategory")}
          value={form.parentId}
          onChange={(value) => onChange({ ...form, parentId: value })}
          options={[{ value: "", label: t("library.noParent") }, ...allCategories.map((category) => ({ value: category.id, label: category.label }))]}
        />
      </div>
      <div className="flex gap-2">
        <PrimaryButton disabled={!form.typeId || !form.nameAr.trim() || !form.nameEn.trim() || !form.nameFr.trim() || !form.slug.trim() || isPending} onClick={onSubmit}>{submitLabel}</PrimaryButton>
        <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm" onClick={onCancel}>{t("actions.cancel")}</button>
      </div>
    </div>
  );
}
