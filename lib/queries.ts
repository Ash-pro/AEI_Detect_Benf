import type { CenterCode, Db, Entry, Project, SessionUser } from "./types";
import { dayFull, formatTime, hourOf, todayKey, weekday } from "./utils";
import { idTypeLabel, lastNumber, projectQueue, waitingCount } from "./queue";

/* استعلامات العرض على البيانات التجريبية — تُستبدل بدوال Supabase لاحقاً */

export type CenterFilter = CenterCode | "ALL";

export function activeProjects(db: Db, center?: CenterCode | null): Project[] {
  return db.projects
    .filter((p) => p.active && (!center || p.centers.includes(center)))
    .sort((a, b) => a.order - b.order);
}

export function allProjects(db: Db): Project[] {
  return [...db.projects].sort((a, b) => a.order - b.order);
}

export function projectName(db: Db, code: string): string {
  return db.projects.find((p) => p.code === code)?.name ?? code;
}

export function centerName(db: Db, code: CenterCode, short = false): string {
  const c = db.centers.find((x) => x.code === code);
  return (short ? c?.short : c?.name) ?? code;
}

export function userName(db: Db, id: string): string {
  return db.users.find((u) => u.id === id)?.fullName ?? "—";
}

export function entriesOf(db: Db, nid: string): Entry[] {
  return db.entries.filter((e) => e.nid === nid).sort((a, b) => b.at.localeCompare(a.at));
}

/** السجل الذي يراه الموظف: الاستقبال يرى كل شيء، النقطة ترى الاستقبال + مشاريعها */
export function visibleHistory(db: Db, nid: string, user: SessionUser): Entry[] {
  const all = entriesOf(db, nid);
  if (user.role !== "POINT") return all;
  return all.filter((e) => e.kind === "RECEPTION" || e.projects.some((p) => user.projects.includes(p)));
}

/** آخر إدخال استقبال لنفس الهوية في نفس المركز — لتحديد المشاريع مسبقاً */
export function lastReception(db: Db, nid: string, center: CenterCode): Entry | undefined {
  return entriesOf(db, nid).find((e) => e.kind === "RECEPTION" && e.center === center);
}

export function filterCenter(entries: Entry[], c: CenterFilter) {
  return c === "ALL" ? entries : entries.filter((e) => e.center === c);
}

/* ===== إحصائيات الموظف اليومية ===== */

export interface StaffStats {
  /** الاستقبال: توزيع حسب نوع الهوية */
  types: { label: string; count: number }[];
  /** النقطة: من قائمة الانتظار / بدون دور / تصحيح توجيه */
  fromQueue: number;
  noQueue: number;
  corrected: number;
  total: number;
  isNew: number;
  repeat: number;
  perProject: { code: string; name: string; count: number }[];
  first?: string;
  last?: string;
}

export function staffStats(db: Db, user: SessionUser, center: CenterCode, date = todayKey()): StaffStats {
  // النقطة: الخدمات فقط (التحويلات التي ينشئها موظف النقطة لا تُحسب خدمة)
  const mine = db.entries.filter(
    (e) => e.userId === user.id && e.date === date && e.center === center && (user.role !== "POINT" || e.kind === "POINT"),
  );
  const counts = new Map<string, number>();
  mine.forEach((e) => e.projects.forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1)));
  const cases = user.role === "POINT" ? new Set(mine.map((e) => e.nid)).size : mine.length;
  const sorted = [...mine].sort((a, b) => a.at.localeCompare(b.at));
  const typeCount = new Map<string, number>();
  if (user.role !== "POINT")
    mine.forEach((e) => {
      const l = idTypeLabel(db.beneficiaries[e.nid]?.type) || "غير محدد";
      typeCount.set(l, (typeCount.get(l) ?? 0) + 1);
    });
  const recToday = db.entries.filter((e) => e.kind === "RECEPTION" && e.date === date && e.center === center);
  const queued = mine.filter((e) => e.queueRef || recToday.some((r) => r.nid === e.nid && e.projects.some((p) => r.queue?.[p])));
  // النقطة: بالحالات (الهويات) حتى يتطابق المجموع مع عدد الحالات المخدومة
  const fromQueue = user.role === "POINT" ? new Set(queued.map((e) => e.nid)).size : queued.length;
  return {
    types: ["أم", "أب", "طفل", "غير محدد"].filter((l) => typeCount.has(l)).map((l) => ({ label: l, count: typeCount.get(l)! })),
    fromQueue,
    noQueue: Math.max(0, (user.role === "POINT" ? new Set(mine.map((e) => e.nid)).size : mine.length) - fromQueue),
    corrected: recToday.filter((e) => e.corrected?.by === user.id).length,
    total: cases,
    isNew: mine.filter((e) => e.isNew).length,
    repeat: cases - mine.filter((e) => e.isNew).length,
    perProject: allProjects(db)
      .filter((p) => counts.has(p.code) || (user.role === "POINT" && user.projects.includes(p.code)))
      .map((p) => ({ code: p.code, name: p.name, count: counts.get(p.code) ?? 0 })),
    first: sorted[0]?.at,
    last: sorted[sorted.length - 1]?.at,
  };
}

