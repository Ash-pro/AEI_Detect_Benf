import type { Role } from "./types";

/* صلاحيات المشرف — نفس الرموز في قاعدة البيانات (profiles.permissions و public.has_perm) */

export type Perm = "home" | "days" | "export" | "reports" | "overlap" | "beneficiaries" | "edit_entries" | "users" | "projects";

export interface PermInfo {
  key: Perm;
  label: string;
  desc: string;
  group: "view" | "analysis" | "manage";
  /** صلاحية حساسة تعدّل البيانات */
  sensitive?: boolean;
  /** تحتاج صلاحية أخرى لتعمل */
  needs?: Perm;
}

export const PERMS: PermInfo[] = [
  { key: "home", label: "لوحة اليوم", desc: "الرئيسية: مؤشرات اليوم وجدول المشاريع وآخر الإدخالات", group: "view" },
  { key: "days", label: "سجل الأيام", desc: "كل الأيام وتفاصيل إدخالات كل يوم", group: "view" },
  { key: "beneficiaries", label: "المستفيدون", desc: "البحث عن أي هوية وعرض كل إدخالاتها", group: "view" },
  { key: "reports", label: "التقارير", desc: "التقارير الشهرية وأوقات الذروة وأداء الموظفين", group: "analysis" },
  { key: "overlap", label: "تقرير التكرار", desc: "الهويات التي خدمها أكثر من مشروع", group: "analysis" },
  { key: "export", label: "التصدير إلى Excel", desc: "تصدير الأيام والتقارير", group: "analysis" },
  { key: "edit_entries", label: "تعديل وحذف الإدخالات", desc: "تعديل مشاريع أي إدخال أو حذفه، وتعديل بيانات المستفيدين", group: "manage", sensitive: true },
  { key: "users", label: "إدارة المستخدمين", desc: "إنشاء وتعديل حسابات الاستقبال ونقاط المشاريع فقط", group: "manage", sensitive: true },
  { key: "projects", label: "المشاريع والمراكز", desc: "إضافة المشاريع وتفعيلها وترتيبها وتعديل أسماء المراكز", group: "manage", sensitive: true },
];

export const PERM_GROUPS: { id: PermInfo["group"]; label: string }[] = [
  { id: "view", label: "المتابعة" },
  { id: "analysis", label: "التحليل والتقارير" },
  { id: "manage", label: "الإدارة" },
];

/** الافتراضي لأي مشرف جديد */
export const DEFAULT_SUPERVISOR_PERMS: Perm[] = ["days", "export", "reports", "overlap", "beneficiaries", "users", "projects"];

export const PERM_PRESETS: { id: string; label: string; desc: string; perms: Perm[] }[] = [
  { id: "view", label: "متابعة فقط", desc: "عرض بدون أي تعديل", perms: ["home", "days", "beneficiaries", "reports", "overlap"] },
  { id: "default", label: "مشرف عادي", desc: "الإعداد الافتراضي", perms: DEFAULT_SUPERVISOR_PERMS },
  { id: "all", label: "كل الصلاحيات", desc: "كل ما سبق مع التعديل والحذف", perms: PERMS.map((p) => p.key) },
];

/** هل يملك الحساب الصلاحية؟ الأدمن دائماً نعم */
export function can(user: { role: Role; permissions?: string[] } | null | undefined, perm: Perm): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return user.role === "SUPERVISOR" && Boolean(user.permissions?.includes(perm));
}

/** الصفحة ← الصلاحية المطلوبة (null = للأدمن فقط) */
export function pathPerm(path: string): Perm | null {
  if (path === "/admin") return "home";
  if (path.startsWith("/admin/days") || path.startsWith("/admin/day")) return "days";
  if (path.startsWith("/admin/beneficiaries")) return "beneficiaries";
  if (path.startsWith("/admin/reports")) return "reports";
  if (path.startsWith("/admin/overlap")) return "overlap";
  if (path.startsWith("/admin/users")) return "users";
  if (path.startsWith("/admin/projects")) return "projects";
  return null;
}

export function pathAllowed(user: { role: Role; permissions?: string[] } | null | undefined, path: string): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const p = pathPerm(path);
  return p !== null && can(user, p);
}

const ORDER: { perm: Perm; path: string }[] = [
  { perm: "home", path: "/admin" },
  { perm: "days", path: "/admin/days" },
  { perm: "beneficiaries", path: "/admin/beneficiaries" },
  { perm: "reports", path: "/admin/reports" },
  { perm: "overlap", path: "/admin/overlap" },
  { perm: "users", path: "/admin/users" },
  { perm: "projects", path: "/admin/projects" },
];

/** أول صفحة مسموحة للمشرف (أو null إذا لا يملك أي صلاحية) */
export function firstAllowedPath(user: { role: Role; permissions?: string[] } | null | undefined): string | null {
  if (!user) return null;
  if (user.role === "ADMIN") return "/admin";
  return ORDER.find((o) => can(user, o.perm))?.path ?? null;
}
