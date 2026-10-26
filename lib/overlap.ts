import type { CenterCode, Db, Entry } from "./types";
import type { CenterFilter } from "./queries";

/* تقرير التكرار: هوية واحدة خدمها أكثر من مشروع.
   المصدر: إدخالات نقاط المشاريع (الخدمة الفعلية)، وليس تحويلات الاستقبال. */

export type OverlapScope = "period" | "day";

export interface OverlapProject {
  code: string;
  count: number;
  first: string;
  last: string;
}

export interface OverlapRow {
  nid: string;
  projects: OverlapProject[];
  services: Entry[];
  centers: CenterCode[];
  /** أيام اجتمع فيها أكثر من مشروع على نفس الهوية */
  sameDays: string[];
  last: string;
}

export interface OverlapReport {
  rows: OverlapRow[];
  servedIds: number;
  servedServices: number;
  dupServices: number;
  /** عدد الهويات المشتركة لكل زوج مشاريع: "A|B" ← عدد */
  pairs: Map<string, number>;
  /** لكل مشروع: هويات خدمها، ومنها كم خدمها مشروع آخر أيضاً */
  perProject: Map<string, { served: number; shared: number }>;
  /** توزيع عدد المشاريع لكل هوية مكررة: 2 ← عدد، 3 ← عدد … */
  spread: Map<number, number>;
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function overlapReport(db: Db, from: string, to: string, center: CenterFilter, scope: OverlapScope): OverlapReport {
  const list = db.entries.filter((e) => e.kind === "POINT" && e.date >= from && e.date <= to && (center === "ALL" || e.center === center));

  const byNid = new Map<string, Entry[]>();
  list.forEach((e) => {
    const arr = byNid.get(e.nid);
    if (arr) arr.push(e);
    else byNid.set(e.nid, [e]);
  });

  const perProject = new Map<string, { served: number; shared: number }>();
  const pairs = new Map<string, number>();
  const spread = new Map<number, number>();
  const rows: OverlapRow[] = [];
  let dupServices = 0;

  byNid.forEach((entries, nid) => {
    const all = new Set(entries.flatMap((e) => e.projects));
    all.forEach((p) => {
      const s = perProject.get(p) ?? { served: 0, shared: 0 };
      s.served++;
      perProject.set(p, s);
    });

    // أيام اجتمع فيها أكثر من مشروع
    const byDay = new Map<string, Set<string>>();
    entries.forEach((e) => {
      const set = byDay.get(e.date) ?? new Set<string>();
      e.projects.forEach((p) => set.add(p));
      byDay.set(e.date, set);
    });
    const sameDays = [...byDay.entries()]
      .filter(([, s]) => s.size > 1)
      .map(([d]) => d)
      .sort();

    // المشاريع المحسوبة حسب النطاق
    const counted = scope === "period" ? all : new Set(sameDays.flatMap((d) => [...byDay.get(d)!]));
    if (counted.size < 2) return;

    const relevant = scope === "period" ? entries : entries.filter((e) => sameDays.includes(e.date));
    const projects: OverlapProject[] = [...counted]
      .map((code) => {
        const es = relevant.filter((e) => e.projects.includes(code)).sort((a, b) => a.at.localeCompare(b.at));
        return { code, count: es.length, first: es[0].at, last: es[es.length - 1].at };
      })
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

    const codes = projects.map((p) => p.code);
    for (let i = 0; i < codes.length; i++) {
      perProject.get(codes[i])!.shared++;
      for (let j = i + 1; j < codes.length; j++) {
        const k = pairKey(codes[i], codes[j]);
        pairs.set(k, (pairs.get(k) ?? 0) + 1);
      }
    }
    spread.set(codes.length, (spread.get(codes.length) ?? 0) + 1);
    dupServices += relevant.length;

    const services = relevant.slice().sort((a, b) => b.at.localeCompare(a.at));
    rows.push({
      nid,
      projects,
      services,
      centers: [...new Set(relevant.map((e) => e.center))],
      sameDays,
      last: services[0].at,
    });
  });

  return {
    rows,
    servedIds: byNid.size,
    servedServices: list.length,
    dupServices,
    pairs,
    perProject,
    spread,
  };
}
