"use client";

import { tracked } from "./pending";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Appointment, CenterCode, Db, Entry, IdType, Project, SessionUser, Settings, User } from "./types";
import { supabase, usernameToEmail } from "./supabase/client";
import {
  errorText,
  loadBeneficiary,
  loadCenters,
  loadChanges,
  loadCounters,
  loadEntries,
  loadProfile,
  loadProjects,
  loadSettings,
  loadUsers,
  loadAppointments,
  type EntryBatch,
  type EntryScope,
} from "./data";
import { deleteUserAction, saveUserAction } from "@/app/actions/users";
import { addDays, dateKey, storageGet, storageSet, todayKey } from "./utils";
import { isBackOffice, isStaff } from "./roles";

/* المخزن: يقرأ من Supabase ويحتفظ بنسخة في الذاكرة بنفس شكل الواجهة.
   الكتابة كلها عبر دوال قاعدة البيانات (RPC)، والتحديث اللحظي عبر Realtime. */

const CENTER_KEY = "aei.v2.center";
/** أيام البيانات المحمّلة: الإدارة 62 يوماً، والموظف إدخالاته آخر 31 يوماً + كل إدخالات مركزه اليوم */
const BACK_OFFICE_DAYS = 62;
const STAFF_DAYS = 31;

export type AddEntryResult =
  | { ok: true; mode: "created" | "updated"; entry: Entry; isNew: boolean; skipped: string[]; added: string[] }
  | { ok: false; error: string };

export interface ReferInput {
  nid: string;
  projects: string[];
  deleteEntryIds: string[];
  name?: string;
  type?: IdType;
}

export interface AddEntryInput {
  nid: string;
  projects: string[];
  /** للحالة الجديدة: الاسم ونوع الهوية مطلوبان */
  name?: string;
  type?: IdType;
  /** النقطة: إدخال الاستقبال الذي يُخدم دوره */
  queueRef?: string;
}

/** التاريخ قبل نافذة البيانات لتحميل المواعيد */
const APPT_BACK_DAYS = 62;

/** حالة مزامنة بيانات اليوم مع الخادم */
export interface SyncState {
  /** آخر تحديث ناجح (ms) */
  at: number | null;
  /** آخر محاولة تحديث فشلت (تُعاد تلقائياً) */
  failing: boolean;
  /** التحديث اللحظي متصل */
  live: boolean;
  /** يجري التحديث الآن */
  busy: boolean;
}

/** تحديث احتياطي: إذا لم يُحدَّث اليوم منذ هذه المدة والشاشة ظاهرة */
export const POLL_MS = 30_000;

export interface Ctx {
  ready: boolean;
  online: boolean;
  sync: SyncState;
  /** تحديث يدوي فوري لبيانات اليوم */
  syncNow: () => Promise<void>;
  db: Db;
  center: CenterCode | null;
  user: SessionUser | null;
  setCenter: (c: CenterCode | null) => void;
  login: (username: string, password: string) => Promise<{ user?: SessionUser; error?: string }>;
  logout: () => Promise<void>;
  /** تحميل هوية وسجلها كاملاً من الخادم */
  lookup: (nid: string) => Promise<void>;
  refresh: () => Promise<void>;

