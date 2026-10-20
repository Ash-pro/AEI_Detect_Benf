"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Beneficiary, CenterCode, Db, ProjectCode, User } from "./types";
import { seedDb, USERS } from "./mock-data";
import { isToday, normalizeArabicName, storageGet, storageSet, uuid } from "./utils";
import { visitsOf } from "./logic";

/* جلسة وبيانات تجريبية في الذاكرة — للتصميم فقط */

interface SessionState {
  center: CenterCode | null;
  user: User | null;
  project: ProjectCode | null;
}

interface NewBeneficiaryInput {
  nationalId: string;
  typeId: string;
  newTypeName?: string;
  name: string;
  phone: string;
  birthDate?: string;
  projects: ProjectCode[];
  householdId?: string;
}

interface VisitInput {
  beneficiaryId: string;
  projects: ProjectCode[];
  newProjects: { project: ProjectCode; reason: string }[];
}

interface Ctx extends SessionState {
  ready: boolean;
  online: boolean;
  db: Db;
  setCenter: (c: CenterCode | null) => void;
  login: (username: string, password: string) => User | null;
  logout: () => void;
  setProject: (p: ProjectCode) => void;
  registerBeneficiary: (input: NewBeneficiaryInput) => { beneficiary: Beneficiary; visitSeq: number };
  registerVisit: (input: VisitInput) => { visitSeq: number; merged: boolean };
  confirmService: (beneficiaryId: string, exception?: { reason: string; note: string }) => void;
}

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<SessionState>({ center: null, user: null, project: null });
  const [db, setDb] = useState<Db>(() => seedDb());
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setState({
      center: storageGet<CenterCode | null>("aei.device.center", null),
      user: storageGet<User | null>("aei.session.user", null),
      project: storageGet<ProjectCode | null>("aei.session.project", null),
    });
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setReady(true);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const setCenter = useCallback((c: CenterCode | null) => {
    storageSet("aei.device.center", c);
    setState((s) => ({ ...s, center: c }));
  }, []);

  const login = useCallback((username: string, password: string) => {
    const found = USERS.find((u) => u.username === username.trim() && u.password === password);
    if (!found) return null;
    const { password: _pw, ...user } = found;
    const project = user.projects.length === 1 ? user.projects[0] : null;
    storageSet("aei.session.user", user);
    storageSet("aei.session.project", project);
    setState((s) => ({ ...s, user, project }));
    return user;
  }, []);

  const logout = useCallback(() => {
    storageSet("aei.session.user", null);
    storageSet("aei.session.project", null);
    setState((s) => ({ ...s, user: null, project: null }));
  }, []);

  const setProject = useCallback((p: ProjectCode) => {
    storageSet("aei.session.project", p);
    setState((s) => ({ ...s, project: p }));
  }, []);

  const registerBeneficiary = useCallback(
    (input: NewBeneficiaryInput) => {
      const center = state.center!;
      const now = new Date().toISOString();
      let typeId = input.typeId;
      const newTypes = [...db.identityTypes];
      if (input.newTypeName) {
        const existing = newTypes.find((t) => normalizeArabicName(t.name) === normalizeArabicName(input.newTypeName!));
        if (existing) typeId = existing.id;
        else {
          typeId = uuid();
          newTypes.push({ id: typeId, name: input.newTypeName.trim(), isSystem: false });
        }
      }
      const beneficiary: Beneficiary = {
        id: uuid(),
        nationalId: input.nationalId,
        typeId,
        name: input.name.trim(),
        phone: input.phone,
        birthDate: input.birthDate || undefined,
        homeCenter: center,
        householdId: input.householdId,
        createdAt: now,
      };
      setDb((d) => ({
        ...d,
        identityTypes: newTypes,
        beneficiaries: [...d.beneficiaries, beneficiary],
        enrollments: [
          ...d.enrollments,
          ...input.projects.map((p) => ({
            id: uuid(),
            beneficiaryId: beneficiary.id,
            project: p,
            center,
            status: "ACTIVE" as const,
            enrolledAt: now,
          })),
        ],
        visits: [
          ...d.visits,
          {
            id: uuid(),
            beneficiaryId: beneficiary.id,
            seq: 1,
            kind: "NEW",
            center,
            occurredAt: now,
            referrals: input.projects,
            receptionist: state.user?.fullName ?? "",
          },
        ],
      }));
      return { beneficiary, visitSeq: 1 };
    },
    [db.identityTypes, state.center, state.user],
  );

  const registerVisit = useCallback(
    (input: VisitInput) => {
      const center = state.center!;
      const now = new Date().toISOString();
      const visits = visitsOf(db, input.beneficiaryId);
      const todayHere = visits.find(
        (v) => v.center === center && isToday(v.occurredAt),
      );
      const allProjects = [...input.projects, ...input.newProjects.map((n) => n.project)];
      const newEnrollments = input.newProjects.map((n) => ({
        id: uuid(),
        beneficiaryId: input.beneficiaryId,
        project: n.project,
        center,
        status: "PENDING_APPROVAL" as const,
        enrolledAt: now,
      }));
      if (todayHere) {
        setDb((d) => ({
          ...d,
          enrollments: [...d.enrollments, ...newEnrollments],
          visits: d.visits.map((v) =>
            v.id === todayHere.id ? { ...v, referrals: Array.from(new Set([...v.referrals, ...allProjects])) } : v,
          ),
        }));
        return { visitSeq: todayHere.seq, merged: true };
      }
      const seq = (visits[0]?.seq ?? 0) + 1;
      setDb((d) => ({
        ...d,
        enrollments: [...d.enrollments, ...newEnrollments],
        visits: [
          ...d.visits,
          {
            id: uuid(),
            beneficiaryId: input.beneficiaryId,
            seq,
            kind: "FOLLOW_UP",
            center,
            occurredAt: now,
            referrals: allProjects,
            receptionist: state.user?.fullName ?? "",
          },
        ],
      }));
      return { visitSeq: seq, merged: false };
    },
    [db, state.center, state.user],
  );

  const confirmService = useCallback(
    (beneficiaryId: string, exception?: { reason: string; note: string }) => {
      setDb((d) => ({
        ...d,
        services: [
          ...d.services,
          {
            id: uuid(),
            beneficiaryId,
            project: state.project!,
            center: state.center!,
            servedAt: new Date().toISOString(),
            servedBy: state.user?.fullName ?? "",
            source: "POINT",
            exception: Boolean(exception),
          },
        ],
      }));
    },
    [state.center, state.project, state.user],
  );

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      ready,
      online,
      db,
      setCenter,
      login,
      logout,
      setProject,
      registerBeneficiary,
      registerVisit,
      confirmService,
    }),
    [state, ready, online, db, setCenter, login, logout, setProject, registerBeneficiary, registerVisit, confirmService],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
