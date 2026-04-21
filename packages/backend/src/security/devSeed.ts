import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";
import { faker } from "@faker-js/faker";
import type { PrismaClient, Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Static data pools
// ---------------------------------------------------------------------------

const GOVERNORATES = [
  "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "البحيرة",
  "الشرقية", "المنوفية", "الغربية", "القليوبية", "كفر الشيخ",
  "دمياط", "بورسعيد", "الإسماعيلية", "السويس", "شمال سيناء",
  "جنوب سيناء", "الفيوم", "بني سويف", "المنيا", "أسيوط",
  "سوهاج", "قنا", "الأقصر", "أسوان", "البحر الأحمر",
  "الوادي الجديد", "مطروح",
];

const GOV_CODES = [
  "01", "02", "03", "04", "11", "12", "13", "14", "15", "16",
  "17", "18", "19", "21", "22", "23", "24", "25", "26", "27",
  "28", "29", "31", "32", "33", "34", "35",
];

const ARAB_FIRST_NAMES = [
  "محمد", "أحمد", "علي", "عمر", "يوسف", "إبراهيم", "خالد", "طارق",
  "سامي", "كريم", "عبدالله", "حسن", "حسين", "مصطفى", "ماجد",
  "فاطمة", "مريم", "نور", "سارة", "هنا", "منى", "ريم", "دينا",
  "نادية", "إيمان", "أميرة", "سلمى", "لينا", "هالة", "رانيا",
];

const ARAB_LAST_NAMES = [
  "العمري", "الحسيني", "السيد", "محمود", "إبراهيم", "الشافعي",
  "الغزالي", "البدري", "الصاوي", "رضوان", "حمدان", "النجار",
  "السلمي", "الشريف", "المهدي", "القاضي", "الخطيب", "التميمي",
  "الزهراني", "الحربي", "الدوسري", "القحطاني", "الغامدي", "الزهراني",
];

const COMPANY_NAMES_AR = [
  "شركة النيل للتجارة", "مجموعة المستقبل", "شركة الأمل للمقاولات",
  "مصنع الوادي للصناعات", "شركة النور للاستيراد والتصدير",
  "مجموعة الهرم العقارية", "شركة السلام للنقل والشحن",
  "شركة الإخلاص للتوريدات", "مؤسسة الأفق للاستشارات",
  "شركة الفجر للصناعات الغذائية", "مجموعة العز للتطوير العقاري",
  "شركة الريادة للتقنية", "مصنع الجودة للبلاستيك",
  "شركة الوفاء للمواد الإنشائية", "مجموعة الأمانة للخدمات المالية",
  "شركة الصحة للأدوية والمستلزمات", "مؤسسة الخبرة للتدريب",
  "شركة التقدم للطاقة المتجددة", "مجموعة الإتقان للمقاولات",
  "شركة الحكمة للاستثمار",
];

const GOVERNMENT_ENTITIES_AR = [
  "وزارة المالية", "وزارة الصحة والسكان", "وزارة التربية والتعليم",
  "هيئة الرقابة المالية", "الجهاز المركزي للمحاسبات",
  "هيئة قضايا الدولة", "المجلس الأعلى للقضاء",
  "هيئة الاستثمار والمناطق الحرة", "جهاز تنمية المشروعات",
  "البنك المركزي المصري",
];

const COURT_NAMES_AR = [
  "محكمة القاهرة الابتدائية", "محكمة الجيزة الابتدائية",
  "محكمة الإسكندرية الابتدائية", "محكمة شمال القاهرة الابتدائية",
  "محكمة جنوب القاهرة الابتدائية", "محكمة استئناف القاهرة",
  "محكمة استئناف الإسكندرية", "محكمة النقض",
  "المحكمة الإدارية العليا", "محكمة القاهرة الاقتصادية",
  "محكمة أسيوط الابتدائية", "محكمة المنصورة الابتدائية",
];

const COURT_LEVELS = ["PRIMARY", "APPEAL", "CASSATION", "ADMINISTRATIVE", "PARTIAL", "MISDEMEANOR"];

const CASE_TYPES = ["CIVIL", "CRIMINAL", "COMMERCIAL", "FAMILY", "LABOR", "REAL_ESTATE", "ADMINISTRATIVE"];

const CASE_TITLES_AR = [
  "دعوى مطالبة بمبلغ مالي", "دعوى إخلاء وريع", "دعوى فسخ عقد إيجار",
  "دعوى تعويض عن أضرار", "دعوى صحة ونفاذ عقد بيع", "دعوى طرد من العين",
  "دعوى منع تعرض", "دعوى مطالبة بحقوق عمالية", "دعوى إثبات نسب",
  "دعوى نفقة وحضانة", "دعوى طلاق وتعويض", "دعوى شيك بدون رصيد",
  "دعوى غش تجاري", "دعوى إفلاس تجاري", "دعوى علامة تجارية",
  "دعوى مطالبة بميراث", "دعوى قسمة عقارية", "دعوى ترسيم حدود",
  "دعوى إدارية ضد جهة حكومية", "دعوى طعن في قرار إداري",
  "دعوى سرقة واحتيال", "دعوى نصب واحتيال إلكتروني",
  "دعوى إهانة وسب وقذف", "دعوى اعتداء جسدي",
];

const TASK_TITLES_AR = [
  "تحضير مذكرة دفاع", "إعداد عقد بيع", "متابعة جلسة قادمة",
  "تقديم طعن بالنقض", "استلام مستندات من الموكل",
  "مراجعة سند الملكية", "إرسال إنذار رسمي", "تقديم طلب استئناف",
  "الحصول على صورة من الحكم", "توثيق توكيل رسمي",
  "دراسة وتحليل عقد الإيجار", "تقديم شكوى إدارية",
  "إعداد تقرير قانوني شامل", "مراسلة محكمة التنفيذ",
  "تسجيل شركة جديدة", "مراجعة اتفاقية شراكة",
  "إعداد ملف طلب التحكيم", "متابعة طلب التصالح",
  "تقديم مستندات إثبات الجنسية", "مراجعة قيود السجل التجاري",
];

const DOCUMENT_TITLES_AR = [
  "عقد بيع عقار", "توكيل رسمي خاص", "عقد إيجار تجاري",
  "صحيفة دعوى", "مذكرة دفاع", "حكم ابتدائي",
  "صورة رسمية من الحكم", "عقد مقاولة", "تقرير خبير قضائي",
  "محضر استلام أرضية", "عقد شراكة تجارية", "اتفاقية عدم منافسة",
  "شهادة ميلاد", "بطاقة رقم قومي", "كشف حساب بنكي",
  "فاتورة ضريبية", "ترخيص تجاري", "شهادة تسجيل شركة",
  "إنذار رسمي", "إقرار بالمديونية",
];

const INVOICE_ITEM_DESCS_AR = [
  "أتعاب مرافعة", "أتعاب استشارة قانونية", "أتعاب تحرير عقد",
  "رسوم توثيق", "أتعاب إعداد مذكرة", "أتعاب تسجيل عقاري",
  "أتعاب جلسة استئناف", "أتعاب طعن بالنقض", "رسوم تقاضي",
  "أتعاب تحكيم دولي", "أتعاب متابعة تنفيذ حكم",
];

const EXPENSE_DESCS_AR = [
  "رسوم تقديم دعوى", "رسوم الطعن بالاستئناف", "رسوم نقض",
  "أتعاب ترجمة مستندات", "رسوم توثيق رسمي", "أتعاب خبير عقاري",
  "مصاريف انتقال للمحكمة", "رسوم بريد وإخطارات", "رسوم استخراج صورة",
  "رسوم التصديق والأبوستيل",
];

const CONTACT_ROLES_AR = ["مدير مالي", "مدير عام", "محاسب", "مسؤول قانوني", "سكرتير", "شريك"];

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "INSTAPAY", "FAWRY", "CHEQUE"];
const SESSION_OUTCOMES = ["POSTPONED", "DECIDED", "PARTIAL_RULING", "ADJOURNED", "EVIDENCE", "PLEADING"];
const FEE_TYPES = ["FIXED", "RETAINER", "HOURLY", "APPEARANCE"];
const CASE_STATUSES = ["ACTIVE", "ACTIVE", "ACTIVE", "CLOSED", "WON", "SETTLED", "SUSPENDED"];
const INVOICE_STATUSES = ["DRAFT", "ISSUED", "ISSUED", "PAID", "PAID", "PARTIALLY_PAID"];
const TASK_STATUSES = ["PENDING", "PENDING", "IN_PROGRESS", "IN_PROGRESS", "DONE", "DONE", "CANCELLED"];
const TASK_PRIORITIES = ["LOW", "MEDIUM", "MEDIUM", "HIGH", "URGENT"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randDate(daysAgo: number, daysAhead = 0): Date {
  const now = Date.now();
  const from = now - daysAgo * 86400000;
  const to = now + daysAhead * 86400000;
  return new Date(from + Math.random() * (to - from));
}

function egyptianPhone(): string {
  const prefix = pick(["010", "011", "012", "015"]);
  const num = String(randInt(10000000, 99999999));
  return `${prefix}${num}`;
}

function egyptianNationalId(): string {
  const century = pick(["2", "3"]);
  const year = String(randInt(60, 99));
  const month = String(randInt(1, 12)).padStart(2, "0");
  const day = String(randInt(1, 28)).padStart(2, "0");
  const govCode = pick(GOV_CODES);
  const seq = String(randInt(1, 9999)).padStart(4, "0");
  const check = String(randInt(1, 9));
  return `${century}${year}${month}${day}${govCode}${seq}${check}`;
}

function arabicPersonName(): { name: string; nameAr: string } {
  const firstAr = pick(ARAB_FIRST_NAMES);
  const lastAr = pick(ARAB_LAST_NAMES);
  const nameAr = `${firstAr} ${lastAr}`;
  const name = faker.person.fullName();
  return { name, nameAr };
}

// ---------------------------------------------------------------------------
// 1. Firm
// ---------------------------------------------------------------------------

async function ensureDevFirm(prisma: PrismaClient) {
  const firm = await prisma.firm.upsert({
    where: { slug: "dev-firm" },
    update: {},
    create: {
      slug: "dev-firm",
      name: "مكتب المحاماة التجريبي",
      type: "SMALL_FIRM",
      editionKey: "local_firm_online",
      defaultLanguage: "AR",
      lifecycleStatus: "ACTIVE",
    },
  });

  await prisma.firmSettings.upsert({
    where: { firmId: firm.id },
    update: {},
    create: {
      firmId: firm.id,
      timezone: "Africa/Cairo",
      currency: "EGP",
      preferredLanguage: "AR",
    },
  });

  console.log(`  ✓ Dev firm ready (id: ${firm.id})`);
  return firm;
}

// ---------------------------------------------------------------------------
// 2. Users
// ---------------------------------------------------------------------------

async function ensureDevUsers(prisma: PrismaClient, firmId: string) {
  const systemRoles = await prisma.role.findMany({
    where: { firmId: null },
    select: { id: true, key: true },
  });

  const roleByKey = Object.fromEntries(systemRoles.map((r) => [r.key, r.id]));

  const usersToSeed = [
    { email: "admin@elms.local", fullName: "مدير النظام", roleKey: "firm_admin" },
    { email: "lawyer1@elms.local", fullName: "أحمد الشافعي", roleKey: "senior_lawyer" },
    { email: "lawyer2@elms.local", fullName: "منى إبراهيم", roleKey: "junior_lawyer" },
    { email: "secretary@elms.local", fullName: "سامي النجار", roleKey: "secretary" },
  ];

  const passwordHash = await bcrypt.hash("password123", 10);
  const users: { id: string; email: string }[] = [];

  for (const u of usersToSeed) {
    const roleId = roleByKey[u.roleKey];
    if (!roleId) {
      console.warn(`  ⚠ Role key "${u.roleKey}" not found — run system seed first`);
      continue;
    }

    // Email is globally unique — find by email regardless of firm
    const existing = await prisma.user.findFirst({ where: { email: u.email } });
    const user = existing
      ? // If found under a different firm, reassign to the dev firm
        existing.firmId !== firmId
        ? await prisma.user.update({
            where: { id: existing.id },
            data: { firmId, roleId, passwordHash, status: "ACTIVE", deletedAt: null },
          })
        : existing
      : await prisma.user.create({
          data: {
            firmId,
            roleId,
            email: u.email,
            fullName: u.fullName,
            passwordHash,
            preferredLanguage: "AR",
            status: "ACTIVE",
          },
        });

    users.push({ id: user.id, email: user.email });
  }

  console.log(`  ✓ ${users.length} dev users ready`);
  return users.map((u) => u.id);
}

// ---------------------------------------------------------------------------
// 3. Clients
// ---------------------------------------------------------------------------

async function seedDevClients(prisma: PrismaClient, firmId: string) {
  const existing = await prisma.client.count({ where: { firmId, deletedAt: null } });
  if (existing >= 100) {
    console.log(`  ✓ Clients already seeded (${existing}), skipping`);
    const all = await prisma.client.findMany({ where: { firmId, deletedAt: null }, select: { id: true } });
    return all.map((c) => c.id);
  }

  const clientData: Prisma.ClientCreateManyInput[] = [];

  // 80 INDIVIDUAL
  for (let i = 0; i < 80; i++) {
    const { name } = arabicPersonName();
    clientData.push({
      id: randomUUID(),
      firmId,
      name,
      type: "INDIVIDUAL",
      nationalId: egyptianNationalId(),
      phone: egyptianPhone(),
      email: faker.internet.email().toLowerCase(),
      governorate: pick(GOVERNORATES),
      preferredLanguage: "AR",
    });
  }

  // 30 COMPANY
  for (let i = 0; i < 30; i++) {
    const arabicName = pick(COMPANY_NAMES_AR) + ` ${i + 1}`;
    clientData.push({
      id: randomUUID(),
      firmId,
      name: faker.company.name() || arabicName,
      type: "COMPANY",
      commercialRegister: String(randInt(1000000, 9999999)),
      taxNumber: String(randInt(100000000, 999999999)),
      phone: egyptianPhone(),
      email: faker.internet.email().toLowerCase(),
      governorate: pick(GOVERNORATES),
      preferredLanguage: "AR",
    });
  }

  // 10 GOVERNMENT
  for (let i = 0; i < 10; i++) {
    clientData.push({
      id: randomUUID(),
      firmId,
      name: GOVERNMENT_ENTITIES_AR[i],
      type: "GOVERNMENT",
      phone: egyptianPhone(),
      governorate: pick(GOVERNORATES),
      preferredLanguage: "AR",
    });
  }

  await prisma.client.createMany({ data: clientData });

  // Contacts for ~40 random clients
  const chosenIds = pickN(clientData.map((c) => c.id as string), 40);
  const contactData: Prisma.ClientContactCreateManyInput[] = [];

  for (const clientId of chosenIds) {
    const count = randInt(1, 2);
    for (let j = 0; j < count; j++) {
      const { nameAr } = arabicPersonName();
      contactData.push({
        id: randomUUID(),
        clientId,
        name: nameAr,
        phone: egyptianPhone(),
        email: Math.random() > 0.4 ? faker.internet.email().toLowerCase() : null,
        role: Math.random() > 0.5 ? pick(CONTACT_ROLES_AR) : null,
      });
    }
  }

  await prisma.clientContact.createMany({ data: contactData });

  console.log(`  ✓ ${clientData.length} clients + ${contactData.length} contacts seeded`);
  return clientData.map((c) => c.id!);
}

// ---------------------------------------------------------------------------
// 4. Cases
// ---------------------------------------------------------------------------

interface CaseResult {
  caseId: string;
  clientId: string;
  courtIds: string[];
}

async function seedDevCases(
  prisma: PrismaClient,
  firmId: string,
  clientIds: string[],
  userIds: string[],
): Promise<CaseResult[]> {
  const existing = await prisma.case.count({ where: { firmId, deletedAt: null } });
  if (existing >= 60) {
    console.log(`  ✓ Cases already seeded (${existing}), skipping`);
    const all = await prisma.case.findMany({
      where: { firmId, deletedAt: null },
      select: { id: true, clientId: true, courts: { select: { id: true } } },
    });
    return all.map((c) => ({ caseId: c.id, clientId: c.clientId, courtIds: c.courts.map((ct) => ct.id) }));
  }

  const results: CaseResult[] = [];

  for (let i = 0; i < 60; i++) {
    const caseId = randomUUID();
    const clientId = pick(clientIds);
    const caseType = pick(CASE_TYPES);
    const status = pick(CASE_STATUSES);
    const year = randInt(2022, 2025);

    await prisma.case.create({
      data: {
        id: caseId,
        firmId,
        clientId,
        title: pick(CASE_TITLES_AR),
        caseNumber: `${randInt(100, 9999)}/${year}`,
        judicialYear: year,
        type: caseType,
        status: status as never,
        createdAt: randDate(365),
      },
    });

    // CaseCourt(s)
    const numCourts = randInt(1, 2);
    const courtIds: string[] = [];
    for (let j = 0; j < numCourts; j++) {
      const courtId = randomUUID();
      await prisma.caseCourt.create({
        data: {
          id: courtId,
          caseId,
          courtName: pick(COURT_NAMES_AR),
          courtLevel: pick(COURT_LEVELS),
          circuit: `الدائرة ${randInt(1, 20)}`,
          caseNumber: j === 0 ? `${randInt(100, 9999)}/${year}` : null,
          stageOrder: j,
          isActive: j === numCourts - 1,
          startedAt: randDate(400),
        },
      });
      courtIds.push(courtId);
    }

    // Assignment
    await prisma.caseAssignment.create({
      data: {
        id: randomUUID(),
        caseId,
        userId: pick(userIds),
        roleOnCase: "LEAD",
      },
    });

    // Our client as party
    await prisma.caseParty.create({
      data: {
        id: randomUUID(),
        caseId,
        clientId,
        name: "الموكل",
        role: "PLAINTIFF",
        partyType: "CLIENT",
      },
    });

    // Opposing party
    const { nameAr: oppName } = arabicPersonName();
    await prisma.caseParty.create({
      data: {
        id: randomUUID(),
        caseId,
        name: oppName,
        role: "DEFENDANT",
        partyType: "OPPONENT",
      },
    });

    // Status history
    await prisma.caseStatusHistory.create({
      data: {
        id: randomUUID(),
        caseId,
        fromStatus: null,
        toStatus: "ACTIVE",
        changedAt: randDate(365),
      },
    });

    results.push({ caseId, clientId, courtIds });
  }

  console.log(`  ✓ 60 cases seeded`);
  return results;
}

// ---------------------------------------------------------------------------
// 5. Sessions (Hearings)
// ---------------------------------------------------------------------------

async function seedDevSessions(
  prisma: PrismaClient,
  caseResults: CaseResult[],
  userIds: string[],
) {
  const existing = await prisma.caseSession.count({
    where: { caseId: { in: caseResults.map((c) => c.caseId) } },
  });
  if (existing >= 100) {
    console.log(`  ✓ Sessions already seeded (${existing}), skipping`);
    return;
  }

  const sessionData: Prisma.CaseSessionCreateManyInput[] = [];

  for (const { caseId, courtIds } of caseResults) {
    const numSessions = randInt(2, 3);
    for (let i = 0; i < numSessions; i++) {
      const isFuture = i === numSessions - 1 && Math.random() > 0.3;
      const sessionDate = isFuture ? randDate(0, 90) : randDate(180);
      sessionData.push({
        id: randomUUID(),
        caseId,
        caseCourtId: courtIds.length > 0 ? pick(courtIds) : null,
        assignedLawyerId: Math.random() > 0.3 ? pick(userIds) : null,
        sessionDatetime: sessionDate,
        outcome: isFuture ? null : (pick(SESSION_OUTCOMES) as never),
        notes: Math.random() > 0.5
          ? `جلسة رقم ${i + 1} — ${pick(["تم التأجيل لجلسة قادمة", "صدر حكم جزئي", "قرر الحضور والمرافعة", "أحيل لخبير"])}`
          : null,
      });
    }
  }

  await prisma.caseSession.createMany({ data: sessionData });
  console.log(`  ✓ ${sessionData.length} sessions seeded`);
}

// ---------------------------------------------------------------------------
// 6. Tasks
// ---------------------------------------------------------------------------

async function seedDevTasks(
  prisma: PrismaClient,
  firmId: string,
  caseResults: CaseResult[],
  userIds: string[],
) {
  const existing = await prisma.task.count({ where: { firmId, deletedAt: null } });
  if (existing >= 100) {
    console.log(`  ✓ Tasks already seeded (${existing}), skipping`);
    return;
  }

  const taskData: Prisma.TaskCreateManyInput[] = [];

  // ~2 tasks per case
  for (const { caseId } of caseResults) {
    const num = randInt(1, 3);
    for (let i = 0; i < num; i++) {
      const status = pick(TASK_STATUSES);
      taskData.push({
        id: randomUUID(),
        firmId,
        caseId,
        title: pick(TASK_TITLES_AR),
        status: status as never,
        priority: pick(TASK_PRIORITIES) as never,
        assignedToId: Math.random() > 0.3 ? pick(userIds) : null,
        createdById: pick(userIds),
        dueAt: Math.random() > 0.4 ? randDate(30, 60) : null,
        createdAt: randDate(200),
      });
    }
  }

  // 20 standalone firm tasks
  for (let i = 0; i < 20; i++) {
    taskData.push({
      id: randomUUID(),
      firmId,
      caseId: null,
      title: pick(TASK_TITLES_AR),
      status: pick(TASK_STATUSES) as never,
      priority: pick(TASK_PRIORITIES) as never,
      assignedToId: Math.random() > 0.3 ? pick(userIds) : null,
      createdById: pick(userIds),
      dueAt: Math.random() > 0.5 ? randDate(20, 45) : null,
      createdAt: randDate(100),
    });
  }

  await prisma.task.createMany({ data: taskData });
  console.log(`  ✓ ${taskData.length} tasks seeded`);
}

// ---------------------------------------------------------------------------
// 7. Documents (with placeholder files)
// ---------------------------------------------------------------------------

const FAKE_DOC_CONTENT = `
هذا مستند تجريبي أُنشئ لأغراض بيئة التطوير فقط.
يحتوي هذا الملف على نص قانوني نموذجي للاختبار.

بسم الله الرحمن الرحيم

نحن الموقعون أدناه، نُقر بموجب هذا المستند بما يلي:
أولاً: تم الاتفاق على جميع الشروط والأحكام الواردة في هذا العقد.
ثانياً: يلتزم كلا الطرفين بتنفيذ ما ورد في البنود المتفق عليها.
ثالثاً: في حالة النزاع، يُحال الأمر إلى القضاء المصري المختص.

هذا وقد حُرر هذا المستند من نسختين أصليتين بيد كل طرف نسخة للعمل بها عند الاقتضاء.
`.trim();

async function seedDevDocuments(
  prisma: PrismaClient,
  firmId: string,
  caseResults: CaseResult[],
  clientIds: string[],
  userId: string,
) {
  const existing = await prisma.document.count({ where: { firmId, deletedAt: null } });
  if (existing >= 100) {
    console.log(`  ✓ Documents already seeded (${existing}), skipping`);
    return;
  }

  const storagePath = process.env.LOCAL_STORAGE_PATH ?? "./uploads";

  for (const { caseId, clientId } of caseResults) {
    const numDocs = randInt(2, 4);
    for (let i = 0; i < numDocs; i++) {
      const docId = randomUUID();
      const filename = `doc_${docId.slice(0, 8)}.txt`;
      const storageKey = `${firmId}/${docId}/${filename}`;
      const fileDir = path.join(storagePath, firmId, docId);
      const filePath = path.join(fileDir, filename);

      fs.mkdirSync(fileDir, { recursive: true });
      fs.writeFileSync(filePath, FAKE_DOC_CONTENT, "utf8");

      const doc = await prisma.document.create({
        data: {
          id: docId,
          firmId,
          caseId,
          clientId,
          uploadedById: userId,
          title: pick(DOCUMENT_TITLES_AR),
          fileName: filename,
          mimeType: "text/plain",
          storageKey,
          type: pick(["GENERAL", "CONTRACT", "COURT_FILING"]),
          extractionStatus: "INDEXED",
          contentText: FAKE_DOC_CONTENT,
          createdAt: randDate(300),
        },
      });

      await prisma.documentVersion.create({
        data: {
          id: randomUUID(),
          documentId: doc.id,
          versionNumber: 1,
          fileName: filename,
          storageKey,
          contentText: FAKE_DOC_CONTENT,
        },
      });
    }
  }

  // ~20 client-level documents (no case)
  const chosenClients = pickN(clientIds, 20);
  for (const clientId of chosenClients) {
    const docId = randomUUID();
    const filename = `doc_${docId.slice(0, 8)}.txt`;
    const storageKey = `${firmId}/${docId}/${filename}`;
    const fileDir = path.join(storagePath, firmId, docId);

    fs.mkdirSync(fileDir, { recursive: true });
    fs.writeFileSync(path.join(fileDir, filename), FAKE_DOC_CONTENT, "utf8");

    const doc = await prisma.document.create({
      data: {
        id: docId,
        firmId,
        caseId: null,
        clientId,
        uploadedById: userId,
        title: pick(DOCUMENT_TITLES_AR),
        fileName: filename,
        mimeType: "text/plain",
        storageKey,
        type: "GENERAL",
        extractionStatus: "INDEXED",
        contentText: FAKE_DOC_CONTENT,
        createdAt: randDate(200),
      },
    });

    await prisma.documentVersion.create({
      data: {
        id: randomUUID(),
        documentId: doc.id,
        versionNumber: 1,
        fileName: filename,
        storageKey,
        contentText: FAKE_DOC_CONTENT,
      },
    });
  }

  const total = await prisma.document.count({ where: { firmId } });
  console.log(`  ✓ ${total} documents seeded (with placeholder files in ${storagePath})`);
}

// ---------------------------------------------------------------------------
// 8. Invoices
// ---------------------------------------------------------------------------

async function seedDevInvoices(
  prisma: PrismaClient,
  firmId: string,
  caseResults: CaseResult[],
) {
  const existing = await prisma.invoice.count({ where: { firmId } });
  if (existing >= 50) {
    console.log(`  ✓ Invoices already seeded (${existing}), skipping`);
    return;
  }

  let invoiceCounter = 1;

  for (const { caseId, clientId } of caseResults) {
    const numInvoices = randInt(1, 2);
    for (let i = 0; i < numInvoices; i++) {
      const invoiceNumber = `INV-2025-${String(invoiceCounter).padStart(4, "0")}`;
      invoiceCounter++;

      const status = pick(INVOICE_STATUSES);
      const feeType = pick(FEE_TYPES);
      const numItems = randInt(1, 3);
      const items: { description: string; quantity: number; unitPrice: number }[] = [];

      for (let j = 0; j < numItems; j++) {
        items.push({
          description: pick(INVOICE_ITEM_DESCS_AR),
          quantity: randInt(1, 5),
          unitPrice: randInt(500, 5000) * 10,
        });
      }

      const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
      const taxAmount = Math.round(subtotal * 0.14);
      const total = subtotal + taxAmount;

      const issuedAt = ["ISSUED", "PAID", "PARTIALLY_PAID"].includes(status) ? randDate(180) : null;
      const dueDate = issuedAt ? new Date(issuedAt.getTime() + 30 * 86400000) : null;

      const invoice = await prisma.invoice.create({
        data: {
          id: randomUUID(),
          firmId,
          caseId,
          clientId,
          invoiceNumber,
          status: status as never,
          feeType,
          subtotalAmount: subtotal,
          taxAmount,
          totalAmount: total,
          issuedAt,
          dueDate,
          createdAt: randDate(200),
          items: {
            createMany: {
              data: items.map((it) => ({
                id: randomUUID(),
                description: it.description,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                total: it.quantity * it.unitPrice,
              })),
            },
          },
        },
      });

      if (status === "PAID") {
        await prisma.payment.create({
          data: {
            id: randomUUID(),
            invoiceId: invoice.id,
            amount: total,
            method: pick(PAYMENT_METHODS),
            paidAt: randDate(90),
          },
        });
      } else if (status === "PARTIALLY_PAID") {
        await prisma.payment.create({
          data: {
            id: randomUUID(),
            invoiceId: invoice.id,
            amount: Math.round(total / 2),
            method: pick(PAYMENT_METHODS),
            paidAt: randDate(60),
          },
        });
      }
    }
  }

  const total = await prisma.invoice.count({ where: { firmId } });
  console.log(`  ✓ ${total} invoices seeded`);
}

// ---------------------------------------------------------------------------
// 9. Expenses
// ---------------------------------------------------------------------------

async function seedDevExpenses(
  prisma: PrismaClient,
  firmId: string,
  caseResults: CaseResult[],
) {
  const existing = await prisma.expense.count({ where: { firmId } });
  if (existing >= 80) {
    console.log(`  ✓ Expenses already seeded (${existing}), skipping`);
    return;
  }

  const expenseData: Prisma.ExpenseCreateManyInput[] = [];

  for (const { caseId } of caseResults) {
    const num = randInt(1, 3);
    for (let i = 0; i < num; i++) {
      expenseData.push({
        id: randomUUID(),
        firmId,
        caseId,
        category: pick([
          "COURT_FEE", "NOTARIZATION", "TRANSLATION",
          "EXPERT_FEE", "TRAVEL", "POSTAGE", "OTHER",
        ]),
        amount: randInt(5, 500) * 10,
        description: pick(EXPENSE_DESCS_AR),
        createdAt: randDate(300),
      });
    }
  }

  await prisma.expense.createMany({ data: expenseData });
  console.log(`  ✓ ${expenseData.length} expenses seeded`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function seedDevEnvironment(prisma: PrismaClient) {
  console.log("\n🌱 Seeding dev environment...");

  const firm = await ensureDevFirm(prisma);
  const userIds = await ensureDevUsers(prisma, firm.id);

  if (userIds.length === 0) {
    console.error("  ✗ No users seeded — aborting dev seed (system roles missing?)");
    return;
  }

  const adminUserId = userIds[0];

  const clientIds = await seedDevClients(prisma, firm.id);
  const caseResults = await seedDevCases(prisma, firm.id, clientIds, userIds);
  await seedDevSessions(prisma, caseResults, userIds);
  await seedDevTasks(prisma, firm.id, caseResults, userIds);
  await seedDevDocuments(prisma, firm.id, caseResults, clientIds, adminUserId);
  await seedDevInvoices(prisma, firm.id, caseResults);
  await seedDevExpenses(prisma, firm.id, caseResults);

  console.log("\n✅ Dev environment seeded successfully!");
  console.log(`   Login: admin@elms.local / password123`);
  console.log(`   Firm slug: dev-firm\n`);
}
