import type { Role } from "./types";

/** موظف ميداني يعمل من شاشة الإدخال ومربوط بمركز */
export const isStaff = (r: Role) => r === "RECEPTION" || r === "POINT";

/** حسابات لوحة التحكم */
export const isBackOffice = (r: Role) => r === "ADMIN" || r === "SUPERVISOR";

export const homePath = (r: Role) => (r === "ADMIN" ? "/admin" : r === "SUPERVISOR" ? "/admin/days" : "/entry");

/** الصفحات المسموحة للمشرف: سجل الأيام وتفاصيله، المشاريع والمراكز، المستخدمون */
export const supervisorAllowed = (path: string) =>
  path.startsWith("/admin/day") || path.startsWith("/admin/projects") || path.startsWith("/admin/users");

/** هل يستطيع هذا الحساب إدارة ذلك المستخدم؟ المشرف يدير الاستقبال والنقاط فقط */
export const canManageUser = (me: Role | undefined, target: Role) => me === "ADMIN" || (me === "SUPERVISOR" && isStaff(target));
