"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Appointment, Beneficiary, Center, CenterCode, ChangeLog, Entry, IdType, Project, Referral, Role, Settings, User } from "./types";

/* قراءة البيانات من Supabase وتحويلها لنفس شكل الواجهة */

const PAGE = 1000;

/** جلب كل الصفوف على دفعات (الحد الافتراضي 1000 صف للطلب) */
async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/* ===== المراجع ===== */

interface CenterRow { code: CenterCode; name: string; short: string; active: boolean; sort_order: number }
export async function loadCenters(sb: SupabaseClient): Promise<Center[]> {
  const { data, error } = await sb.from("centers").select("code, name, short, active, sort_order").order("sort_order");
  if (error) throw new Error(error.message);
  return ((data ?? []) as CenterRow[]).map((c) => ({ code: c.code, name: c.name, short: c.short }));
}

interface ProjectRow {
  code: string; name: string; active: boolean; sort_order: number; color: string | null;
  is_doctor: boolean | null; defer_centers: CenterCode[] | null; defer_days: number | null;
  project_centers: { center_code: CenterCode }[];
}
export async function loadProjects(sb: SupabaseClient): Promise<Project[]> {
  const { data, error } = await sb.from("projects").select("code, name, active, sort_order, color, is_doctor, defer_centers, defer_days, project_centers(center_code)").order("sort_order");
  if (error) throw new Error(error.message);
  return ((data ?? []) as ProjectRow[]).map((p) => ({
    code: p.code,
    name: p.name,
    active: p.active,
    order: p.sort_order,
    color: p.color ?? undefined,
    centers: p.project_centers.map((x) => x.center_code),
    isDoctor: Boolean(p.is_doctor),
    deferCenters: p.defer_centers ?? [],
    deferDays: p.defer_days ?? 14,
  }));
}

interface ProfileRow {
  id: string; username: string; full_name: string; role: Role; active: boolean; permissions: string[] | null; created_at: string;
  user_centers: { center_code: CenterCode }[]; user_projects: { project_code: string }[];
}
export async function loadUsers(sb: SupabaseClient): Promise<User[]> {
  const rows = await all<ProfileRow>((a, b) =>
    sb.from("profiles").select("id, username, full_name, role, active, permissions, created_at, user_centers(center_code), user_projects(project_code)").order("created_at").range(a, b),
  );
  return rows.map(toUser);
}
export function toUser(p: ProfileRow): User {
  return {
    id: p.id,
    username: p.username,
    password: "",
    fullName: p.full_name,
    role: p.role,
    centers: p.user_centers.map((x) => x.center_code),
    projects: p.user_projects.map((x) => x.project_code),
    permissions: p.permissions ?? [],
    active: p.active,
    createdAt: p.created_at,
  };
}
export async function loadProfile(sb: SupabaseClient, id: string): Promise<User | null> {
  const { data } = await sb
    .from("profiles")
    .select("id, username, full_name, role, active, permissions, created_at, user_centers(center_code), user_projects(project_code)")
    .eq("id", id)
    .maybeSingle();
  return data ? toUser(data as ProfileRow) : null;
}

export async function loadSettings(sb: SupabaseClient): Promise<Settings> {
  const { data } = await sb.from("settings").select("hint_reception, hint_point, idle_minutes").eq("id", 1).maybeSingle();
  return { hintReception: data?.hint_reception ?? "", hintPoint: data?.hint_point ?? "", idleMinutes: data?.idle_minutes ?? 30 };
}

export async function loadChanges(sb: SupabaseClient): Promise<ChangeLog[]> {
  const { data } = await sb.from("change_log").select("id, at, user_id, action, detail").order("at", { ascending: false }).limit(500);
  return (data ?? []).map((c) => ({ id: String(c.id), at: c.at, userId: c.user_id ?? "", action: c.action, detail: c.detail }));
}

export async function loadCounters(sb: SupabaseClient, fromDay: string): Promise<Record<string, number>> {
  const rows = await all<{ day: string; center_code: string; project_code: string; last_no: number }>((a, b) =>
    sb.from("queue_counters").select("day, center_code, project_code, last_no").gte("day", fromDay).range(a, b),
  );
  const out: Record<string, number> = {};
  rows.forEach((r) => (out[`${r.day}|${r.center_code}|${r.project_code}`] = r.last_no));
  return out;
}

/* ===== الإدخالات ===== */

const ENTRY_SELECT =
  "id, nid, center_code, user_id, kind, at, day, is_new, queue_ref, corrected_by, corrected_at, corrected_from, no_donor, no_donor_reason, entry_projects(project_code, queue_no, status, referred_by, referred_from, ref_note), beneficiaries(nid, name, id_type, created_at)";

interface EntryRow {
  id: string; nid: string; center_code: CenterCode; user_id: string; kind: Entry["kind"]; at: string; day: string; is_new: boolean;
  queue_ref: string | null; corrected_by: string | null; corrected_at: string | null; corrected_from: string[] | null;
  no_donor: boolean | null; no_donor_reason: string | null;
  entry_projects: {
    project_code: string; queue_no: number | null; status: "active" | "moved";
    referred_by: string | null; referred_from: string | null; ref_note: string | null;
  }[];
  beneficiaries: { nid: string; name: string; id_type: IdType | null; created_at: string } | null;
}

