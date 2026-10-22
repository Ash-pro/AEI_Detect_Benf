import type { CenterCode, Db, Entry, IdType } from "./types";
import { todayKey } from "./utils";

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

export type QueueStatus = "wait" | "served" | "moved";

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
  for (const rec of db.entries) {
    if (rec.kind !== "RECEPTION" || rec.date !== date || rec.center !== center) continue;
    const n = rec.queue?.[project];
    if (n) {
      const served = servedFor(db, rec, project);
      const movedFrom = rec.corrected && !rec.corrected.from.includes(project) ? rec.corrected.from : undefined;
      items.push({ reception: rec, project, number: n, status: served ? "served" : "wait", served, movedFrom });
      continue;
    }
    const out = rec.queueOut?.[project];
    if (out) items.push({ reception: rec, project, number: out, status: "moved", movedTo: rec.projects });
  }
  return items.sort((a, b) => a.number - b.number);
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
