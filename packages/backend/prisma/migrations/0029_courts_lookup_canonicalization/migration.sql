-- Canonicalize CourtType and CourtLevel lookups and remove CaseCourt.caseNumber.

-- 1) Upsert canonical CourtType system rows (15)
WITH canonical(entity, key, label_ar, label_en, label_fr, sort_order) AS (
  VALUES
    ('CourtType','CIVIL_COURT','محكمة مدنية','Civil Court','Tribunal civil',0),
    ('CourtType','FAMILY_COURT','محكمة الأسرة','Family Court','Tribunal de la famille',1),
    ('CourtType','MISDEMEANOR_COURT','محكمة الجنح','Misdemeanor Court','Tribunal correctionnel',2),
    ('CourtType','CRIMINAL_COURT','محكمة الجنايات','Criminal Court','Cour criminelle',3),
    ('CourtType','ECONOMIC_COURT','المحكمة الاقتصادية','Economic Court','Tribunal économique',4),
    ('CourtType','STATE_COUNCIL_ADMINISTRATIVE_COURT','مجلس الدولة - محكمة القضاء الإداري','State Council - Administrative Court','Conseil d''État - Tribunal administratif',5),
    ('CourtType','STATE_COUNCIL_DISCIPLINARY_COURT','مجلس الدولة - المحكمة التأديبية','State Council - Disciplinary Court','Conseil d''État - Tribunal disciplinaire',6),
    ('CourtType','STATE_COUNCIL_SUPREME_ADMINISTRATIVE_COURT','مجلس الدولة - المحكمة الإدارية العليا','State Council - Supreme Administrative Court','Conseil d''État - Haute Cour administrative',7),
    ('CourtType','SUPREME_CONSTITUTIONAL_COURT','المحكمة الدستورية العليا','Supreme Constitutional Court','Haute Cour constitutionnelle',8),
    ('CourtType','COURT_OF_URGENT_MATTERS','محكمة الأمور المستعجلة','Court of Urgent Matters','Tribunal des référés',9),
    ('CourtType','LABOR_COURT','المحكمة العمالية','Labor Court','Tribunal du travail',10),
    ('CourtType','COURT_OF_CASSATION','محكمة النقض','Court of Cassation','Cour de cassation',11),
    ('CourtType','JUVENILE_CHILD_COURT','محكمة الأحداث / الطفل','Juvenile / Child Court','Tribunal pour mineurs / enfants',12),
    ('CourtType','TRAFFIC_COURT','محكمة المرور','Traffic Court','Tribunal de la circulation',13),
    ('CourtType','STATE_SECURITY_COURT','محكمة أمن الدولة','State Security Court','Tribunal de sûreté de l''État',14)
)
INSERT INTO "LookupOption" ("id","firmId","entity","key","labelAr","labelEn","labelFr","isSystem","isActive","sortOrder","createdAt","updatedAt")
SELECT gen_random_uuid(), NULL, c.entity, c.key, c.label_ar, c.label_en, c.label_fr, true, true, c.sort_order, now(), now()
FROM canonical c
ON CONFLICT ("firmId","entity","key") DO UPDATE
SET "labelAr" = EXCLUDED."labelAr",
    "labelEn" = EXCLUDED."labelEn",
    "labelFr" = EXCLUDED."labelFr",
    "isSystem" = true,
    "isActive" = true,
    "sortOrder" = EXCLUDED."sortOrder",
    "updatedAt" = now();

-- Deactivate legacy/non-canonical system CourtType keys
UPDATE "LookupOption"
SET "isActive" = false,
    "isSystem" = true,
    "updatedAt" = now()
WHERE "firmId" IS NULL
  AND "entity" = 'CourtType'
  AND "key" NOT IN (
    'CIVIL_COURT','FAMILY_COURT','MISDEMEANOR_COURT','CRIMINAL_COURT','ECONOMIC_COURT',
    'STATE_COUNCIL_ADMINISTRATIVE_COURT','STATE_COUNCIL_DISCIPLINARY_COURT','STATE_COUNCIL_SUPREME_ADMINISTRATIVE_COURT',
    'SUPREME_CONSTITUTIONAL_COURT','COURT_OF_URGENT_MATTERS','LABOR_COURT','COURT_OF_CASSATION',
    'JUVENILE_CHILD_COURT','TRAFFIC_COURT','STATE_SECURITY_COURT'
  );

-- 2) Canonicalize CourtLevel to 4 keys
WITH canonical(entity, key, label_ar, label_en, label_fr, sort_order) AS (
  VALUES
    ('CourtLevel','PARTIAL','جزئي','Partial / Summary','Partiel / sommaire',0),
    ('CourtLevel','PRIMARY','ابتدائي','Primary','Premier degré',1),
    ('CourtLevel','APPEAL','استئناف','Appeal','Appel',2),
    ('CourtLevel','CASSATION','نقض / عليا','Cassation / Supreme','Cassation / suprême',3)
)
INSERT INTO "LookupOption" ("id","firmId","entity","key","labelAr","labelEn","labelFr","isSystem","isActive","sortOrder","createdAt","updatedAt")
SELECT gen_random_uuid(), NULL, c.entity, c.key, c.label_ar, c.label_en, c.label_fr, true, true, c.sort_order, now(), now()
FROM canonical c
ON CONFLICT ("firmId","entity","key") DO UPDATE
SET "labelAr" = EXCLUDED."labelAr",
    "labelEn" = EXCLUDED."labelEn",
    "labelFr" = EXCLUDED."labelFr",
    "isSystem" = true,
    "isActive" = true,
    "sortOrder" = EXCLUDED."sortOrder",
    "updatedAt" = now();

-- Remap existing CaseCourt rows to canonical levels
UPDATE "CaseCourt" SET "courtLevel" = 'APPEAL' WHERE "courtLevel" = 'ADMINISTRATIVE';
UPDATE "CaseCourt" SET "courtLevel" = 'CASSATION' WHERE "courtLevel" = 'CONSTITUTIONAL_HIGH';
UPDATE "CaseCourt" SET "courtLevel" = 'PARTIAL' WHERE "courtLevel" = 'MISDEMEANOR';
UPDATE "CaseCourt" SET "courtLevel" = 'PRIMARY' WHERE "courtLevel" = 'FELONY';

-- Deactivate legacy/non-canonical system CourtLevel keys
UPDATE "LookupOption"
SET "isActive" = false,
    "isSystem" = true,
    "updatedAt" = now()
WHERE "firmId" IS NULL
  AND "entity" = 'CourtLevel'
  AND "key" NOT IN ('PARTIAL','PRIMARY','APPEAL','CASSATION');

-- 3) Remove Case number from court stages
ALTER TABLE "CaseCourt" DROP COLUMN IF EXISTS "caseNumber";