export interface EntryBatch {
  entries: Entry[];
  beneficiaries: Record<string, Beneficiary>;
}

function toBatch(rows: EntryRow[], order: Map<string, number>): EntryBatch {
  const beneficiaries: Record<string, Beneficiary> = {};
  const entries = rows.map((r): Entry => {
    if (r.beneficiaries) {
      beneficiaries[r.nid] = { nid: r.nid, name: r.beneficiaries.name, type: r.beneficiaries.id_type ?? undefined, createdAt: r.beneficiaries.created_at };
    }
    const active = r.entry_projects.filter((p) => p.status === "active").sort((a, b) => (order.get(a.project_code) ?? 99) - (order.get(b.project_code) ?? 99));
    const moved = r.entry_projects.filter((p) => p.status === "moved");
    const queue: Record<string, number> = {};
    active.forEach((p) => p.queue_no && (queue[p.project_code] = p.queue_no));
    const queueOut: Record<string, number> = {};
    moved.forEach((p) => p.queue_no && (queueOut[p.project_code] = p.queue_no));
    const referrals: Record<string, Referral> = {};
    active.forEach((p) => {
      if (p.referred_by) referrals[p.project_code] = { by: p.referred_by, from: p.referred_from ?? undefined, note: p.ref_note ?? undefined };
    });
    return {
      id: r.id,
      nid: r.nid,
      center: r.center_code,
      userId: r.user_id,
      kind: r.kind,
      at: r.at,
      date: r.day,
      projects: active.map((p) => p.project_code),
      isNew: r.is_new,
      ...(r.corrected_by ? { corrected: { by: r.corrected_by, at: r.corrected_at ?? r.at, from: r.corrected_from ?? [] } } : {}),
      ...(Object.keys(queue).length ? { queue } : {}),
      ...(Object.keys(queueOut).length ? { queueOut } : {}),
      ...(r.queue_ref ? { queueRef: r.queue_ref } : {}),
      ...(r.no_donor ? { noDonor: { reason: r.no_donor_reason ?? undefined } } : {}),
      ...(Object.keys(referrals).length ? { referrals } : {}),
    };
  });
  return { entries, beneficiaries };
}

export interface EntryScope {
  fromDay?: string;
  day?: string;
  center?: CenterCode;
  userId?: string;
  nid?: string;
}

export async function loadEntries(sb: SupabaseClient, scope: EntryScope, projectOrder: Map<string, number>): Promise<EntryBatch> {
  const rows = await all<EntryRow>((a, b) => {
    let q = sb.from("entries").select(ENTRY_SELECT);
    if (scope.fromDay) q = q.gte("day", scope.fromDay);
    if (scope.day) q = q.eq("day", scope.day);
    if (scope.center) q = q.eq("center_code", scope.center);
    if (scope.userId) q = q.eq("user_id", scope.userId);
    if (scope.nid) q = q.eq("nid", scope.nid);
    return q.order("at").order("id").range(a, b);
  });
  return toBatch(rows, projectOrder);
}

/* ===== المواعيد ===== */

interface AppointmentRow {
  id: string; nid: string; center_code: CenterCode; project_code: string; due_day: string; attempt: number;
  created_entry: string; done_entry: string | null; created_by: string | null; created_at: string;
}
const APPT_SELECT = "id, nid, center_code, project_code, due_day, attempt, created_entry, done_entry, created_by, created_at";
const toAppointment = (a: AppointmentRow): Appointment => ({
  id: a.id,
  nid: a.nid,
  center: a.center_code,
  project: a.project_code,
  due: a.due_day,
  attempt: a.attempt,
  createdEntry: a.created_entry,
  doneEntry: a.done_entry ?? undefined,
  createdBy: a.created_by ?? undefined,
  createdAt: a.created_at,
});

/** المواعيد القادمة والمفتوحة، والمنتهية خلال الفترة */
export async function loadAppointments(sb: SupabaseClient, fromDay: string, nid?: string): Promise<Appointment[]> {
  const rows = await all<AppointmentRow>((a, b) => {
    let q = sb.from("appointments").select(APPT_SELECT);
    q = nid ? q.eq("nid", nid) : q.or(`due_day.gte.${fromDay},done_entry.is.null`);
    return q.order("due_day").order("id").range(a, b);
  });
  return rows.map(toAppointment);
}

export async function loadBeneficiary(sb: SupabaseClient, nid: string): Promise<Beneficiary | null> {
  const { data } = await sb.from("beneficiaries").select("nid, name, id_type, created_at").eq("nid", nid).maybeSingle();
  return data ? { nid: data.nid, name: data.name, type: data.id_type ?? undefined, createdAt: data.created_at } : null;
}

/** رسالة خطأ مفهومة من Supabase */
export function errorText(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "تعذّر الاتصال بالخادم. تأكد من الإنترنت وأعد المحاولة";
  if (/JWT|session|not authenticated/i.test(m)) return "انتهت الجلسة، سجّل الدخول من جديد";
  return m;
}
