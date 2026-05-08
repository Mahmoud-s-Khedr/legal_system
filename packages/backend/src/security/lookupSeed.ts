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
  { entity: "CaseType", key: "CIVIL",                          labelAr: "مدني",                             labelEn: "Civil",                               labelFr: "Civil",                                   sortOrder: 0 },
  { entity: "CaseType", key: "FELONIES_CRIMINAL",              labelAr: "جنايات / جنائي",                  labelEn: "Felonies / Criminal",                 labelFr: "Crimes majeurs / pénal",                 sortOrder: 1 },
  { entity: "CaseType", key: "MISDEMEANORS",                   labelAr: "جنح",                              labelEn: "Misdemeanors",                        labelFr: "Délits",                                  sortOrder: 2 },
  { entity: "CaseType", key: "CORPORATE_COMPANIES",            labelAr: "شركات",                            labelEn: "Corporate / Companies",               labelFr: "Sociétés",                                sortOrder: 3 },
  { entity: "CaseType", key: "TAXES",                          labelAr: "ضرائب",                            labelEn: "Taxes",                               labelFr: "Fiscalité",                               sortOrder: 4 },
  { entity: "CaseType", key: "CUSTOMS",                        labelAr: "جمارك",                            labelEn: "Customs",                             labelFr: "Douanes",                                 sortOrder: 5 },
  { entity: "CaseType", key: "ECONOMIC_COURT",                 labelAr: "اقتصادي",                          labelEn: "Economic Court",                      labelFr: "Tribunal économique",                     sortOrder: 6 },
  { entity: "CaseType", key: "MILITARY",                       labelAr: "عسكري",                            labelEn: "Military",                            labelFr: "Militaire",                               sortOrder: 7 },
  { entity: "CaseType", key: "STATE_COUNCIL_ADMINISTRATIVE",   labelAr: "مجلس الدولة / إداري",              labelEn: "State Council / Administrative",      labelFr: "Conseil d’État / administratif",          sortOrder: 8 },
  { entity: "CaseType", key: "ARBITRATION",                    labelAr: "تحكيم",                            labelEn: "Arbitration",                         labelFr: "Arbitrage",                               sortOrder: 9 },
  { entity: "CaseType", key: "RENTAL_DISPUTES",                labelAr: "منازعات الإيجارات",                labelEn: "Rental Disputes",                     labelFr: "Litiges locatifs",                        sortOrder: 10 },
  { entity: "CaseType", key: "INHERITANCE_ESTATE",             labelAr: "إعلام وراثة / تركات",              labelEn: "Inheritance & Estates",               labelFr: "Successions et patrimoines",              sortOrder: 11 },
  { entity: "CaseType", key: "FAMILY",                         labelAr: "أسرة",                             labelEn: "Family",                              labelFr: "Famille",                                 sortOrder: 12 },
  { entity: "CaseType", key: "SHARIA",                         labelAr: "شرعي",                             labelEn: "Sharia",                              labelFr: "Charia",                                  sortOrder: 13 },
  { entity: "CaseType", key: "CYBERCRIMES",                    labelAr: "جرائم تقنية المعلومات / إلكترونية", labelEn: "Cybercrimes",                          labelFr: "Cybercriminalité",                        sortOrder: 14 },
  { entity: "CaseType", key: "BANKING_FINANCE",                labelAr: "منازعات مصرفية / بنوك",            labelEn: "Banking & Finance",                   labelFr: "Banque et finance",                       sortOrder: 15 },
  { entity: "CaseType", key: "TRAFFIC_OFFENSES",               labelAr: "مخالفات وجنح المرور",               labelEn: "Traffic Offenses",                    labelFr: "Infractions routières",                   sortOrder: 16 },
  { entity: "CaseType", key: "BANKRUPTCY",                     labelAr: "إفلاس",                            labelEn: "Bankruptcy",                          labelFr: "Faillite",                                sortOrder: 17 },
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
  { entity: "PartyRole", key: "PLAINTIFF",                          labelAr: "مدعي",                                      labelEn: "Plaintiff",                            labelFr: "Demandeur",                        sortOrder: 0 },
  { entity: "PartyRole", key: "DEFENDANT",                          labelAr: "مدعى عليه",                                 labelEn: "Defendant",                            labelFr: "Défendeur",                        sortOrder: 1 },
  { entity: "PartyRole", key: "EXECUTING_PARTY",                    labelAr: "طالب التنفيذ",                               labelEn: "Executing Party",                      labelFr: "Partie poursuivante",              sortOrder: 2 },
  { entity: "PartyRole", key: "EXECUTED_AGAINST",                   labelAr: "منفذ ضده",                                   labelEn: "Executed Against",                     labelFr: "Partie exécutée contre",           sortOrder: 3 },
  { entity: "PartyRole", key: "GARNISHEE",                          labelAr: "محجوز لديه",                                 labelEn: "Garnishee",                           labelFr: "Tiers saisi",                      sortOrder: 4 },
  { entity: "PartyRole", key: "THIRD_PARTY_HOLDER",                 labelAr: "حائز مال الغير",                              labelEn: "Third Party Holder",                  labelFr: "Détenteur tiers",                  sortOrder: 5 },
  { entity: "PartyRole", key: "PUBLIC_PROSECUTION",                 labelAr: "نيابة عامة",                                 labelEn: "Public Prosecution",                   labelFr: "Ministère public",                 sortOrder: 5 },
  { entity: "PartyRole", key: "COMPLAINANT",                        labelAr: "شاكي",                                       labelEn: "Complainant",                          labelFr: "Plaignant",                        sortOrder: 6 },
  { entity: "PartyRole", key: "VICTIM",                             labelAr: "مجني عليه",                                   labelEn: "Victim",                               labelFr: "Victime",                          sortOrder: 7 },
  { entity: "PartyRole", key: "REPORTER",                           labelAr: "مُبلغ",                                       labelEn: "Reporter",                             labelFr: "Déclarant",                        sortOrder: 8 },
  { entity: "PartyRole", key: "ACCUSED",                            labelAr: "متهم",                                       labelEn: "Accused",                              labelFr: "Accusé",                           sortOrder: 9 },
  { entity: "PartyRole", key: "CRIMINAL_DEFENDANT",                 labelAr: "مدعى عليه جنائيًا",                            labelEn: "Criminal Defendant",                   labelFr: "Prévenu",                          sortOrder: 10 },
  { entity: "PartyRole", key: "OBJECTOR",                           labelAr: "معارض",                                      labelEn: "Objector",                             labelFr: "Opposant",                         sortOrder: 11 },
  { entity: "PartyRole", key: "CIVIL_RIGHTS_CLAIMANT",              labelAr: "مدعي بالحق المدني",                           labelEn: "Civil Rights Claimant",                labelFr: "Demandeur civil",                  sortOrder: 12 },
  { entity: "PartyRole", key: "CIVILLY_RESPONSIBLE_PARTY",          labelAr: "مسؤول عن الحقوق المدنية",                     labelEn: "Civilly Responsible Party",            labelFr: "Responsable civil",                sortOrder: 13 },
  { entity: "PartyRole", key: "APPELLANT",                          labelAr: "مستأنف",                                      labelEn: "Appellant",                            labelFr: "Appelant",                         sortOrder: 14 },
  { entity: "PartyRole", key: "APPELLEE",                           labelAr: "مستأنف ضده",                                  labelEn: "Appellee",                             labelFr: "Intimé",                           sortOrder: 15 },
  { entity: "PartyRole", key: "CASSATION_PETITIONER",               labelAr: "طاعن",                                       labelEn: "Cassation Petitioner",                 labelFr: "Demandeur en cassation",           sortOrder: 16 },
  { entity: "PartyRole", key: "CASSATION_RESPONDENT",               labelAr: "مطعون ضده",                                   labelEn: "Cassation Respondent",                 labelFr: "Défendeur en cassation",           sortOrder: 17 },
  { entity: "PartyRole", key: "INTERVENER",                         labelAr: "خصم متدخل",                                   labelEn: "Intervener",                           labelFr: "Intervenant",                      sortOrder: 18 },
  { entity: "PartyRole", key: "BROUGHT_IN_PARTY",                   labelAr: "خصم مدخل",                                    labelEn: "Brought-in Party",                     labelFr: "Partie mise en cause",             sortOrder: 19 },
  { entity: "PartyRole", key: "IMPLEADED_PARTY",                    labelAr: "خصم مختصم",                                   labelEn: "Impleaded Party",                      labelFr: "Partie appelée",                   sortOrder: 20 },
  { entity: "PartyRole", key: "GUARANTOR",                          labelAr: "ضامن",                                       labelEn: "Guarantor",                            labelFr: "Garant",                           sortOrder: 21 },
  { entity: "PartyRole", key: "LEGAL_REPRESENTATIVE",               labelAr: "ممثل قانوني",                                 labelEn: "Legal Representative",                 labelFr: "Représentant légal",               sortOrder: 22 },
  { entity: "PartyRole", key: "GUARDIAN",                           labelAr: "ولي",                                         labelEn: "Guardian",                             labelFr: "Tuteur",                           sortOrder: 23 },
  { entity: "PartyRole", key: "TRUSTEE",                            labelAr: "وصي",                                         labelEn: "Trustee",                              labelFr: "Administrateur",                   sortOrder: 24 },
  { entity: "PartyRole", key: "CURATOR",                            labelAr: "قيم",                                         labelEn: "Curator",                              labelFr: "Curateur",                         sortOrder: 25 },
  { entity: "PartyRole", key: "EXPERT",                             labelAr: "خبير",                                       labelEn: "Expert",                               labelFr: "Expert",                           sortOrder: 26 },
  { entity: "PartyRole", key: "ARBITRATOR",                         labelAr: "محكم",                                       labelEn: "Arbitrator",                           labelFr: "Arbitre",                          sortOrder: 27 },
  { entity: "PartyRole", key: "WITNESS",                            labelAr: "شاهد",                                       labelEn: "Witness",                              labelFr: "Témoin",                           sortOrder: 28 },
  // DocumentType
  { entity: "DocumentType", key: "GENERAL_OTHER",                    labelAr: "عام / أخرى",                          labelEn: "General / Other",                        labelFr: "Général / autre",                              sortOrder: 0 },
  { entity: "DocumentType", key: "POWER_OF_ATTORNEY",                labelAr: "توكيل",                              labelEn: "Power of Attorney",                      labelFr: "Procuration",                                   sortOrder: 1 },
  { entity: "DocumentType", key: "POLICE_REPORT",                    labelAr: "محضر شرطة / محضر جمع استدلالات",     labelEn: "Police Report",                          labelFr: "Procès-verbal de police / constatations",      sortOrder: 2 },
  { entity: "DocumentType", key: "INVESTIGATION_REPORT",             labelAr: "محضر تحقيقات",                        labelEn: "Investigation Report",                   labelFr: "Procès-verbal d’enquête",                      sortOrder: 3 },
  { entity: "DocumentType", key: "LAWSUIT_STATEMENT_WRIT",           labelAr: "صحيفة الدعوى",                        labelEn: "Lawsuit Statement / Writ of Summons",    labelFr: "Assignation / requête introductive d’instance", sortOrder: 4 },
  { entity: "DocumentType", key: "APPEAL_OBJECTION_STATEMENT",       labelAr: "صحيفة استئناف / طعن / معارضة",       labelEn: "Appeal / Objection Statement",           labelFr: "Déclaration d’appel / pourvoi / opposition",   sortOrder: 5 },
  { entity: "DocumentType", key: "DEFENSE_MEMORANDUM",               labelAr: "مذكرة دفاع",                          labelEn: "Defense Memorandum",                     labelFr: "Mémoire en défense",                            sortOrder: 6 },
  { entity: "DocumentType", key: "HEARING_MINUTES",                  labelAr: "محضر الجلسة",                          labelEn: "Hearing Minutes",                        labelFr: "Procès-verbal d’audience",                      sortOrder: 7 },
  { entity: "DocumentType", key: "JUDGMENT_COPY",                    labelAr: "صورة رسمية من الحكم",                  labelEn: "Judgment Copy",                          labelFr: "Expédition officielle du jugement",             sortOrder: 8 },
  { entity: "DocumentType", key: "EXECUTIVE_FORMULA",                labelAr: "صيغة تنفيذية",                          labelEn: "Executive Formula",                      labelFr: "Formule exécutoire",                            sortOrder: 9 },
  { entity: "DocumentType", key: "EXPERT_REPORT",                    labelAr: "تقرير الخبير",                          labelEn: "Expert Report",                          labelFr: "Rapport d’expert",                              sortOrder: 10 },
  { entity: "DocumentType", key: "MEDICAL_REPORT",                   labelAr: "تقرير طبي",                            labelEn: "Medical Report",                         labelFr: "Rapport médical",                                sortOrder: 11 },
  { entity: "DocumentType", key: "OFFICIAL_CERTIFICATE",             labelAr: "شهادة رسمية",                          labelEn: "Official Certificate",                   labelFr: "Certificat officiel",                            sortOrder: 12 },
  { entity: "DocumentType", key: "WARNING_LEGAL_NOTICE",             labelAr: "إنذار رسمي",                            labelEn: "Warning / Legal Notice",                 labelFr: "Mise en demeure / sommation",                   sortOrder: 13 },
  { entity: "DocumentType", key: "CONTRACT_AGREEMENT",               labelAr: "عقد / اتفاق",                           labelEn: "Contract / Agreement",                   labelFr: "Contrat / accord",                               sortOrder: 14 },
  { entity: "DocumentType", key: "PROOF_OF_PAYMENT_RECEIPTS",        labelAr: "إيصالات / قسائم سداد أموال",          labelEn: "Proof of Payment / Receipts",            labelFr: "Preuves de paiement / reçus",                   sortOrder: 15 },
  { entity: "DocumentType", key: "TAX_CARD",                         labelAr: "بطاقة ضريبية",                          labelEn: "Tax Card",                               labelFr: "Carte fiscale",                                   sortOrder: 16 },
  { entity: "DocumentType", key: "CLIENT_ID_COMMERCIAL_REGISTER",    labelAr: "هوية موكل / سجل تجاري",                labelEn: "Client ID / Commercial Register",        labelFr: "Pièce d’identité client / registre du commerce", sortOrder: 17 },
  // HearingOutcome
  { entity: "HearingOutcome", key: "POSTPONED_DOCUMENT_SUBMISSION",       labelAr: "تأجيل لتقديم مستندات",                        labelEn: "Postponed for Document Submission",            labelFr: "Reporté pour dépôt de documents",                    sortOrder: 0 },
  { entity: "HearingOutcome", key: "POSTPONED_REVIEW_MEMO",               labelAr: "تأجيل للاطلاع / مذكرات",                       labelEn: "Postponed for Review / Memo",                  labelFr: "Reporté pour consultation / mémoires",                sortOrder: 1 },
  { entity: "HearingOutcome", key: "POSTPONED_NOTIFICATION_RENOTIFICATION", labelAr: "تأجيل للإعلان / إعادة إعلان",                 labelEn: "Postponed for Notification / Re-notification", labelFr: "Reporté pour notification / renotification",          sortOrder: 2 },
  { entity: "HearingOutcome", key: "POSTPONED_EXPERT_REPORT_REVIEW",      labelAr: "تأجيل للاطلاع على تقرير الخبير",               labelEn: "Postponed to Review Expert Report",            labelFr: "Reporté pour consultation du rapport d’expert",       sortOrder: 3 },
  { entity: "HearingOutcome", key: "POSTPONED_WITNESS_TESTIMONY",         labelAr: "تأجيل لسماع الشهود",                           labelEn: "Postponed for Witness Testimony",              labelFr: "Reporté pour audition des témoins",                    sortOrder: 4 },
  { entity: "HearingOutcome", key: "POSTPONED_JOIN_INTERVENING_PARTIES",  labelAr: "تأجيل لإدخال أو تدخل خصوم",                    labelEn: "Postponed for Joining/Intervening Parties",    labelFr: "Reporté pour mise en cause / intervention de parties", sortOrder: 5 },
  { entity: "HearingOutcome", key: "POSTPONED_FINAL_PLEADING",            labelAr: "تأجيل للمرافعة",                               labelEn: "Postponed for Final Pleading",                 labelFr: "Reporté pour plaidoirie finale",                      sortOrder: 6 },
  { entity: "HearingOutcome", key: "ADMINISTRATIVE_POSTPONEMENT",         labelAr: "تأجيل إداري / أجل إداري",                       labelEn: "Administrative Postponement",                  labelFr: "Report administratif",                               sortOrder: 7 },
  { entity: "HearingOutcome", key: "REFERRED_TO_EXPERTS",                 labelAr: "إحالة لمكتب الخبراء",                           labelEn: "Referred to Experts",                          labelFr: "Renvoi au bureau des experts",                        sortOrder: 8 },
  { entity: "HearingOutcome", key: "RESERVED_FOR_JUDGMENT",               labelAr: "حجز للحكم",                                     labelEn: "Reserved for Judgment",                        labelFr: "Mise en délibéré",                                  sortOrder: 9 },
  { entity: "HearingOutcome", key: "INTERLOCUTORY_JUDGMENT_ISSUED",       labelAr: "حكم تمهيدي",                                    labelEn: "Interlocutory Judgment Issued",                labelFr: "Jugement interlocutoire rendu",                      sortOrder: 10 },
  { entity: "HearingOutcome", key: "JUDGMENT_ISSUED",                     labelAr: "صدر حكم",                                       labelEn: "Judgment Issued",                              labelFr: "Jugement rendu",                                    sortOrder: 11 },
  { entity: "HearingOutcome", key: "CASE_DISMISSED",                      labelAr: "شطب الدعوى",                                    labelEn: "Case Dismissed",                               labelFr: "Affaire radiée",                                   sortOrder: 12 },
  { entity: "HearingOutcome", key: "SUSPENDED",                           labelAr: "وقف تعليقي / جزائي",                            labelEn: "Suspended",                                    labelFr: "Sursis / suspension",                              sortOrder: 13 },
  { entity: "HearingOutcome", key: "DISCONTINUATION_OF_LITIGATION",       labelAr: "انقطاع سير الخصومة",                             labelEn: "Discontinuation of Litigation",                labelFr: "Interruption de l’instance",                        sortOrder: 14 },
  { entity: "HearingOutcome", key: "REFERRED_TO_ANOTHER_CIRCUIT_COURT",   labelAr: "إحالة لدائرة/محكمة أخرى",                        labelEn: "Referred to Another Circuit/Court",            labelFr: "Renvoi à une autre chambre/juridiction",            sortOrder: 15 },
  { entity: "HearingOutcome", key: "SETTLED_RECONCILED",                  labelAr: "تصالح",                                         labelEn: "Settled / Reconciled",                         labelFr: "Transaction / conciliation",                        sortOrder: 16 },
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
