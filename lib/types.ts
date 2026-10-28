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
  /** مشروع طبيب: أي نقطة تحوّل إليه، ولا يُحسب تكراراً */
  isDoctor?: boolean;
  /** المراكز التي يُسمح فيها بالخدمة بدون تطبيق الممول + موعد */
  deferCenters?: CenterCode[];
  /** مدة الموعد الافتراضية بالأيام */
  deferDays?: number;
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
  /** إدخال النقطة: خُدمت بدون تطبيق الممول (بت) وحُجز لها موعد */
  noDonor?: { reason?: string };
  /** إدخال الاستقبال: مشاريع الطبيب التي حوّلتها نقطة: مشروع ← من حوّل */
  referrals?: Record<string, Referral>;
  /** إدخال الاستقبال: أدوار رحّلتها النقطة يدوياً إلى "حضرت ولم تُخدم": مشروع ← متى ومن */
  left?: Record<string, { at: string; by?: string }>;
}

export interface Referral {
  /** الموظف الذي حوّل */
  by: string;
  /** مشروع النقطة التي حوّلت */
  from?: string;
  note?: string;
}

/** موعد بعد خدمة بدون تطبيق الممول */
export interface Appointment {
  id: string;
  nid: string;
  center: CenterCode;
  project: string;
  /** يوم الموعد YYYY-MM-DD */
  due: string;
  attempt: number;
  /** الخدمة التي حُجز فيها */
  createdEntry: string;
  /** الخدمة التي أغلقته (حضرت وخُدمت) */
  doneEntry?: string;
  createdBy?: string;
  createdAt: string;
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
  /** مواعيد الخدمة بدون تطبيق الممول */
  appointments: Appointment[];
}

export type SessionUser = Omit<User, "password">;
