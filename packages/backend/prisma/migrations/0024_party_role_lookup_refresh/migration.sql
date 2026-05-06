WITH canonical_roles(entity, key, label_ar, label_en, label_fr, sort_order) AS (
  VALUES
    ('PartyRole', 'PLAINTIFF', 'مدعي', 'Plaintiff', 'Demandeur', 0),
    ('PartyRole', 'DEFENDANT', 'مدعى عليه', 'Defendant', 'Défendeur', 1),
    ('PartyRole', 'EXECUTING_PARTY', 'طالب التنفيذ', 'Executing Party', 'Partie poursuivante', 2),
    ('PartyRole', 'EXECUTED_AGAINST', 'منفذ ضده', 'Executed Against', 'Partie exécutée contre', 3),
    ('PartyRole', 'GARNISHEE_THIRD_PARTY_HOLDER', 'محجوز لديه', 'Garnishee / Third Party Holder', 'Tiers saisi / détenteur', 4),
    ('PartyRole', 'PUBLIC_PROSECUTION', 'نيابة عامة', 'Public Prosecution', 'Ministère public', 5),
    ('PartyRole', 'COMPLAINANT_VICTIM', 'شاكي / مجني عليه / مُبلغ', 'Complainant / Victim', 'Plaignant / victime', 6),
    ('PartyRole', 'ACCUSED_DEFENDANT', 'متهم', 'Accused/Defendant', 'Accusé / prévenu', 7),
    ('PartyRole', 'OBJECTOR', 'معارض', 'Objector', 'Opposant', 8),
    ('PartyRole', 'CIVIL_RIGHTS_CLAIMANT', 'مدعي بالحق المدني', 'Civil Rights Claimant', 'Demandeur civil', 9),
    ('PartyRole', 'CIVILLY_RESPONSIBLE_PARTY', 'مسؤول عن الحقوق المدنية', 'Civilly Responsible Party', 'Responsable civil', 10),
    ('PartyRole', 'APPELLANT', 'مستأنف', 'Appellant', 'Appelant', 11),
    ('PartyRole', 'APPELLEE', 'مستأنف ضده', 'Appellee', 'Intimé', 12),
    ('PartyRole', 'CASSATION_PETITIONER', 'طاعن', 'Cassation Petitioner', 'Demandeur en cassation', 13),
    ('PartyRole', 'CASSATION_RESPONDENT', 'مطعون ضده', 'Cassation Respondent', 'Défendeur en cassation', 14),
    ('PartyRole', 'INTERVENER', 'خصم متدخل', 'Intervener', 'Intervenant', 15),
    ('PartyRole', 'BROUGHT_IN_PARTY_IMPLEADED', 'خصم مدخل', 'Brought-in Party / Impleaded', 'Partie mise en cause', 16),
    ('PartyRole', 'GUARANTOR', 'ضامن', 'Guarantor', 'Garant', 17),
    ('PartyRole', 'LEGAL_REPRESENTATIVE_GUARDIAN', 'ممثل قانوني / ولي / وصي / قيم', 'Legal Representative / Guardian', 'Représentant légal / tuteur', 18),
    ('PartyRole', 'EXPERT', 'خبير', 'Expert', 'Expert', 19),
    ('PartyRole', 'ARBITRATOR', 'محكم', 'Arbitrator', 'Arbitre', 20),
    ('PartyRole', 'WITNESS', 'شاهد', 'Witness', 'Témoin', 21)
)
UPDATE "LookupOption" lo
SET
  "labelAr" = cr.label_ar,
  "labelEn" = cr.label_en,
  "labelFr" = cr.label_fr,
  "sortOrder" = cr.sort_order,
  "isSystem" = true,
  "isActive" = true,
  "updatedAt" = NOW()
FROM canonical_roles cr
WHERE lo."firmId" IS NULL
  AND lo.entity = cr.entity
  AND lo.key = cr.key;

