-- Convert hearing outcome from enum to lookup-driven text
ALTER TABLE "CaseSession"
  ALTER COLUMN "outcome" TYPE TEXT
  USING "outcome"::text;

DROP TYPE IF EXISTS "SessionOutcome";

-- Remap existing case types to new taxonomy keys
UPDATE "Case"
SET "type" = CASE "type"
  WHEN 'CIVIL' THEN 'CIVIL'
  WHEN 'CRIMINAL' THEN 'FELONIES_CRIMINAL'
  WHEN 'COMMERCIAL' THEN 'CORPORATE_COMPANIES'
  WHEN 'FAMILY' THEN 'FAMILY'
  WHEN 'ADMINISTRATIVE' THEN 'STATE_COUNCIL_ADMINISTRATIVE'
  WHEN 'CONSTITUTIONAL' THEN 'STATE_COUNCIL_ADMINISTRATIVE'
  WHEN 'LABOR' THEN 'LABOR'
  WHEN 'REAL_ESTATE' THEN 'RENTAL_DISPUTES'
  WHEN 'INTELLECTUAL_PROPERTY' THEN 'ECONOMIC_COURT'
  ELSE "type"
END;

-- Replace system CaseType/DocumentType and add HearingOutcome lookups
DELETE FROM "LookupOption"
WHERE "firmId" IS NULL
  AND "entity" IN ('CaseType', 'DocumentType', 'HearingOutcome');

