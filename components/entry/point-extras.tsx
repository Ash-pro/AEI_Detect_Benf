"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarDays, CalendarX2, CheckCircle2, Info, RotateCcw, Stethoscope, TriangleAlert, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { IdTypeTag } from "./id-fields";
import { useStore } from "@/lib/store";
import { projectName, userName } from "@/lib/queries";
import { projectColor, projectSoft } from "@/lib/project-colors";
import { lastNumber, projectQueue, type QueueItem } from "@/lib/queue";
import {
  apptStatus,
  apptWhen,
  daysBetween,
  deferDays,
  doctorProjects,
  doctorReferrals,
  openAppointments,
  workday,
} from "@/lib/appointments";
import type { CenterCode, Db, Entry, IdType, SessionUser } from "@/lib/types";
import { addDays, cn, dayFull, todayKey, weekday } from "@/lib/utils";

/* ===== أسباب عدم الدخول في تطبيق الممول ===== */
const REASONS = ["مستلمة هذا الشهر من شريك آخر", "التطبيق رفضها لسبب آخر", "عطل في تطبيق بت"];

/* ===== قسم الإجراءات الإضافية في شاشة النقطة ===== */

export function PointExtras({
  db,
  user,
  center,
  nid,
  reception,
  canDefer,
  onNoDonor,
  onDoctor,
}: {
  db: Db;
  user: SessionUser;
  center: CenterCode;
  nid: string;
  /** إدخال استقبال اليوم في هذا المركز */
  reception?: Entry;
  /** يمكن الخدمة بدون بت الآن (مشروع مفعّل ولم يُخدم اليوم) */
  canDefer: boolean;
  onNoDonor: () => void;
  onDoctor: () => void;
}) {
  const [cancel, setCancel] = useState<{ entry: Entry; project: string } | null>(null);
  const today = todayKey();
  const doctors = doctorProjects(db, center);
  const refs = doctorReferrals(reception);
  const appts = openAppointments(db, nid, center, user.projects);
  const servedBy = (project: string) =>
    db.entries.some((e) => e.kind === "POINT" && e.nid === nid && e.date === today && e.center === center && e.projects.includes(project));

  if (!doctors.length && !canDefer && !refs.length && !appts.length) return null;

  return (
    <div className="space-y-2.5">
      {/* مواعيد الحالة في مشاريعي */}
      {appts.map((a) => {
        const s = apptStatus(a, today);
        return (
          <div
            key={a.id}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold",
              s === "today" ? "bg-ok-soft text-ok" : s === "missed" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn",
            )}
          >
            {s === "missed" ? <CalendarX2 className="size-5 shrink-0" /> : <CalendarClock className="size-5 shrink-0" />}
            <span className="flex-1">
              {apptWhen(a, today)} في {projectName(db, a.project)} · <span className="num">{dayFull(a.due)}</span>
              {a.attempt > 1 && <span className="font-normal"> · المحاولة {a.attempt}</span>}
              <span className="block text-xs font-normal opacity-90">خُدمت سابقاً بدون تطبيق بت. أي خدمة لها اليوم تغلق هذا الموعد.</span>
            </span>
          </div>
        );
      })}

      {/* تحويلات الطبيب لهذه الحالة اليوم */}
      {refs.map((r) => {
        const mine = r.by === user.id;
        const done = servedBy(r.project);
        const c = projectColor(db, r.project);
        return (
          <div key={r.project} className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: c, background: projectSoft(c) }}>
            <Stethoscope className="size-5 shrink-0" style={{ color: c }} />
            <span className="min-w-0 flex-1">
              <span className="font-bold" style={{ color: c }}>
                محوّلة لـ {projectName(db, r.project)}
              </span>
              {r.number ? <span className="num ms-1.5 rounded bg-surface px-1.5 text-xs font-bold">دور {r.number}</span> : null}
              <span className="block text-xs text-muted">
                {mine ? "حوّلتها أنت" : `حوّلها ${userName(db, r.by)}`}
                {r.from ? ` من ${projectName(db, r.from)}` : ""}
                {r.note ? ` · ${r.note}` : ""}
                {done ? " · خدمها الطبيب" : ""}
              </span>
            </span>
            {mine && !done && reception && (
              <Button size="sm" variant="secondary" className="border-bad/30 text-bad hover:bg-bad-soft" onClick={() => setCancel({ entry: reception, project: r.project })}>
                <RotateCcw className="size-4" />
                إلغاء التحويل
              </Button>
            )}
          </div>
        );
      })}

      {(canDefer || doctors.length > 0) && (
        <div className={cn("grid gap-2", canDefer && doctors.length > 0 && "sm:grid-cols-2")}>
          {canDefer && (
            <button
              type="button"
              onClick={onNoDonor}
              className="focus-ring flex min-h-14 items-center gap-3 rounded-xl border-2 border-warn/40 bg-warn-soft/50 px-4 py-2.5 text-start transition hover:border-warn hover:bg-warn-soft"
            >
              <CalendarClock className="size-6 shrink-0 text-warn" />
              <span>
                <span className="block font-bold text-warn">خدمة بدون بت + موعد</span>
                <span className="block text-xs text-muted">لم تدخل تطبيق الممول: تُسجَّل مخدومة ويُحجز موعد</span>
              </span>
            </button>
          )}
          {doctors.length > 0 && (
            <button
              type="button"
              onClick={onDoctor}
              className="focus-ring flex min-h-14 items-center gap-3 rounded-xl border-2 border-info/30 bg-info-soft/50 px-4 py-2.5 text-start transition hover:border-info hover:bg-info-soft"
            >
              <Stethoscope className="size-6 shrink-0 text-info" />
              <span>
                <span className="block font-bold text-info">تحويل لطبيب</span>
                <span className="block text-xs text-muted">إضافي: لا يلغي تحويلها لمشروعك</span>
              </span>
            </button>
          )}
        </div>
      )}

      <CancelReferralDialog value={cancel} onClose={() => setCancel(null)} />
    </div>
  );
}

