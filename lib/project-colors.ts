import type { Db, Project } from "./types";

/* لون مميز ثابت لكل مشروع — يُحفظ مع المشروع، ويقرأ عليه النص الأبيض بوضوح */
export const PALETTE = [
  "#2563eb", // أزرق
  "#c2410c", // برتقالي
  "#7c3aed", // بنفسجي
  "#0e7490", // سماوي غامق
  "#be185d", // وردي
  "#15803d", // أخضر
  "#a16207", // ذهبي
  "#4f46e5", // نيلي
  "#b91c1c", // أحمر
  "#334155", // رمادي
];

export function projectColor(db: Db, code: string): string {
  const i = db.projects.findIndex((p) => p.code === code);
  return db.projects[i]?.color ?? PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
}

/** أول لون غير مستخدم لمشروع جديد */
export function nextColor(projects: Project[]): string {
  const used = new Set(projects.map((p) => p.color));
  return PALETTE.find((c) => !used.has(c)) ?? PALETTE[projects.length % PALETTE.length];
}

/** إعطاء لون للمشاريع المحفوظة بدون لون */
export function withColors(projects: Project[]): Project[] {
  const out: Project[] = [];
  for (const p of projects) out.push(p.color ? p : { ...p, color: nextColor([...out, ...projects.filter((x) => x.color)]) });
  return out;
}

/** خلفية فاتحة من لون المشروع */
export function projectSoft(color: string, pct = 12): string {
  return `color-mix(in srgb, ${color} ${pct}%, white)`;
}
