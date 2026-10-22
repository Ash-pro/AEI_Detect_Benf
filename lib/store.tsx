"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Beneficiary, CenterCode, Db, Entry, IdType, Project, SessionUser, Settings, User } from "./types";
import { assignQueue } from "./queue";
import { nextColor, withColors } from "./project-colors";
import { DB_VERSION, seedDb } from "./mock-data";
import { dateKey, storageGet, storageSet, todayKey, uuid } from "./utils";
import { isStaff } from "./roles";

/* مخزن تجريبي في المتصفح — للتصميم والاختبار فقط، بدون قاعدة بيانات */

const DB_KEY = "aei.v2.db";
const CENTER_KEY = "aei.v2.center";
const USER_KEY = "aei.v2.user";

export type AddEntryResult =
  | { ok: true; mode: "created" | "updated"; entry: Entry; isNew: boolean; skipped: string[]; added: string[] }
  | { ok: false; error: string };

interface Ctx {
  ready: boolean;
  online: boolean;
  db: Db;
  center: CenterCode | null;
  user: SessionUser | null;
  setCenter: (c: CenterCode | null) => void;
  login: (username: string, password: string) => { user?: SessionUser; error?: string };
  logout: () => void;

  addEntry: (input: AddEntryInput) => AddEntryResult;
  renameBeneficiary: (nid: string, name: string) => void;
  updateBeneficiary: (nid: string, data: { name: string; type?: IdType }) => string | null;
  updateEntryProjects: (entryId: string, projects: string[]) => string | null;
  deleteEntry: (entryId: string) => void;
  correctRouting: (receptionEntryId: string, projects: string[], deleteEntryIds: string[]) => string | null;
  moveEntry: (entryId: string, newNid: string) => string | null;

  saveUser: (u: User) => string | null;
  deleteUser: (id: string) => void;
  saveProject: (p: Project) => string | null;
  moveProject: (code: string, dir: -1 | 1) => void;
  renameCenter: (code: CenterCode, name: string) => void;
  saveSettings: (s: Settings) => void;
  resetDemo: () => void;
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

const StoreContext = createContext<Ctx | null>(null);

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
};

const strip = (u: User): SessionUser => {
  const { password: _p, ...rest } = u;
  return rest;
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
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
          const q = assignQueue(db.counters, existing, input.projects);
          const updated = { ...existing, projects: input.projects, queue: q.queue };
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

  const renameBeneficiary = useCallback(
    (nid: string, name: string) => {
      setDb((d) => {
        const b = d.beneficiaries[nid];
        if (!b) return d;
        return log({ ...d, beneficiaries: { ...d.beneficiaries, [nid]: { ...b, name: name.trim() } } }, "تعديل اسم", `${nid}: "${b.name || "—"}" ← "${name.trim() || "—"}"`);
      });
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
        return log({ ...d, entries, beneficiaries }, "حذف إدخال", `${e.nid} (${e.date}) ${e.projects.join("، ")}`);
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
      const from = e.corrected?.from ?? e.projects;
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
          { ...d, projects: exists ? d.projects.map((x) => (x.code === p.code ? p : x)) : [...d.projects, { ...p, color: p.color ?? nextColor(d.projects) }] },
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

  const renameCenter = useCallback(
    (code: CenterCode, name: string) =>
      setDb((d) => log({ ...d, centers: d.centers.map((c) => (c.code === code ? { ...c, name: name.trim() || c.name } : c)) }, "تعديل مركز", name)),
    [log],
  );

  const saveSettings = useCallback((s: Settings) => setDb((d) => log({ ...d, settings: s }, "تعديل الإعدادات", "")), [log]);

  const resetDemo = useCallback(() => {
    const fresh = seedDb();
    setDb(fresh);
    storageSet(DB_KEY, fresh);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ready, online, db, center, user, setCenter, login, logout,
      addEntry, renameBeneficiary, updateBeneficiary, updateEntryProjects, deleteEntry, correctRouting, moveEntry,
      saveUser, deleteUser, saveProject, moveProject, renameCenter, saveSettings, resetDemo,
    }),
    [ready, online, db, center, user, setCenter, login, logout, addEntry, renameBeneficiary, updateBeneficiary, updateEntryProjects, deleteEntry, correctRouting, moveEntry, saveUser, deleteUser, saveProject, moveProject, renameCenter, saveSettings, resetDemo],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export { dateKey };
