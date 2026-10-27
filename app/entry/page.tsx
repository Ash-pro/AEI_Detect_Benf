"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, CalendarDays, CheckCircle2, RotateCcw, ChevronDown, CircleAlert, Info, Keyboard, Link2, ListOrdered, Sparkles, Ticket, X } from "lucide-react";
import { AppGate } from "@/components/shell/app-gate";
import { StaffHeader } from "@/components/shell/app-header";
import { IdInput } from "@/components/entry/id-input";
import { BeneficiaryCard } from "@/components/entry/beneficiary-card";
import { EditDialog } from "@/components/entry/edit-dialog";
import { ShareDialog } from "@/components/entry/share-dialog";
import { RoutingDialog, RoutingPanel } from "@/components/entry/routing";
import { StatsStrip } from "@/components/entry/stats-strip";
import { IdFields, IdTypeTag } from "@/components/entry/id-fields";
import { QueueList } from "@/components/entry/queue-list";
import { AppointmentsList } from "@/components/entry/appointments-list";
import { UndoEntryDialog, canUndo } from "@/components/entry/undo-dialog";
import { DoctorReferDialog, NoDonorDialog, PointExtras } from "@/components/entry/point-extras";
import { apptStatus, apptWhen, appointmentOf, deferAllowed, openAppointments } from "@/lib/appointments";
import { dayFull } from "@/lib/utils";
import { DayLog } from "@/components/entry/day-log";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckBox } from "@/components/ui/check";
import { FieldError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import {
  activeProjects,
  lastReception,
  projectName,
  staffShareText,
  staffStats,
  type StaffStats,
  visibleHistory,
} from "@/lib/queries";
import { idTypeLabel, pointQueue, type QueueItem, waitingCount } from "@/lib/queue";
import { projectColor, projectSoft } from "@/lib/project-colors";
import type { Db, Entry, IdType } from "@/lib/types";
import { cn, formatTime, normalizeDigits, storageGet, storageSet, todayKey } from "@/lib/utils";

/** الشاشة 3 — شاشة الإدخال (الاستقبال والنقاط) */
function EntryScreen() {
  const store = useStore();
  const { db, center, user } = store;
  const c = center!;
  const u = user!;
  const isPoint = u.role === "POINT";
  const toast = useToast();

  const inputRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState("");
  const [nid, setNid] = useState("");
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [routingOpen, setRoutingOpen] = useState(false);
  const [noDonorOpen, setNoDonorOpen] = useState(false);
  const [doctorOpen, setDoctorOpen] = useState(false);
  // الحالة الجديدة: الاسم ونوع الهوية
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [idType, setIdType] = useState<IdType>();
  const [showErr, setShowErr] = useState(false);
  // موظف النقطة: إدخال هوية أو قائمة الانتظار
  const [view, setView] = useState<View>("entry");
  const [shareDay, setShareDay] = useState<{ date: string; stats: StaffStats } | null>(null);
  const [queueRef, setQueueRef] = useState<QueueItem | null>(null);
  // الاستقبال: آخر إدخال مع أرقام الدور لتبليغ المستفيد
  const [lastDone, setLastDone] = useState<{ nid: string; name: string; type?: IdType; projects: string[]; queue: Record<string, number>; updated: boolean } | null>(null);

  const today = todayKey();
  // كل مشاريع المركز (للاستقبال ولتعديل التوجيه من النقطة)
  const allHere = useMemo(() => activeProjects(db, c), [db, c]);
  // مربعات الخدمة عند النقطة: مشاريع الموظف فقط
  const projects = useMemo(() => (isPoint ? allHere.filter((p) => u.projects.includes(p.code)) : allHere), [allHere, isPoint, u.projects]);

  const beneficiary = nid ? db.beneficiaries[nid] : undefined;
  const history = useMemo(() => (nid ? visibleHistory(db, nid, u) : []), [db, nid, u]);
  const receptionToday = useMemo(
    () => (nid ? db.entries.filter((e) => e.nid === nid && e.date === today && e.kind === "RECEPTION") : []),
    [db, nid, today],
  );
  const pointDoneToday = useMemo(() => {
    const m = new Map<string, string>();
    if (nid) db.entries.filter((e) => e.nid === nid && e.date === today && e.kind === "POINT").forEach((e) => e.projects.forEach((p) => m.set(p, e.at)));
    return m;
  }, [db, nid, today]);
  const todayHere = receptionToday.find((e) => e.center === c);
  const todayMine = useMemo(
    () => (nid ? db.entries.filter((e) => e.nid === nid && e.date === today && e.userId === u.id) : []),
    [db, nid, today, u.id],
  );

  const stats = staffStats(db, u, c);
  const waiting = useMemo(() => (isPoint ? waitingCount(db, c, u.projects) : 0), [db, c, isPoint, u.projects]);
  // تبويب المواعيد: لموظف نقطة مشروع مفعّل له الخدمة بدون بت في هذا المركز
  const apptCount = useMemo(() => {
    if (!isPoint || !u.projects.some((p) => deferAllowed(db, p, c))) return undefined;
    return db.appointments.filter((a) => a.center === c && u.projects.includes(a.project) && ["today", "missed"].includes(apptStatus(a))).length;
  }, [db, c, isPoint, u.projects]);

  /** المشاريع المحددة مسبقاً */
  const preselect = useCallback(
    (id: string, ref: QueueItem | null = null) => {
      const available = projects.map((p) => p.code);
      if (isPoint) {
        const done = new Set(
          db.entries.filter((e) => e.nid === id && e.date === today && e.kind === "POINT").flatMap((e) => e.projects),
        );
        const own = available.filter((p) => !done.has(p));
        if (ref) return own.includes(ref.project) ? [ref.project] : [];
        // محوّلة لمشروع آخر: لا شيء محدد مسبقاً حتى لا تُدخل خدمة بالخطأ
        const rt = db.entries.filter((e) => e.nid === id && e.date === today && e.kind === "RECEPTION");
        if (rt.length && !rt.some((e) => e.projects.some((p) => u.projects.includes(p)))) return [];
        const mineLast = [...db.entries].reverse().find((e) => e.userId === u.id && own.includes(e.projects[0]));
        return own.length ? [mineLast?.projects[0] ?? own[0]] : [];
      }
      const todayEntry = db.entries.find((e) => e.nid === id && e.date === today && e.kind === "RECEPTION" && e.center === c);
      const src = todayEntry ?? lastReception(db, id, c);
      // زيارة سابقة: تحويلات الطبيب من النقاط لا تتكرر تلقائياً
      return src ? src.projects.filter((p) => available.includes(p) && (src === todayEntry || !src.referrals?.[p])) : [];
    },
    [db, projects, isPoint, today, u.id, u.projects, c],
  );

  const reset = useCallback(() => {
    setRaw("");
    setNid("");
    setError(undefined);
    setSelected([]);
    setFormError("");
    setName("");
    setIdType(undefined);
    setShowErr(false);
    setQueueRef(null);
    setChecking(false);
    setLookupError("");
    pending.current = null;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // البحث عن الهوية وسجلها في قاعدة البيانات
  const [checking, setChecking] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const pending = useRef<{ id: string; ref: QueueItem | null } | null>(null);

  function open(id: string, ref: QueueItem | null = queueRef) {
    setNid(id);
    setFormError("");
    setName("");
    setIdType(undefined);
    setShowErr(false);
    setSelected([]);
    setLookupError("");
    setChecking(true);
    pending.current = { id, ref };
    store
      .lookup(id)
      .catch(() => pending.current?.id === id && setLookupError("تعذّر البحث عن الهوية. تأكد من الإنترنت وأعد المحاولة"))
      .finally(() => pending.current?.id === id && setChecking(false));
  }

  // بعد وصول السجل: تحديد المشاريع مسبقاً
  useEffect(() => {
    if (checking || !pending.current || pending.current.id !== nid) return;
    setSelected(preselect(nid, pending.current.ref));
    pending.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, nid]);

  /** اختيار حالة من قائمة الانتظار */
  function pick(item: QueueItem) {
    const ref = item.status === "wait" ? item : null;
    setQueueRef(ref);
    setView("entry");
    setRaw(item.reception.nid);
    setError(undefined);
    open(item.reception.nid, ref);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // الحالة الجديدة: المؤشر ينتقل لحقل الاسم مباشرة
  const isNew = Boolean(nid) && !checking && !lookupError && !beneficiary;
  useEffect(() => {
    if (isNew) requestAnimationFrame(() => nameRef.current?.focus());
  }, [isNew, nid]);

  function onChange(v: string) {
    const d = normalizeDigits(v).slice(0, 9);
    setRaw(d);
    setError(undefined);
    if (nid) {
      setNid("");
      setSelected([]);
    }
    if (d.length === 9) {
      setLastDone(null);
      open(d);
    }
  }

  const [busy, setBusy] = useState(false);
  /* آخر حالة أدخلها موظف النقطة — للتراجع السريع */
  const [lastServedId, setLastServedId] = useState<string | null>(null);
  const [undo, setUndo] = useState<Entry | null>(null);
  const lastServed = lastServedId ? db.entries.find((e) => e.id === lastServedId) : undefined;

  async function submit() {
    if (!nid || busy) return;
    if (!store.online) return setFormError("لا يوجد اتصال بالإنترنت. انتظر عودة الاتصال ثم أعد المحاولة");
    if (isNew && (!name.trim() || !idType)) {
      setShowErr(true);
      setFormError(!name.trim() ? "اكتب اسم المستفيد — الاسم الأول يكفي" : "اختر نوع الهوية: أب أو أم أو طفل");
      if (!name.trim()) nameRef.current?.focus();
      return;
    }
    const ref = queueRef && selected.includes(queueRef.project) ? queueRef.reception.id : undefined;
    setBusy(true);
    const r = await store.addEntry({ nid, projects: selected, name, type: idType, queueRef: ref });
    setBusy(false);
    if (!r.ok) return setFormError(r.error);
    const done = r.mode === "updated" ? r.entry.projects : selected.filter((p) => !r.skipped.includes(p));
    const names = done.map((p) => projectName(db, p)).join("، ");
    if (isPoint) {
      setLastServedId(r.entry.id);
      toast(`تم إدخال الخدمة${queueRef ? ` — الدور ${queueRef.number}` : ""} — ${names}`);
      const back = Boolean(queueRef);
      reset();
      if (back) setView("queue");
      return;
    }
    toast(r.mode === "updated" ? `تم تحديث إدخال اليوم — ${names}` : `تم الإدخال${r.isNew ? " (حالة جديدة)" : ""} — ${names}`);
    setLastDone({
      nid,
      name: beneficiary?.name || name.trim(),
      type: beneficiary?.type ?? idType,
      projects: r.entry.projects,
      queue: r.entry.queue ?? {},
      updated: r.mode === "updated",
    });
    reset();
  }

  const hint = isPoint ? db.settings.hintPoint : db.settings.hintReception;

  /* رسالة الحالة تحت البطاقة */
  let status: React.ReactNode = null;
  if (nid && !isPoint && todayHere) {
    status = (
      <StatusLine tone="info" icon={<Info className="size-5" />}>
        أُدخلت اليوم الساعة <span className="num">{formatTime(todayHere.at)}</span>. الضغط على "إدخال" يحدّث مشاريع نفس الإدخال ولا يُحسب حالة جديدة.
      </StatusLine>
    );
  }
  // الاستقبال: مواعيد الخدمة بدون تطبيق الممول في هذا المركز
  const receptionAppts = nid && !isPoint ? openAppointments(db, nid, c) : [];
  if (receptionAppts.length) {
    status = (
      <>
        {status}
        {receptionAppts.map((a) => {
          const s = apptStatus(a);
          return (
            <StatusLine key={a.id} tone={s === "today" ? "ok" : s === "missed" ? "bad" : "warn"} icon={<CalendarDays className="size-5" />}>
              {apptWhen(a)} في {projectName(db, a.project)} (<span className="num">{dayFull(a.due)}</span>) — خُدمت سابقاً بدون تطبيق بت
              {s === "upcoming" ? ". يمكن تحويلها، والقرار للمشروع" : ""}
            </StatusLine>
          );
        })}
      </>
    );
  }
  const myPointToday = todayMine.filter((e) => e.kind === "POINT");

  const allDone = isPoint && u.projects.length > 0 && u.projects.every((p) => pointDoneToday.has(p));
  // مشاريعي التي تسمح بالخدمة بدون تطبيق الممول هنا ولم تُخدم فيها الحالة اليوم
  const deferProjects = isPoint ? projects.map((p) => p.code).filter((p) => deferAllowed(db, p, c) && !pointDoneToday.has(p)) : [];
  // مشروع النقطة الذي يحوّل للطبيب
  const referFrom = queueRef?.project ?? selected.find((p) => u.projects.includes(p)) ?? u.projects[0];
  /** الحالة الجديدة تحتاج الاسم والنوع قبل أي إجراء */
  const needIdentity = () => {
    if (!isNew || (name.trim() && idType)) return false;
    setShowErr(true);
    setFormError(!name.trim() ? "اكتب اسم المستفيد — الاسم الأول يكفي" : "اختر نوع الهوية: أب أو أم أو طفل");
    if (!name.trim()) nameRef.current?.focus();
    return true;
  };

  const cardEl =
    beneficiary && !checking ? (
      <BeneficiaryCard db={db} beneficiary={beneficiary} history={history} status={status} onEdit={() => setEditOpen(true)} />
    ) : null;

  return (
    <main className={cn("mx-auto space-y-4 px-4 pb-24 pt-5", view === "log" ? "max-w-5xl" : "max-w-3xl")}>
      <UndoEntryDialog
        entry={undo}
        onClose={() => setUndo(null)}
        onDone={(e) => {
          if (e.id === lastServedId) setLastServedId(null);
          if (nid === e.nid) setSelected(preselect(nid, queueRef));
        }}
      />
      <div className="sticky top-[70px] z-30 -mx-4 bg-bg/90 px-4 pb-2 pt-1 backdrop-blur">
        <ViewTabs view={view} onChange={setView} waiting={waiting} isPoint={isPoint} appts={apptCount} />
      </div>

      {isPoint && view !== "log" && canUndo(lastServed, u.id) && (
        <LastServedBanner
          db={db}
          entry={lastServed}
          onUndo={() => setUndo(lastServed)}
          onClose={() => setLastServedId(null)}
        />
      )}

      {view === "log" ? (
        <DayLog
          db={db}
          user={u}
          center={c}
          onOpen={(id) => {
            setQueueRef(null);
            setView("entry");
            setRaw(id);
            setError(undefined);
            open(id, null);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onShare={(date, st) => {
            setShareDay({ date, stats: st });
            setShareOpen(true);
          }}
        />
      ) : isPoint && view === "queue" ? (
        <QueueList db={db} user={u} center={c} onPick={pick} />
      ) : view === "appts" && apptCount !== undefined ? (
        <AppointmentsList
          db={db}
          user={u}
          center={c}
          onOpen={(id) => {
            setQueueRef(null);
            setView("entry");
            setRaw(id);
            setError(undefined);
            open(id, null);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      ) : (
      <>
      {lastDone && !nid && <QueueTicket db={db} done={lastDone} onClose={() => setLastDone(null)} />}

      {queueRef && <QueueRefBanner db={db} item={queueRef} nid={nid} onClear={() => { setQueueRef(null); if (nid) setSelected(preselect(nid, null)); }} />}

      {/* حقل الهوية أول عنصر في الشاشة — هو الإجراء الأساسي */}
      <IdInput ref={inputRef} value={raw} onChange={onChange} onEnter={() => (nid ? submit() : raw.length < 9 && setError("رقم الهوية يجب أن يكون 9 أرقام"))} onClear={reset} error={error} loading={Boolean(nid) && checking} />

      {/* أثناء العمل على هوية: إخفاء التلميح والإحصائيات للتركيز على الحالة */}
      {!nid && <StatsStrip stats={stats} isPoint={isPoint} waiting={isPoint ? waiting : undefined} onShare={() => { setShareDay(null); setShareOpen(true); }} />}

      {!nid && <Hint text={hint} storageKey={`aei.hint.${u.role}`} />}

      {nid && checking && <LookupSkeleton />}

      {nid && lookupError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">
          {lookupError}
          <Button size="sm" variant="secondary" onClick={() => open(nid)}>
            إعادة المحاولة
          </Button>
        </div>
      )}

      {/* الاستقبال: بطاقة الهوية أولاً للتحقق. النقطة: التوجيه والخدمة أولاً ثم البطاقة */}
      {!isPoint && cardEl}

      {nid && !checking && !lookupError && (
        <Card
          aria-busy={busy || undefined}
          className={cn("animate-fade-up space-y-5 p-5", busy && "pointer-events-none [&>*:not(:last-child)]:opacity-50 [&>*]:transition-opacity")}
        >
          {isNew && (
            <>
              <div className="flex items-center gap-2.5 rounded-xl bg-warn-soft px-4 py-3 font-bold text-warn">
                <Sparkles className="size-5" />
                حالة جديدة — أول مرة في النظام
              </div>
              <IdFields
                ref={nameRef}
                name={name}
                type={idType}
                showErrors={showErr}
                onName={(v) => {
                  setName(v);
                  setFormError("");
                }}
                onType={(t) => {
                  setIdType(t);
                  setFormError("");
                }}
                onEnter={submit}
              />
              {status}
            </>
          )}

          {isPoint && <RoutingPanel reception={todayHere} user={u} center={c} onFix={() => setRoutingOpen(true)} />}

          <fieldset>
            <legend className="mb-2.5 flex w-full flex-wrap items-baseline gap-x-2 text-sm font-bold">
              <span>{isPoint ? "إدخال الخدمة في:" : "التحويل إلى:"}</span>
              {!isPoint && <span className="text-xs font-normal text-muted">يمكن اختيار أكثر من مشروع</span>}
            </legend>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {projects.map((p) => {
                const doneAt = isPoint ? pointDoneToday.get(p.code) : undefined;
                // الاستقبال: تحويل طبيب أضافته نقطة اليوم — ثابت ولا يُلغى من هنا
                const ref = !isPoint ? todayHere?.referrals?.[p.code] : undefined;
                return (
                  <CheckBox
                    key={p.code}
                    checked={selected.includes(p.code) || Boolean(ref)}
                    disabled={Boolean(doneAt) || Boolean(ref)}
                    sub={
                      doneAt
                        ? `أُدخلت اليوم ${formatTime(doneAt)}`
                        : ref
                          ? `حوّلتها نقطة ${ref.from ? projectName(db, ref.from) : ""} · دور ${todayHere?.queue?.[p.code] ?? ""}`
                          : undefined
                    }
                    onChange={(v) => {
                      setFormError("");
                      setSelected((s) => (v ? [...s, p.code] : s.filter((x) => x !== p.code)));
                    }}
                  >
                    {p.name}
                  </CheckBox>
                );
              })}
            </div>
          </fieldset>

          {allDone && (
            <div className="flex items-center gap-2 rounded-xl bg-bad-soft px-4 py-3 text-sm font-bold text-bad">
              <CircleAlert className="size-5" />
              هذه الحالة أُدخلت اليوم في مشروعك. لا يمكن إدخالها مرة ثانية في نفس المشروع.
            </div>
          )}

          {isPoint &&
            myPointToday
              .filter((e) => canUndo(e, u.id))
              .map((e) => (
                <div key={e.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm">
                  <CheckCircle2 className="size-5 shrink-0 text-ok" />
                  <span className="min-w-0 flex-1">
                    أدخلتها في <b>{e.projects.map((x) => projectName(db, x)).join("، ")}</b> الساعة <span className="num">{formatTime(e.at)}</span>
                    {e.noDonor && (
                      <span className="ms-1.5 rounded bg-warn-soft px-1.5 text-xs font-bold text-warn">
                        بدون بت{appointmentOf(db, e.id) ? ` · موعد ${dayFull(appointmentOf(db, e.id)!.due)}` : ""}
                      </span>
                    )}
                  </span>
                  <Button size="sm" variant="secondary" className="border-bad/30 text-bad hover:bg-bad-soft" onClick={() => setUndo(e)}>
                    <RotateCcw className="size-4" />
                    تراجع عن الإدخال
                  </Button>
                </div>
              ))}

          {isPoint && (
            <PointExtras
              db={db}
              user={u}
              center={c}
              nid={nid}
              reception={todayHere}
              canDefer={deferProjects.length > 0}
              onNoDonor={() => !needIdentity() && setNoDonorOpen(true)}
              onDoctor={() => !needIdentity() && setDoctorOpen(true)}
            />
          )}

          <FieldError>{formError}</FieldError>

          {/* زر الإدخال ثابت أسفل الشاشة على الجوال حتى لا يحتاج الموظف للتمرير */}
          <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex gap-2 rounded-b-2xl border-t border-line bg-surface/95 px-5 py-3 backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:bg-transparent sm:p-0">
            <Button variant="secondary" size="xl" className="px-5" onClick={reset} disabled={busy}>
              إلغاء
            </Button>
            <Button
              size="xl"
              className="flex-1"
              disabled={!selected.length}
              loading={busy}
              loadingText="جارٍ الإدخال…"
              onClick={submit}
            >
              {!isPoint && todayHere ? "تحديث إدخال اليوم" : isPoint ? "إدخال الخدمة" : "إدخال"}
            </Button>
          </div>
        </Card>
      )}

      {isPoint && cardEl}

      </>
      )}


      {beneficiary && (
        <EditDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          beneficiary={beneficiary}
          todayMine={todayMine}
          projects={projects}
          onMoved={(id) => {
            setEditOpen(false);
            setRaw(id);
            open(id);
          }}
        />
      )}

      {isPoint && (
        <RoutingDialog
          open={routingOpen}
          onClose={() => setRoutingOpen(false)}
          nid={nid}
          name={name}
          type={idType}
          reception={todayHere}
          projects={allHere}
          myEntries={myPointToday}
          onDone={(list, queue) => {
            setRoutingOpen(false);
            const n = list.map((p) => `${projectName(db, p)}${queue[p] ? ` (دور ${queue[p]})` : ""}`).join("، ");
            toast(`تم التحويل إلى ${n} — وجّه المستفيد إلى نقطة المشروع`);
            setQueueRef(null);
            // بعد التصحيح: لا خدمة محددة إلا إذا بقيت الحالة محوّلة لمشروعي
            setSelected(list.some((p) => u.projects.includes(p)) ? projects.map((p) => p.code).filter((p) => list.includes(p) && !pointDoneToday.has(p)) : []);
          }}
        />
      )}

      {isPoint && nid && (
        <>
          <NoDonorDialog
            open={noDonorOpen}
            onClose={() => setNoDonorOpen(false)}
            nid={nid}
            name={name}
            type={idType}
            projects={deferProjects}
            defaultProject={queueRef?.project ?? selected.find((p) => deferProjects.includes(p))}
            queueRef={queueRef}
            onDone={(r) => {
              setNoDonorOpen(false);
              setLastServedId(r.entryId);
              toast(`تم — خُدمت ${projectName(db, r.project)} بدون بت · موعدها ${dayFull(r.due)}${r.attempt > 1 ? ` (المحاولة ${r.attempt})` : ""}`);
              const back = Boolean(queueRef);
              reset();
              if (back) setView("queue");
            }}
          />
          <DoctorReferDialog
            open={doctorOpen}
            onClose={() => setDoctorOpen(false)}
            nid={nid}
            name={name}
            type={idType}
            from={referFrom}
            reception={todayHere}
            onDone={(r) => {
              setDoctorOpen(false);
              toast(`تم التحويل لـ ${projectName(db, r.project)} — دور ${r.queueNo}. وجّه المستفيد للطبيب`);
            }}
          />
        </>
      )}

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={shareDay && shareDay.date !== today ? "مشاركة إحصائيات اليوم المختار" : "مشاركة إحصائيات اليوم"}
        text={shareDay ? staffShareText(db, u, c, shareDay.stats, shareDay.date) : staffShareText(db, u, c, stats)}
      />
    </main>
  );
}

type View = "entry" | "queue" | "appts" | "log";

/** تبويبات الموظف: إدخال هوية / قائمة الانتظار (النقطة) / سجل الإدخالات */
function ViewTabs({
  view,
  onChange,
  waiting,
  isPoint,
  appts,
}: {
  view: View;
  onChange: (v: View) => void;
  waiting: number;
  isPoint: boolean;
  /** عدد مواعيد اليوم والفائتة — يظهر التبويب فقط لمشاريع الخدمة بدون بت */
  appts?: number;
}) {
  const tabs: { value: View; label: string; short: string; icon: typeof Keyboard }[] = [
    { value: "entry", label: "إدخال هوية", short: "إدخال", icon: Keyboard },
    ...(isPoint ? [{ value: "queue" as const, label: "قائمة الانتظار", short: "الانتظار", icon: ListOrdered }] : []),
    ...(appts !== undefined ? [{ value: "appts" as const, label: "المواعيد", short: "المواعيد", icon: CalendarClock }] : []),
    { value: "log", label: "سجل الإدخالات", short: "السجل", icon: CalendarDays },
  ];
  return (
    <div
      role="tablist"
      aria-label="طريقة العمل"
      className={cn(
        "mx-auto grid max-w-3xl gap-1 rounded-2xl border border-line bg-surface p-1 shadow-card",
        tabs.length === 4 ? "grid-cols-4" : tabs.length === 3 ? "grid-cols-3" : "grid-cols-2",
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={view === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "focus-ring flex h-12 min-w-0 items-center justify-center gap-1 rounded-xl px-1 font-bold transition sm:gap-2",
            tabs.length === 4 ? "text-sm sm:text-[15px]" : "text-[15px]",
            view === t.value ? "bg-brand text-brand-ink shadow-card" : "text-muted hover:bg-sunken hover:text-ink",
          )}
        >
          <t.icon className={cn("size-5 shrink-0", tabs.length === 4 && "hidden sm:block")} />
          <span className={isPoint ? "hidden sm:inline" : ""}>{t.label}</span>
          {isPoint && <span className="sm:hidden">{t.short}</span>}
          {t.value === "queue" && (
            <span
              className={cn(
                "num min-w-5 shrink-0 rounded-full px-1.5 text-xs leading-5",
                view === "queue" ? "bg-surface/25" : waiting ? "bg-warn text-white" : "bg-sunken text-ink",
              )}
            >
              {waiting}
            </span>
          )}
          {t.value === "appts" && Boolean(appts) && (
            <span className={cn("num min-w-5 shrink-0 rounded-full px-1.5 text-xs leading-5", view === "appts" ? "bg-surface/25" : "bg-warn text-white")}>{appts}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** بعد إدخال الاستقبال: أرقام الدور ليبلّغها الموظف للمستفيد */
function QueueTicket({
  db,
  done,
  onClose,
}: {
  db: Parameters<typeof projectName>[0];
  done: { nid: string; name: string; type?: IdType; projects: string[]; queue: Record<string, number>; updated: boolean };
  onClose: () => void;
}) {
  return (
    <section className="animate-fade-up overflow-hidden rounded-2xl border-2 border-ok/40 bg-ok-soft" aria-live="polite">
      <div className="flex items-start gap-3 px-4 pb-2 pt-3.5">
        <Ticket className="mt-0.5 size-5 shrink-0 text-ok" />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-ok">{done.updated ? "تم تحديث إدخال اليوم" : "تم الإدخال"} — بلّغ المستفيد برقم دوره</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink/80">
            <span className="font-semibold">{done.name}</span>
            <IdTypeTag type={done.type} />
            <span className="num">{done.nid}</span>
          </div>
        </div>
        <button onClick={onClose} aria-label="إغلاق" className="focus-ring grid size-8 place-items-center rounded-lg text-muted hover:bg-surface/70">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2 px-4 pb-4">
        {done.projects.map((p) => (
          <div key={p} className="flex items-center gap-3 rounded-xl border-s-[6px] bg-surface px-3.5 py-2 shadow-sm" style={{ borderInlineStartColor: projectColor(db, p) }}>
            <span className="text-sm font-bold" style={{ color: projectColor(db, p) }}>{projectName(db, p)}</span>
            <span className="text-xs text-muted">الدور</span>
            <span className="num grid min-w-10 place-items-center rounded-lg px-2 py-1 text-2xl font-bold leading-none text-white" style={{ background: projectColor(db, p) }}>{done.queue[p] ?? "—"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** النقطة: الحالة المختارة من قائمة الانتظار */
function QueueRefBanner({ db, item, nid, onClear }: { db: Parameters<typeof projectName>[0]; item: QueueItem; nid: string; onClear: () => void }) {
  const b = db.beneficiaries[item.reception.nid];
  const other = nid && nid !== item.reception.nid;
  return (
    <section
      className="animate-fade-up rounded-2xl border-2 px-4 py-3"
      style={{ borderColor: projectColor(db, item.project), background: projectSoft(projectColor(db, item.project)) }}
    >
      <div className="flex items-center gap-3">
        <span className="num grid size-12 shrink-0 place-items-center rounded-xl text-xl font-bold text-white" style={{ background: projectColor(db, item.project) }}>{item.number}</span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold" style={{ color: projectColor(db, item.project) }}>تخدم الآن من قائمة الانتظار · {projectName(db, item.project)}</div>
          <div className="truncate font-bold">
            {b?.name || item.reception.nid} {b?.type && <span className="font-semibold text-muted">({idTypeLabel(b.type)})</span>}
          </div>
        </div>
        <button onClick={onClear} className="focus-ring inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-black/10 bg-surface/60 px-3 text-sm font-bold text-muted hover:bg-surface">
          <X className="size-4" />
          إلغاء الربط
        </button>
      </div>
      <p className="mt-2 flex gap-1.5 text-xs text-ink/75">
        <Link2 className="mt-0.5 size-3.5 shrink-0" />
        {other
          ? `ستُسجّل الخدمة بهوية ${nid} على دور ${b?.name || item.reception.nid}.`
          : "إذا خدمت شخصاً آخر من نفس الأسرة، اكتب هويته ويبقى الدور مربوطاً."}
      </p>
    </section>
  );
}

/** التلميح: مفتوح في أول استخدام فقط، ثم مطوي بسطر واحد ويُفتح عند الحاجة */
function Hint({ text, storageKey }: { text: string; storageKey: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const saved = storageGet<boolean | null>(storageKey, null);
    if (saved === null) {
      // أول مرة: نعرضه مفتوحاً ونحفظه مطوياً للمرات القادمة
      setOpen(true);
      storageSet(storageKey, false);
    } else setOpen(saved);
  }, [storageKey]);
  if (!text) return null;
  const toggle = () => {
    storageSet(storageKey, !open);
    setOpen(!open);
  };
  return (
    <button
      onClick={toggle}
      aria-expanded={open}
      className="focus-ring flex min-h-11 w-full items-start gap-3 rounded-2xl bg-info-soft px-4 py-2.5 text-start text-sm font-semibold text-info sm:text-[15px]"
    >
      <Info className="mt-0.5 size-5 shrink-0" />
      <span className={cn("flex-1", !open && "truncate")}>{text}</span>
      <ChevronDown className={cn("mt-0.5 size-5 shrink-0 transition", open && "rotate-180")} aria-hidden />
    </button>
  );
}

function StatusLine({ tone, icon, children }: { tone: "ok" | "info" | "muted" | "warn" | "bad"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex gap-2.5 border-t border-line px-5 py-3 text-sm font-semibold",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "info" && "bg-info-soft text-info",
        tone === "muted" && "bg-sunken text-muted",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "bad" && "bg-bad-soft text-bad",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  );
}

export default function EntryPage() {
  return (
    <AppGate area="staff">
      <StaffHeader />
      <EntryScreen />
    </AppGate>
  );
}

/** هيكل مؤقت مكان بطاقة الهوية أثناء البحث */
function LookupSkeleton() {
  return (
    <div role="status" aria-label="جارٍ البحث عن الهوية" className="animate-fade-in rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-4">
        <span className="skeleton size-12 rounded-2xl" />
        <span className="flex-1 space-y-2.5">
          <span className="skeleton block h-4 w-2/5 rounded-md" />
          <span className="skeleton block h-3 w-1/4 rounded-md" />
        </span>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <span className="skeleton block h-12 rounded-xl" />
        <span className="skeleton block h-12 rounded-xl" />
      </div>
    </div>
  );
}

/** شريط بعد إدخال الخدمة: تأكيد ما أُدخل مع زر تراجع */
function LastServedBanner({ db, entry, onUndo, onClose }: { db: Db; entry: Entry; onUndo: () => void; onClose: () => void }) {
  const b = db.beneficiaries[entry.nid];
  const q = pointQueue(db, entry);
  const appt = entry.noDonor ? appointmentOf(db, entry.id) : undefined;
  return (
    <div
      role="status"
      className={cn(
        "flex animate-fade-up items-center gap-3 rounded-2xl border px-4 py-3",
        entry.noDonor ? "border-warn/30 bg-warn-soft" : "border-ok/30 bg-ok-soft",
      )}
    >
      {entry.noDonor ? <CalendarDays className="size-6 shrink-0 text-warn" /> : <CheckCircle2 className="size-6 shrink-0 text-ok" />}
      <span className="min-w-0 flex-1 text-sm">
        <span className={cn("block font-bold", entry.noDonor ? "text-warn" : "text-ok")}>
          {entry.noDonor ? "تم — خدمة بدون بت" : "تم إدخال الحالة"}
          {appt && (
            <span className="num ms-1.5 font-semibold">
              · موعدها {dayFull(appt.due)}
            </span>
          )}
        </span>
        <span className="block truncate text-ink/80">
          {b?.name || entry.nid} · {entry.projects.map((p) => projectName(db, p)).join("، ")}
          {q.number ? <span className="num"> · دور {q.number}</span> : null}
        </span>
      </span>
      <Button size="sm" variant="secondary" className="shrink-0 border-bad/30 text-bad hover:bg-bad-soft" onClick={onUndo}>
        <RotateCcw className="size-4" />
        تراجع
      </Button>
      <button onClick={onClose} aria-label="إخفاء" className="focus-ring grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface">
        <X className="size-4" />
      </button>
    </div>
  );
}
