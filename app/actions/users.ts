"use server";

import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { canManageUser, isStaff } from "@/lib/roles";
import { PERMS, DEFAULT_SUPERVISOR_PERMS } from "@/lib/permissions";
import type { CenterCode, Role } from "@/lib/types";

/* إدارة الحسابات على الخادم: تحتاج المفتاح السري لإنشاء حسابات Supabase Auth */

export interface UserInput {
  id?: string;
  username: string;
  fullName: string;
  role: Role;
  centers: CenterCode[];
  projects: string[];
  /** صلاحيات المشرف — يحددها الأدمن فقط */
  permissions?: string[];
  active: boolean;
  /** للإنشاء، أو لإعادة التعيين عند التعديل */
  password?: string;
}

type Result = { ok: true; id: string } | { ok: false; error: string };

const toEmail = (username: string) => `${username}@aei.local`;
const ROLES: Role[] = ["RECEPTION", "POINT", "SUPERVISOR", "ADMIN"];

/** المستخدم الذي يستدعي الدالة، من جلسته — مع دوره من قاعدة البيانات */
async function caller() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await supabaseAdmin().from("profiles").select("id, role, active, permissions").eq("id", data.user.id).single();
  if (!p || !p.active) return null;
  return { id: p.id as string, role: p.role as Role, permissions: (p.permissions ?? []) as string[] };
}

async function log(userId: string, action: string, detail: string) {
  await supabaseAdmin().from("change_log").insert({ user_id: userId, action, detail });
}

export async function saveUserAction(input: UserInput): Promise<Result> {
  const me = await caller();
  if (!me || (me.role !== "ADMIN" && !(me.role === "SUPERVISOR" && me.permissions.includes("users")))) return { ok: false, error: "غير مسموح" };

  const username = input.username.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return { ok: false, error: "اسم المستخدم: 3 أحرف على الأقل من حروف إنجليزية صغيرة وأرقام و . _ -" };
  if (!fullName) return { ok: false, error: "اكتب اسم الموظف" };
  if (!ROLES.includes(input.role)) return { ok: false, error: "نوع الحساب غير صحيح" };
  if (input.password && input.password.length < 6) return { ok: false, error: "كلمة المرور 6 أحرف على الأقل" };
  if (!canManageUser(me.role, input.role)) return { ok: false, error: "لا تملك صلاحية إدارة هذا النوع من الحسابات" };

  const centers = isStaff(input.role) ? input.centers : (["GAZA", "KHY"] as CenterCode[]);
  const projects = input.role === "POINT" ? input.projects : [];
  if (isStaff(input.role) && !centers.length) return { ok: false, error: "اختر مركزاً واحداً على الأقل" };
  if (input.role === "POINT" && !projects.length) return { ok: false, error: "اختر مشروعاً واحداً على الأقل" };

  // الصلاحيات للمشرف فقط، والأدمن وحده يحددها
  const valid = new Set<string>(PERMS.map((x) => x.key));
  const wanted = input.role === "SUPERVISOR" ? (input.permissions ?? DEFAULT_SUPERVISOR_PERMS).filter((x) => valid.has(x)) : [];

  const admin = supabaseAdmin();
  const { data: taken } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
  if (taken && taken.id !== input.id) return { ok: false, error: "اسم المستخدم مستخدم لحساب آخر" };

  let id = input.id;
  const existing = id ? (await admin.from("profiles").select("id, role, active, username, permissions").eq("id", id).maybeSingle()).data : null;
  // غير الأدمن لا يغيّر الصلاحيات: تبقى كما هي
  const permissions = me.role === "ADMIN" ? wanted : ((existing?.permissions as string[] | undefined) ?? []);
  const permsChanged = Boolean(existing) && JSON.stringify([...(existing?.permissions ?? [])].sort()) !== JSON.stringify([...permissions].sort());

  if (existing) {
    if (!canManageUser(me.role, existing.role as Role)) return { ok: false, error: "لا تملك صلاحية تعديل هذا الحساب" };
    if (existing.id === me.id && (input.role !== existing.role || !input.active)) return { ok: false, error: "لا يمكنك تغيير نوع حسابك أو إيقافه" };
    if (existing.role === "ADMIN" && (input.role !== "ADMIN" || !input.active)) {
      const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "ADMIN").eq("active", true);
      if ((count ?? 0) <= 1) return { ok: false, error: "لا يمكن إيقاف أو تغيير آخر حساب أدمن" };
    }
    const authPatch: { email?: string; password?: string } = {};
    if (existing.username !== username) authPatch.email = toEmail(username);
    if (input.password) authPatch.password = input.password;
    if (Object.keys(authPatch).length) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, { ...authPatch, email_confirm: true });
      if (error) return { ok: false, error: "تعذّر تحديث بيانات الدخول: " + error.message };
    }
    const { error } = await admin
      .from("profiles")
      .update({ username, full_name: fullName, role: input.role, active: input.active, permissions })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    if (!input.password) return { ok: false, error: "كلمة المرور مطلوبة" };
    const { data, error } = await admin.auth.admin.createUser({ email: toEmail(username), password: input.password, email_confirm: true });
    if (error || !data.user) return { ok: false, error: "تعذّر إنشاء الحساب: " + (error?.message ?? "") };
    id = data.user.id;
    const { error: pErr } = await admin.from("profiles").insert({ id, username, full_name: fullName, role: input.role, active: input.active, permissions });
    if (pErr) {
      await admin.auth.admin.deleteUser(id);
      return { ok: false, error: pErr.message };
    }
  }

  // المراكز والمشاريع
  await admin.from("user_centers").delete().eq("user_id", id!);
  await admin.from("user_projects").delete().eq("user_id", id!);
  if (centers.length) await admin.from("user_centers").insert(centers.map((c) => ({ user_id: id, center_code: c })));
  if (projects.length) await admin.from("user_projects").insert(projects.map((p) => ({ user_id: id, project_code: p })));

  const what = !existing ? "إنشاء مستخدم" : input.password ? "تعديل مستخدم وكلمة المرور" : permsChanged ? "تعديل صلاحيات مشرف" : "تعديل مستخدم";
  await log(me.id, what, `${fullName} (${username})`);
  return { ok: true, id: id! };
}

export async function deleteUserAction(id: string): Promise<Result> {
  const me = await caller();
  if (!me || (me.role !== "ADMIN" && !(me.role === "SUPERVISOR" && me.permissions.includes("users")))) return { ok: false, error: "غير مسموح" };
  if (id === me.id) return { ok: false, error: "لا يمكنك حذف حسابك" };
  const admin = supabaseAdmin();
  const { data: target } = await admin.from("profiles").select("id, role, full_name, username").eq("id", id).maybeSingle();
  if (!target) return { ok: false, error: "الحساب غير موجود" };
  if (!canManageUser(me.role, target.role as Role)) return { ok: false, error: "لا تملك صلاحية حذف هذا الحساب" };
  const { count } = await admin.from("entries").select("id", { count: "exact", head: true }).eq("user_id", id);
  if ((count ?? 0) > 0) return { ok: false, error: "لهذا الحساب إدخالات مسجلة. أوقف الحساب بدلاً من حذفه حتى تبقى السجلات" };
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { ok: false, error: error.message };
  await log(me.id, "حذف مستخدم", `${target.full_name} (${target.username})`);
  return { ok: true, id };
}