export function staffShareText(db: Db, user: SessionUser, center: CenterCode, s: StaffStats, date = todayKey()): string {
  const head =
    user.role === "POINT"
      ? `📋 إحصائيات نقطة ${user.projects.map((p) => projectName(db, p)).join(" و")}`
      : "📋 إحصائيات الاستقبال";
  const lines = [head, `${centerName(db, center)} — ${weekday(date)} ${dayFull(date)}`, `الموظف: ${user.fullName}`, ""];
  if (user.role === "POINT") {
    lines.push(`الحالات المخدومة: ${s.total}`);
    if (s.perProject.length > 1) s.perProject.forEach((p) => lines.push(`• ${p.name}: ${p.count}`));
    lines.push(`• من قائمة الانتظار: ${s.fromQueue}`, `• بدون دور: ${s.noQueue}`);
    lines.push(`• ما زال بانتظار: ${waitingCount(db, center, user.projects, date)}`);
    if (s.corrected) lines.push(`• صُحّح توجيهها: ${s.corrected}`);
    lines.push(`• جديدة على النظام: ${s.isNew}`);
    if (s.first) lines.push("", `أول حالة: ${formatTime(s.first)}`, `آخر حالة: ${formatTime(s.last!)}`);
  } else {
    lines.push(`إجمالي الحالات: ${s.total}`, `• جديدة: ${s.isNew}`, `• متكررة: ${s.repeat}`);
    if (s.types.length) lines.push(`• ${s.types.map((t) => `${t.label} ${t.count}`).join(" · ")}`);
    lines.push("", "التوجيه حسب المشروع:");
    s.perProject
      .filter((p) => p.count)
      .sort((a, b) => b.count - a.count)
      .forEach((p) => lines.push(`• ${p.name}: ${p.count} (آخر دور ${lastNumber(db, center, p.code, date)})`));
  }
  lines.push("", `آخر تحديث: ${formatTime(new Date().toISOString())}`);
  return lines.join("\n");
}

/* ===== إحصائيات الأدمن ===== */

export interface ProjectCounts {
  /** كل المحوّل للمشروع = من الاستقبال + من النقاط (أساس نسبة الخدمة) */
  referred: number;
  /** حوّلها موظف الاستقبال */
  fromReception: number;
  /** من النقاط = تحويل مسجّل من نقطة (طبيب أو تحويل لمشروع آخر) + خدمة بدون تحويل للمشروع */
  fromPoints: number;
  /** منها: تحويل مسجّل من نقطة مشروع آخر */
  pointReferrals: number;
  /** منها: خدمتها النقطة بدون أي تحويل لهذا المشروع اليوم */
  direct: number;
  served: number;
  /** ما زال بانتظار الخدمة */
  waiting: number;
  /** حضرت ولم تُخدم (رُحّلت يدوياً أو تلقائياً بعد 4:00) */
  left: number;
  /** آخر رقم دور (مجموع المراكز عند "الكل") */
  lastQueue: number;
}

export interface ProjectRow extends ProjectCounts {
  code: string;
  name: string;
  byCenter: Record<CenterCode, ProjectCounts>;
}

export interface DayStats {
  date: string;
  reception: number;
  receptionNew: number;
  point: number;
  pointCases: number;
  staff: number;
  projects: ProjectRow[];
}