INSERT INTO "LookupOption"
("id", "firmId", "entity", "key", "labelAr", "labelEn", "labelFr", "isSystem", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
-- CaseType
(gen_random_uuid(), NULL, 'CaseType', 'CIVIL', 'مدني', 'Civil', 'Civil', true, true, 0, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'FELONIES_CRIMINAL', 'جنايات / جنائي', 'Felonies / Criminal', 'Crimes majeurs / pénal', true, true, 1, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'MISDEMEANORS', 'جنح', 'Misdemeanors', 'Délits', true, true, 2, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'CORPORATE_COMPANIES', 'شركات', 'Corporate / Companies', 'Sociétés', true, true, 3, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'TAXES', 'ضرائب', 'Taxes', 'Fiscalité', true, true, 4, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'CUSTOMS', 'جمارك', 'Customs', 'Douanes', true, true, 5, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'ECONOMIC_COURT', 'اقتصادي', 'Economic Court', 'Tribunal économique', true, true, 6, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'MILITARY', 'عسكري', 'Military', 'Militaire', true, true, 7, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'STATE_COUNCIL_ADMINISTRATIVE', 'مجلس الدولة / إداري', 'State Council / Administrative', 'Conseil d’État / administratif', true, true, 8, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'ARBITRATION', 'تحكيم', 'Arbitration', 'Arbitrage', true, true, 9, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'RENTAL_DISPUTES', 'منازعات الإيجارات', 'Rental Disputes', 'Litiges locatifs', true, true, 10, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'INHERITANCE_ESTATE', 'إعلام وراثة / تركات', 'Inheritance & Estates', 'Successions et patrimoines', true, true, 11, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'FAMILY', 'أسرة', 'Family', 'Famille', true, true, 12, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'SHARIA', 'شرعي', 'Sharia', 'Charia', true, true, 13, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'CYBERCRIMES', 'جرائم تقنية المعلومات / إلكترونية', 'Cybercrimes', 'Cybercriminalité', true, true, 14, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'BANKING_FINANCE', 'منازعات مصرفية / بنوك', 'Banking & Finance', 'Banque et finance', true, true, 15, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'TRAFFIC_OFFENSES', 'مخالفات وجنح المرور', 'Traffic Offenses', 'Infractions routières', true, true, 16, now(), now()),
(gen_random_uuid(), NULL, 'CaseType', 'BANKRUPTCY', 'إفلاس', 'Bankruptcy', 'Faillite', true, true, 17, now(), now()),

-- HearingOutcome
(gen_random_uuid(), NULL, 'HearingOutcome', 'POSTPONED_DOCUMENT_SUBMISSION', 'تأجيل لتقديم مستندات', 'Postponed for Document Submission', 'Reporté pour dépôt de documents', true, true, 0, now(), now()),
(gen_random_uuid(), NULL, 'HearingOutcome', 'POSTPONED_REVIEW_MEMO', 'تأجيل للاطلاع / مذكرات', 'Postponed for Review / Memo', 'Reporté pour consultation / mémoires', true, true, 1, now(), now()),
(gen_random_uuid(), NULL, 'HearingOutcome', 'POSTPONED_NOTIFICATION_RENOTIFICATION', 'تأجيل للإعلان / إعادة إعلان', 'Postponed for Notification / Re-notification', 'Reporté pour notification / renotification', true, true, 2, now(), now()),
(gen_random_uuid(), NULL, 'HearingOutcome', 'POSTPONED_EXPERT_REPORT_REVIEW', 'تأجيل للاطلاع على تقرير الخبير', 'Postponed to Review Expert Report', 'Reporté pour consultation du rapport d’expert', true, true, 3, now(), now()),
(gen_random_uuid(), NULL, 'HearingOutcome', 'POSTPONED_WITNESS_TESTIMONY', 'تأجيل لسماع الشهود', 'Postponed for Witness Testimony', 'Reporté pour audition des témoins', true, true, 4, now(), now()),
(gen_random_uuid(), NULL, 'HearingOutcome', 'POSTPONED_JOIN_INTERVENING_PARTIES', 'تأجيل لإدخال أو تدخل خصوم', 'Postponed for Joining/Intervening Parties', 'Reporté pour mise en cause / intervention de parties', true, true, 5, now(), now()),
(gen_random_uuid(), NULL, 'HearingOutcome', 'POSTPONED_FINAL_PLEADING', 'تأجيل للمرافعة', 'Postponed for Final Pleading', 'Reporté pour plaidoirie finale', true, true, 6, now(), now()),
(gen_random_uuid(), NULL, 'HearingOutcome', 'ADMINISTRATIVE_POSTPONEMENT', 'تأجيل إداري / أجل إداري', 'Administrative Postponement', 'Report administratif', true, true, 7, now(), now()),
(gen_random_uuid(), NULL, 'HearingOutcome', 'REFERRED_TO_EXPERTS', 'إحالة لمكتب الخبراء', 'Referred to Experts', 'Renvoi au bureau des experts', true, true, 8, now(), now()),
(gen_random_uuid(), NULL, 'HearingOutcome', 'RESERVED_FOR_JUDGMENT', 'حجز للحكم', 'Reserved for Judgment', 'Mise en délibéré', true, true, 9, now(), now()),
(gen_random_uuid(), NULL, 'HearingOutcome', 'INTERLOCUTORY_JUDGMENT_ISSUED', 'حكم تمهيدي', 'Interlocutory Judgment Issued', 'Jugement interlocutoire rendu', true, true, 10, now(), now()),
(gen_random_uuid(), NULL, 'HearingOutcome', 'JUDGMENT_ISSUED', 'صدر حكم', 'Judgment Issued', 'Jugement rendu', true, true, 11, now(), now()),
(gen_random_uuid(), NULL, 'HearingOutcome', 'CASE_DISMISSED', 'شطب الدعوى', 'Case Dismissed', 'Affaire radiée', true, true, 12, now(), now()),
(gen_random_uuid(), NULL, 'HearingOutcome', 'SUSPENDED', 'وقف تعليقي / جزائي', 'Suspended', 'Sursis / suspension', true, true, 13, now(), now()),
(gen_random_uuid(), NULL, 'HearingOutcome', 'DISCONTINUATION_OF_LITIGATION', 'انقطاع سير الخصومة', 'Discontinuation of Litigation', 'Interruption de l’instance', true, true, 14, now(), now()),
(gen_random_uuid(), NULL, 'HearingOutcome', 'REFERRED_TO_ANOTHER_CIRCUIT_COURT', 'إحالة لدائرة/محكمة أخرى', 'Referred to Another Circuit/Court', 'Renvoi à une autre chambre/juridiction', true, true, 15, now(), now()),
(gen_random_uuid(), NULL, 'HearingOutcome', 'SETTLED_RECONCILED', 'تصالح', 'Settled / Reconciled', 'Transaction / conciliation', true, true, 16, now(), now()),

-- DocumentType
(gen_random_uuid(), NULL, 'DocumentType', 'GENERAL_OTHER', 'عام / أخرى', 'General / Other', 'Général / autre', true, true, 0, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'POWER_OF_ATTORNEY', 'توكيل', 'Power of Attorney', 'Procuration', true, true, 1, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'POLICE_REPORT', 'محضر شرطة / محضر جمع استدلالات', 'Police Report', 'Procès-verbal de police / constatations', true, true, 2, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'INVESTIGATION_REPORT', 'محضر تحقيقات', 'Investigation Report', 'Procès-verbal d’enquête', true, true, 3, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'LAWSUIT_STATEMENT_WRIT', 'صحيفة الدعوى', 'Lawsuit Statement / Writ of Summons', 'Assignation / requête introductive d’instance', true, true, 4, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'APPEAL_OBJECTION_STATEMENT', 'صحيفة استئناف / طعن / معارضة', 'Appeal / Objection Statement', 'Déclaration d’appel / pourvoi / opposition', true, true, 5, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'DEFENSE_MEMORANDUM', 'مذكرة دفاع', 'Defense Memorandum', 'Mémoire en défense', true, true, 6, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'HEARING_MINUTES', 'محضر الجلسة', 'Hearing Minutes', 'Procès-verbal d’audience', true, true, 7, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'JUDGMENT_COPY', 'صورة رسمية من الحكم', 'Judgment Copy', 'Expédition officielle du jugement', true, true, 8, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'EXECUTIVE_FORMULA', 'صيغة تنفيذية', 'Executive Formula', 'Formule exécutoire', true, true, 9, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'EXPERT_REPORT', 'تقرير الخبير', 'Expert Report', 'Rapport d’expert', true, true, 10, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'MEDICAL_REPORT', 'تقرير طبي', 'Medical Report', 'Rapport médical', true, true, 11, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'OFFICIAL_CERTIFICATE', 'شهادة رسمية', 'Official Certificate', 'Certificat officiel', true, true, 12, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'WARNING_LEGAL_NOTICE', 'إنذار رسمي', 'Warning / Legal Notice', 'Mise en demeure / sommation', true, true, 13, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'CONTRACT_AGREEMENT', 'عقد / اتفاق', 'Contract / Agreement', 'Contrat / accord', true, true, 14, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'PROOF_OF_PAYMENT_RECEIPTS', 'إيصالات / قسائم سداد أموال', 'Proof of Payment / Receipts', 'Preuves de paiement / reçus', true, true, 15, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'TAX_CARD', 'بطاقة ضريبية', 'Tax Card', 'Carte fiscale', true, true, 16, now(), now()),
(gen_random_uuid(), NULL, 'DocumentType', 'CLIENT_ID_COMMERCIAL_REGISTER', 'هوية موكل / سجل تجاري', 'Client ID / Commercial Register', 'Pièce d’identité client / registre du commerce', true, true, 17, now(), now());
