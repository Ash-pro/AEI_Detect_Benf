import type { CenterCode, Db, Entry, IdType } from "./types";
import { gazaMinutes, todayKey } from "./utils";

/* رقم الدور اليومي — مستقل لكل مشروع في كل مركز، ويبدأ من 1 كل يوم */

export const ID_TYPES: { value: IdType; label: string }[] = [
  { value: "MOTHER", label: "أم" },
  { value: "FATHER", label: "أب" },
  { value: "CHILD", label: "طفل" },
];

export function idTypeLabel(t?: IdType): string {
  return ID_TYPES.find((x) => x.value === t)?.label ?? "";
}

export function counterKey(date: string, center: CenterCode, project: string): string {
  return `${date}|${center}|${project}`;
}

/**
 * يعطي أرقام دور للمشاريع المضافة ويحتفظ بأرقام المشاريع الباقية.
 * المشروع المحذوف يفقد رقمه ولا يُعاد استخدام الرقم.
 */
export function assignQueue(
  counters: Record<string, number>,
  entry: Pick<Entry, "date" | "center" | "queue">,
  projects: string[],
): { queue: Record<string, number>; counters: Record<string, number>; added: string[] } {
  const next = { ...counters };
  const queue: Record<string, number> = {};
  const added: string[] = [];
  for (const p of projects) {
    const old = entry.queue?.[p];
    if (old) queue[p] = old;
    else {
      const k = counterKey(entry.date, entry.center, p);
      next[k] = (next[k] ?? 0) + 1;
      queue[p] = next[k];
      added.push(p);
    }
  }
  return { queue, counters: next, added };
}

export type QueueStatus = "wait" | "served" | "moved" | "left";

/* ===== حضرت ولم تُخدم =====
   بعد 2:20 ظهراً تستطيع النقطة ترحيل المنتظرين يدوياً،
   وبعد 4:00 عصراً (أو في أي يوم سابق) يُعتبر كل دور لم يُخدم "حضرت ولم تُخدم" تلقائياً. */
export const LEAVE_FROM = 14 * 60 + 20;
export const AUTO_LEFT = 16 * 60;
export const LEAVE_FROM_LABEL = "2:20 م";
export const AUTO_LEFT_LABEL = "4:00 م";

/** هل يمكن الترحيل اليدوي الآن؟ */
export function canMarkLeft(now = new Date()): boolean {
  return gazaMinutes(now) >= LEAVE_FROM;
}

/** هل انتهى وقت الانتظار لهذا اليوم (ترحيل تلقائي)؟ */
export function isAutoLeft(date: string, now = new Date()): boolean {
  const today = todayKey();
  return date < today || (date === today && gazaMinutes(now) >= AUTO_LEFT);
}

export interface QueueItem {
  reception: Entry;
  project: string;
  number: number;
  status: QueueStatus;
  /** إدخال الخدمة إن خُدمت */
  served?: Entry;
  /** المشاريع التي حُوّلت إليها (للحالة المحوّلة) */
  movedTo?: string[];
  /** وصلت لهذا المشروع بعد تصحيح التوجيه من مشروع آخر */
  movedFrom?: string[];
  /** حضرت ولم تُخدم: وقت الترحيل اليدوي ومن رحّلها، أو auto للترحيل التلقائي */
  left?: { at?: string; by?: string; auto: boolean };
}

/** إدخال خدمة النقطة الذي يغطي دور هذا الاستقبال في هذا المشروع */
export function servedFor(db: Db, rec: Entry, project: string): Entry | undefined {
  return db.entries.find(
    (e) =>
      e.kind === "POINT" &&
      e.date === rec.date &&
      e.center === rec.center &&
      e.projects.includes(project) &&
      (e.queueRef === rec.id || (!e.queueRef && e.nid === rec.nid)),
  );
}

/** قائمة انتظار مشروع في مركز ليوم محدد، مرتبة حسب رقم الدور */
export function projectQueue(db: Db, center: CenterCode, project: string, date = todayKey()): QueueItem[] {
  const items: QueueItem[] = [];
  const auto = isAutoLeft(date);
  for (const rec of db.entries) {
    if (rec.kind !== "RECEPTION" || rec.date !== date || rec.center !== center) continue;
    const n = rec.queue?.[project];
    if (n) {
      const served = servedFor(db, rec, project);
      const movedFrom = rec.corrected && rec.corrected.from.length && !rec.corrected.from.includes(project) ? rec.corrected.from : undefined;
      const manual = rec.left?.[project];
      const left = served ? undefined : manual ? { at: manual.at, by: manual.by, auto: false } : auto ? { auto: true } : undefined;
      items.push({ reception: rec, project, number: n, status: served ? "served" : left ? "left" : "wait", served, movedFrom, left });
      continue;
    }
    const out = rec.queueOut?.[project];
    if (out) items.push({ reception: rec, project, number: out, status: "moved", movedTo: rec.projects });
  }
  return items.sort((a, b) => a.number - b.number);
}

