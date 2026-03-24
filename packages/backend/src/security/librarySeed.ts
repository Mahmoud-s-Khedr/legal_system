import type { PrismaClient } from "@prisma/client";

interface CategoryRow {
  slug: string;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  children?: Omit<CategoryRow, "children">[];
}

const SYSTEM_CATEGORIES: CategoryRow[] = [
  {
    slug: "civil-law",
    nameAr: "القانون المدني",
    nameEn: "Civil Law",
    nameFr: "Civil Law",
    children: [
      { slug: "civil-contracts", nameAr: "العقود", nameEn: "Contracts", nameFr: "Contracts" },
      { slug: "civil-property", nameAr: "الملكية", nameEn: "Property", nameFr: "Property" },
      { slug: "civil-obligations", nameAr: "الالتزامات", nameEn: "Obligations", nameFr: "Obligations" },
      { slug: "civil-torts", nameAr: "المسؤولية التقصيرية", nameEn: "Torts", nameFr: "Torts" }
    ]
  },
  {
    slug: "criminal-law",
    nameAr: "قانون العقوبات",
    nameEn: "Criminal Law",
    nameFr: "Criminal Law",
    children: [
      { slug: "criminal-general", nameAr: "الأحكام العامة", nameEn: "General Provisions", nameFr: "General Provisions" },
      { slug: "criminal-offences", nameAr: "الجرائم", nameEn: "Offences", nameFr: "Offences" },
      { slug: "criminal-procedure", nameAr: "الإجراءات الجنائية", nameEn: "Criminal Procedure", nameFr: "Criminal Procedure" }
    ]
  },
  {
    slug: "commercial-law",
    nameAr: "القانون التجاري",
    nameEn: "Commercial Law",
    nameFr: "Commercial Law",
    children: [
      { slug: "commercial-companies", nameAr: "الشركات", nameEn: "Companies", nameFr: "Companies" },
      { slug: "commercial-contracts", nameAr: "العقود التجارية", nameEn: "Commercial Contracts", nameFr: "Commercial Contracts" },
      { slug: "commercial-bankruptcy", nameAr: "الإفلاس والإعسار", nameEn: "Bankruptcy & Insolvency", nameFr: "Bankruptcy & Insolvency" },
      { slug: "commercial-securities", nameAr: "الأوراق المالية", nameEn: "Securities", nameFr: "Securities" }
    ]
  },
  {
    slug: "administrative-law",
    nameAr: "القانون الإداري",
    nameEn: "Administrative Law",
    nameFr: "Administrative Law",
    children: [
      { slug: "admin-decisions", nameAr: "القرارات الإدارية", nameEn: "Administrative Decisions", nameFr: "Administrative Decisions" },
      { slug: "admin-contracts", nameAr: "العقود الإدارية", nameEn: "Administrative Contracts", nameFr: "Administrative Contracts" },
      { slug: "admin-procedure", nameAr: "الإجراءات الإدارية", nameEn: "Administrative Procedure", nameFr: "Administrative Procedure" }
    ]
  },
  {
    slug: "labor-law",
    nameAr: "قانون العمل",
    nameEn: "Labor Law",
    nameFr: "Labor Law",
    children: [
      { slug: "labor-contracts", nameAr: "عقود العمل", nameEn: "Employment Contracts", nameFr: "Employment Contracts" },
      { slug: "labor-rights", nameAr: "حقوق العمال", nameEn: "Worker Rights", nameFr: "Worker Rights" },
      { slug: "labor-social-insurance", nameAr: "التأمينات الاجتماعية", nameEn: "Social Insurance", nameFr: "Social Insurance" }
    ]
  },
  {
    slug: "family-law",
    nameAr: "قانون الأسرة",
    nameEn: "Family Law",
    nameFr: "Family Law",
    children: [
      { slug: "family-marriage", nameAr: "الزواج والطلاق", nameEn: "Marriage & Divorce", nameFr: "Marriage & Divorce" },
      { slug: "family-custody", nameAr: "الحضانة والولاية", nameEn: "Custody & Guardianship", nameFr: "Custody & Guardianship" },
      { slug: "family-inheritance", nameAr: "الميراث", nameEn: "Inheritance", nameFr: "Inheritance" },
      { slug: "family-alimony", nameAr: "النفقة والمؤنة", nameEn: "Alimony & Support", nameFr: "Alimony & Support" }
    ]
  },
  {
    slug: "constitutional-law",
    nameAr: "القانون الدستوري",
    nameEn: "Constitutional Law",
    nameFr: "Constitutional Law",
    children: [
      { slug: "constitutional-rights", nameAr: "الحقوق الأساسية", nameEn: "Fundamental Rights", nameFr: "Fundamental Rights" },
      { slug: "constitutional-institutions", nameAr: "المؤسسات الدستورية", nameEn: "State Institutions", nameFr: "State Institutions" }
    ]
  },
  {
    slug: "international-law",
    nameAr: "القانون الدولي",
    nameEn: "International Law",
    nameFr: "International Law",
    children: [
      { slug: "international-private", nameAr: "القانون الدولي الخاص", nameEn: "Private International Law", nameFr: "Private International Law" },
      { slug: "international-public", nameAr: "القانون الدولي العام", nameEn: "Public International Law", nameFr: "Public International Law" },
      { slug: "international-treaties", nameAr: "المعاهدات والاتفاقيات", nameEn: "Treaties & Conventions", nameFr: "Treaties & Conventions" }
    ]
  }
];

async function upsertCategory(
  prisma: PrismaClient,
  cat: Omit<CategoryRow, "children">,
  parentId?: string
) {
  // slug is unique per (firmId, slug) — for system categories firmId is null
  const existing = await prisma.legalCategory.findFirst({
    where: { firmId: null, slug: cat.slug }
  });
  if (existing) {
    return prisma.legalCategory.update({
      where: { id: existing.id },
      data: {
        nameAr: cat.nameAr,
        nameEn: cat.nameEn,
        nameFr: cat.nameFr,
        parentId: parentId ?? null
      }
    });
  }
  return prisma.legalCategory.create({
    data: {
      slug: cat.slug,
      nameAr: cat.nameAr,
      nameEn: cat.nameEn,
      nameFr: cat.nameFr,
      parentId: parentId ?? null
    }
  });
}

export async function ensureSystemLibraryCategories(prisma: PrismaClient): Promise<void> {
  for (const cat of SYSTEM_CATEGORIES) {
    const parent = await upsertCategory(prisma, cat);

    if (cat.children) {
      for (const child of cat.children) {
        await upsertCategory(prisma, child, parent.id);
      }
    }
  }

  console.log("✅ System library categories seeded");
}
