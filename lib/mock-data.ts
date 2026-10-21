import type { Beneficiary, Center, CenterCode, Db, Entry, Project, Settings, User } from "./types";
import { addDays, isValidNationalId, todayKey } from "./utils";

/* بيانات تجريبية للعرض والاختبار فقط — تُستبدل بـ Supabase لاحقاً */

export const DB_VERSION = 4;

export const CENTERS: Center[] = [
  { code: "GAZA", name: "مركز غزة", short: "غزة" },
  { code: "KHY", name: "مركز خانيونس", short: "خانيونس" },
];

const BOTH: CenterCode[] = ["GAZA", "KHY"];

export const SEED_PROJECTS: Project[] = [
  { code: "WFP", name: "WFP", active: true, order: 1, centers: BOTH },
  { code: "MAP", name: "MAP", active: true, order: 2, centers: BOTH },
  { code: "WHH", name: "WHH", active: true, order: 3, centers: BOTH },
  { code: "UNICEF", name: "UNICEF", active: true, order: 4, centers: BOTH },
  { code: "STC", name: "Save The Children", active: true, order: 5, centers: BOTH },
  { code: "CELIAC", name: "السيلياك", active: true, order: 6, centers: BOTH },
  { code: "MECA", name: "MECA", active: true, order: 7, centers: BOTH },
  { code: "TAAWON", name: "التعاون", active: true, order: 8, centers: BOTH },
];

export const DEFAULT_SETTINGS: Settings = {
  hintReception: "أدخل رقم هوية ولي الأمر (الأم أو الأب)، ثم اختر المشاريع التي ستتوجه لها الحالة واضغط إدخال.",
  hintPoint: "أدخل كل حالة تخدمها، واحدة تلو الأخرى، فور تقديم الخدمة. إذا كان توجيه الاستقبال خاطئاً، اضغط \"تعديل التوجيه\" ولا تُدخل الخدمة.",
  idleMinutes: 30,
};

/** كلمة المرور لكل الحسابات التجريبية */
export const DEMO_PASSWORD = "1234";

const POINT_NAMES: Record<CenterCode, string[]> = {
  GAZA: ["أحمد الحلو", "منى السقا", "خالد عياد", "ريم الشوا", "سامي حمدان", "إيمان الغول", "يوسف بكر", "نسرين عاشور"],
  KHY: ["محمود قديح", "رهف أبو طير", "عبير الفرا", "بلال الأغا", "هدى معمر", "طارق شعت", "دعاء النجار", "وسيم بربخ"],
};

function seedUsers(): User[] {
  const created = addDays(todayKey(), -60) + "T08:00:00Z";
  const users: User[] = [
    { id: "u-admin", username: "admin", password: DEMO_PASSWORD, fullName: "مدير النظام", role: "ADMIN", centers: BOTH, projects: [], active: true, createdAt: created },
    { id: "u-sup", username: "supervisor", password: DEMO_PASSWORD, fullName: "مشرف النظام", role: "SUPERVISOR", centers: BOTH, projects: [], active: true, createdAt: created },
    { id: "u-rg", username: "reception.gaza", password: DEMO_PASSWORD, fullName: "هناء أبو شعبان", role: "RECEPTION", centers: ["GAZA"], projects: [], active: true, createdAt: created },
    { id: "u-rk", username: "reception.khy", password: DEMO_PASSWORD, fullName: "سماح الأسطل", role: "RECEPTION", centers: ["KHY"], projects: [], active: true, createdAt: created },
    { id: "u-rx", username: "reception.both", password: DEMO_PASSWORD, fullName: "ياسر عودة", role: "RECEPTION", centers: BOTH, projects: [], active: false, createdAt: created },
  ];
  for (const c of BOTH) {
    SEED_PROJECTS.forEach((p, i) => {
      const special = c === "KHY" && p.code === "UNICEF" ? "unicef.khy" : c === "GAZA" && p.code === "WFP" ? "wfp.gaza" : null;
      if (c === "KHY" && (p.code === "WFP" || p.code === "CELIAC")) return; // يغطيهما حساب متعدد المشاريع
      users.push({
        id: `u-${c}-${p.code}`.toLowerCase(),
        username: special ?? `${p.code.toLowerCase()}.${c === "GAZA" ? "gaza" : "khy"}`,
        password: DEMO_PASSWORD,
        fullName: POINT_NAMES[c][i],
        role: "POINT",
        centers: [c],
        projects: [p.code],
        active: true,
        createdAt: created,
      });
    });
  }
  users.push({
    id: "u-khy-multi",
    username: "multi.khy",
    password: DEMO_PASSWORD,
    fullName: "نادين أبو ريدة",
    role: "POINT",
    centers: ["KHY"],
    projects: ["WFP", "CELIAC"],
    active: true,
    createdAt: created,
  });
  return users;
}