  addEntry: (input: AddEntryInput) => Promise<AddEntryResult>;
  updateBeneficiary: (nid: string, data: { name: string; type?: IdType }) => Promise<string | null>;
  updateEntryProjects: (entryId: string, projects: string[]) => Promise<string | null>;
  deleteEntry: (entryId: string) => Promise<string | null>;
  correctRouting: (receptionEntryId: string, projects: string[], deleteEntryIds: string[]) => Promise<string | null>;
  /** النقطة: تصحيح التوجيه، أو إنشاء تحويل جديد باسم موظف النقطة إن لم تمر الحالة على الاستقبال */
  referFromPoint: (input: ReferInput) => Promise<{ error?: string; queue?: Record<string, number>; created?: boolean }>;
  moveEntry: (entryId: string, newNid: string) => Promise<string | null>;
  /** النقطة: تحويل الحالة لمشروع طبيب (إضافي، لا يلغي تحويلها الحالي) */
  referToDoctor: (input: DoctorReferInput) => Promise<{ error?: string; queueNo?: number; entryId?: string }>;
  cancelDoctorReferral: (entryId: string, project: string) => Promise<string | null>;
  /** ترحيل المنتظرين اليوم في مشاريع الموظف إلى "حضرت ولم تُخدم" (بعد 2:20 ظهراً) */
  markLeft: (projects: string[]) => Promise<{ n?: number; error?: string }>;
  /** إرجاع دور مُرحّل إلى الانتظار */
  unmarkLeft: (entryId: string, project: string) => Promise<string | null>;
  /** النقطة: خدمة بدون تطبيق الممول + موعد */
  serveWithoutDonor: (input: NoDonorInput) => Promise<{ error?: string; entryId?: string; due?: string; attempt?: number }>;

  saveUser: (u: User) => Promise<string | null>;
  deleteUser: (id: string) => Promise<string | null>;
  saveProject: (p: Project) => Promise<string | null>;
  moveProject: (code: string, dir: -1 | 1) => Promise<void>;
  /** ترتيب كامل للمشاريع (السحب والإفلات) — يُعيد رسالة خطأ أو null */
  reorderProjects: (codes: string[]) => Promise<string | null>;
  renameCenter: (code: CenterCode, name: string) => Promise<void>;
  saveSettings: (s: Settings) => Promise<string | null>;
  saveProjectOptions: (code: string, o: { isDoctor: boolean; deferCenters: CenterCode[]; deferDays: number }) => Promise<string | null>;
}

export interface DoctorReferInput {
  nid: string;
  project: string;
  /** مشروع النقطة التي تحوّل */
  from?: string;
  note?: string;
  name?: string;
  type?: IdType;
}

export interface NoDonorInput {
  nid: string;
  project: string;
  due: string;
  reason?: string;
  name?: string;
  type?: IdType;
  queueRef?: string;
}

export const StoreContext = createContext<Ctx | null>(null);

const EMPTY: Db = {
  version: 1,
  seededOn: "",
  centers: [],
  projects: [],
  users: [],
  beneficiaries: {},
  entries: [],
  counters: {},
  changes: [],
  settings: { hintReception: "", hintPoint: "", idleMinutes: 30 },
  appointments: [],
};

const strip = (u: User): SessionUser => {
  const { password: _p, ...rest } = u;
  return rest;
};

const byTime = (a: Entry, b: Entry) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id);

/** دمج دفعة إدخالات: تستبدل كل ما يطابق `replace` */
function merge(d: Db, batch: EntryBatch, replace: (e: Entry) => boolean): Db {
  const ids = new Set(batch.entries.map((e) => e.id));
  const entries = d.entries.filter((e) => !replace(e) && !ids.has(e.id)).concat(batch.entries).sort(byTime);
  return { ...d, entries, beneficiaries: { ...d.beneficiaries, ...batch.beneficiaries } };
}

