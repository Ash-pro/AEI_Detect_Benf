import type { Center, Db, IdentityType, Project, User } from "./types";
import { todayKey } from "./utils";

/* بيانات تجريبية للتصميم فقط — تُستبدل بـ Supabase لاحقاً */

export const CENTERS: Center[] = [
  { code: "GAZA", name: "مركز غزة", short: "غزة" },
  { code: "KHY", name: "مركز خانيونس", short: "خانيونس" },
];

export const PROJECTS: Project[] = [
  { code: "WFP", name: "WFP", nameAr: "برنامج الأغذية العالمي", allowException: false },
  { code: "MAP", name: "MAP", nameAr: "ماب", allowException: false },
  { code: "WHH", name: "WHH", nameAr: "ويلت هنغر هيلفه", allowException: false },
  { code: "UNICEF", name: "UNICEF", nameAr: "يونيسف", allowException: true },
  { code: "STC", name: "Save The Children", nameAr: "أنقذوا الأطفال", allowException: false },
  { code: "CELIAC", name: "السيلياك", nameAr: "Celiac Disease", allowException: true },
  { code: "MECA", name: "MECA", nameAr: "ميكا", allowException: false },
  { code: "TAAWON", name: "التعاون", nameAr: "مؤسسة التعاون", allowException: false },
];

export const IDENTITY_TYPES: IdentityType[] = [
  { id: "mother", name: "أم", isSystem: true },
  { id: "father", name: "أب", isSystem: true },
  { id: "child", name: "طفل", isSystem: true },
  { id: "grandmother", name: "جدة", isSystem: false },
];

export const EXCEPTION_REASONS = ["حالة طبية طارئة", "تحويل من طبيب المشروع", "خطأ في التحويل من الاستقبال", "أخرى"];
export const NEW_ENROLLMENT_REASONS = ["تحويل طبي", "طلب من المشروع", "تغيّر حالة المستفيد (حمل / رضاعة)", "أخرى"];

export const USERS: (User & { password: string })[] = [
  { username: "reception1", password: "1234", fullName: "سماح الأسطل", role: "RECEPTION", centers: ["GAZA", "KHY"], projects: [] },
  { username: "unicef1", password: "1234", fullName: "محمود قديح", role: "PROJECT", centers: ["GAZA", "KHY"], projects: ["UNICEF"] },
  { username: "multi1", password: "1234", fullName: "رهف أبو طير", role: "PROJECT", centers: ["GAZA", "KHY"], projects: ["WFP", "CELIAC"] },
];

/** ينتج وقتاً بتوقيت غزة قبل عدد أيام */
function at(daysAgo: number, hhmm: string): string {
  const base = new Date(todayKey() + "T" + hhmm + ":00+03:00");
  base.setUTCDate(base.getUTCDate() - daysAgo);
  return base.toISOString();
}

