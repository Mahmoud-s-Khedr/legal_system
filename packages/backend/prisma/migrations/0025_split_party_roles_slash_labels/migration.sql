WITH canonical_roles(entity, key, label_ar, label_en, label_fr, sort_order) AS (
  VALUES
    ('PartyRole', 'PLAINTIFF', 'مدعي', 'Plaintiff', 'Demandeur', 0),
    ('PartyRole', 'DEFENDANT', 'مدعى عليه', 'Defendant', 'Défendeur', 1),
    ('PartyRole', 'EXECUTING_PARTY', 'طالب التنفيذ', 'Executing Party', 'Partie poursuivante', 2),
    ('PartyRole', 'EXECUTED_AGAINST', 'منفذ ضده', 'Executed Against', 'Partie exécutée contre', 3),
    ('PartyRole', 'GARNISHEE', 'محجوز لديه', 'Garnishee', 'Tiers saisi', 4),
    ('PartyRole', 'THIRD_PARTY_HOLDER', 'حائز مال الغير', 'Third Party Holder', 'Détenteur tiers', 5),
    ('PartyRole', 'PUBLIC_PROSECUTION', 'نيابة عامة', 'Public Prosecution', 'Ministère public', 6),
    ('PartyRole', 'COMPLAINANT', 'شاكي', 'Complainant', 'Plaignant', 7),
    ('PartyRole', 'VICTIM', 'مجني عليه', 'Victim', 'Victime', 8),
    ('PartyRole', 'REPORTER', 'مُبلغ', 'Reporter', 'Déclarant', 9),
    ('PartyRole', 'ACCUSED', 'متهم', 'Accused', 'Accusé', 10),
    ('PartyRole', 'CRIMINAL_DEFENDANT', 'مدعى عليه جنائيًا', 'Criminal Defendant', 'Prévenu', 11),
    ('PartyRole', 'OBJECTOR', 'معارض', 'Objector', 'Opposant', 12),
    ('PartyRole', 'CIVIL_RIGHTS_CLAIMANT', 'مدعي بالحق المدني', 'Civil Rights Claimant', 'Demandeur civil', 13),
    ('PartyRole', 'CIVILLY_RESPONSIBLE_PARTY', 'مسؤول عن الحقوق المدنية', 'Civilly Responsible Party', 'Responsable civil', 14),
    ('PartyRole', 'APPELLANT', 'مستأنف', 'Appellant', 'Appelant', 15),
    ('PartyRole', 'APPELLEE', 'مستأنف ضده', 'Appellee', 'Intimé', 16),
    ('PartyRole', 'CASSATION_PETITIONER', 'طاعن', 'Cassation Petitioner', 'Demandeur en cassation', 17),
    ('PartyRole', 'CASSATION_RESPONDENT', 'مطعون ضده', 'Cassation Respondent', 'Défendeur en cassation', 18),
    ('PartyRole', 'INTERVENER', 'خصم متدخل', 'Intervener', 'Intervenant', 19),
    ('PartyRole', 'BROUGHT_IN_PARTY', 'خصم مدخل', 'Brought-in Party', 'Partie mise en cause', 20),
    ('PartyRole', 'IMPLEADED_PARTY', 'خصم مختصم', 'Impleaded Party', 'Partie appelée', 21),
    ('PartyRole', 'GUARANTOR', 'ضامن', 'Guarantor', 'Garant', 22),
    ('PartyRole', 'LEGAL_REPRESENTATIVE', 'ممثل قانوني', 'Legal Representative', 'Représentant légal', 23),
    ('PartyRole', 'GUARDIAN', 'ولي', 'Guardian', 'Tuteur', 24),
    ('PartyRole', 'TRUSTEE', 'وصي', 'Trustee', 'Administrateur', 25),
    ('PartyRole', 'CURATOR', 'قيم', 'Curator', 'Curateur', 26),
    ('PartyRole', 'EXPERT', 'خبير', 'Expert', 'Expert', 27),
    ('PartyRole', 'ARBITRATOR', 'محكم', 'Arbitrator', 'Arbitre', 28),
    ('PartyRole', 'WITNESS', 'شاهد', 'Witness', 'Témoin', 29)
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
WHERE lo."firmId" IS NULL AND lo.entity = cr.entity AND lo.key = cr.key;

WITH canonical_roles(entity, key, label_ar, label_en, label_fr, sort_order) AS (
  VALUES
    ('PartyRole', 'PLAINTIFF', 'مدعي', 'Plaintiff', 'Demandeur', 0),
    ('PartyRole', 'DEFENDANT', 'مدعى عليه', 'Defendant', 'Défendeur', 1),
    ('PartyRole', 'EXECUTING_PARTY', 'طالب التنفيذ', 'Executing Party', 'Partie poursuivante', 2),
    ('PartyRole', 'EXECUTED_AGAINST', 'منفذ ضده', 'Executed Against', 'Partie exécutée contre', 3),
    ('PartyRole', 'GARNISHEE', 'محجوز لديه', 'Garnishee', 'Tiers saisi', 4),
    ('PartyRole', 'THIRD_PARTY_HOLDER', 'حائز مال الغير', 'Third Party Holder', 'Détenteur tiers', 5),
    ('PartyRole', 'PUBLIC_PROSECUTION', 'نيابة عامة', 'Public Prosecution', 'Ministère public', 6),
    ('PartyRole', 'COMPLAINANT', 'شاكي', 'Complainant', 'Plaignant', 7),
    ('PartyRole', 'VICTIM', 'مجني عليه', 'Victim', 'Victime', 8),
    ('PartyRole', 'REPORTER', 'مُبلغ', 'Reporter', 'Déclarant', 9),
    ('PartyRole', 'ACCUSED', 'متهم', 'Accused', 'Accusé', 10),
    ('PartyRole', 'CRIMINAL_DEFENDANT', 'مدعى عليه جنائيًا', 'Criminal Defendant', 'Prévenu', 11),
    ('PartyRole', 'OBJECTOR', 'معارض', 'Objector', 'Opposant', 12),
    ('PartyRole', 'CIVIL_RIGHTS_CLAIMANT', 'مدعي بالحق المدني', 'Civil Rights Claimant', 'Demandeur civil', 13),
    ('PartyRole', 'CIVILLY_RESPONSIBLE_PARTY', 'مسؤول عن الحقوق المدنية', 'Civilly Responsible Party', 'Responsable civil', 14),
    ('PartyRole', 'APPELLANT', 'مستأنف', 'Appellant', 'Appelant', 15),
    ('PartyRole', 'APPELLEE', 'مستأنف ضده', 'Appellee', 'Intimé', 16),
    ('PartyRole', 'CASSATION_PETITIONER', 'طاعن', 'Cassation Petitioner', 'Demandeur en cassation', 17),
    ('PartyRole', 'CASSATION_RESPONDENT', 'مطعون ضده', 'Cassation Respondent', 'Défendeur en cassation', 18),
    ('PartyRole', 'INTERVENER', 'خصم متدخل', 'Intervener', 'Intervenant', 19),
    ('PartyRole', 'BROUGHT_IN_PARTY', 'خصم مدخل', 'Brought-in Party', 'Partie mise en cause', 20),
    ('PartyRole', 'IMPLEADED_PARTY', 'خصم مختصم', 'Impleaded Party', 'Partie appelée', 21),
    ('PartyRole', 'GUARANTOR', 'ضامن', 'Guarantor', 'Garant', 22),
    ('PartyRole', 'LEGAL_REPRESENTATIVE', 'ممثل قانوني', 'Legal Representative', 'Représentant légal', 23),
    ('PartyRole', 'GUARDIAN', 'ولي', 'Guardian', 'Tuteur', 24),
    ('PartyRole', 'TRUSTEE', 'وصي', 'Trustee', 'Administrateur', 25),
    ('PartyRole', 'CURATOR', 'قيم', 'Curator', 'Curateur', 26),
    ('PartyRole', 'EXPERT', 'خبير', 'Expert', 'Expert', 27),
    ('PartyRole', 'ARBITRATOR', 'محكم', 'Arbitrator', 'Arbitre', 28),
    ('PartyRole', 'WITNESS', 'شاهد', 'Witness', 'Témoin', 29)
)
INSERT INTO "LookupOption" ("id","firmId","entity","key","labelAr","labelEn","labelFr","isSystem","isActive","sortOrder","createdAt","updatedAt")
SELECT gen_random_uuid(), NULL, cr.entity, cr.key, cr.label_ar, cr.label_en, cr.label_fr, true, true, cr.sort_order, NOW(), NOW()
FROM canonical_roles cr
WHERE NOT EXISTS (
  SELECT 1 FROM "LookupOption" lo
  WHERE lo."firmId" IS NULL AND lo.entity = cr.entity AND lo.key = cr.key
);

UPDATE "CaseParty" SET role = 'COMPLAINANT' WHERE role = 'COMPLAINANT_VICTIM';
UPDATE "CaseParty" SET role = 'COMPLAINANT' WHERE role = 'COMPLAINANT';
UPDATE "CaseParty" SET role = 'ACCUSED' WHERE role = 'ACCUSED_DEFENDANT';
UPDATE "CaseParty" SET role = 'GARNISHEE' WHERE role = 'GARNISHEE_THIRD_PARTY_HOLDER';
UPDATE "CaseParty" SET role = 'BROUGHT_IN_PARTY' WHERE role = 'BROUGHT_IN_PARTY_IMPLEADED';
UPDATE "CaseParty" SET role = 'LEGAL_REPRESENTATIVE' WHERE role = 'LEGAL_REPRESENTATIVE_GUARDIAN';
UPDATE "CaseParty" SET role = 'COMPLAINANT' WHERE role = 'REPORTER';

UPDATE "LookupOption"
SET "isActive" = false, "updatedAt" = NOW()
WHERE "firmId" IS NULL
  AND entity = 'PartyRole'
  AND key IN (
    'COMPLAINANT_VICTIM',
    'ACCUSED_DEFENDANT',
    'GARNISHEE_THIRD_PARTY_HOLDER',
    'BROUGHT_IN_PARTY_IMPLEADED',
    'LEGAL_REPRESENTATIVE_GUARDIAN'
  );