/* ===== خدمة بدون تطبيق الممول + موعد ===== */

export function NoDonorDialog({
  open,
  onClose,
  nid,
  name,
  type,
  projects,
  defaultProject,
  queueRef,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  nid: string;
  name?: string;
  type?: IdType;
  /** المشاريع المفعّل لها الخيار ولم تُخدم فيها الحالة اليوم */
  projects: string[];
  defaultProject?: string;
  queueRef: QueueItem | null;
  onDone: (r: { entryId: string; project: string; due: string; attempt: number }) => void;
}) {
  const { db, center, serveWithoutDonor } = useStore();
  const today = todayKey();
  const [project, setProject] = useState(projects[0] ?? "");
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const days = deferDays(db, project);
  useEffect(() => {
    if (!open) return;
    const p = defaultProject && projects.includes(defaultProject) ? defaultProject : projects[0] ?? "";
    setProject(p);
    setReason(REASONS[0]);
    setNote("");
    setDue(workday(addDays(today, deferDays(db, p))));
    setErr("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const b = db.beneficiaries[nid];
  const last = useMemo(
    () =>
      [...db.entries]
        .filter((e) => e.kind === "POINT" && e.nid === nid && e.projects.includes(project) && e.date < today)
        .sort((a, x) => x.at.localeCompare(a.at))[0],
    [db.entries, nid, project, today],
  );
  const openAppt = center ? openAppointments(db, nid, center, [project])[0] : undefined;
  const nextMonth = workday(`${addDays(`${today.slice(0, 7)}-28`, 5).slice(0, 7)}-01`);
  const quick = [
    { label: `بعد ${days === 14 ? "أسبوعين" : `${days} يوماً`}`, day: workday(addDays(today, days)) },
    { label: "بعد 3 أسابيع", day: workday(addDays(today, 21)) },
    { label: "أول الشهر القادم", day: nextMonth },
  ].filter((q, i, arr) => arr.findIndex((x) => x.day === q.day) === i);
  const isFriday = due && new Date(`${due}T12:00:00Z`).getUTCDay() === 5;
  const valid = Boolean(project) && due > today && daysBetween(today, due) <= 90 && !isFriday;

  async function confirm() {
    if (!valid || busy) return;
    setBusy(true);
    setErr("");
    const r = await serveWithoutDonor({
      nid,
      project,
      due,
      reason: [reason, note.trim()].filter(Boolean).join(" — "),
      name,
      type,
      queueRef: queueRef && queueRef.project === project ? queueRef.reception.id : undefined,
    });
    setBusy(false);
    if (r.error || !r.entryId) return setErr(r.error ?? "تعذّر الإدخال");
    onDone({ entryId: r.entryId, project, due: r.due ?? due, attempt: r.attempt ?? 1 });
  }

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      size="lg"
      title="خدمة بدون تطبيق بت + موعد"
      description="الحالة لم تدخل تطبيق الممول: تُسجَّل مخدومة في المشروع، ويُحجز لها موعد لتستلم فيه"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>
            خروج
          </Button>
          <Button size="lg" className="bg-warn text-white hover:bg-warn/90 sm:min-w-[220px]" disabled={!valid} loading={busy} loadingText="جارٍ الحفظ…" onClick={confirm}>
            <CalendarClock className="size-5" />
            تأكيد وحجز الموعد
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* الحالة */}
        <div className="flex items-center gap-3 rounded-2xl border border-line p-3.5">
          {queueRef && queueRef.project === project ? (
            <span className="num grid size-12 shrink-0 place-items-center rounded-xl text-xl font-bold text-white" style={{ background: projectColor(db, project) }}>
              {queueRef.number}
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-bold">{b?.name || name || "حالة جديدة"}</span>
              <IdTypeTag type={b?.type ?? type} />
            </span>
            <span className="num text-sm font-semibold tracking-wider text-muted">{nid}</span>
          </span>
        </div>

        {projects.length > 1 && (
          <div>
            <Label>المشروع</Label>
            <div className="grid grid-cols-2 gap-2">
              {projects.map((p) => {
                const on = p === project;
                const c = projectColor(db, p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setProject(p);
                      setDue(workday(addDays(today, deferDays(db, p))));
                    }}
                    aria-pressed={on}
                    className={cn("focus-ring min-h-11 rounded-xl border-2 px-3 text-start font-bold", !on && "border-line")}
                    style={on ? { borderColor: c, background: projectSoft(c), color: c } : undefined}
                  >
                    {projectName(db, p)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* معلومات مساعدة */}
        <div className="space-y-2 text-sm">
          {last && (
            <p className="flex items-center gap-2 text-muted">
              <Info className="size-4 shrink-0" />
              آخر خدمة {projectName(db, project)} عندنا: <b className="num text-ink">{dayFull(last.date)}</b> (قبل {daysBetween(last.date, today)} يوماً)
              {last.noDonor ? " · كانت بدون بت" : ""}
            </p>
          )}
          {openAppt && (
            <p className={cn("flex items-center gap-2 font-semibold", apptStatus(openAppt, today) === "missed" ? "text-bad" : "text-warn")}>
              <CalendarDays className="size-4 shrink-0" />
              {apptWhen(openAppt, today)} ({dayFull(openAppt.due)}). سيُغلق ويُحجز موعد جديد — المحاولة {openAppt.attempt + 1}
            </p>
          )}
        </div>

        {/* السبب */}
        <div>
          <Label>السبب</Label>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                aria-pressed={reason === r}
                className={cn(
                  "focus-ring min-h-10 rounded-xl border px-3 text-sm font-bold transition",
                  reason === r ? "border-warn bg-warn-soft text-warn" : "border-line hover:border-muted/40",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <Textarea className="mt-2" rows={2} placeholder="ملاحظة (اختياري)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {/* الموعد */}
        <div>
          <Label htmlFor="nd-due">موعد العودة</Label>
          <div className="mb-2 flex flex-wrap gap-2">
            {quick.map((q) => (
              <button
                key={q.day}
                type="button"
                onClick={() => setDue(q.day)}
                aria-pressed={due === q.day}
                className={cn(
                  "focus-ring min-h-11 rounded-xl border-2 px-3 text-start transition",
                  due === q.day ? "border-brand bg-brand-soft" : "border-line hover:border-muted/40",
                )}
              >
                <span className={cn("block text-sm font-bold", due === q.day && "text-brand")}>{q.label}</span>
                <span className="num block text-[11px] text-muted">
                  {weekday(q.day)} {dayFull(q.day)}
                </span>
              </button>
            ))}
          </div>
          <input
            id="nd-due"
            type="date"
            lang="en-GB"
            dir="ltr"
            min={addDays(today, 1)}
            max={addDays(today, 90)}
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="num h-11 rounded-xl border border-line bg-surface px-3 text-sm font-bold"
          />
          {due && (
            <p className={cn("mt-1.5 text-sm font-semibold", isFriday ? "text-bad" : "text-muted")}>
              {isFriday ? "يوم الجمعة عطلة، اختر يوماً آخر" : `${weekday(due)} ${dayFull(due)} — بعد ${daysBetween(today, due)} يوماً`}
            </p>
          )}
        </div>

        <p className="flex gap-2 rounded-xl bg-sunken px-4 py-3 text-xs leading-relaxed text-muted">
          <CheckCircle2 className="size-4 shrink-0 text-ok" />
          تظهر للاستقبال وفي سجلها: خُدمت {projectName(db, project)}، مع إشارة &quot;بدون بت&quot; وموعدها. عند عودتها وخدمتها يُغلق الموعد تلقائياً.
        </p>
        <FieldError>{err}</FieldError>
      </div>
    </Dialog>
  );
}

/* ===== تحويل لطبيب ===== */

export function DoctorReferDialog({
  open,
  onClose,
  nid,
  name,
  type,
  from,
  reception,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  nid: string;
  name?: string;
  type?: IdType;
  /** مشروع النقطة التي تحوّل */
  from?: string;
  reception?: Entry;
  onDone: (r: { project: string; queueNo: number }) => void;
}) {
  const { db, center, referToDoctor } = useStore();
  const [project, setProject] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const doctors = center ? doctorProjects(db, center) : [];

  useEffect(() => {
    if (!open) return;
    const first = doctors.find((d) => !reception?.queue?.[d.code]);
    setProject(first?.code ?? "");
    setNote("");
    setErr("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function confirm() {
    if (!project || busy) return;
    setBusy(true);
    setErr("");
    const r = await referToDoctor({ nid, project, from, note, name, type });
    setBusy(false);
    if (r.error || !r.queueNo) return setErr(r.error ?? "تعذّر التحويل");
    onDone({ project, queueNo: r.queueNo });
  }

  const b = db.beneficiaries[nid];
  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      size="lg"
      title="تحويل لطبيب"
      description="تحويل إضافي: لا يلغي تحويل الحالة لمشروعك ولا خدمتك لها، ولا يُحسب تكراراً"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>
            خروج
          </Button>
          <Button size="lg" className="sm:min-w-[220px]" disabled={!project} loading={busy} loadingText="جارٍ التحويل…" onClick={confirm}>
            <Stethoscope className="size-5" />
            تحويل وإعطاء رقم دور
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold">{b?.name || name || "حالة جديدة"}</span>
          <IdTypeTag type={b?.type ?? type} />
          <span className="num font-semibold tracking-wider text-muted">{nid}</span>
          {from && <span className="ms-auto rounded-md bg-sunken px-2 py-0.5 text-xs font-bold">من {projectName(db, from)}</span>}
        </div>

        <div role="radiogroup" aria-label="الطبيب" className="grid gap-2.5 sm:grid-cols-2">
          {doctors.map((d) => {
            const already = reception?.queue?.[d.code];
            const on = project === d.code;
            const c = projectColor(db, d.code);
            const waiting = center ? projectQueue(db, center, d.code).filter((x) => x.status === "wait").length : 0;
            return (
              <button
                key={d.code}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={Boolean(already)}
                onClick={() => setProject(d.code)}
                className={cn(
                  "focus-ring flex items-center gap-3 rounded-xl border-2 p-3.5 text-start transition disabled:cursor-not-allowed disabled:opacity-60",
                  !on && "border-line hover:border-muted/40",
                )}
                style={on ? { borderColor: c, background: projectSoft(c) } : undefined}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: c }}>
                  <Stethoscope className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold" style={on ? { color: c } : undefined}>
                    {d.name}
                  </span>
                  <span className="num block text-xs text-muted">
                    {already ? `محوّلة اليوم · دور ${already}` : `بانتظار ${waiting} · آخر دور ${center ? lastNumber(db, center, d.code) : 0}`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div>
          <Label htmlFor="dr-note">ملاحظة للطبيب (اختياري)</Label>
          <Textarea id="dr-note" rows={2} placeholder="مثال: وزن منخفض، فقر دم" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <FieldError>{err}</FieldError>
      </div>
    </Dialog>
  );
}

/* ===== تأكيد إلغاء تحويل الطبيب ===== */

function CancelReferralDialog({ value, onClose }: { value: { entry: Entry; project: string } | null; onClose: () => void }) {
  const { db, cancelDoctorReferral } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => setErr(""), [value]);
  if (!value) return null;
  const n = value.entry.queue?.[value.project];

  async function confirm() {
    if (!value || busy) return;
    setBusy(true);
    const e = await cancelDoctorReferral(value.entry.id, value.project);
    setBusy(false);
    if (e) return setErr(e);
    toast(`تم إلغاء التحويل لـ ${projectName(db, value.project)}`, "info");
    onClose();
  }

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title="إلغاء التحويل للطبيب"
      description="هل أنت متأكد من إلغاء تحويل هذه الحالة للطبيب؟"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>
            خروج
          </Button>
          <Button variant="danger" size="lg" onClick={confirm} loading={busy} loadingText="جارٍ الإلغاء…">
            <X className="size-5" />
            متأكد
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="flex gap-2 rounded-xl bg-warn-soft px-4 py-3 text-sm font-semibold text-warn">
          <TriangleAlert className="size-5 shrink-0" />
          تخرج الحالة من قائمة انتظار {projectName(db, value.project)}
          {n ? ` (دور ${n})` : ""}. الرقم لا يُعاد استخدامه.
        </p>
        <FieldError>{err}</FieldError>
      </div>
    </Dialog>
  );
}
