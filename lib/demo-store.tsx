"use client";

import { tracked } from "./pending";
/* وضع العرض التجريبي (NEXT_PUBLIC_DEMO=1): بيانات محلية في المتصفح بدون Supabase — للمراجعة والتجربة فقط */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Appointment, Beneficiary, CenterCode, Db, Entry, IdType, Project, SessionUser, Settings, User } from "./types";
import { DB_VERSION, seedDb } from "./mock-data";
import { assignQueue, canMarkLeft, LEAVE_FROM_LABEL, projectQueue } from "./queue";
import { nextColor, withColors } from "./project-colors";
import { addDays, storageGet, storageSet, todayKey, uuid } from "./utils";
import { isStaff } from "./roles";
import { StoreContext, type AddEntryInput, type AddEntryResult, type Ctx, type DoctorReferInput, type NoDonorInput, type ReferInput } from "./store";

const DB_KEY = "aei.demo.db";
const CENTER_KEY = "aei.v2.center";
const USER_KEY = "aei.demo.user";

const EMPTY: Db = {
  version: DB_VERSION,
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

const KEYS: (keyof Ctx)[] = ["login", "lookup", "refresh", "addEntry", "updateBeneficiary", "updateEntryProjects", "deleteEntry", "correctRouting", "referFromPoint", "moveEntry", "saveUser", "deleteUser", "saveProject", "moveProject", "reorderProjects", "renameCenter", "saveSettings", "referToDoctor", "cancelDoctorReferral", "serveWithoutDonor", "saveProjectOptions", "markLeft", "unmarkLeft"];
const LATENCY = 450;

/** مثل قاعدة البيانات: تعديل توجيه الاستقبال لا يحذف تحويلات الطبيب التي أضافتها النقاط */
function keepReferrals(e: Entry, projects: string[]): string[] {
  const kept = e.projects.filter((p) => e.referrals?.[p] && !projects.includes(p));
  return [...projects, ...kept];
}

/** مثل trigger قاعدة البيانات: أي خدمة نقطة تغلق الموعد القادم لنفس الهوية والمشروع والمركز */
function closeAppointments(list: Appointment[], created: Entry[]): Appointment[] {
  return list.map((a) => {
    if (a.doneEntry) return a;
    const hit = created.find((e) => e.nid === a.nid && e.center === a.center && e.projects.includes(a.project) && e.id !== a.createdEntry);
    return hit ? { ...a, doneEntry: hit.id } : a;
  });
}
function withLatency(ctx: Ctx, keys: (keyof Ctx)[]): Ctx {
  const out = { ...ctx };
  keys.forEach((k) => {
    const fn = ctx[k];
    if (typeof fn !== "function" || k === "lookup" || k === "refresh") return;
    (out as Record<string, unknown>)[k] = async (...args: unknown[]) => {
      await new Promise((r) => setTimeout(r, LATENCY));
      return (fn as (...a: unknown[]) => unknown)(...args);
    };
  });
  return out;
}

export function DemoStoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [db, setDb] = useState<Db>(EMPTY);
  const [center, setCenterState] = useState<CenterCode | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [online, setOnline] = useState(true);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    const stored = storageGet<Db | null>(DB_KEY, null);
    let initial: Db;
    if (!stored || stored.version !== DB_VERSION) initial = seedDb();
    else if (stored.seededOn !== todayKey()) {
      // يوم جديد: إدخالات تجريبية جديدة، مع الإبقاء على المستخدمين والمشاريع والإعدادات
      const fresh = seedDb();
      initial = { ...fresh, users: stored.users, projects: stored.projects, centers: stored.centers, settings: stored.settings, changes: stored.changes };
    } else initial = stored;
    initial = { ...initial, projects: withColors(initial.projects) };
    setDb(initial);
    setCenterState(storageGet<CenterCode | null>(CENTER_KEY, null));
    const u = storageGet<SessionUser | null>(USER_KEY, null);
    const fresh = u ? initial.users.find((x) => x.id === u.id && x.active) : undefined;
    setUser(fresh ? strip(fresh) : null);
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    // مزامنة بين تبويبات المتصفح: الاستقبال في تبويب والنقطة في آخر
    const sync = (e: StorageEvent) => {
      if (e.key !== DB_KEY || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue) as Db;
        if (next.version === DB_VERSION) setDb(next);
      } catch {
        /* تجاهل */
      }
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("storage", sync);
    setReady(true);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => storageSet(DB_KEY, db), 400);
  }, [db, ready]);

  const log = useCallback(
    (d: Db, action: string, detail: string): Db => ({
      ...d,
      changes: [{ id: uuid(), at: new Date().toISOString(), userId: user?.id ?? "", action, detail }, ...d.changes].slice(0, 500),
    }),
    [user],
  );

  const setCenter = useCallback((c: CenterCode | null) => {
    storageSet(CENTER_KEY, c);
    setCenterState(c);
  }, []);

  const login = useCallback(
    (username: string, password: string) => {
      const u = db.users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
      if (!u || u.password !== password) return { error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
      if (!u.active) return { error: "هذا الحساب موقوف. تواصل مع إدارة الموقع" };
      if (isStaff(u.role) && center && !u.centers.includes(center)) {
        const name = db.centers.find((c) => c.code === center)?.name;
        return { error: `حسابك غير مسموح له بالعمل في ${name}` };
      }
      const s = strip(u);
      storageSet(USER_KEY, s);
      setUser(s);
      return { user: s };
    },
    [db, center],
  );

  const logout = useCallback(() => {
    storageSet(USER_KEY, null);
    setUser(null);
  }, []);

  /* ===== الإدخال ===== */

  const addEntry = useCallback(
    (input: AddEntryInput): AddEntryResult => {
      if (!user || !center) return { ok: false, error: "انتهت الجلسة، سجّل الدخول من جديد" };
      const today = todayKey();
      const now = new Date().toISOString();
      const kind: Entry["kind"] = user.role === "POINT" ? "POINT" : "RECEPTION";
      const isNew = !db.beneficiaries[input.nid];
      if (isNew) {
        if (!input.name?.trim()) return { ok: false, error: "اكتب اسم المستفيد — الاسم الأول يكفي" };
        if (!input.type) return { ok: false, error: "اختر نوع الهوية: أب أو أم أو طفل" };
      }
      if (!input.projects.length) return { ok: false, error: "اختر مشروعاً واحداً على الأقل" };
      const beneficiary: Beneficiary = db.beneficiaries[input.nid] ?? {
        nid: input.nid,
        name: input.name!.trim().replace(/\s+/g, " "),
        type: input.type,
        createdAt: now,
      };

      if (kind === "RECEPTION") {
        const existing = db.entries.find(
          (e) => e.kind === "RECEPTION" && e.nid === input.nid && e.date === today && e.center === center,
        );
        if (existing) {
          // تحويلات الطبيب من النقاط تبقى كما هي
          const projects = keepReferrals(existing, input.projects);
          const q = assignQueue(db.counters, existing, projects);
          const updated = { ...existing, projects, queue: q.queue };
          setDb((d) =>
            log(
              { ...d, counters: { ...d.counters, ...q.counters }, entries: d.entries.map((e) => (e.id === existing.id ? updated : e)) },
              "تحديث إدخال اليوم",
              `${input.nid}: ${input.projects.join("، ")}`,
            ),
          );
          return { ok: true, mode: "updated", entry: updated, isNew: false, skipped: [], added: q.added };
        }
      }

      let projects = input.projects;
      const skipped: string[] = [];
      if (kind === "POINT") {
        const done = new Set(
          db.entries.filter((e) => e.kind === "POINT" && e.nid === input.nid && e.date === today).flatMap((e) => e.projects),
        );
        projects = input.projects.filter((p) => !done.has(p));
        input.projects.filter((p) => done.has(p)).forEach((p) => skipped.push(p));
        if (!projects.length) return { ok: false, error: "هذه الحالة أُدخلت اليوم في هذا المشروع مسبقاً" };
      }

      let counters = db.counters;
      let created: Entry[];
      if (kind === "POINT") {
        created = projects.map((p, i) => ({
          id: uuid(), nid: input.nid, center, userId: user.id, kind, at: now, date: today, projects: [p], isNew: isNew && i === 0,
          ...(input.queueRef ? { queueRef: input.queueRef } : {}),
        }));
      } else {
        const base: Entry = { id: uuid(), nid: input.nid, center, userId: user.id, kind, at: now, date: today, projects, isNew };
        const q = assignQueue(counters, base, projects);
        counters = q.counters;
        created = [{ ...base, queue: q.queue }];
      }

      setDb((d) => ({
        ...d,
        counters: { ...d.counters, ...counters },
        beneficiaries: isNew ? { ...d.beneficiaries, [input.nid]: beneficiary } : d.beneficiaries,
        entries: [...d.entries, ...created],
        appointments: kind === "POINT" ? closeAppointments(d.appointments, created) : d.appointments,
      }));
      return { ok: true, mode: "created", entry: created[0], isNew, skipped, added: kind === "RECEPTION" ? projects : [] };
    },
    [db, user, center, log],
  );

  const updateBeneficiary = useCallback(
    (nid: string, data: { name: string; type?: IdType }) => {
      const name = data.name.trim().replace(/\s+/g, " ");
      if (!name) return "اكتب الاسم — الاسم الأول يكفي";
      setDb((d) => {
        const b = d.beneficiaries[nid];
        if (!b) return d;
        return log(
          { ...d, beneficiaries: { ...d.beneficiaries, [nid]: { ...b, name, type: data.type ?? b.type } } },
          "تعديل بيانات هوية",
          `${nid}: "${b.name || "—"}" ← "${name}"${data.type && data.type !== b.type ? " (تغيير النوع)" : ""}`,
        );
      });
      return null;
    },
    [log],
  );


  const updateEntryProjects = useCallback(
    (entryId: string, projects: string[]) => {
      if (!projects.length) return "اختر مشروعاً واحداً على الأقل";
      const e = db.entries.find((x) => x.id === entryId);
      if (!e) return "الإدخال غير موجود";
      if (e.kind === "POINT") {
        const clash = db.entries.some((x) => x.id !== e.id && x.kind === "POINT" && x.nid === e.nid && x.date === e.date && x.projects.some((p) => projects.includes(p)));
        if (clash) return "هذا المشروع مُدخل لنفس الحالة في نفس اليوم";
      }
      if (e.kind === "RECEPTION") projects = keepReferrals(e, projects);
      const q = e.kind === "RECEPTION" ? assignQueue(db.counters, e, projects) : null;
      setDb((d) =>
        log(
          {
            ...d,
            counters: q ? { ...d.counters, ...q.counters } : d.counters,
            entries: d.entries.map((x) => (x.id === entryId ? { ...x, projects, ...(q ? { queue: q.queue } : {}) } : x)),
          },
          "تعديل مشاريع إدخال",
          `${e.nid} (${e.date}): ${e.projects.join("، ")} ← ${projects.join("، ")}`,
        ),
      );
      return null;
    },
    [db, log],
  );

  const deleteEntry = useCallback(
    (entryId: string) => {
      setDb((d) => {
        const e = d.entries.find((x) => x.id === entryId);
        if (!e) return d;
        const entries = d.entries.filter((x) => x.id !== entryId);
        const beneficiaries = { ...d.beneficiaries };
        if (!entries.some((x) => x.nid === e.nid)) delete beneficiaries[e.nid];
        // مثل قاعدة البيانات: موعد الخدمة المحذوفة يُحذف، والموعد الذي أغلقته يعود قادماً
        const appointments = d.appointments
          .filter((a) => a.createdEntry !== entryId && beneficiaries[a.nid])
          .map((a) => (a.doneEntry === entryId ? { ...a, doneEntry: undefined } : a));
        return log({ ...d, entries, beneficiaries, appointments }, "حذف إدخال", `${e.nid} (${e.date}) ${e.projects.join("، ")}`);
      });
    },
    [log],
  );

  /** موظف النقطة يصحح توجيه الاستقبال لليوم، ويحذف إدخال خدمته الخاطئ إن وُجد */
  const correctRouting = useCallback(
    (receptionEntryId: string, projects: string[], deleteEntryIds: string[]) => {
      if (!projects.length) return "اختر المشروع الصحيح";
      const e = db.entries.find((x) => x.id === receptionEntryId && x.kind === "RECEPTION");
      if (!e) return "لا يوجد توجيه استقبال لهذه الحالة اليوم";
      const from = e.corrected?.from ?? e.projects.filter((p) => !e.referrals?.[p]);
      projects = keepReferrals(e, projects);
      // المشروع الجديد يعطي الرقم التالي، ورقم المشروع القديم يُلغى ولا يُعاد استخدامه
      const q = assignQueue(db.counters, e, projects);
      const queueOut = { ...e.queueOut };
      e.projects.filter((p) => !projects.includes(p) && e.queue?.[p]).forEach((p) => (queueOut[p] = e.queue![p]));
      projects.forEach((p) => delete queueOut[p]);
      setDb((d) =>
        log(
          {
            ...d,
            counters: { ...d.counters, ...q.counters },
            entries: d.entries
              .filter((x) => !deleteEntryIds.includes(x.id))
              .map((x) =>
                x.id === receptionEntryId
                  ? { ...x, projects, queue: q.queue, queueOut, corrected: { by: user?.id ?? "", at: new Date().toISOString(), from } }
                  : x,
              ),
          },
          "تصحيح توجيه",
          `${e.nid}: ${e.projects.join("، ")} ← ${projects.join("، ")}${deleteEntryIds.length ? " (مع حذف إدخال الخدمة الخاطئ)" : ""}`,
        ),
      );
      return null;
    },
    [db, user, log],
  );

  /** النقطة: تصحيح التوجيه أو إنشاء تحويل جديد باسم موظف النقطة */
  const referFromPoint = useCallback(
    (input: ReferInput): { error?: string; queue?: Record<string, number>; created?: boolean } => {
      if (!user || !center) return { error: "انتهت الجلسة" };
      if (!input.projects.length) return { error: "اختر المشروع الصحيح" };
      const today = todayKey();
      const rec = db.entries.find((e) => e.kind === "RECEPTION" && e.nid === input.nid && e.date === today && e.center === center);
      if (rec) {
        const err = correctRouting(rec.id, input.projects, input.deleteEntryIds);
        return err ? { error: err } : { created: false };
      }
      const isNew = !db.beneficiaries[input.nid];
      if (isNew && (!input.name?.trim() || !input.type)) return { error: "اكتب اسم المستفيد واختر نوع الهوية أولاً" };
      const now = new Date().toISOString();
      const base: Entry = { id: uuid(), nid: input.nid, center, userId: user.id, kind: "RECEPTION", at: now, date: today, projects: input.projects, isNew, corrected: { by: user.id, at: now, from: [] } };
      const q = assignQueue(db.counters, base, input.projects);
      setDb((d) =>
        log(
          {
            ...d,
            counters: { ...d.counters, ...q.counters },
            beneficiaries: isNew ? { ...d.beneficiaries, [input.nid]: { nid: input.nid, name: input.name!.trim(), type: input.type, createdAt: now } } : d.beneficiaries,
            entries: [...d.entries.filter((x) => !input.deleteEntryIds.includes(x.id)), { ...base, queue: q.queue }],
          },
          "تحويل من نقطة",
          `${input.nid} ← ${input.projects.join("، ")}`,
        ),
      );
      return { queue: q.queue, created: true };
    },
    [db, user, center, log, correctRouting],
  );

  const moveEntry = useCallback(
    (entryId: string, newNid: string) => {
      const e = db.entries.find((x) => x.id === entryId);
      if (!e) return "الإدخال غير موجود";
      if (newNid === e.nid) return "الرقم الجديد مطابق للحالي";
      const target = db.entries.filter((x) => x.nid === newNid && x.date === e.date);
      if (e.kind === "RECEPTION" && target.some((x) => x.kind === "RECEPTION" && x.center === e.center))
        return "الرقم الصحيح له إدخال استقبال اليوم في نفس المركز. عدّل ذلك الإدخال بدلاً من النقل";
      if (e.kind === "POINT" && target.some((x) => x.kind === "POINT" && x.projects.some((p) => e.projects.includes(p))))
        return "الرقم الصحيح مُدخل اليوم في نفس المشروع";
      setDb((d) => {
        const old = d.beneficiaries[e.nid];
        const entries = d.entries.map((x) => (x.id === entryId ? { ...x, nid: newNid } : x));
        const beneficiaries = { ...d.beneficiaries };
        if (!beneficiaries[newNid]) beneficiaries[newNid] = { nid: newNid, name: old?.name ?? "", createdAt: e.at };
        if (!entries.some((x) => x.nid === e.nid)) delete beneficiaries[e.nid];
        return log({ ...d, entries, beneficiaries }, "تصحيح رقم هوية", `${e.nid} ← ${newNid} (${e.date})`);
      });
      return null;
    },
    [db, log],
  );

  /** النقطة: تحويل لمشروع طبيب (إضافي) */
  const referToDoctor = useCallback(
    (input: DoctorReferInput): { error?: string; queueNo?: number; entryId?: string } => {
      if (!user || !center) return { error: "انتهت الجلسة" };
      if (user.role !== "POINT") return { error: "التحويل للطبيب من نقاط المشاريع" };
      const proj = db.projects.find((p) => p.code === input.project);
      if (!proj?.isDoctor) return { error: "هذا المشروع ليس مشروع طبيب" };
      if (!proj.active || !proj.centers.includes(center)) return { error: "مشروع غير متاح في هذا المركز" };
      const today = todayKey();
      const now = new Date().toISOString();
      const isNew = !db.beneficiaries[input.nid];
      if (isNew && (!input.name?.trim() || !input.type)) return { error: "اكتب اسم المستفيد واختر نوع الهوية أولاً" };
      const rec = db.entries.find((e) => e.kind === "RECEPTION" && e.nid === input.nid && e.date === today && e.center === center);
      if (rec?.queue?.[input.project]) return { error: `الحالة محوّلة لهذا الطبيب اليوم (دور ${rec.queue[input.project]})` };
      const base: Entry = rec ?? { id: uuid(), nid: input.nid, center, userId: user.id, kind: "RECEPTION", at: now, date: today, projects: [], isNew, corrected: { by: user.id, at: now, from: [] } };
      const q = assignQueue(db.counters, base, [...base.projects, input.project]);
      const from = input.from && user.projects.includes(input.from) ? input.from : undefined;
      const queueOut = { ...base.queueOut };
      delete queueOut[input.project];
      const next: Entry = {
        ...base,
        projects: [...base.projects, input.project],
        queue: q.queue,
        ...(Object.keys(queueOut).length ? { queueOut } : { queueOut: undefined }),
        referrals: { ...base.referrals, [input.project]: { by: user.id, from, note: input.note?.trim() || undefined } },
      };
      setDb((d) =>
        log(
          {
            ...d,
            counters: { ...d.counters, ...q.counters },
            beneficiaries: isNew ? { ...d.beneficiaries, [input.nid]: { nid: input.nid, name: input.name!.trim(), type: input.type, createdAt: now } } : d.beneficiaries,
            entries: rec ? d.entries.map((e) => (e.id === rec.id ? next : e)) : [...d.entries, next],
          },
          "تحويل لطبيب",
          `${input.nid} ← ${input.project}${from ? ` (من ${from})` : ""} دور ${q.queue[input.project]}`,
        ),
      );
      return { queueNo: q.queue[input.project], entryId: next.id };
    },
    [db, user, center, log],
  );

  /* مثل mark_left في قاعدة البيانات */
  const markLeft = useCallback(
    (projects: string[]): { n?: number; error?: string } => {
      if (user?.role !== "POINT") return { error: "الترحيل من نقاط المشاريع فقط" };
      if (!center) return { error: "انتهت الجلسة، سجّل الدخول من جديد" };
      if (projects.some((p) => !user.projects.includes(p))) return { error: "لا يمكنك الترحيل إلا في مشاريعك" };
      if (!canMarkLeft()) return { error: `الترحيل متاح بعد الساعة ${LEAVE_FROM_LABEL}` };
      const today = todayKey();
      const at = new Date().toISOString();
      const hits = new Map<string, string[]>();
      projects.forEach((p) =>
        projectQueue(db, center, p, today)
          .filter((x) => x.status === "wait")
          .forEach((x) => hits.set(x.reception.id, [...(hits.get(x.reception.id) ?? []), p])),
      );
      const n = [...hits.values()].reduce((a, l) => a + l.length, 0);
      if (n)
        setDb((d) =>
          log(
            {
              ...d,
              entries: d.entries.map((e) => {
                const ps = hits.get(e.id);
                if (!ps) return e;
                const left = { ...e.left };
                ps.forEach((p) => (left[p] = { at, by: user.id }));
                return { ...e, left };
              }),
            },
            "ترحيل لم تُخدم",
            `${projects.join("، ")} · ${n} حالة`,
          ),
        );
      return { n };
    },
    [db, user, center, log],
  );

  const unmarkLeft = useCallback(
    (entryId: string, project: string): string | null => {
      const e = db.entries.find((x) => x.id === entryId);
      if (!e?.left?.[project]) return "هذا الدور غير مُرحّل";
      const admin = user?.role === "ADMIN" || user?.permissions?.includes("edit_entries");
      if (!admin && !(user?.role === "POINT" && user.projects.includes(project) && e.date === todayKey())) return "لا تملك صلاحية إرجاع هذا الدور";
      setDb((d) =>
        log(
          {
            ...d,
            entries: d.entries.map((x) => {
              if (x.id !== entryId) return x;
              const left = { ...x.left };
              delete left[project];
              return { ...x, left: Object.keys(left).length ? left : undefined };
            }),
          },
          "إرجاع للانتظار",
          `${e.nid} · ${project}`,
        ),
      );
      return null;
    },
    [db, user, log],
  );

  const cancelDoctorReferral = useCallback(
    (entryId: string, project: string): string | null => {
      const e = db.entries.find((x) => x.id === entryId);
      const ref = e?.referrals?.[project];
      if (!e || !ref) return "لا يوجد تحويل للطبيب لإلغائه";
      if (!(ref.by === user?.id && e.date === todayKey()) && !(user?.role === "ADMIN" || user?.permissions?.includes("edit_entries")))
        return "يمكن إلغاء التحويل من نفس الموظف وفي نفس اليوم";
      if (db.entries.some((x) => x.kind === "POINT" && x.nid === e.nid && x.date === e.date && x.center === e.center && x.projects.includes(project)))
        return "الطبيب أدخل خدمة هذه الحالة. لا يمكن إلغاء التحويل";
      setDb((d) => {
        const projects = e.projects.filter((p) => p !== project);
        const queue = { ...e.queue };
        delete queue[project];
        const referrals = { ...e.referrals };
        delete referrals[project];
        const removeEntry = !projects.length && !Object.keys(e.queueOut ?? {}).length;
        const entries = removeEntry
          ? d.entries.filter((x) => x.id !== e.id)
          : d.entries.map((x) => (x.id === e.id ? { ...x, projects, queue, referrals: Object.keys(referrals).length ? referrals : undefined } : x));
        const beneficiaries = { ...d.beneficiaries };
        if (!entries.some((x) => x.nid === e.nid)) delete beneficiaries[e.nid];
        return log({ ...d, entries, beneficiaries }, "إلغاء تحويل طبيب", `${e.nid} ← ${project} دور ${e.queue?.[project] ?? ""}`);
      });
      return null;
    },
    [db, user, log],
  );

  /** النقطة: خدمة بدون تطبيق الممول + موعد */
  const serveWithoutDonor = useCallback(
    (input: NoDonorInput): { error?: string; entryId?: string; due?: string; attempt?: number } => {
      if (!user || !center) return { error: "انتهت الجلسة" };
      if (user.role !== "POINT") return { error: "هذه الخدمة لموظف نقطة المشروع" };
      if (!user.projects.includes(input.project)) return { error: "يمكنك إدخال الخدمة في مشاريعك فقط" };
      const proj = db.projects.find((p) => p.code === input.project);
      if (!proj?.deferCenters?.includes(center)) return { error: "هذا الخيار غير مفعّل لهذا المشروع في هذا المركز" };
      const today = todayKey();
      if (!input.due || input.due <= today || input.due > addDays(today, 90)) return { error: "اختر موعداً بعد اليوم وخلال 90 يوماً" };
      const r = addEntry({ nid: input.nid, projects: [input.project], name: input.name, type: input.type, queueRef: input.queueRef });
      if (!r.ok) return { error: r.error };
      const entryId = r.entry.id;
      let attempt = 1;
      setDb((d) => {
        const prev = d.appointments.filter((a) => a.doneEntry === entryId);
        attempt = prev.reduce((m, a) => Math.max(m, a.attempt), 0) + 1;
        const appt: Appointment = {
          id: uuid(),
          nid: input.nid,
          center,
          project: input.project,
          due: input.due,
          attempt,
          createdEntry: entryId,
          createdBy: user.id,
          createdAt: new Date().toISOString(),
        };
        return log(
          {
            ...d,
            entries: d.entries.map((e) => (e.id === entryId ? { ...e, noDonor: { reason: input.reason?.trim() || undefined } } : e)),
            appointments: [...d.appointments, appt],
          },
          "خدمة بدون تطبيق الممول",
          `${input.nid} · ${input.project} · موعد ${input.due}${attempt > 1 ? ` (محاولة ${attempt})` : ""}`,
        );
      });
      return { entryId, due: input.due, attempt };
    },
    [db, user, center, log, addEntry],
  );

  /* ===== الإدارة ===== */

  const saveUser = useCallback(
    (u: User) => {
      if (db.users.some((x) => x.id !== u.id && x.username.toLowerCase() === u.username.toLowerCase()))
        return "اسم المستخدم مستخدم لحساب آخر";
      setDb((d) => {
        const exists = d.users.some((x) => x.id === u.id);
        return log(
          { ...d, users: exists ? d.users.map((x) => (x.id === u.id ? u : x)) : [...d.users, u] },
          exists ? "تعديل مستخدم" : "إنشاء مستخدم",
          `${u.fullName} (${u.username})`,
        );
      });
      return null;
    },
    [db, log],
  );

  const deleteUser = useCallback(
    (id: string) => setDb((d) => {
      const u = d.users.find((x) => x.id === id);
      return log({ ...d, users: d.users.filter((x) => x.id !== id) }, "حذف مستخدم", u ? `${u.fullName} (${u.username})` : id);
    }),
    [log],
  );

  const saveProject = useCallback(
    (p: Project) => {
      if (!p.name.trim()) return "اكتب اسم المشروع";
      setDb((d) => {
        const exists = d.projects.some((x) => x.code === p.code);
        return log(
          {
            ...d,
            projects: exists
              ? d.projects.map((x) => (x.code === p.code ? { ...x, ...p } : x))
              : [...d.projects, { ...p, color: p.color ?? nextColor(d.projects), isDoctor: p.isDoctor ?? p.code.startsWith("DR") }],
          },
          exists ? "تعديل مشروع" : "إضافة مشروع",
          p.name,
        );
      });
      return null;
    },
    [log],
  );

  const moveProject = useCallback((code: string, dir: -1 | 1) => {
    setDb((d) => {
      const list = [...d.projects].sort((a, b) => a.order - b.order);
      const i = list.findIndex((p) => p.code === code);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return d;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...d, projects: list.map((p, k) => ({ ...p, order: k + 1 })) };
    });
  }, []);

  const reorderProjects = useCallback((codes: string[]) => {
    setDb((d) => {
      const byCode = new Map(d.projects.map((p) => [p.code, p]));
      if (codes.length !== byCode.size || codes.some((c) => !byCode.has(c))) return d;
      return { ...d, projects: codes.map((c, k) => ({ ...byCode.get(c)!, order: k + 1 })) };
    });
  }, []);

  const renameCenter = useCallback(
    (code: CenterCode, name: string) =>
      setDb((d) => log({ ...d, centers: d.centers.map((c) => (c.code === code ? { ...c, name: name.trim() || c.name } : c)) }, "تعديل مركز", name)),
    [log],
  );

  const saveProjectOptions = useCallback(
    (code: string, o: { isDoctor: boolean; deferCenters: CenterCode[]; deferDays: number }): string | null => {
      if (!(o.deferDays >= 1 && o.deferDays <= 90)) return "مدة الموعد من 1 إلى 90 يوماً";
      setDb((d) =>
        log(
          { ...d, projects: d.projects.map((p) => (p.code === code ? { ...p, isDoctor: o.isDoctor, deferCenters: [...new Set(o.deferCenters)], deferDays: o.deferDays } : p)) },
          "خيارات مشروع",
          code,
        ),
      );
      return null;
    },
    [log],
  );

  const saveSettings = useCallback((s: Settings) => setDb((d) => log({ ...d, settings: s }, "تعديل الإعدادات", "")), [log]);

  // العرض التجريبي: البيانات محلية دائماً محدّثة — "آخر تحديث" = آخر تغيير أو ضغط تحديث
  const [syncAt, setSyncAt] = useState(() => Date.now());
  useEffect(() => setSyncAt(Date.now()), [db]);
  const sync = useMemo(() => ({ at: syncAt, failing: !online, live: online, busy: false }), [syncAt, online]);

  const value = useMemo<Ctx>(
    () =>
      // العرض التجريبي: تأخير بسيط يحاكي زمن قاعدة البيانات حتى تظهر مؤشرات التحميل كما في الوضع الحقيقي
      tracked<Ctx>(withLatency({
      ready,
      online,
      sync,
      syncNow: async () => setSyncAt(Date.now()),
      db,
      center,
      user,
      setCenter,
      login: async (u, p) => login(u, p),
      logout: async () => logout(),
      lookup: async () => {},
      refresh: async () => {},
      addEntry: async (i) => addEntry(i),
      updateBeneficiary: async (n, d) => updateBeneficiary(n, d),
      updateEntryProjects: async (id, p) => updateEntryProjects(id, p),
      deleteEntry: async (id) => (deleteEntry(id), null),
      correctRouting: async (id, p, d) => correctRouting(id, p, d),
      referFromPoint: async (i) => referFromPoint(i),
      moveEntry: async (id, n) => moveEntry(id, n),
      referToDoctor: async (i) => referToDoctor(i),
      cancelDoctorReferral: async (id, p) => cancelDoctorReferral(id, p),
      markLeft: async (ps) => markLeft(ps),
      unmarkLeft: async (id, p) => unmarkLeft(id, p),
      serveWithoutDonor: async (i) => serveWithoutDonor(i),
      saveProjectOptions: async (c, o) => saveProjectOptions(c, o),
      saveUser: async (u) => saveUser({ ...u, password: u.password || db.users.find((x) => x.id === u.id)?.password || "1234" }),
      deleteUser: async (id) => (deleteUser(id), null),
      saveProject: async (p) => saveProject(p),
      moveProject: async (c, d) => moveProject(c, d),
      reorderProjects: async (codes) => (reorderProjects(codes), null),
      renameCenter: async (c, n) => renameCenter(c, n),
      saveSettings: async (s) => (saveSettings(s), null),
    }, KEYS), KEYS),
    [ready, online, db, center, user, setCenter, login, logout, addEntry, updateBeneficiary, updateEntryProjects, deleteEntry, correctRouting, referFromPoint, moveEntry,
      referToDoctor, cancelDoctorReferral, serveWithoutDonor, saveProjectOptions, markLeft, unmarkLeft,
      saveUser, deleteUser, saveProject, moveProject, reorderProjects, renameCenter, saveSettings, sync],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