WITH canonical_roles(entity, key, label_ar, label_en, label_fr, sort_order) AS (
  VALUES
    ('PartyRole', 'PLAINTIFF', 'مدعي', 'Plaintiff', 'Demandeur', 0),
    ('PartyRole', 'DEFENDANT', 'مدعى عليه', 'Defendant', 'Défendeur', 1),
    ('PartyRole', 'EXECUTING_PARTY', 'طالب التنفيذ', 'Executing Party', 'Partie poursuivante', 2),
    ('PartyRole', 'EXECUTED_AGAINST', 'منفذ ضده', 'Executed Against', 'Partie exécutée contre', 3),
    ('PartyRole', 'GARNISHEE_THIRD_PARTY_HOLDER', 'محجوز لديه', 'Garnishee / Third Party Holder', 'Tiers saisi / détenteur', 4),
    ('PartyRole', 'PUBLIC_PROSECUTION', 'نيابة عامة', 'Public Prosecution', 'Ministère public', 5),
    ('PartyRole', 'COMPLAINANT_VICTIM', 'شاكي / مجني عليه / مُبلغ', 'Complainant / Victim', 'Plaignant / victime', 6),
    ('PartyRole', 'ACCUSED_DEFENDANT', 'متهم', 'Accused/Defendant', 'Accusé / prévenu', 7),
    ('PartyRole', 'OBJECTOR', 'معارض', 'Objector', 'Opposant', 8),
    ('PartyRole', 'CIVIL_RIGHTS_CLAIMANT', 'مدعي بالحق المدني', 'Civil Rights Claimant', 'Demandeur civil', 9),
    ('PartyRole', 'CIVILLY_RESPONSIBLE_PARTY', 'مسؤول عن الحقوق المدنية', 'Civilly Responsible Party', 'Responsable civil', 10),
    ('PartyRole', 'APPELLANT', 'مستأنف', 'Appellant', 'Appelant', 11),
    ('PartyRole', 'APPELLEE', 'مستأنف ضده', 'Appellee', 'Intimé', 12),
    ('PartyRole', 'CASSATION_PETITIONER', 'طاعن', 'Cassation Petitioner', 'Demandeur en cassation', 13),
    ('PartyRole', 'CASSATION_RESPONDENT', 'مطعون ضده', 'Cassation Respondent', 'Défendeur en cassation', 14),
    ('PartyRole', 'INTERVENER', 'خصم متدخل', 'Intervener', 'Intervenant', 15),
    ('PartyRole', 'BROUGHT_IN_PARTY_IMPLEADED', 'خصم مدخل', 'Brought-in Party / Impleaded', 'Partie mise en cause', 16),
    ('PartyRole', 'GUARANTOR', 'ضامن', 'Guarantor', 'Garant', 17),
    ('PartyRole', 'LEGAL_REPRESENTATIVE_GUARDIAN', 'ممثل قانوني / ولي / وصي / قيم', 'Legal Representative / Guardian', 'Représentant légal / tuteur', 18),
    ('PartyRole', 'EXPERT', 'خبير', 'Expert', 'Expert', 19),
    ('PartyRole', 'ARBITRATOR', 'محكم', 'Arbitrator', 'Arbitre', 20),
    ('PartyRole', 'WITNESS', 'شاهد', 'Witness', 'Témoin', 21)
)
INSERT INTO "LookupOption" (
  "id", "firmId", "entity", "key", "labelAr", "labelEn", "labelFr", "isSystem", "isActive", "sortOrder", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  NULL,
  cr.entity,
  cr.key,
  cr.label_ar,
  cr.label_en,
  cr.label_fr,
  true,
  true,
  cr.sort_order,
  NOW(),
  NOW()
FROM canonical_roles cr
WHERE NOT EXISTS (
  SELECT 1
  FROM "LookupOption" lo
  WHERE lo."firmId" IS NULL
    AND lo.entity = cr.entity
    AND lo.key = cr.key
);

UPDATE "CaseParty"
SET role = 'COMPLAINANT_VICTIM'
WHERE role = 'COMPLAINANT';

UPDATE "CaseParty"
SET role = 'APPELLEE'
WHERE role = 'RESPONDENT';

UPDATE "CaseParty"
SET role = 'LEGAL_REPRESENTATIVE_GUARDIAN'
WHERE role = 'OPPOSING_COUNSEL';

DO $$
DECLARE
  unmapped_role text;
BEGIN
  FOR unmapped_role IN
    SELECT DISTINCT cp.role
    FROM "CaseParty" cp
    WHERE cp.role NOT IN (
      'PLAINTIFF',
      'DEFENDANT',
      'EXECUTING_PARTY',
      'EXECUTED_AGAINST',
      'GARNISHEE_THIRD_PARTY_HOLDER',
      'PUBLIC_PROSECUTION',
      'COMPLAINANT_VICTIM',
      'ACCUSED_DEFENDANT',
      'OBJECTOR',
      'CIVIL_RIGHTS_CLAIMANT',
      'CIVILLY_RESPONSIBLE_PARTY',
      'APPELLANT',
      'APPELLEE',
      'CASSATION_PETITIONER',
      'CASSATION_RESPONDENT',
      'INTERVENER',
      'BROUGHT_IN_PARTY_IMPLEADED',
      'GUARANTOR',
      'LEGAL_REPRESENTATIVE_GUARDIAN',
      'EXPERT',
      'ARBITRATOR',
      'WITNESS'
    )
  LOOP
    RAISE NOTICE 'Unmapped CaseParty.role value retained for manual review: %', unmapped_role;
  END LOOP;
END $$;
