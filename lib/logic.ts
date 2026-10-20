import type {
  Beneficiary,
  CenterCode,
  Db,
  Enrollment,
  PointStatus,
  ProjectCode,
  Restriction,
  ServiceRecord,
  Visit,
} from "./types";
import { dateKey, isToday } from "./utils";
import { COUNTER_BASELINE } from "./mock-data";

/* منطق العرض فقط (للتصميم). المنطق الحقيقي سيكون في دوال Postgres */

const SEVERITY: Record<Restriction["level"], number> = {
  BLOCKED: 4,
  TEMPORARILY_BLOCKED: 3,
  REVIEW_REQUIRED: 2,
  WARNING: 1,
};

export function findByNid(db: Db, nid: string): Beneficiary | undefined {
  return db.beneficiaries.find((b) => b.nationalId === nid);
}

export function activeRestriction(db: Db, bid: string): Restriction | undefined {
  const now = Date.now();
  return db.restrictions
    .filter((r) => r.beneficiaryId === bid && (!r.endsAt || new Date(r.endsAt).getTime() > now))
    .sort((a, b) => SEVERITY[b.level] - SEVERITY[a.level])[0];
}

export function isBlocking(r?: Restriction) {
  return r?.level === "BLOCKED" || r?.level === "TEMPORARILY_BLOCKED";
}

export function visitsOf(db: Db, bid: string): Visit[] {
  return db.visits.filter((v) => v.beneficiaryId === bid).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function servicesOf(db: Db, bid: string): ServiceRecord[] {
  return db.services.filter((s) => s.beneficiaryId === bid).sort((a, b) => b.servedAt.localeCompare(a.servedAt));
}

export interface EnrollmentView extends Enrollment {
  serviceCount: number;
  lastService?: string;
}

export interface ReceptionView {
  beneficiary: Beneficiary;
  restriction?: Restriction;
  enrollments: EnrollmentView[];
  visits: Visit[];
  totalVisits: number;
  lastVisit?: Visit;
  todayVisitHere?: Visit;
  todayVisitElsewhere?: Visit;
  isOtherCenter: boolean;
  household: Beneficiary[];
  servedKeys: Set<string>; // `${visitDate}|${project}`
}

export function receptionView(db: Db, b: Beneficiary, center: CenterCode): ReceptionView {
  const visits = visitsOf(db, b.id);
  const services = servicesOf(db, b.id);
  const order: Record<Enrollment["status"], number> = { ACTIVE: 0, PENDING_APPROVAL: 1, CLOSED: 2 };
  const enrollments = db.enrollments
    .filter((e) => e.beneficiaryId === b.id)
    .map((e) => {
      const s = services.filter((x) => x.project === e.project);
      return { ...e, serviceCount: s.length, lastService: s[0]?.servedAt };
    })
    .sort((a, b2) => {
      const here = Number(b2.center === center) - Number(a.center === center);
      return order[a.status] - order[b2.status] || here;
    });
  const todayVisits = visits.filter((v) => isToday(v.occurredAt));
  const servedKeys = new Set(services.map((s) => `${dateKey(s.servedAt)}|${s.project}`));
  return {
    beneficiary: b,
    restriction: activeRestriction(db, b.id),
    enrollments,
    visits,
    totalVisits: visits.length,
    lastVisit: visits[0],
    todayVisitHere: todayVisits.find((v) => v.center === center),
    todayVisitElsewhere: todayVisits.find((v) => v.center !== center),
    isOtherCenter: b.homeCenter !== center && !enrollments.some((e) => e.center === center && e.status !== "CLOSED"),
    household: b.householdId
      ? db.beneficiaries.filter((x) => x.householdId === b.householdId && x.id !== b.id)
      : [],
    servedKeys,
  };
}

export function wasServed(view: ReceptionView, visit: Visit, project: ProjectCode) {
  return view.servedKeys.has(`${dateKey(visit.occurredAt)}|${project}`);
}

export interface PointView {
  status: PointStatus;
  beneficiary?: Beneficiary;
  restriction?: Restriction;
  enrollment?: Enrollment;
  visitToday?: Visit;
  service?: ServiceRecord;
  lastService?: ServiceRecord;
  serviceCount: number;
}

export function pointView(db: Db, nid: string, center: CenterCode, project: ProjectCode): PointView {
  const b = findByNid(db, nid);
  if (!b) return { status: "P7_UNKNOWN", serviceCount: 0 };

  const restriction = activeRestriction(db, b.id);
  const services = servicesOf(db, b.id).filter((s) => s.project === project);
  const base = { beneficiary: b, restriction, lastService: services[0], serviceCount: services.length };

  if (isBlocking(restriction)) return { ...base, status: "P10_BLOCKED" };

  const servedToday = services.find((s) => isToday(s.servedAt) && s.center === center);
  if (servedToday) return { ...base, status: "P8_ALREADY_SERVED", service: servedToday };

  const ens = db.enrollments.filter((e) => e.beneficiaryId === b.id && e.project === project);
  const here = ens.find((e) => e.center === center && e.status !== "CLOSED");
  const elsewhere = ens.find((e) => e.center !== center && e.status !== "CLOSED");
  const closed = ens.find((e) => e.status === "CLOSED");

  if (!here && !elsewhere && closed) return { ...base, status: "P9_CLOSED", enrollment: closed };
  if (!here && !elsewhere) return { ...base, status: "P4_WRONG_PROJECT" };
  if (!here && elsewhere) return { ...base, status: "P5_WRONG_CENTER", enrollment: elsewhere };

  const todayVisits = visitsOf(db, b.id).filter((v) => isToday(v.occurredAt));
  const visitHere = todayVisits.find((v) => v.center === center);
  if (!visitHere) {
    if (todayVisits.length) return { ...base, status: "P5_WRONG_CENTER", enrollment: here, visitToday: todayVisits[0] };
    return { ...base, status: "P6_NO_VISIT", enrollment: here };
  }
  if (!visitHere.referrals.includes(project))
    return { ...base, status: "P3_NOT_REFERRED_TODAY", enrollment: here, visitToday: visitHere };

  return {
    ...base,
    status: here!.status === "PENDING_APPROVAL" ? "P2_REFERRED_PENDING" : "P1_REFERRED",
    enrollment: here,
    visitToday: visitHere,
  };
}

export function receptionCounters(db: Db, center: CenterCode) {
  const today = db.visits.filter((v) => v.center === center && isToday(v.occurredAt));
  const b = COUNTER_BASELINE.reception;
  return {
    visits: b.visits + today.length,
    newCases: b.newCases + today.filter((v) => v.kind === "NEW").length,
    referrals: b.referrals + today.reduce((n, v) => n + v.referrals.length, 0),
    served: b.served + db.services.filter((s) => s.center === center && isToday(s.servedAt)).length,
  };
}

export function pointCounters(db: Db, center: CenterCode, project: ProjectCode) {
  const served = db.services.filter((s) => s.center === center && s.project === project && isToday(s.servedAt));
  const servedIds = new Set(served.map((s) => s.beneficiaryId));
  const referred = db.visits.filter(
    (v) => v.center === center && isToday(v.occurredAt) && v.referrals.includes(project),
  );
  const b = COUNTER_BASELINE.point;
  return {
    served: b.served + served.length,
    pending: referred.filter((v) => !servedIds.has(v.beneficiaryId)).length + 5,
    exceptions: b.exceptions + served.filter((s) => s.exception).length,
  };
}
