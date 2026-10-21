import type { Role } from "./types";

/** موظف ميداني يعمل من شاشة الإدخال ومربوط بمركز */
export const isStaff = (r: Role) => r === "RECEPTION" || r === "POINT";

/** حسابات لوحة التحكم */
export const isBackOffice = (r: Role) => r === "ADMIN" || r === "SUPERVISOR";

export const homePath = (r: Role) => (r === "ADMIN" ? "/admin" : r === "SUPERVISOR" ? "/admin/days" : "/entry");

/** الصفحات المسموحة للمشرف: سجل الأيام وتفاصيل اليوم فقط */
export const supervisorAllowed = (path: string) => path.startsWith("/admin/days") || path.startsWith("/admin/day");