export function seedDb(): Db {
  return {
    identityTypes: IDENTITY_TYPES,
    beneficiaries: [
      { id: "b1", nationalId: "401234562", typeId: "mother", name: "سعاد محمد أحمد النجار", phone: "0599123456", homeCenter: "KHY", householdId: "h1", createdAt: at(120, "09:10") },
      { id: "b2", nationalId: "402345672", typeId: "child", name: "أحمد محمد أحمد النجار", phone: "0599123456", birthDate: "2023-04-11", homeCenter: "KHY", householdId: "h1", createdAt: at(60, "09:30") },
      { id: "b3", nationalId: "803456789", typeId: "child", name: "ليان محمد أحمد النجار", phone: "0599123456", birthDate: "2024-12-02", homeCenter: "KHY", householdId: "h1", createdAt: at(45, "10:05") },
      { id: "b4", nationalId: "404567893", typeId: "mother", name: "مريم عبد الله سالم أبو جزر", phone: "0567788990", homeCenter: "GAZA", createdAt: at(90, "11:00") },
      { id: "b5", nationalId: "905678124", typeId: "father", name: "خالد يوسف حسن شعبان", phone: "0592233445", homeCenter: "KHY", createdAt: at(200, "08:40") },
      { id: "b6", nationalId: "406781237", typeId: "mother", name: "هبة سامي محمود الأغا", phone: "0598877665", homeCenter: "KHY", createdAt: at(30, "12:15") },
      { id: "b7", nationalId: "807892344", typeId: "mother", name: "نور حسن علي أبو شمالة", phone: "0569911223", homeCenter: "KHY", createdAt: at(15, "10:00") },
      { id: "b8", nationalId: "408913457", typeId: "child", name: "ياسر رامي خليل الفرا", phone: "0594455667", birthDate: "2022-07-19", homeCenter: "KHY", createdAt: at(150, "09:45") },
      { id: "b9", nationalId: "909124562", typeId: "mother", name: "رنا إبراهيم عطية الفرا", phone: "0594455667", homeCenter: "KHY", createdAt: at(70, "10:30") },
    ],
    enrollments: [
      { id: "e1", beneficiaryId: "b1", project: "WFP", center: "KHY", status: "ACTIVE", enrolledAt: at(120, "09:10") },
      { id: "e2", beneficiaryId: "b1", project: "UNICEF", center: "KHY", status: "ACTIVE", enrolledAt: at(120, "09:10") },
      { id: "e3", beneficiaryId: "b1", project: "MAP", center: "KHY", status: "PENDING_APPROVAL", enrolledAt: at(6, "10:00") },
      { id: "e4", beneficiaryId: "b1", project: "WHH", center: "GAZA", status: "CLOSED", enrolledAt: at(300, "09:00"), closedAt: at(49, "12:00"), closedReason: "إتمام البرنامج" },
      { id: "e5", beneficiaryId: "b2", project: "UNICEF", center: "KHY", status: "ACTIVE", enrolledAt: at(60, "09:30") },
      { id: "e6", beneficiaryId: "b2", project: "WFP", center: "KHY", status: "ACTIVE", enrolledAt: at(60, "09:30") },
      { id: "e7", beneficiaryId: "b3", project: "UNICEF", center: "KHY", status: "ACTIVE", enrolledAt: at(45, "10:05") },
      { id: "e8", beneficiaryId: "b3", project: "STC", center: "KHY", status: "ACTIVE", enrolledAt: at(45, "10:05") },
      { id: "e9", beneficiaryId: "b4", project: "WFP", center: "GAZA", status: "ACTIVE", enrolledAt: at(90, "11:00") },
      { id: "e10", beneficiaryId: "b4", project: "UNICEF", center: "GAZA", status: "ACTIVE", enrolledAt: at(90, "11:00") },
      { id: "e11", beneficiaryId: "b5", project: "WFP", center: "KHY", status: "ACTIVE", enrolledAt: at(200, "08:40") },
      { id: "e12", beneficiaryId: "b6", project: "CELIAC", center: "KHY", status: "ACTIVE", enrolledAt: at(30, "12:15") },
      { id: "e13", beneficiaryId: "b7", project: "UNICEF", center: "KHY", status: "PENDING_APPROVAL", enrolledAt: at(0, "09:05") },
      { id: "e14", beneficiaryId: "b7", project: "WFP", center: "KHY", status: "ACTIVE", enrolledAt: at(15, "10:00") },
      { id: "e15", beneficiaryId: "b8", project: "UNICEF", center: "KHY", status: "CLOSED", enrolledAt: at(150, "09:45"), closedAt: at(20, "11:00"), closedReason: "تعافٍ" },
      { id: "e16", beneficiaryId: "b9", project: "UNICEF", center: "KHY", status: "ACTIVE", enrolledAt: at(70, "10:30") },
      { id: "e17", beneficiaryId: "b9", project: "WFP", center: "KHY", status: "ACTIVE", enrolledAt: at(70, "10:30") },
    ],
    visits: [
      // سعاد
      { id: "v1", beneficiaryId: "b1", seq: 1, kind: "NEW", center: "GAZA", occurredAt: at(120, "09:10"), referrals: ["WHH"], receptionist: "استقبال غزة 1" },
      { id: "v2", beneficiaryId: "b1", seq: 2, kind: "FOLLOW_UP", center: "KHY", occurredAt: at(90, "09:40"), referrals: ["WFP", "UNICEF"], receptionist: "سماح الأسطل" },
      { id: "v3", beneficiaryId: "b1", seq: 3, kind: "FOLLOW_UP", center: "KHY", occurredAt: at(63, "10:15"), referrals: ["WFP"], receptionist: "سماح الأسطل" },
      { id: "v4", beneficiaryId: "b1", seq: 4, kind: "FOLLOW_UP", center: "KHY", occurredAt: at(42, "11:20"), referrals: ["WFP", "UNICEF"], receptionist: "سماح الأسطل" },
      { id: "v5", beneficiaryId: "b1", seq: 5, kind: "FOLLOW_UP", center: "KHY", occurredAt: at(21, "09:05"), referrals: ["WFP", "UNICEF"], receptionist: "سماح الأسطل" },
      { id: "v6", beneficiaryId: "b1", seq: 6, kind: "FOLLOW_UP", center: "KHY", occurredAt: at(6, "10:00"), referrals: ["WFP", "MAP"], receptionist: "سماح الأسطل" },
      { id: "v7", beneficiaryId: "b1", seq: 7, kind: "FOLLOW_UP", center: "KHY", occurredAt: at(0, "09:15"), referrals: ["WFP"], receptionist: "سماح الأسطل" },
      // أحمد (لا زيارة اليوم)
      { id: "v8", beneficiaryId: "b2", seq: 1, kind: "NEW", center: "KHY", occurredAt: at(60, "09:30"), referrals: ["UNICEF", "WFP"], receptionist: "سماح الأسطل" },
      { id: "v9", beneficiaryId: "b2", seq: 2, kind: "FOLLOW_UP", center: "KHY", occurredAt: at(14, "10:10"), referrals: ["UNICEF"], receptionist: "سماح الأسطل" },
      // ليان: زيارة اليوم لـ STC فقط
      { id: "v10", beneficiaryId: "b3", seq: 1, kind: "NEW", center: "KHY", occurredAt: at(45, "10:05"), referrals: ["UNICEF", "STC"], receptionist: "سماح الأسطل" },
      { id: "v11", beneficiaryId: "b3", seq: 2, kind: "FOLLOW_UP", center: "KHY", occurredAt: at(0, "10:02"), referrals: ["STC"], receptionist: "سماح الأسطل" },
      // مريم (غزة)
      { id: "v12", beneficiaryId: "b4", seq: 1, kind: "NEW", center: "GAZA", occurredAt: at(90, "11:00"), referrals: ["WFP", "UNICEF"], receptionist: "استقبال غزة 1" },
      { id: "v13", beneficiaryId: "b4", seq: 2, kind: "FOLLOW_UP", center: "GAZA", occurredAt: at(12, "09:20"), referrals: ["WFP"], receptionist: "استقبال غزة 1" },
      // خالد
      { id: "v14", beneficiaryId: "b5", seq: 1, kind: "NEW", center: "KHY", occurredAt: at(200, "08:40"), referrals: ["WFP"], receptionist: "سماح الأسطل" },
      // هبة: اليوم للسيلياك
      { id: "v15", beneficiaryId: "b6", seq: 1, kind: "NEW", center: "KHY", occurredAt: at(30, "12:15"), referrals: ["CELIAC"], receptionist: "سماح الأسطل" },
      { id: "v16", beneficiaryId: "b6", seq: 2, kind: "FOLLOW_UP", center: "KHY", occurredAt: at(0, "09:50"), referrals: ["CELIAC"], receptionist: "سماح الأسطل" },
      // نور: اليوم UNICEF (بانتظار الاعتماد) + WFP
      { id: "v17", beneficiaryId: "b7", seq: 1, kind: "NEW", center: "KHY", occurredAt: at(15, "10:00"), referrals: ["WFP"], receptionist: "سماح الأسطل" },
      { id: "v18", beneficiaryId: "b7", seq: 2, kind: "FOLLOW_UP", center: "KHY", occurredAt: at(0, "09:05"), referrals: ["WFP", "UNICEF"], receptionist: "سماح الأسطل" },
      // ياسر
      { id: "v19", beneficiaryId: "b8", seq: 1, kind: "NEW", center: "KHY", occurredAt: at(150, "09:45"), referrals: ["UNICEF"], receptionist: "سماح الأسطل" },
      // رنا: اليوم UNICEF + WFP
      { id: "v21", beneficiaryId: "b9", seq: 1, kind: "NEW", center: "KHY", occurredAt: at(70, "10:30"), referrals: ["UNICEF", "WFP"], receptionist: "سماح الأسطل" },
      { id: "v22", beneficiaryId: "b9", seq: 2, kind: "FOLLOW_UP", center: "KHY", occurredAt: at(35, "09:30"), referrals: ["UNICEF"], receptionist: "سماح الأسطل" },
      { id: "v23", beneficiaryId: "b9", seq: 3, kind: "FOLLOW_UP", center: "KHY", occurredAt: at(0, "10:20"), referrals: ["UNICEF", "WFP"], receptionist: "سماح الأسطل" },
    ],
    services: [
      { id: "s1", beneficiaryId: "b1", project: "WFP", center: "KHY", servedAt: at(6, "10:30"), servedBy: "رهف أبو طير", source: "POINT" },
      { id: "s2", beneficiaryId: "b1", project: "UNICEF", center: "KHY", servedAt: at(21, "09:40"), servedBy: "محمود قديح", source: "POINT" },
      { id: "s3", beneficiaryId: "b1", project: "WFP", center: "KHY", servedAt: at(0, "09:35"), servedBy: "رهف أبو طير", source: "POINT" },
      { id: "s4", beneficiaryId: "b2", project: "UNICEF", center: "KHY", servedAt: at(14, "10:30"), servedBy: "محمود قديح", source: "POINT" },
      { id: "s5", beneficiaryId: "b9", project: "UNICEF", center: "KHY", servedAt: at(35, "09:50"), servedBy: "محمود قديح", source: "EXCEL" },
      { id: "s6", beneficiaryId: "b6", project: "CELIAC", center: "KHY", servedAt: at(30, "12:40"), servedBy: "رهف أبو طير", source: "POINT" },
    ],
    restrictions: [
      { beneficiaryId: "b5", level: "TEMPORARILY_BLOCKED", reason: "تكرار الاستلام من مشروعين خلال نفس الأسبوع — قيد المراجعة الإدارية", endsAt: at(-9, "23:59") },
      { beneficiaryId: "b6", level: "WARNING", reason: "خُدمت سابقاً دون المرور على الاستقبال" },
    ],
  };
}

/** أرقام تجريبية لتبدو العدادات واقعية */
export const COUNTER_BASELINE = {
  reception: { visits: 84, newCases: 11, referrals: 126, served: 98 },
  point: { served: 33, exceptions: 1 },
};

/** هويات جاهزة لمعاينة السيناريوهات */
export const DEMO_IDS: { id: string; label: string }[] = [
  { id: "401234562", label: "سعاد — زيارة اليوم + خدمات" },
  { id: "402345672", label: "أحمد (طفل) — متابعة عادية" },
  { id: "803456789", label: "ليان — محوّلة لمشروع آخر اليوم" },
  { id: "404567893", label: "مريم — مسجلة في مركز غزة" },
  { id: "905678124", label: "خالد — منع مؤقت" },
  { id: "406781237", label: "هبة — تحذير" },
  { id: "807892344", label: "نور — مشروع بانتظار الاعتماد" },
  { id: "408913457", label: "ياسر — ارتباط مغلق" },
  { id: "909124562", label: "رنا — محوّلة اليوم" },
  { id: "401029384", label: "هوية غير مسجلة" },
  { id: "123456789", label: "هوية غير صالحة" },
];
