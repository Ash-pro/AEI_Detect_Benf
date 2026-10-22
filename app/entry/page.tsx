"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CircleAlert, FlaskConical, Info, Keyboard, Link2, ListOrdered, Sparkles, Ticket, X } from "lucide-react";
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
import { freshValidId } from "@/lib/mock-data";
import { idTypeLabel, type QueueItem, waitingCount } from "@/lib/queue";
import type { IdType } from "@/lib/types";
import { cn, formatTime, normalizeDigits, todayKey } from "@/lib/utils";

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
  const routing = todayHere ?? receptionToday[0];
  const todayMine = useMemo(
    () => (nid ? db.entries.filter((e) => e.nid === nid && e.date === today && e.userId === u.id) : []),
    [db, nid, today, u.id],
  );

  const stats = staffStats(db, u, c);
  const waiting = useMemo(() => (isPoint ? waitingCount(db, c, u.projects) : 0), [db, c, isPoint, u.projects]);

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
      return src ? src.projects.filter((p) => available.includes(p)) : [];
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
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  function open(id: string, ref: QueueItem | null = queueRef) {
    setNid(id);
    setFormError("");
    setName("");
    setIdType(undefined);
    setShowErr(false);
    setSelected(preselect(id, ref));
  }

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
  const isNew = Boolean(nid) && !beneficiary;
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

  function submit() {
    if (!nid) return;
    if (!store.online) return setFormError("لا يوجد اتصال بالإنترنت. انتظر عودة الاتصال ثم أعد المحاولة");
    if (isNew && (!name.trim() || !idType)) {
      setShowErr(true);
      setFormError(!name.trim() ? "اكتب اسم المستفيد — الاسم الأول يكفي" : "اختر نوع الهوية: أب أو أم أو طفل");
      if (!name.trim()) nameRef.current?.focus();
      return;
    }
    const ref = queueRef && selected.includes(queueRef.project) ? queueRef.reception.id : undefined;
    const r = store.addEntry({ nid, projects: selected, name, type: idType, queueRef: ref });
    if (!r.ok) return setFormError(r.error);
    const done = r.mode === "updated" ? r.entry.projects : selected.filter((p) => !r.skipped.includes(p));
    const names = done.map((p) => projectName(db, p)).join("، ");
    if (isPoint) {
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
  const myPointToday = todayMine.filter((e) => e.kind === "POINT");

  const allDone = isPoint && u.projects.length > 0 && u.projects.every((p) => pointDoneToday.has(p));

  return (
    <main className={cn("mx-auto space-y-4 px-4 pb-24 pt-5", view === "log" ? "max-w-5xl" : "max-w-3xl")}>
      <ViewTabs view={view} onChange={setView} waiting={waiting} isPoint={isPoint} />

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
      ) : (
      <>
      <div className="flex gap-3 rounded-2xl bg-info-soft px-4 py-3 text-[15px] font-semibold text-info">
        <Info className="mt-0.5 size-5 shrink-0" />
        <p>{hint}</p>
      </div>

      <StatsStrip stats={stats} isPoint={isPoint} waiting={isPoint ? waiting : undefined} onShare={() => { setShareDay(null); setShareOpen(true); }} />

      {lastDone && !nid && <QueueTicket db={db} done={lastDone} onClose={() => setLastDone(null)} />}

      {queueRef && <QueueRefBanner db={db} item={queueRef} nid={nid} onClear={() => { setQueueRef(null); if (nid) setSelected(preselect(nid, null)); }} />}

      <IdInput ref={inputRef} value={raw} onChange={onChange} onEnter={() => (nid ? submit() : raw.length < 9 && setError("رقم الهوية يجب أن يكون 9 أرقام"))} onClear={reset} error={error} />

      {beneficiary && (
        <BeneficiaryCard db={db} beneficiary={beneficiary} history={history} status={status} onEdit={() => setEditOpen(true)} />
      )}

      {nid && (
        <Card className="animate-fade-up space-y-5 p-5">
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

          {isPoint && <RoutingPanel reception={routing} user={u} center={c} onFix={() => setRoutingOpen(true)} />}

          <fieldset>
            <legend className="mb-2.5 text-sm font-bold">
              {isPoint ? "إدخال الخدمة في" : "التحويل إلى"}
              {!isPoint && <span className="ms-2 font-normal text-muted">يمكن اختيار أكثر من مشروع</span>}
            </legend>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {projects.map((p) => {
                const doneAt = isPoint ? pointDoneToday.get(p.code) : undefined;
                return (
                  <CheckBox
                    key={p.code}
                    checked={selected.includes(p.code)}
                    disabled={Boolean(doneAt)}
                    sub={doneAt ? `أُدخلت اليوم ${formatTime(doneAt)}` : undefined}
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

          <FieldError>{formError}</FieldError>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" size="lg" onClick={reset}>
              إلغاء
            </Button>
            <Button size="xl" className="w-full sm:flex-1" disabled={!selected.length} onClick={submit}>
              {!isPoint && todayHere ? "تحديث إدخال اليوم" : isPoint ? "إدخال الخدمة" : "إدخال"}
            </Button>
          </div>
        </Card>
      )}

      {!nid && !raw && <TestPanel onPick={(id) => onChange(id)} />}
      </>
      )}

      {isPoint && view === "entry" && (
        <button
          onClick={() => setView("queue")}
          className="focus-ring fixed end-0 top-[58%] z-30 flex w-[52px] -translate-y-1/2 flex-col items-center gap-1 rounded-s-2xl bg-ink py-3 text-[11px] font-bold leading-tight text-surface shadow-pop active:scale-[0.97] lg:hidden"
          aria-label={`قائمة الانتظار، ${waiting} بانتظار الخدمة`}
        >
          <ListOrdered className="size-5" />
          الانتظار
          <span className={cn("num min-w-7 rounded-full px-1.5 text-sm leading-6", waiting ? "bg-warn text-white" : "bg-surface/20")}>{waiting}</span>
        </button>
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
          reception={routing}
          projects={allHere}
          myEntries={myPointToday}
          onDone={(list) => {
            setRoutingOpen(false);
            const n = list.map((p) => projectName(db, p)).join("، ");
            toast(`تم تعديل التوجيه إلى ${n} — وجّه المستفيد إلى نقطة ${n} برقم دوره الجديد`);
            setQueueRef(null);
            // بعد التصحيح: لا خدمة محددة إلا إذا بقيت الحالة محوّلة لمشروعي
            setSelected(list.some((p) => u.projects.includes(p)) ? projects.map((p) => p.code).filter((p) => list.includes(p) && !pointDoneToday.has(p)) : []);
          }}
        />
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

type View = "entry" | "queue" | "log";

/** تبويبات الموظف: إدخال هوية / قائمة الانتظار (النقطة) / سجل الإدخالات */
function ViewTabs({ view, onChange, waiting, isPoint }: { view: View; onChange: (v: View) => void; waiting: number; isPoint: boolean }) {
  const tabs = [
    { value: "entry" as const, label: "إدخال هوية", short: "إدخال", icon: Keyboard },
    ...(isPoint ? [{ value: "queue" as const, label: "قائمة الانتظار", short: "الانتظار", icon: ListOrdered }] : []),
    { value: "log" as const, label: "سجل الإدخالات", short: "السجل", icon: CalendarDays },
  ];
  return (
    <div
      role="tablist"
      aria-label="طريقة العمل"
      className={cn("mx-auto grid max-w-3xl gap-1 rounded-2xl border border-line bg-surface p-1 shadow-card", isPoint ? "grid-cols-3" : "grid-cols-2")}
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={view === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "focus-ring flex h-12 items-center justify-center gap-1.5 rounded-xl px-1 text-[15px] font-bold transition sm:gap-2",
            view === t.value ? "bg-brand text-brand-ink shadow-card" : "text-muted hover:bg-sunken hover:text-ink",
          )}
        >
          <t.icon className="size-5 shrink-0" />
          <span className={isPoint ? "hidden sm:inline" : ""}>{t.label}</span>
          {isPoint && <span className="sm:hidden">{t.short}</span>}
          {t.value === "queue" && (
            <span
              className={cn(
                "num min-w-6 rounded-full px-1.5 text-xs leading-5",
                view === "queue" ? "bg-surface/25" : waiting ? "bg-warn text-white" : "bg-sunken text-ink",
              )}
            >
              {waiting}
            </span>
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
          <div key={p} className="flex items-center gap-3 rounded-xl bg-surface px-3.5 py-2 shadow-sm">
            <span className="text-sm font-bold">{projectName(db, p)}</span>
            <span className="text-xs text-muted">الدور</span>
            <span className="num text-2xl font-bold leading-none text-ok">{done.queue[p] ?? "—"}</span>
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
    <section className="animate-fade-up rounded-2xl border-2 border-brand/30 bg-brand-soft px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="num grid size-12 shrink-0 place-items-center rounded-xl bg-brand text-xl font-bold text-brand-ink">{item.number}</span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-brand">تخدم الآن من قائمة الانتظار · {projectName(db, item.project)}</div>
          <div className="truncate font-bold">
            {b?.name || item.reception.nid} {b?.type && <span className="font-semibold text-muted">({idTypeLabel(b.type)})</span>}
          </div>
        </div>
        <button onClick={onClear} className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-muted hover:bg-surface/70">
          <X className="size-4" />
          إلغاء الربط
        </button>
      </div>
      <p className="mt-2 flex gap-1.5 text-xs text-ink/75">
        <Link2 className="mt-0.5 size-3.5 shrink-0" />
        {other
          ? `ستُسجّل الخدمة بهوية ${nid} على دور ${b?.name || item.reception.nid}.`
          : "إذا خدمت أحد الأطفال، اكتب هوية الطفل مكان هوية ولي الأمر ويبقى الدور مربوطاً."}
      </p>
    </section>
  );
}

function StatusLine({ tone, icon, children }: { tone: "ok" | "info" | "muted"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex gap-2.5 border-t border-line px-5 py-3 text-sm font-semibold",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "info" && "bg-info-soft text-info",
        tone === "muted" && "bg-sunken text-muted",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  );
}

/** أمثلة للاختبار — تُحذف عند ربط قاعدة البيانات */
function TestPanel({ onPick }: { onPick: (id: string) => void }) {
  const { db, center, user } = useStore();
  const today = todayKey();
  const items = useMemo(() => {
    const here = db.entries.filter((e) => e.center === center);
    const list: { id: string; label: string }[] = [];
    const returning = center === "KHY" ? "401234562" : here.find((e) => e.kind === "RECEPTION" && e.date !== today)?.nid;
    if (returning) list.push({ id: returning, label: "حالة مسجلة لها سجل زيارات" });
    list.push({ id: "403300117", label: "آخر زيارة منذ شهر" });
    if (user?.role === "POINT") {
      const servedIds = new Set(db.entries.filter((e) => e.kind === "POINT" && e.date === today).map((e) => e.nid));
      const referred = here.find((e) => e.kind === "RECEPTION" && e.date === today && e.projects.some((p) => user.projects.includes(p)) && !servedIds.has(e.nid));
      if (referred) list.push({ id: referred.nid, label: "مرّت على الاستقبال اليوم ولم تُخدم" });
      const served = here.find((e) => e.kind === "POINT" && e.date === today && user.projects.includes(e.projects[0]));
      if (served) list.push({ id: served.nid, label: "أُدخلت اليوم في مشروعك" });
    } else {
      const t = here.find((e) => e.kind === "RECEPTION" && e.date === today);
      if (t) list.push({ id: t.nid, label: "أُدخلت اليوم في الاستقبال" });
    }
    list.push({ id: freshValidId(db), label: "هوية جديدة غير مسجلة" });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center, user]);

  return (
    <section className="rounded-2xl border border-dashed border-line p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted">
        <FlaskConical className="size-4" />
        أمثلة للاختبار — للعرض فقط
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((d) => (
          <button
            key={d.id + d.label}
            onClick={() => onPick(d.id)}
            className="focus-ring flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5 text-start text-sm shadow-card hover:bg-sunken"
          >
            <span className="num w-[86px] shrink-0 font-semibold">{d.id}</span>
            <span className="truncate text-muted">{d.label}</span>
          </button>
        ))}
      </div>
    </section>
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
