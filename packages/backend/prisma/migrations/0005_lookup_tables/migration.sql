-- Migration 0005: Lookup Tables
-- Converts 8 PostgreSQL ENUM types to a single LookupOption table
-- allowing firm admins to define custom values.

-- ============================================================
-- PART 1: Create the LookupOption table
-- ============================================================

CREATE TABLE "LookupOption" (
  "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
  "firmId"    UUID,
  "entity"    TEXT         NOT NULL,
  "key"       TEXT         NOT NULL,
  "labelAr"   TEXT         NOT NULL,
  "labelEn"   TEXT         NOT NULL,
  "labelFr"   TEXT         NOT NULL,
  "isSystem"  BOOLEAN      NOT NULL DEFAULT true,
  "isActive"  BOOLEAN      NOT NULL DEFAULT true,
  "sortOrder" INTEGER      NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LookupOption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LookupOption_firmId_fkey" FOREIGN KEY ("firmId")
    REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LookupOption_firmId_entity_key_key"
  ON "LookupOption" ("firmId", "entity", "key");

CREATE INDEX "LookupOption_entity_isActive_idx"
  ON "LookupOption" ("entity", "isActive");

-- ============================================================
-- PART 2: Convert ENUM columns to TEXT
-- The USING clause preserves existing values as their text form.
-- ============================================================

ALTER TABLE "Case"            ALTER COLUMN "type"       TYPE TEXT USING "type"::TEXT;
ALTER TABLE "Case"            ALTER COLUMN "courtLevel"  TYPE TEXT USING "courtLevel"::TEXT;
ALTER TABLE "CaseParty"       ALTER COLUMN "role"        TYPE TEXT USING "role"::TEXT;
ALTER TABLE "Document"        ALTER COLUMN "type"        TYPE TEXT USING "type"::TEXT;
ALTER TABLE "Invoice"         ALTER COLUMN "feeType"     TYPE TEXT USING "feeType"::TEXT;
ALTER TABLE "Payment"         ALTER COLUMN "method"      TYPE TEXT USING "method"::TEXT;
ALTER TABLE "Expense"         ALTER COLUMN "category"    TYPE TEXT USING "category"::TEXT;
ALTER TABLE "LibraryDocument" ALTER COLUMN "type"        TYPE TEXT USING "type"::TEXT;

-- ============================================================
-- PART 3: Drop the old PostgreSQL ENUM types
-- ============================================================

DROP TYPE IF EXISTS "CaseType";
DROP TYPE IF EXISTS "CourtLevel";
DROP TYPE IF EXISTS "PartyRole";
DROP TYPE IF EXISTS "DocumentType";
DROP TYPE IF EXISTS "PaymentMethod";
DROP TYPE IF EXISTS "FeeType";
DROP TYPE IF EXISTS "ExpenseCategory";
DROP TYPE IF EXISTS "LibraryDocType";

-- ============================================================
-- PART 4: Seed system lookup rows for all 8 entities
-- ON CONFLICT DO NOTHING makes this safe to re-run.
-- NULL firmId = system-wide default visible to all firms.
-- ============================================================

INSERT INTO "LookupOption" ("id","firmId","entity","key","labelAr","labelEn","labelFr","isSystem","isActive","sortOrder") VALUES
  -- CaseType
  (gen_random_uuid(), NULL, 'CaseType', 'CIVIL',               'مدني',                'Civil',               'Civil',               true, true, 0),
  (gen_random_uuid(), NULL, 'CaseType', 'CRIMINAL',             'جنائي',               'Criminal',            'Pénal',               true, true, 1),
  (gen_random_uuid(), NULL, 'CaseType', 'COMMERCIAL',           'تجاري',               'Commercial',          'Commercial',          true, true, 2),
  (gen_random_uuid(), NULL, 'CaseType', 'FAMILY',               'أسري',                'Family',              'Famille',             true, true, 3),
  (gen_random_uuid(), NULL, 'CaseType', 'ADMINISTRATIVE',       'إداري',               'Administrative',      'Administratif',       true, true, 4),
  (gen_random_uuid(), NULL, 'CaseType', 'CONSTITUTIONAL',       'دستوري',              'Constitutional',      'Constitutionnel',     true, true, 5),
  (gen_random_uuid(), NULL, 'CaseType', 'LABOR',                'عمالي',               'Labor',               'Travail',             true, true, 6),
  (gen_random_uuid(), NULL, 'CaseType', 'REAL_ESTATE',          'عقاري',               'Real Estate',         'Immobilier',          true, true, 7),
  (gen_random_uuid(), NULL, 'CaseType', 'INTELLECTUAL_PROPERTY','ملكية فكرية',          'Intellectual Property','Propriété intellectuelle', true, true, 8),
  -- CourtLevel
  (gen_random_uuid(), NULL, 'CourtLevel', 'PRIMARY',            'ابتدائي',             'Primary',             'Premier degré',       true, true, 0),
  (gen_random_uuid(), NULL, 'CourtLevel', 'APPEAL',             'استئناف',             'Appeal',              'Appel',               true, true, 1),
  (gen_random_uuid(), NULL, 'CourtLevel', 'CASSATION',          'نقض',                 'Cassation',           'Cassation',           true, true, 2),
  (gen_random_uuid(), NULL, 'CourtLevel', 'ADMINISTRATIVE',     'إداري',               'Administrative',      'Administratif',       true, true, 3),
  (gen_random_uuid(), NULL, 'CourtLevel', 'CONSTITUTIONAL_HIGH','دستورية عليا',         'Constitutional High', 'Constitutionnel Haut',true, true, 4),
  (gen_random_uuid(), NULL, 'CourtLevel', 'PARTIAL',            'جزئي',                'Partial',             'Partiel',             true, true, 5),
  (gen_random_uuid(), NULL, 'CourtLevel', 'MISDEMEANOR',        'جنح',                 'Misdemeanor',         'Correctionnel',       true, true, 6),
  (gen_random_uuid(), NULL, 'CourtLevel', 'FELONY',             'جنايات',              'Felony',              'Criminel',            true, true, 7),
  -- PartyRole
  (gen_random_uuid(), NULL, 'PartyRole', 'PLAINTIFF',           'مدعي',                'Plaintiff',           'Demandeur',           true, true, 0),
  (gen_random_uuid(), NULL, 'PartyRole', 'DEFENDANT',           'مدعى عليه',           'Defendant',           'Défendeur',           true, true, 1),
  (gen_random_uuid(), NULL, 'PartyRole', 'COMPLAINANT',         'مشتكي',               'Complainant',         'Plaignant',           true, true, 2),
  (gen_random_uuid(), NULL, 'PartyRole', 'APPELLANT',           'طاعن',                'Appellant',           'Appelant',            true, true, 3),
  (gen_random_uuid(), NULL, 'PartyRole', 'RESPONDENT',          'مطعون ضده',           'Respondent',          'Intimé',              true, true, 4),
  (gen_random_uuid(), NULL, 'PartyRole', 'OPPOSING_COUNSEL',    'محامي الخصم',         'Opposing Counsel',    'Avocat adverse',      true, true, 5),
  (gen_random_uuid(), NULL, 'PartyRole', 'WITNESS',             'شاهد',                'Witness',             'Témoin',              true, true, 6),
  (gen_random_uuid(), NULL, 'PartyRole', 'EXPERT',              'خبير',                'Expert',              'Expert',              true, true, 7),
  -- DocumentType
  (gen_random_uuid(), NULL, 'DocumentType', 'GENERAL',          'عام',                 'General',             'Général',             true, true, 0),
  (gen_random_uuid(), NULL, 'DocumentType', 'CONTRACT',         'عقد',                 'Contract',            'Contrat',             true, true, 1),
  (gen_random_uuid(), NULL, 'DocumentType', 'COURT_FILING',     'مستند قضائي',         'Court Filing',        'Acte de procédure',   true, true, 2),
  (gen_random_uuid(), NULL, 'DocumentType', 'RECEIPT',          'إيصال',               'Receipt',             'Reçu',                true, true, 3),
  (gen_random_uuid(), NULL, 'DocumentType', 'POWER_OF_ATTORNEY','توكيل',               'Power of Attorney',   'Procuration',         true, true, 4),
  -- PaymentMethod
  (gen_random_uuid(), NULL, 'PaymentMethod', 'CASH',            'نقدي',                'Cash',                'Espèces',             true, true, 0),
  (gen_random_uuid(), NULL, 'PaymentMethod', 'BANK_TRANSFER',   'تحويل بنكي',          'Bank Transfer',       'Virement bancaire',   true, true, 1),
  (gen_random_uuid(), NULL, 'PaymentMethod', 'INSTAPAY',        'إنستاباي',            'InstaPay',            'InstaPay',            true, true, 2),
  (gen_random_uuid(), NULL, 'PaymentMethod', 'FAWRY',           'فوري',                'Fawry',               'Fawry',               true, true, 3),
  (gen_random_uuid(), NULL, 'PaymentMethod', 'PAYMOB_CARD',     'بطاقة بيموب',         'Paymob Card',         'Carte Paymob',        true, true, 4),
  (gen_random_uuid(), NULL, 'PaymentMethod', 'CHEQUE',          'شيك',                 'Cheque',              'Chèque',              true, true, 5),
  -- FeeType
  (gen_random_uuid(), NULL, 'FeeType', 'RETAINER',              'أتعاب ثابتة',         'Retainer',            'Provision',           true, true, 0),
  (gen_random_uuid(), NULL, 'FeeType', 'HOURLY',                'بالساعة',             'Hourly',              'Horaire',             true, true, 1),
  (gen_random_uuid(), NULL, 'FeeType', 'FIXED',                 'مبلغ ثابت',           'Fixed',               'Forfait',             true, true, 2),
  (gen_random_uuid(), NULL, 'FeeType', 'CONTINGENCY',           'نسبة من المكسب',      'Contingency',         'Honoraires au succès',true, true, 3),
  (gen_random_uuid(), NULL, 'FeeType', 'APPEARANCE',            'أتعاب جلسة',          'Appearance',          'Vacation',            true, true, 4),
  -- ExpenseCategory
  (gen_random_uuid(), NULL, 'ExpenseCategory', 'COURT_FEE',     'رسوم قضائية',         'Court Fee',           'Frais de justice',    true, true, 0),
  (gen_random_uuid(), NULL, 'ExpenseCategory', 'NOTARIZATION',  'توثيق',               'Notarization',        'Notarisation',        true, true, 1),
  (gen_random_uuid(), NULL, 'ExpenseCategory', 'TRANSLATION',   'ترجمة',               'Translation',         'Traduction',          true, true, 2),
  (gen_random_uuid(), NULL, 'ExpenseCategory', 'EXPERT_FEE',    'أتعاب خبير',          'Expert Fee',          'Honoraires d''expert', true, true, 3),
  (gen_random_uuid(), NULL, 'ExpenseCategory', 'TRAVEL',        'سفر',                 'Travel',              'Déplacement',         true, true, 4),
  (gen_random_uuid(), NULL, 'ExpenseCategory', 'POSTAGE',       'بريد',                'Postage',             'Frais postaux',       true, true, 5),
  (gen_random_uuid(), NULL, 'ExpenseCategory', 'OTHER',         'أخرى',                'Other',               'Autre',               true, true, 6),
  -- LibraryDocType
  (gen_random_uuid(), NULL, 'LibraryDocType', 'LEGISLATION',    'تشريع',               'Legislation',         'Législation',         true, true, 0),
  (gen_random_uuid(), NULL, 'LibraryDocType', 'JUDGMENT',       'حكم قضائي',           'Judgment',            'Jugement',            true, true, 1),
  (gen_random_uuid(), NULL, 'LibraryDocType', 'ARTICLE',        'مقال',                'Article',             'Article',             true, true, 2),
  (gen_random_uuid(), NULL, 'LibraryDocType', 'COMMENTARY',     'شرح',                 'Commentary',          'Commentaire',         true, true, 3)
ON CONFLICT DO NOTHING;

-- ============================================================
-- PART 5: Row-Level Security for LookupOption
-- System rows (firmId IS NULL) are visible to all.
-- Firm rows are visible only to their own firm.
-- ============================================================

ALTER TABLE "LookupOption" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lookup_option_visibility" ON "LookupOption"
  FOR ALL
  USING (
    "firmId" IS NULL
    OR "firmId"::text = current_setting('app.current_firm_id', true)
  );
