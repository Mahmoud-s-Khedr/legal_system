import type { PrismaClient } from "@prisma/client";

interface LookupRow {
  entity: string;
  key: string;
  labelAr: string;
  labelEn: string;
  labelFr: string;
  sortOrder: number;
}

const SYSTEM_LOOKUP_OPTIONS: LookupRow[] = [
  // CaseType
  { entity: "CaseType", key: "CIVIL",               labelAr: "مدني",               labelEn: "Civil",                labelFr: "Civil",                sortOrder: 0 },
  { entity: "CaseType", key: "CRIMINAL",             labelAr: "جنائي",              labelEn: "Criminal",             labelFr: "Pénal",                sortOrder: 1 },
  { entity: "CaseType", key: "COMMERCIAL",           labelAr: "تجاري",              labelEn: "Commercial",           labelFr: "Commercial",           sortOrder: 2 },
  { entity: "CaseType", key: "FAMILY",               labelAr: "أسري",               labelEn: "Family",               labelFr: "Famille",              sortOrder: 3 },
  { entity: "CaseType", key: "ADMINISTRATIVE",       labelAr: "إداري",              labelEn: "Administrative",       labelFr: "Administratif",        sortOrder: 4 },
  { entity: "CaseType", key: "CONSTITUTIONAL",       labelAr: "دستوري",             labelEn: "Constitutional",       labelFr: "Constitutionnel",      sortOrder: 5 },
  { entity: "CaseType", key: "LABOR",                labelAr: "عمالي",              labelEn: "Labor",                labelFr: "Travail",              sortOrder: 6 },
  { entity: "CaseType", key: "REAL_ESTATE",          labelAr: "عقاري",              labelEn: "Real Estate",          labelFr: "Immobilier",           sortOrder: 7 },
  { entity: "CaseType", key: "INTELLECTUAL_PROPERTY",labelAr: "ملكية فكرية",        labelEn: "Intellectual Property",labelFr: "Propriété intellectuelle", sortOrder: 8 },
  // CourtLevel
  { entity: "CourtLevel", key: "PRIMARY",            labelAr: "ابتدائي",            labelEn: "Primary",              labelFr: "Premier degré",        sortOrder: 0 },
  { entity: "CourtLevel", key: "APPEAL",             labelAr: "استئناف",            labelEn: "Appeal",               labelFr: "Appel",                sortOrder: 1 },
  { entity: "CourtLevel", key: "CASSATION",          labelAr: "نقض",                labelEn: "Cassation",            labelFr: "Cassation",            sortOrder: 2 },
  { entity: "CourtLevel", key: "ADMINISTRATIVE",     labelAr: "إداري",              labelEn: "Administrative",       labelFr: "Administratif",        sortOrder: 3 },
  { entity: "CourtLevel", key: "CONSTITUTIONAL_HIGH",labelAr: "دستورية عليا",       labelEn: "Constitutional High",  labelFr: "Constitutionnel Haut", sortOrder: 4 },
  { entity: "CourtLevel", key: "PARTIAL",            labelAr: "جزئي",               labelEn: "Partial",              labelFr: "Partiel",              sortOrder: 5 },
  { entity: "CourtLevel", key: "MISDEMEANOR",        labelAr: "جنح",                labelEn: "Misdemeanor",          labelFr: "Correctionnel",        sortOrder: 6 },
  { entity: "CourtLevel", key: "FELONY",             labelAr: "جنايات",             labelEn: "Felony",               labelFr: "Criminel",             sortOrder: 7 },
  // PartyRole
  { entity: "PartyRole", key: "PLAINTIFF",           labelAr: "مدعي",               labelEn: "Plaintiff",            labelFr: "Demandeur",            sortOrder: 0 },
  { entity: "PartyRole", key: "DEFENDANT",           labelAr: "مدعى عليه",          labelEn: "Defendant",            labelFr: "Défendeur",            sortOrder: 1 },
  { entity: "PartyRole", key: "COMPLAINANT",         labelAr: "مشتكي",              labelEn: "Complainant",          labelFr: "Plaignant",            sortOrder: 2 },
  { entity: "PartyRole", key: "APPELLANT",           labelAr: "طاعن",               labelEn: "Appellant",            labelFr: "Appelant",             sortOrder: 3 },
  { entity: "PartyRole", key: "RESPONDENT",          labelAr: "مطعون ضده",          labelEn: "Respondent",           labelFr: "Intimé",               sortOrder: 4 },
  { entity: "PartyRole", key: "OPPOSING_COUNSEL",    labelAr: "محامي الخصم",        labelEn: "Opposing Counsel",     labelFr: "Avocat adverse",       sortOrder: 5 },
  { entity: "PartyRole", key: "WITNESS",             labelAr: "شاهد",               labelEn: "Witness",              labelFr: "Témoin",               sortOrder: 6 },
  { entity: "PartyRole", key: "EXPERT",              labelAr: "خبير",               labelEn: "Expert",               labelFr: "Expert",               sortOrder: 7 },
  // DocumentType
  { entity: "DocumentType", key: "GENERAL",          labelAr: "عام",                labelEn: "General",              labelFr: "Général",              sortOrder: 0 },
  { entity: "DocumentType", key: "CONTRACT",         labelAr: "عقد",                labelEn: "Contract",             labelFr: "Contrat",              sortOrder: 1 },
  { entity: "DocumentType", key: "COURT_FILING",     labelAr: "مستند قضائي",        labelEn: "Court Filing",         labelFr: "Acte de procédure",    sortOrder: 2 },
  { entity: "DocumentType", key: "RECEIPT",          labelAr: "إيصال",              labelEn: "Receipt",              labelFr: "Reçu",                 sortOrder: 3 },
  { entity: "DocumentType", key: "POWER_OF_ATTORNEY",labelAr: "توكيل",              labelEn: "Power of Attorney",    labelFr: "Procuration",          sortOrder: 4 },
  // PaymentMethod
  { entity: "PaymentMethod", key: "CASH",            labelAr: "نقدي",               labelEn: "Cash",                 labelFr: "Espèces",              sortOrder: 0 },
  { entity: "PaymentMethod", key: "BANK_TRANSFER",   labelAr: "تحويل بنكي",         labelEn: "Bank Transfer",        labelFr: "Virement bancaire",    sortOrder: 1 },
  { entity: "PaymentMethod", key: "INSTAPAY",        labelAr: "إنستاباي",           labelEn: "InstaPay",             labelFr: "InstaPay",             sortOrder: 2 },
  { entity: "PaymentMethod", key: "FAWRY",           labelAr: "فوري",               labelEn: "Fawry",                labelFr: "Fawry",                sortOrder: 3 },
  { entity: "PaymentMethod", key: "PAYMOB_CARD",     labelAr: "بطاقة بيموب",        labelEn: "Paymob Card",          labelFr: "Carte Paymob",         sortOrder: 4 },
  { entity: "PaymentMethod", key: "CHEQUE",          labelAr: "شيك",                labelEn: "Cheque",               labelFr: "Chèque",               sortOrder: 5 },
  // FeeType
  { entity: "FeeType", key: "RETAINER",              labelAr: "أتعاب ثابتة",        labelEn: "Retainer",             labelFr: "Provision",            sortOrder: 0 },
  { entity: "FeeType", key: "HOURLY",                labelAr: "بالساعة",            labelEn: "Hourly",               labelFr: "Horaire",              sortOrder: 1 },
  { entity: "FeeType", key: "FIXED",                 labelAr: "مبلغ ثابت",          labelEn: "Fixed",                labelFr: "Forfait",              sortOrder: 2 },
  { entity: "FeeType", key: "CONTINGENCY",           labelAr: "نسبة من المكسب",     labelEn: "Contingency",          labelFr: "Honoraires au succès", sortOrder: 3 },
  { entity: "FeeType", key: "APPEARANCE",            labelAr: "أتعاب جلسة",         labelEn: "Appearance",           labelFr: "Vacation",             sortOrder: 4 },
  // ExpenseCategory
  { entity: "ExpenseCategory", key: "COURT_FEE",     labelAr: "رسوم قضائية",        labelEn: "Court Fee",            labelFr: "Frais de justice",     sortOrder: 0 },
  { entity: "ExpenseCategory", key: "NOTARIZATION",  labelAr: "توثيق",              labelEn: "Notarization",         labelFr: "Notarisation",         sortOrder: 1 },
  { entity: "ExpenseCategory", key: "TRANSLATION",   labelAr: "ترجمة",              labelEn: "Translation",          labelFr: "Traduction",           sortOrder: 2 },
  { entity: "ExpenseCategory", key: "EXPERT_FEE",    labelAr: "أتعاب خبير",         labelEn: "Expert Fee",           labelFr: "Honoraires d'expert",  sortOrder: 3 },
  { entity: "ExpenseCategory", key: "TRAVEL",        labelAr: "سفر",                labelEn: "Travel",               labelFr: "Déplacement",          sortOrder: 4 },
  { entity: "ExpenseCategory", key: "POSTAGE",       labelAr: "بريد",               labelEn: "Postage",              labelFr: "Frais postaux",        sortOrder: 5 },
  { entity: "ExpenseCategory", key: "OTHER",         labelAr: "أخرى",               labelEn: "Other",                labelFr: "Autre",                sortOrder: 6 },
  // LibraryDocType
  { entity: "LibraryDocType", key: "LEGISLATION",    labelAr: "تشريع",              labelEn: "Legislation",          labelFr: "Législation",          sortOrder: 0 },
  { entity: "LibraryDocType", key: "JUDGMENT",       labelAr: "حكم قضائي",          labelEn: "Judgment",             labelFr: "Jugement",             sortOrder: 1 },
  { entity: "LibraryDocType", key: "ARTICLE",        labelAr: "مقال",               labelEn: "Article",              labelFr: "Article",              sortOrder: 2 },
  { entity: "LibraryDocType", key: "COMMENTARY",     labelAr: "شرح",                labelEn: "Commentary",           labelFr: "Commentaire",          sortOrder: 3 }
];

export async function ensureSystemLookupOptions(prisma: PrismaClient) {
  for (const row of SYSTEM_LOOKUP_OPTIONS) {
    const existing = await prisma.lookupOption.findFirst({
      where: { firmId: null, entity: row.entity, key: row.key }
    });

    if (existing) {
      await prisma.lookupOption.update({
        where: { id: existing.id },
        data: {
          labelAr: row.labelAr,
          labelEn: row.labelEn,
          labelFr: row.labelFr,
          sortOrder: row.sortOrder,
          isSystem: true,
          isActive: true
        }
      });
    } else {
      await prisma.lookupOption.create({
        data: {
          firmId: null,
          entity: row.entity,
          key: row.key,
          labelAr: row.labelAr,
          labelEn: row.labelEn,
          labelFr: row.labelFr,
          isSystem: true,
          isActive: true,
          sortOrder: row.sortOrder
        }
      });
    }
  }
}
