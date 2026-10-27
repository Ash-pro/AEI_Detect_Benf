import type { Appointment, CenterCode, Db, Entry } from "./types";
import { addDays, todayKey } from "./utils";

/* مشاريع الطبيب + الخدمة بدون تطبيق الممول ومواعيدها */

export const isDoctor = (db: Db, code: string) => Boolean(db.projects.find((p) => p.code === code)?.isDoctor);

/** مشاريع الطبيب المفعّلة في المركز */
export const doctorProjects = (db: Db, center: CenterCode) =>
  [...db.projects].filter((p) => p.isDoctor && p.active && p.centers.includes(center)).sort((a, b) => a.order - b.order);

/** هل الخدمة بدون تطبيق الممول مفعّلة لهذا المشروع في هذا المركز؟ */
export const deferAllowed = (db: Db, code: string, center: CenterCode) =>
  Boolean(db.projects.find((p) => p.code === code)?.deferCenters?.includes(center));

export const deferDays = (db: Db, code: string) => db.projects.find((p) => p.code === code)?.deferDays ?? 14;

/** الجمعة عطلة: الموعد يُنقل لليوم التالي */
export function workday(day: string): string {
  return new Date(`${day}T12:00:00Z`).getUTCDay() === 5 ? addDays(day, 1) : day;
}

/** الفرق بالأيام (b − a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
}

export type ApptStatus = "done" | "today" | "upcoming" | "missed";

export function apptStatus(a: Appointment, today = todayKey()): ApptStatus {
  if (a.doneEntry) return "done";
  if (a.due === today) return "today";
  return a.due > today ? "upcoming" : "missed";
}

/** المواعيد المفتوحة (لم تُخدم بعد) لهوية */
export function openAppointments(db: Db, nid: string, center?: CenterCode, projects?: string[]): Appointment[] {
  return db.appointments
    .filter((a) => a.nid === nid && !a.doneEntry && (!center || a.center === center) && (!projects || projects.includes(a.project)))
    .sort((a, b) => a.due.localeCompare(b.due));
}

/** الموعد الذي حُجز مع خدمة بدون تطبيق الممول */
export const appointmentOf = (db: Db, entryId: string) => db.appointments.find((a) => a.createdEntry === entryId);

/** نص قصير لحالة الموعد بالنسبة لليوم */
export function apptWhen(a: Appointment, today = todayKey()): string {
  const s = apptStatus(a, today);
  if (s === "done") return "حضرت وخُدمت";
  if (s === "today") return "موعدها اليوم";
  const d = Math.abs(daysBetween(today, a.due));
  if (s === "upcoming") return d === 1 ? "موعدها غداً" : `موعدها بعد ${d} أيام`;
  return d === 1 ? "فات موعدها أمس" : `فات موعدها منذ ${d} أيام`;
}

/** تحويلات الطبيب التي أضافتها نقطة على إدخال الاستقبال */
export function doctorReferrals(e: Entry | undefined): { project: string; by: string; from?: string; note?: string; number?: number }[] {
  if (!e?.referrals) return [];
  return Object.entries(e.referrals).map(([project, r]) => ({ project, ...r, number: e.queue?.[project] }));
}