/** دمج المواعيد: تستبدل كل ما يطابق `replace` */
function mergeAppointments(cur: Appointment[], fresh: Appointment[], replace: (a: Appointment) => boolean): Appointment[] {
  const ids = new Set(fresh.map((a) => a.id));
  return cur.filter((a) => !replace(a) && !ids.has(a.id)).concat(fresh).sort((a, b) => a.due.localeCompare(b.due));
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const sb = supabase();
  const [ready, setReady] = useState(false);
  const [db, setDb] = useState<Db>(EMPTY);
  const [center, setCenterState] = useState<CenterCode | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [online, setOnline] = useState(true);
  const dbRef = useRef(db);
  dbRef.current = db;
  const userRef = useRef<SessionUser | null>(null);
  userRef.current = user;
  const centerRef = useRef<CenterCode | null>(null);
  centerRef.current = center;
  const channel = useRef<RealtimeChannel | null>(null);
  const timer = useRef<number | null>(null);
  // المزامنة: آخر تحديث ناجح، وإعادة المحاولة عند الفشل، ومنع تحديثين متزامنين
  const [sync, setSync] = useState<SyncState>({ at: null, failing: false, live: false, busy: false });
  const syncAt = useRef(0);
  const inflight = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const fails = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const joined = useRef(false);

  const projectOrder = () => new Map(dbRef.current.projects.map((p) => [p.code, p.order]));

  /* ===== التحميل ===== */

  const loadAll = useCallback(
    async (u: SessionUser, c: CenterCode | null) => {
      const today = todayKey();
      const back = isBackOffice(u.role);
      const [projects, users, settings] = await Promise.all([loadProjects(sb), loadUsers(sb), loadSettings(sb)]);
      const order = new Map(projects.map((p) => [p.code, p.order]));
      const fromDay = addDays(today, -(back ? BACK_OFFICE_DAYS : STAFF_DAYS));
      const [counters, changes, batches, appointments] = await Promise.all([
        loadCounters(sb, fromDay),
        u.role === "ADMIN" ? loadChanges(sb) : Promise.resolve([]),
        back
          ? Promise.all([loadEntries(sb, { fromDay }, order)])
          : Promise.all([
              loadEntries(sb, { day: today, center: c ?? undefined }, order),
              loadEntries(sb, { fromDay, userId: u.id, center: c ?? undefined }, order),
            ]),
        loadAppointments(sb, addDays(today, -APPT_BACK_DAYS)).catch(() => [] as Appointment[]),
      ]);
      setDb((d) => {
        let next: Db = { ...d, projects, users, settings, counters, changes, appointments, entries: [], beneficiaries: {} };
        batches.forEach((b) => (next = merge(next, b, () => false)));
        return next;
      });
    },
    [sb],
  );

  const markSynced = useCallback(() => {
    syncAt.current = Date.now();
    fails.current = 0;
    if (retryTimer.current) window.clearTimeout(retryTimer.current);
    retryTimer.current = null;
    setSync((s) => ({ ...s, at: syncAt.current, failing: false }));
  }, []);

  /** تحميل إدخالات اليوم وأرقام الدور مرة واحدة */
  const fetchToday = useCallback(async () => {
    const u = userRef.current;
    if (!u) return;
    const today = todayKey();
    const c = isStaff(u.role) ? centerRef.current ?? undefined : undefined;
    const scope: EntryScope = { day: today, ...(c ? { center: c } : {}) };
    const [batch, counters, appointments] = await Promise.all([
      loadEntries(sb, scope, projectOrder()),
      loadCounters(sb, today),
      loadAppointments(sb, addDays(today, -APPT_BACK_DAYS)).catch(() => null),
    ]);
    if (userRef.current !== u) return; // خرج المستخدم أثناء التحميل
    setDb((d) => ({
      ...merge(d, batch, (e) => e.date === today && (!c || e.center === c)),
      counters: { ...d.counters, ...counters },
      ...(appointments ? { appointments: mergeAppointments(d.appointments, appointments, () => true) } : {}),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  /**
   * تحديث إدخالات اليوم (بعد أي كتابة أو حدث لحظي أو تحديث دوري).
   * - لا يعمل تحديثان معاً: طلب أثناء التحميل يُنفَّذ مرة واحدة بعده.
   * - عند الفشل (نت ضعيف) يُعاد تلقائياً بعد 3 ثم 6 ثم 12… حتى 30 ثانية.
   */
  const refreshToday = useCallback(async (): Promise<void> => {
    if (!userRef.current) return;
    if (inflight.current) {
      again.current = true;
      return inflight.current;
    }
    const run = (async () => {
      setSync((s) => ({ ...s, busy: true }));
      try {
        do {
          again.current = false;
          await fetchToday();
        } while (again.current && userRef.current);
        markSynced();
      } catch {
        fails.current++;
        setSync((s) => ({ ...s, failing: true }));
        if (retryTimer.current) window.clearTimeout(retryTimer.current);
        const wait = Math.min(3000 * 2 ** (fails.current - 1), 30_000);
        retryTimer.current = window.setTimeout(() => {
          retryTimer.current = null;
          if (userRef.current) void refreshToday();
        }, wait);
      } finally {
        inflight.current = null;
        setSync((s) => ({ ...s, busy: false }));
      }
    })();
    inflight.current = run;
    return run;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchToday, markSynced]);

  const lookup = useCallback(
    async (nid: string) => {
      const [b, batch, appts] = await Promise.all([
        loadBeneficiary(sb, nid),
        loadEntries(sb, { nid }, projectOrder()),
        loadAppointments(sb, "", nid).catch(() => null),
      ]);
      setDb((d) => {
        const next = merge(d, batch, (e) => e.nid === nid);
        const beneficiaries = { ...next.beneficiaries };
        if (b) beneficiaries[nid] = b;
        else delete beneficiaries[nid];
        return { ...next, beneficiaries, ...(appts ? { appointments: mergeAppointments(next.appointments, appts, (a) => a.nid === nid) } : {}) };
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sb],
  );

  const reloadRefs = useCallback(async () => {
    const [projects, users, centers, settings] = await Promise.all([loadProjects(sb), loadUsers(sb), loadCenters(sb), loadSettings(sb)]);
    const changes = userRef.current?.role === "ADMIN" ? await loadChanges(sb) : dbRef.current.changes;
    setDb((d) => ({ ...d, projects, users, centers, settings, changes }));
  }, [sb]);

  /* ===== التحديث اللحظي ===== */

  const subscribe = useCallback(() => {
    channel.current?.unsubscribe();
    joined.current = false;
    const schedule = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void refreshToday(), 500);
    };
    channel.current = sb
      .channel("entries-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "entry_projects" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, schedule)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSync((s) => ({ ...s, live: true }));
          // بعد عودة الاتصال: الأحداث التي فاتت أثناء الانقطاع لا تُعاد، فنحدّث كل شيء
          if (joined.current) void refreshToday();
          joined.current = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setSync((s) => ({ ...s, live: false }));
        }
      });
  }, [sb, refreshToday]);

  /* ===== التحديث الاحتياطي =====
     إذا لم يصل أي تحديث منذ 30 ثانية (حدث ضاع أو اتصال لحظي مقطوع) والشاشة ظاهرة: نحدّث.
     في أوقات الضغط تصل الأحداث باستمرار فلا يعمل هذا التحديث تقريباً. */
  useEffect(() => {
    if (!user) return;
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !navigator.onLine || inflight.current || retryTimer.current) return;
      if (Date.now() - syncAt.current >= POLL_MS) void refreshToday();
    }, 5_000);
    return () => window.clearInterval(t);
  }, [user, refreshToday]);

  /* ===== البدء ===== */

  useEffect(() => {
    let alive = true;
    const c = storageGet<CenterCode | null>(CENTER_KEY, null);
    setCenterState(c);
    centerRef.current = c;
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      void refreshToday();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    (async () => {
      try {
        const centers = await loadCenters(sb);
        if (alive) setDb((d) => ({ ...d, centers }));
        const { data } = await sb.auth.getSession();
        const uid = data.session?.user.id;
        if (uid) {
          const profile = await loadProfile(sb, uid);
          if (profile && profile.active && (!isStaff(profile.role) || (c && profile.centers.includes(c)))) {
            const s = strip(profile);
            userRef.current = s;
            await loadAll(s, c);
            if (!alive) return;
            markSynced();
            setUser(s);
            subscribe();
          } else {
            await sb.auth.signOut();
          }
        }
      } catch {
        /* بدون اتصال: تبقى الشاشة على الدخول */
      }
      if (alive) setReady(true);
    })();

    const visible = () => document.visibilityState === "visible" && void refreshToday();
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      document.removeEventListener("visibilitychange", visible);
      channel.current?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCenter = useCallback((c: CenterCode | null) => {
    storageSet(CENTER_KEY, c);
    centerRef.current = c;
    setCenterState(c);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const { data, error } = await sb.auth.signInWithPassword({ email: usernameToEmail(username), password });
      if (error || !data.user) {
        const m = error?.message ?? "";
        if (/fetch|network/i.test(m)) return { error: "تعذّر الاتصال بالخادم. تأكد من الإنترنت" };
        if (error?.code === "invalid_credentials" || /invalid login credentials/i.test(m)) return { error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
        if (error?.code === "email_provider_disabled") return { error: "تسجيل الدخول متوقف من إعدادات Supabase (Email provider)" };
        return { error: `تعذّر تسجيل الدخول: ${m}` };
      }
      const profile = await loadProfile(sb, data.user.id);
      if (!profile) {
        await sb.auth.signOut();
        return { error: "هذا الحساب غير مكتمل. تواصل مع إدارة الموقع" };
      }
      if (!profile.active) {
        await sb.auth.signOut();
        return { error: "هذا الحساب موقوف. تواصل مع إدارة الموقع" };
      }
      const c = centerRef.current;
      if (isStaff(profile.role) && (!c || !profile.centers.includes(c))) {
        await sb.auth.signOut();
        const name = dbRef.current.centers.find((x) => x.code === c)?.name ?? "هذا المركز";
        return { error: `حسابك غير مسموح له بالعمل في ${name}` };
      }
      const s = strip(profile);
      userRef.current = s;
      try {
        await loadAll(s, c);
        markSynced();
      } catch (e) {
        await sb.auth.signOut();
        return { error: errorText(e) };
      }
      setUser(s);
      subscribe();
      return { user: s };
    },
    [sb, loadAll, subscribe],
  );

  const logout = useCallback(async () => {
    channel.current?.unsubscribe();
    channel.current = null;
    if (retryTimer.current) window.clearTimeout(retryTimer.current);
    retryTimer.current = null;
    setSync({ at: null, failing: false, live: false, busy: false });
    userRef.current = null;
    setUser(null);
    setDb((d) => ({ ...EMPTY, centers: d.centers }));
    await sb.auth.signOut();
  }, [sb]);

  /* ===== الإدخال ===== */

  const rpc = useCallback(
    async <T,>(fn: string, args: Record<string, unknown>): Promise<{ data?: T; error?: string }> => {
      if (!navigator.onLine) return { error: "لا يوجد اتصال بالإنترنت. انتظر عودة الاتصال ثم أعد المحاولة" };
      const { data, error } = await sb.rpc(fn, args);
      if (error) return { error: errorText(error) };
      return { data: data as T };
    },
    [sb],
  );

  const addEntry = useCallback(
    async (input: AddEntryInput): Promise<AddEntryResult> => {
      const u = userRef.current;
      const c = centerRef.current;
      if (!u || !c) return { ok: false, error: "انتهت الجلسة، سجّل الدخول من جديد" };
      const r = await rpc<{ mode: "created" | "updated"; entry_id: string; is_new: boolean; queue: Record<string, number>; skipped: string[] }>("add_entry", {
        p_nid: input.nid,
        p_center: c,
        p_projects: input.projects,
        p_name: input.name?.trim() || null,
        p_type: input.type ?? null,
        p_queue_ref: input.queueRef ?? null,
      });
      if (r.error || !r.data) return { ok: false, error: r.error ?? "تعذّر الإدخال" };
      const res = r.data;
      await Promise.all([refreshToday(), lookup(input.nid)]);
      const order = projectOrder();
      const projects =
        u.role === "POINT"
          ? input.projects.filter((p) => !res.skipped.includes(p))
          : Object.keys(res.queue).sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
      const now = new Date().toISOString();
      const entry: Entry = {
        id: res.entry_id,
        nid: input.nid,
        center: c,
        userId: u.id,
        kind: u.role === "POINT" ? "POINT" : "RECEPTION",
        at: now,
        date: dateKey(now),
        projects,
        isNew: res.is_new,
        ...(u.role === "POINT" ? {} : { queue: res.queue }),
      };
      return { ok: true, mode: res.mode, entry, isNew: res.is_new, skipped: res.skipped ?? [], added: projects };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rpc, refreshToday, lookup],
  );

  /** بعد تعديل إدخال: تحديث اليوم وسجل الهوية */
  const after = useCallback(
    async (nids: string[]) => {
      await Promise.all([refreshToday(), ...nids.map((n) => lookup(n))]);
    },
    [refreshToday, lookup],
  );
  const nidOf = (entryId: string) => dbRef.current.entries.find((e) => e.id === entryId)?.nid;

  const updateBeneficiary = useCallback(
    async (nid: string, data: { name: string; type?: IdType }) => {
      const r = await rpc("update_beneficiary", { p_nid: nid, p_name: data.name, p_type: data.type ?? null });
      if (r.error) return r.error;
      await lookup(nid);
      return null;
    },
    [rpc, lookup],
  );

  const updateEntryProjects = useCallback(
    async (entryId: string, projects: string[]) => {
      if (!projects.length) return "اختر مشروعاً واحداً على الأقل";
      const nid = nidOf(entryId);
      const r = await rpc("update_entry_projects", { p_entry: entryId, p_projects: projects });
      if (r.error) return r.error;
      await after(nid ? [nid] : []);
      return null;
    },
    [rpc, after],
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      const nid = nidOf(entryId);
      const r = await rpc("delete_entry", { p_entry: entryId });
      if (r.error) return r.error;
      setDb((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== entryId) }));
      await after(nid ? [nid] : []);
      return null;
    },
    [rpc, after],
  );

  const correctRouting = useCallback(
    async (receptionEntryId: string, projects: string[], deleteEntryIds: string[]) => {
      if (!projects.length) return "اختر المشروع الصحيح";
      const nid = nidOf(receptionEntryId);
      const r = await rpc("correct_routing", { p_reception: receptionEntryId, p_projects: projects, p_delete: deleteEntryIds });
      if (r.error) return r.error;
      if (deleteEntryIds.length) setDb((d) => ({ ...d, entries: d.entries.filter((e) => !deleteEntryIds.includes(e.id)) }));
      await after(nid ? [nid] : []);
      return null;
    },
    [rpc, after],
  );

  const referFromPoint = useCallback(
    async (input: ReferInput) => {
      if (!input.projects.length) return { error: "اختر المشروع الصحيح" };
      const c = centerRef.current;
      if (!c) return { error: "انتهت الجلسة، سجّل الدخول من جديد" };
      const r = await rpc<{ queue: Record<string, number>; created: boolean }>("refer_from_point", {
        p_nid: input.nid,
        p_center: c,
        p_projects: input.projects,
        p_name: input.name?.trim() || null,
        p_type: input.type ?? null,
        p_delete: input.deleteEntryIds,
      });
      if (r.error || !r.data) return { error: r.error ?? "تعذّر التحويل" };
      if (input.deleteEntryIds.length) setDb((d) => ({ ...d, entries: d.entries.filter((e) => !input.deleteEntryIds.includes(e.id)) }));
      await after([input.nid]);
      return { queue: r.data.queue, created: r.data.created };
    },
    [rpc, after],
  );

  const moveEntry = useCallback(
    async (entryId: string, newNid: string) => {
      const old = nidOf(entryId);
      const r = await rpc("move_entry", { p_entry: entryId, p_new_nid: newNid });
      if (r.error) return r.error;
      await after([newNid, ...(old ? [old] : [])]);
      return null;
    },
    [rpc, after],
  );

  const referToDoctor = useCallback(
    async (input: DoctorReferInput) => {
      const c = centerRef.current;
      if (!c) return { error: "انتهت الجلسة، سجّل الدخول من جديد" };
      const r = await rpc<{ entry_id: string; queue_no: number }>("refer_to_doctor", {
        p_nid: input.nid,
        p_center: c,
        p_project: input.project,
        p_from: input.from ?? null,
        p_note: input.note?.trim() || null,
        p_name: input.name?.trim() || null,
        p_type: input.type ?? null,
      });
      if (r.error || !r.data) return { error: r.error ?? "تعذّر التحويل" };
      await after([input.nid]);
      return { queueNo: r.data.queue_no, entryId: r.data.entry_id };
    },
    [rpc, after],
  );

  const cancelDoctorReferral = useCallback(
    async (entryId: string, project: string) => {
      const nid = nidOf(entryId);
      const r = await rpc("cancel_doctor_referral", { p_entry: entryId, p_project: project });
      if (r.error) return r.error;
      await after(nid ? [nid] : []);
      return null;
    },
    [rpc, after],
  );

  const markLeft = useCallback(
    async (projects: string[]) => {
      const c = centerRef.current;
      if (!c) return { error: "انتهت الجلسة، سجّل الدخول من جديد" };
      const r = await rpc<number>("mark_left", { p_center: c, p_projects: projects });
      if (r.error) return { error: r.error };
      await refreshToday();
      return { n: r.data ?? 0 };
    },
    [rpc, refreshToday],
  );

  const unmarkLeft = useCallback(
    async (entryId: string, project: string) => {
      const r = await rpc("unmark_left", { p_entry: entryId, p_project: project });
      if (r.error) return r.error;
      await refreshToday();
      return null;
    },
    [rpc, refreshToday],
  );

  const serveWithoutDonor = useCallback(
    async (input: NoDonorInput) => {
      const c = centerRef.current;
      if (!c) return { error: "انتهت الجلسة، سجّل الدخول من جديد" };
      const r = await rpc<{ entry_id: string; due_day: string; attempt: number }>("serve_without_donor", {
        p_nid: input.nid,
        p_center: c,
        p_project: input.project,
        p_due: input.due,
        p_reason: input.reason?.trim() || null,
        p_name: input.name?.trim() || null,
        p_type: input.type ?? null,
        p_queue_ref: input.queueRef ?? null,
      });
      if (r.error || !r.data) return { error: r.error ?? "تعذّر الإدخال" };
      await after([input.nid]);
      return { entryId: r.data.entry_id, due: r.data.due_day, attempt: r.data.attempt };
    },
    [rpc, after],
  );

  /* ===== الإدارة ===== */

  const saveUser = useCallback(
    async (u: User) => {
      const r = await saveUserAction({
        id: dbRef.current.users.some((x) => x.id === u.id) ? u.id : undefined,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        centers: u.centers,
        projects: u.projects,
        permissions: u.permissions,
        active: u.active,
        password: u.password || undefined,
      });
      if (!r.ok) return r.error;
      await reloadRefs();
      return null;
    },
    [reloadRefs],
  );

  const deleteUser = useCallback(
    async (id: string) => {
      const r = await deleteUserAction(id);
      if (!r.ok) return r.error;
      await reloadRefs();
      return null;
    },
    [reloadRefs],
  );

  const saveProject = useCallback(
    async (p: Project) => {
      if (!p.name.trim()) return "اكتب اسم المشروع";
      const r = await rpc("save_project", { p_code: p.code, p_name: p.name, p_active: p.active, p_centers: p.centers, p_color: p.color ?? null });
      if (r.error) return r.error;
      await reloadRefs();
      return null;
    },
    [rpc, reloadRefs],
  );

  const moveProject = useCallback(
    async (code: string, dir: -1 | 1) => {
      const list = [...dbRef.current.projects].sort((a, b) => a.order - b.order);
      const i = list.findIndex((p) => p.code === code);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      // عرض فوري ثم حفظ
      setDb((d) => ({ ...d, projects: list.map((p, k) => ({ ...p, order: k + 1 })) }));
      await rpc("reorder_projects", { p_codes: list.map((p) => p.code) });
      await reloadRefs();
    },
    [rpc, reloadRefs],
  );

  const reorderProjects = useCallback(
    async (codes: string[]) => {
      const byCode = new Map(dbRef.current.projects.map((p) => [p.code, p]));
      if (codes.length !== byCode.size || codes.some((c) => !byCode.has(c))) return "ترتيب غير صالح، حدّث الصفحة وأعد المحاولة";
      // عرض فوري ثم حفظ، وعند الخطأ نرجع لترتيب قاعدة البيانات
      setDb((d) => ({ ...d, projects: codes.map((c, k) => ({ ...byCode.get(c)!, order: k + 1 })) }));
      const r = await rpc("reorder_projects", { p_codes: codes });
      await reloadRefs();
      return r.error ?? null;
    },
    [rpc, reloadRefs],
  );

  const renameCenter = useCallback(
    async (code: CenterCode, name: string) => {
      await rpc("rename_center", { p_code: code, p_name: name });
      await reloadRefs();
    },
    [rpc, reloadRefs],
  );

  const saveSettings = useCallback(
    async (s: Settings) => {
      const r = await rpc("save_settings", { p_hint_reception: s.hintReception, p_hint_point: s.hintPoint, p_idle_minutes: s.idleMinutes });
      if (r.error) return r.error;
      await reloadRefs();
      return null;
    },
    [rpc, reloadRefs],
  );

  const saveProjectOptions = useCallback(
    async (code: string, o: { isDoctor: boolean; deferCenters: CenterCode[]; deferDays: number }) => {
      const r = await rpc("save_project_options", { p_code: code, p_is_doctor: o.isDoctor, p_defer_centers: o.deferCenters, p_defer_days: o.deferDays });
      if (r.error) return r.error;
      await reloadRefs();
      return null;
    },
    [rpc, reloadRefs],
  );

  const refresh = useCallback(async () => {
    const u = userRef.current;
    if (u) await loadAll(u, centerRef.current);
  }, [loadAll]);

  const value = useMemo<Ctx>(
    () =>
      // كل عملية مع قاعدة البيانات تُظهر شريط التقدّم العلوي
      tracked<Ctx>(
        {
          ready, online, sync, syncNow: refreshToday, db, center, user, setCenter, login, logout, lookup, refresh,
          addEntry, updateBeneficiary, updateEntryProjects, deleteEntry, correctRouting, referFromPoint, moveEntry,
          referToDoctor, cancelDoctorReferral, serveWithoutDonor, markLeft, unmarkLeft,
          saveUser, deleteUser, saveProject, moveProject, reorderProjects, renameCenter, saveSettings, saveProjectOptions,
        },
        ["login", "lookup", "refresh", "addEntry", "updateBeneficiary", "updateEntryProjects", "deleteEntry", "correctRouting", "referFromPoint", "moveEntry",
          "referToDoctor", "cancelDoctorReferral", "serveWithoutDonor", "markLeft", "unmarkLeft",
          "saveUser", "deleteUser", "saveProject", "moveProject", "reorderProjects", "renameCenter", "saveSettings", "saveProjectOptions"],
      ),
    [ready, online, sync, refreshToday, db, center, user, setCenter, login, logout, lookup, refresh, addEntry, updateBeneficiary, updateEntryProjects, deleteEntry, correctRouting, referFromPoint, moveEntry,
      referToDoctor, cancelDoctorReferral, serveWithoutDonor, markLeft, unmarkLeft,
      saveUser, deleteUser, saveProject, moveProject, reorderProjects, renameCenter, saveSettings, saveProjectOptions],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export { dateKey };
