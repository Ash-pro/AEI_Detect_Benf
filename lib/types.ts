export type CenterCode = "GAZA" | "KHY";
export type Role = "RECEPTION" | "POINT" | "SUPERVISOR" | "ADMIN";
export type EntryKind = "RECEPTION" | "POINT";

export interface Center {
  code: CenterCode;
  name: string;
  short: string;
}

export interface Project {
  code: string;
  name: string;
  active: boolean;
  order: number;
  centers: CenterCode[];
  /** لون الدور المميز للمشروع */
  color?: string;
}

export interface User {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: Role;
  centers: CenterCode[];
  projects: string[];
  /** صلاحيات المشرف (فارغة لباقي الأنواع؛ الأدمن يملك الكل) */
  permissions: string[];
  active: boolean;
  createdAt: string;
}

/** نوع الهوية المدخلة */
export type IdType = "FATHER" | "MOTHER" | "CHILD";

export interface Beneficiary {
  nid: string;
  name: string;
  type?: IdType;
  createdAt: string;
}

export interface Entry {
  id: string;
  nid: string;
  center: CenterCode;
  userId: string;
  kind: EntryKind;
  at: string; // ISO
  date: string; // YYYY-MM-DD بتوقيت غزة
  projects: string[];
  isNew: boolean;
  /** تصحيح توجيه الاستقبال من نقطة مشروع */
  corrected?: { by: string; at: string; from: string[] };
  /** أرقام الدور لإدخال الاستقبال: مشروع ← رقم */
  queue?: Record<string, number>;
  /** أرقام دور أُلغيت بعد تحويل الحالة لمشروع آخر: مشروع ← رقم */
  queueOut?: Record<string, number>;
  /** إدخال النقطة: إدخال الاستقبال الذي خُدم دوره (قد تكون هوية الطفل مختلفة عن ولي الأمر) */
  queueRef?: string;
}

export interface ChangeLog {
  id: string;
  at: string;
  userId: string;
  action: string;
  detail: string;
}

export interface Settings {
  hintReception: string;
  hintPoint: string;
  idleMinutes: number;
}

export interface Db {
  version: number;
  /** يوم توليد البيانات التجريبية */
  seededOn: string;
  centers: Center[];
  projects: Project[];
  users: User[];
  beneficiaries: Record<string, Beneficiary>;
  entries: Entry[];
  /** آخر رقم دور: "اليوم|المركز|المشروع" ← رقم */
  counters: Record<string, number>;
  changes: ChangeLog[];
  settings: Settings;
}

export type SessionUser = Omit<User, "password">;
