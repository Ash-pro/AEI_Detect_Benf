import type { Role } from "./types";
import { can, firstAllowedPath } from "./permissions";

/** موظف ميداني يعمل من شاشة الإدخال ومربوط بمركز */
export const isStaff = (r: Role) => r === "RECEPTION" || r === "POINT";

/** حسابات لوحة التحكم */
export const isBackOffice = (r: Role) => r === "ADMIN" || r === "SUPERVISOR";

/** الصفحة الأولى بعد الدخول. المشرف: أول صفحة تسمح بها صلاحياته */
export const homePath = (r: Role, permissions?: string[]) =>
  r === "ADMIN" ? "/admin" : r === "SUPERVISOR" ? (firstAllowedPath({ role: r, permissions }) ?? "/admin/days") : "/entry";

/** هل يستطيع هذا الحساب إدارة ذلك المستخدم؟ المشرف يدير الاستقبال والنقاط فقط */
export const canManageUser = (me: Role | undefined, target: Role, myPerms?: string[]) =>
  me === "ADMIN" || (me === "SUPERVISOR" && isStaff(target) && (myPerms === undefined || can({ role: me, permissions: myPerms }, "users")));