/**
 * "حضرت ولم تُخدم" المفتوحة: كل دور لم يُخدم في يومه (اليوم بعد الترحيل أو أيام سابقة)
 * ولم تُخدم فيه الهوية لنفس المشروع بعد ذلك. تُغلق تلقائياً عند خدمتها في أي يوم لاحق.
 * آخر حضور فقط لكل هوية ومشروع.
 */
export function leftOpen(db: Db, center: CenterCode | "ALL", projects: string[]): QueueItem[] {
  const want = new Set(projects);
  // فهارس مرة واحدة (بدل البحث في كل الإدخالات لكل دور)
  const lastServed = new Map<string, string>(); // هوية|مشروع ← آخر يوم خدمة (أي مركز)
  const servedRef = new Set<string>(); // دور الاستقبال|مشروع
  const servedNid = new Set<string>(); // يوم|مركز|مشروع|هوية — خدمة بدون ربط بدور
  for (const e of db.entries) {
    if (e.kind !== "POINT") continue;
    for (const p of e.projects) {
      const k = `${e.nid}|${p}`;
      if ((lastServed.get(k) ?? "") < e.date) lastServed.set(k, e.date);
      if (e.queueRef) servedRef.add(`${e.queueRef}|${p}`);
      else servedNid.add(`${e.date}|${e.center}|${p}|${e.nid}`);
    }
  }
  const best = new Map<string, QueueItem>();
  for (const rec of db.entries) {
    if (rec.kind !== "RECEPTION" || !rec.queue || (center !== "ALL" && rec.center !== center)) continue;
    const auto = isAutoLeft(rec.date);
    for (const p of rec.projects) {
      const n = rec.queue[p];
      if (!n || !want.has(p)) continue;
      const manual = rec.left?.[p];
      if (!manual && !auto) continue;
      if (servedRef.has(`${rec.id}|${p}`) || servedNid.has(`${rec.date}|${rec.center}|${p}|${rec.nid}`)) continue;
      const k = `${rec.nid}|${p}`;
      if ((lastServed.get(k) ?? "") >= rec.date) continue; // خُدمت في نفس اليوم أو بعده
      const prev = best.get(k);
      if (prev && prev.reception.at >= rec.at) continue;
      best.set(k, {
        reception: rec,
        project: p,
        number: n,
        status: "left",
        left: manual ? { at: manual.at, by: manual.by, auto: false } : { auto: true },
      });
    }
  }
  return [...best.values()].sort((a, b) => b.reception.at.localeCompare(a.reception.at));
}

/** عدد المنتظرين في مشاريع الموظف */
export function waitingCount(db: Db, center: CenterCode, projects: string[], date = todayKey()): number {
  return projects.reduce((s, p) => s + projectQueue(db, center, p, date).filter((x) => x.status === "wait").length, 0);
}

/** آخر رقم دور أُعطي اليوم لمشروع في مركز */
export function lastNumber(db: Db, center: CenterCode, project: string, date = todayKey()): number {
  return db.counters[counterKey(date, center, project)] ?? 0;
}

/** نص "دور 12 · 7" لإدخال استقبال */
export function queueText(e: Entry): string {
  if (!e.queue) return "";
  return e.projects
    .map((p) => e.queue?.[p])
    .filter(Boolean)
    .join(" · ");
}

/** رقم الدور الذي خُدم عليه إدخال النقطة، والاستقبال المرتبط به */
export function pointQueue(db: Db, e: Entry): { number?: number; reception?: Entry } {
  const p = e.projects[0];
  const rec = e.queueRef
    ? db.entries.find((x) => x.id === e.queueRef)
    : db.entries.find((x) => x.kind === "RECEPTION" && x.date === e.date && x.center === e.center && x.nid === e.nid && x.queue?.[p]);
  return { number: rec?.queue?.[p], reception: rec };
}