export function dayStats(db: Db, date: string, center: CenterFilter): DayStats {
  const list = filterCenter(db.entries.filter((e) => e.date === date), center);
  const rec = list.filter((e) => e.kind === "RECEPTION");
  const pt = list.filter((e) => e.kind === "POINT");
  const pointUsers = new Set(db.users.filter((u) => u.role === "POINT").map((u) => u.id));
  const zero = (): ProjectCounts => ({ referred: 0, fromReception: 0, fromPoints: 0, pointReferrals: 0, direct: 0, served: 0, waiting: 0, left: 0, lastQueue: 0 });
  const projects = allProjects(db).map((p) => {
    const centers: CenterCode[] = center === "ALL" ? ["GAZA", "KHY"] : [center];
    const byCenter = { GAZA: zero(), KHY: zero() } as ProjectRow["byCenter"];
    centers.forEach((c) => {
      const b = byCenter[c];
      // أدوار المشروع اليوم: كل حالة حُوّلت له (من الاستقبال أو من نقطة)
      const items = projectQueue(db, c, p.code, date).filter((x) => x.status !== "moved");
      const matched = new Set<string>();
      items.forEach((x) => {
        const byPoint = Boolean(x.reception.referrals?.[p.code]) || pointUsers.has(x.reception.userId);
        if (byPoint) b.pointReferrals++;
        else b.fromReception++;
        if (x.status === "wait") b.waiting++;
        if (x.status === "left") b.left++;
        if (x.served) matched.add(x.served.id);
      });
      // الخدمات في النقطة: ما لم يُطابق أي تحويل لهذا المشروع = خدمة مباشرة من النقطة
      pt.forEach((e) => {
        if (e.center !== c || !e.projects.includes(p.code)) return;
        b.served++;
        if (!matched.has(e.id)) b.direct++;
      });
      b.fromPoints = b.pointReferrals + b.direct;
      b.referred = b.fromReception + b.fromPoints;
      b.lastQueue = lastNumber(db, c, p.code, date);
    });
    const sum = (k: keyof ProjectCounts) => byCenter.GAZA[k] + byCenter.KHY[k];
    return {
      code: p.code,
      name: p.name,
      referred: sum("referred"),
      fromReception: sum("fromReception"),
      fromPoints: sum("fromPoints"),
      pointReferrals: sum("pointReferrals"),
      direct: sum("direct"),
      served: sum("served"),
      waiting: sum("waiting"),
      left: sum("left"),
      lastQueue: sum("lastQueue"),
      byCenter,
    };
  });
  return {
    date,
    reception: rec.length,
    receptionNew: rec.filter((e) => e.isNew).length,
    point: pt.length,
    pointCases: new Set(pt.map((e) => e.nid)).size,
    staff: new Set(list.map((e) => e.userId)).size,
    projects,
  };
}

export function workedDays(db: Db, center: CenterFilter, month?: string): string[] {
  const set = new Set(filterCenter(db.entries, center).map((e) => e.date));
  return Array.from(set)
    .filter((d) => !month || d.startsWith(month))
    .sort((a, b) => b.localeCompare(a));
}

export function months(db: Db): string[] {
  return Array.from(new Set(db.entries.map((e) => e.date.slice(0, 7)))).sort((a, b) => b.localeCompare(a));
}

export function staffRanking(db: Db, dates: Set<string>, center: CenterFilter) {
  const list = filterCenter(db.entries.filter((e) => dates.has(e.date)), center);
  const m = new Map<string, number>();
  list.forEach((e) => m.set(e.userId, (m.get(e.userId) ?? 0) + 1));
  return Array.from(m.entries())
    .map(([id, count]) => ({ user: db.users.find((u) => u.id === id), count }))
    .filter((x) => x.user)
    .sort((a, b) => b.count - a.count);
}

export function adminShareText(db: Db, s: DayStats, center: CenterFilter): string {
  const lines = [
    "📊 ملخص اليوم — أرض الإنسان",
    `${center === "ALL" ? "كل المراكز" : centerName(db, center)} — ${weekday(s.date)} ${dayFull(s.date)}`,
    "",
    `حالات الاستقبال: ${s.reception} (جديدة: ${s.receptionNew})`,
    `حالات النقاط: ${s.point}`,
    "",
    "حسب المشروع (محوّل: استقبال + نقاط / مخدوم / بانتظار / نسبة الخدمة):",
  ];
  s.projects
    .filter((p) => p.referred || p.served)
    .forEach((p) =>
      lines.push(
        `• ${p.name}: ${p.referred} (${p.fromReception} + ${p.fromPoints}) / ${p.served} / ${p.waiting}${p.left ? ` (+ لم تُخدم ${p.left})` : ""}${p.referred ? ` / ${Math.round((p.served / p.referred) * 100)}%` : ""}`,
      ),
    );
  return lines.join("\n");
}

export function lastActivity(db: Db, userId: string): string | undefined {
  for (let i = db.entries.length - 1; i >= 0; i--) if (db.entries[i].userId === userId) return db.entries[i].at;
  return undefined;
}

/** نص ملاحظة التوجيه: تصحيح من مشروع، أو تحويل أنشأه موظف نقطة */
export function correctionText(db: Db, c: NonNullable<Entry["corrected"]>, withBy = false): string {
  if (!c.from.length) return `حوّلها موظف النقطة ${userName(db, c.by)}`;
  return `عُدّل التوجيه من ${c.from.map((p) => projectName(db, p)).join("، ")}${withBy ? ` بواسطة ${userName(db, c.by)}` : ""}`;
}

/** توزيع الإدخالات على ساعات اليوم (بتوقيت غزة) */
export function hourly(list: Entry[]): { reception: number[]; point: number[] } {
  const reception = Array<number>(24).fill(0);
  const point = Array<number>(24).fill(0);
  list.forEach((e) => (e.kind === "RECEPTION" ? reception : point)[hourOf(e.at)]++);
  return { reception, point };
}