/* ===== مولد بيانات ثابت (نفس النتيجة في كل مرة) ===== */

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function validId(r: () => number): string {
  const base = String(Math.floor(r() * 90_000_000) + 400_000_000).slice(0, 8);
  for (let c = 0; c < 10; c++) if (isValidNationalId(base + c)) return base + c;
  return validId(r);
}

const FIRST = ["سعاد", "مريم", "هبة", "نور", "رنا", "أسماء", "فاطمة", "آمنة", "دعاء", "ولاء", "محمد", "أحمد", "خالد", "يوسف", "إبراهيم", "سمر", "إيمان", "رغد", "حنان", "عبير"];
const MIDDLE = ["محمد", "أحمد", "سالم", "حسن", "علي", "خليل", "عبد الله", "سامي", "رامي", "يوسف"];
const LAST = ["النجار", "أبو جزر", "الفرا", "الأغا", "شعبان", "أبو شمالة", "الأسطل", "قديح", "معمر", "بربخ", "السقا", "الحلو", "الشوا", "حمدان", "عياد"];

function randomName(r: () => number): string {
  const roll = r();
  if (roll < 0.3) return ""; // الاسم اختياري
  const f = FIRST[Math.floor(r() * FIRST.length)];
  const l = LAST[Math.floor(r() * LAST.length)];
  if (roll < 0.45) return f;
  if (roll < 0.8) return `${f} ${l}`;
  return `${f} ${MIDDLE[Math.floor(r() * MIDDLE.length)]} ${l}`;
}

/** فرق توقيت غزة عن UTC ليوم محدد، مثل +03:00 */
function gazaOffset(key: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Gaza", timeZoneName: "shortOffset" }).formatToParts(
      new Date(key + "T09:00:00Z"),
    );
    const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+3";
    const h = Number(tz.replace("GMT", "") || "3");
    return `${h >= 0 ? "+" : "-"}${String(Math.abs(h)).padStart(2, "0")}:00`;
  } catch {
    return "+03:00";
  }
}

export function atTime(key: string, minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return new Date(`${key}T${hh}:${mm}:00${gazaOffset(key)}`).toISOString();
}

const WEIGHTS: Record<string, number> = { WFP: 0.55, UNICEF: 0.45, MAP: 0.2, STC: 0.12, TAAWON: 0.09, CELIAC: 0.07, WHH: 0.06, MECA: 0.05 };

export function seedDb(): Db {
  const r = rng(20261021);
  const users = seedUsers();
  const beneficiaries: Record<string, Beneficiary> = {};
  const entries: Entry[] = [];
  const known: Record<CenterCode, string[]> = { GAZA: [], KHY: [] };
  const today = todayKey();
  let n = 0;
  const seen = new Set<string>(); // منع تكرار نفس الهوية في نفس اليوم

  // اليوم: الإدخالات حتى الوقت الحالي فقط
  const nowParts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Gaza", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).split(":");
  const nowMin = Number(nowParts[0]) * 60 + Number(nowParts[1]);
  const todaySpan = Math.max(30, Math.min(330, nowMin - 8 * 60));
  const cap = (date: string, m: number) => (date === today ? Math.min(m, 8 * 60 + todaySpan) : Math.min(m, 15 * 60));

  const pointUser = (c: CenterCode, p: string) =>
    c === "KHY" && (p === "WFP" || p === "CELIAC") ? "u-khy-multi" : `u-${c}-${p}`.toLowerCase();

  const touch = (nid: string, at: string): boolean => {
    if (beneficiaries[nid]) return false;
    beneficiaries[nid] = { nid, name: randomName(r), createdAt: at };
    return true;
  };

  for (let d = 35; d >= 0; d--) {
    const date = addDays(today, -d);
    if (new Date(date + "T12:00:00Z").getUTCDay() === 5) continue; // الجمعة عطلة
    for (const c of ["GAZA", "KHY"] as CenterCode[]) {
      let count = Math.round((c === "GAZA" ? 55 : 62) + r() * 30);
      if (d === 0) count = Math.max(6, Math.round((count * todaySpan) / 330));
      const receptionUser = c === "GAZA" ? "u-rg" : "u-rk";
      for (let i = 0; i < count; i++) {
        const returning = known[c].length > 40 && r() < 0.72;
        const nid = returning ? known[c][Math.floor(r() * known[c].length)] : validId(r);
        if (seen.has(`R|${date}|${c}|${nid}`)) continue;
        seen.add(`R|${date}|${c}|${nid}`);
        const minute = 8 * 60 + Math.floor(r() * (d === 0 ? todaySpan : 330));
        const at = atTime(date, minute);
        const isNew = touch(nid, at);
        if (isNew) known[c].push(nid);
        const projects = SEED_PROJECTS.filter((p) => r() < WEIGHTS[p.code]).map((p) => p.code);
        if (!projects.length) projects.push(r() < 0.6 ? "WFP" : "UNICEF");
        entries.push({ id: `e${++n}`, nid, center: c, userId: receptionUser, kind: "RECEPTION", at, date, projects, isNew });

        for (const p of projects) {
          if (r() < 0.9 && !seen.has(`P|${date}|${nid}|${p}`)) {
            seen.add(`P|${date}|${nid}|${p}`);
            const pAt = atTime(date, cap(date, minute + 10 + Math.floor(r() * 50)));
            entries.push({ id: `e${++n}`, nid, center: c, userId: pointUser(c, p), kind: "POINT", at: pAt, date, projects: [p], isNew: false });
          }
        }
        // طفل يُخدم في النقطة بهويته الخاصة
        if (r() < 0.12) {
          const child = validId(r);
          const p = r() < 0.6 ? "UNICEF" : "STC";
          const cAt = atTime(date, cap(date, minute + 20 + Math.floor(r() * 40)));
          const childNew = touch(child, cAt);
          entries.push({ id: `e${++n}`, nid: child, center: c, userId: pointUser(c, p), kind: "POINT", at: cAt, date, projects: [p], isNew: childNew });
        }
      }
    }
  }

  // حالة عرض ثابتة بسجل واضح
  const demo = "401234562";
  beneficiaries[demo] = { nid: demo, name: "سعاد محمد النجار", createdAt: atTime(addDays(today, -34), 9 * 60 + 10) };
  const demoVisits: [number, number, string[]][] = [
    [34, 9 * 60 + 10, ["WFP", "UNICEF"]],
    [27, 10 * 60 + 5, ["WFP"]],
    [20, 9 * 60 + 40, ["WFP", "UNICEF"]],
    [13, 11 * 60 + 20, ["WFP", "MAP"]],
    [6, 9 * 60 + 5, ["WFP", "UNICEF"]],
    [1, 10 * 60, ["WFP"]],
  ];
  demoVisits.forEach(([ago, m, projects], i) => {
    const date = addDays(today, -ago);
    if (new Date(date + "T12:00:00Z").getUTCDay() === 5) return;
    entries.push({ id: `e${++n}`, nid: demo, center: "KHY", userId: "u-rk", kind: "RECEPTION", at: atTime(date, m), date, projects, isNew: i === 0 });
    projects.forEach((p) =>
      entries.push({ id: `e${++n}`, nid: demo, center: "KHY", userId: pointUser("KHY", p), kind: "POINT", at: atTime(date, m + 25), date, projects: [p], isNew: false }),
    );
  });

  entries.sort((a, b) => a.at.localeCompare(b.at));

  return {
    version: DB_VERSION,
    seededOn: today,
    centers: CENTERS,
    projects: SEED_PROJECTS,
    users,
    beneficiaries,
    entries,
    changes: [],
    settings: DEFAULT_SETTINGS,
  };
}

/** هوية صالحة غير مسجلة لاختبار "حالة جديدة" */
export function freshValidId(db: Db): string {
  const r = rng(Date.now() % 100000);
  for (let i = 0; i < 50; i++) {
    const id = validId(r);
    if (!db.beneficiaries[id]) return id;
  }
  return "401029384";
}
