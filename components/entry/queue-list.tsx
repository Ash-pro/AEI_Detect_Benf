"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, CalendarClock, CheckCircle2, ChevronLeft, Clock, DoorOpen, ListOrdered, PenLine, RotateCcw, Stethoscope, Undo2 } from "lucide-react";
import { appointmentOf } from "@/lib/appointments";
import { UndoEntryDialog, canUndo } from "./undo-dialog";
import { IdTypeTag } from "./id-fields";
import { Card } from "@/components/ui/card";
import { SyncStatus } from "@/components/shell/sync-status";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { projectName, userName } from "@/lib/queries";
import { projectColor } from "@/lib/project-colors";
import { AUTO_LEFT_LABEL, LEAVE_FROM_LABEL, canMarkLeft, leftOpen, projectQueue, type QueueItem } from "@/lib/queue";
import type { CenterCode, Db, Entry, SessionUser } from "@/lib/types";
import { cn, dayFull, formatTime, minutesText, todayKey, weekday } from "@/lib/utils";

type Tab = "wait" | "served" | "left" | "all";

/** قائمة انتظار موظف النقطة: كل الحالات المحوّلة لمشروعه اليوم، مرتبة حسب الدور */
export function QueueList({
  db,
  user,
  center,
  onPick,
}: {
  db: Db;
  user: SessionUser;
  center: CenterCode;
  onPick: (item: QueueItem) => void;
}) {
  const [tab, setTab] = useState<Tab>("wait");
  const [project, setProject] = useState<string>("ALL");
  const [now, setNow] = useState(() => Date.now());
  const [undo, setUndo] = useState<Entry | null>(null);
  const { markLeft, unmarkLeft } = useStore();
  const toast = useToast();
  const [confirmLeft, setConfirmLeft] = useState(false);
  const [busyLeft, setBusyLeft] = useState(false);
  const [busyBack, setBusyBack] = useState<string | null>(null);

  // تحديث مدة الانتظار كل 30 ثانية
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const mine = user.projects;
  // الدقيقة الحالية: حتى يتغير وضع الترحيل (2:20 و 4:00) بدون انتظار أي تحديث للبيانات
  const minute = Math.floor(now / 60_000);
  const all = useMemo(() => {
    const list = mine.flatMap((p) => projectQueue(db, center, p));
    // أكثر من مشروع: ترتيب حسب وقت الاستقبال ثم رقم الدور
    return mine.length > 1 ? list.sort((a, b) => a.reception.at.localeCompare(b.reception.at) || a.number - b.number) : list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, center, mine, minute]);
  // حضرت ولم تُخدم: اليوم (بعد الترحيل) والأيام السابقة — ما لم تُخدم بعد
  const leftAll = useMemo(
    () => leftOpen(db, center, mine),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, center, mine, minute],
  );

  const scoped = project === "ALL" ? all : all.filter((x) => x.project === project);
  const leftScoped = project === "ALL" ? leftAll : leftAll.filter((x) => x.project === project);
  const counts = {
    wait: scoped.filter((x) => x.status === "wait").length,
    served: scoped.filter((x) => x.status === "served" || x.status === "moved").length,
    all: scoped.length,
  };
  const list =
    tab === "all"
      ? scoped
      : tab === "wait"
        ? scoped.filter((x) => x.status === "wait")
        : tab === "left"
          ? leftScoped
          : scoped.filter((x) => x.status === "served" || x.status === "moved");

  const tabs: { value: Tab; label: string; short: string; n: number }[] = [
    { value: "wait", label: "بانتظار", short: "بانتظار", n: counts.wait },
    { value: "served", label: "خُدمت", short: "خُدمت", n: counts.served },
    { value: "left", label: "حضرت ولم تُخدم", short: "لم تُخدم", n: leftScoped.length },
    { value: "all", label: "الكل", short: "الكل", n: counts.all },
  ];

  const allowLeft = canMarkLeft(new Date(now));
  const waitingMine = all.filter((x) => x.status === "wait");
  async function doMarkLeft() {
    setBusyLeft(true);
    const r = await markLeft(mine);
    setBusyLeft(false);
    setConfirmLeft(false);
    if (r.error) return toast(r.error, "bad");
    toast(r.n ? `تم ترحيل ${r.n} ${r.n === 1 ? "حالة" : "حالات"} إلى "حضرت ولم تُخدم"` : "لا توجد حالات بانتظار للترحيل");
    if (r.n) setTab("left");
  }
  async function backToWait(item: QueueItem) {
    const k = item.reception.id + item.project;
    setBusyBack(k);
    const e = await unmarkLeft(item.reception.id, item.project);
    setBusyBack(null);
    toast(e ?? "أُرجعت الحالة إلى قائمة الانتظار", e ? "bad" : "ok");
  }

  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="border-b border-line px-4 pb-3 pt-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex min-w-0 items-center gap-2 text-lg font-bold">
            <ListOrdered className="size-5 shrink-0 text-brand" />
            قائمة الانتظار
            {mine.length === 1 && <span className="truncate text-base font-semibold text-muted">· {projectName(db, mine[0])}</span>}
          </h2>
          {/* آخر تحديث للقائمة + تحديث يدوي */}
          <SyncStatus variant="line" className="-me-2" />
        </div>

        {mine.length > 1 && (
          <div className="scroll-fade -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
            {["ALL", ...mine].map((p) => (
              <button
                key={p}
                onClick={() => setProject(p)}
                aria-pressed={project === p}
                className={cn(
                  "focus-ring min-h-10 shrink-0 whitespace-nowrap rounded-xl border px-3.5 text-sm font-bold",
                  project === p ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-muted hover:text-ink",
                )}
              >
                {p === "ALL" ? "كل مشاريعي" : projectName(db, p)}
              </button>
            ))}
          </div>
        )}

        <div role="tablist" className="mt-3 flex gap-1 rounded-xl bg-sunken p-1">
          {tabs.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "focus-ring flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1 text-sm font-bold transition sm:gap-1.5 sm:px-2",
                tab === t.value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
              )}
            >
              <span className="hidden sm:inline">{t.label}</span>
              <span className="whitespace-nowrap sm:hidden">{t.short}</span>
              <span
                className={cn(
                  "num min-w-6 rounded-full px-1.5 text-xs leading-5",
                  t.value === "wait" && t.n ? "bg-warn text-white" : t.value === "left" && t.n ? "bg-bad text-white" : "bg-line/70 text-ink",
                )}
              >
                {t.n}
              </span>
            </button>
          ))}
        </div>

        {/* ترحيل المتبقين: بعد 2:20 ظهراً، وتلقائي بعد 4:00 عصراً */}
        {tab === "wait" && waitingMine.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5">
            <DoorOpen className="size-5 shrink-0 text-muted" />
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
              {allowLeft
                ? `من غادر قبل خدمته: رحّل المتبقين إلى "حضرت ولم تُخدم" ليُخدموا في يوم آخر. بعد ${AUTO_LEFT_LABEL} يُرحَّلون تلقائياً.`
                : `يتاح ترحيل المتبقين بعد الساعة ${LEAVE_FROM_LABEL}، وبعد ${AUTO_LEFT_LABEL} يُرحَّلون تلقائياً.`}
            </p>
            <Button
              size="sm"
              variant="secondary"
              disabled={!allowLeft}
              onClick={() => setConfirmLeft(true)}
              title={allowLeft ? undefined : `متاح بعد ${LEAVE_FROM_LABEL}`}
              className="border-bad/30 text-bad hover:bg-bad-soft"
            >
              <DoorOpen className="size-4" />
              ترحيل المتبقين <span className="num">({waitingMine.length})</span>
            </Button>
          </div>
        )}
        {tab === "left" && (
          <p className="mt-3 flex gap-2 rounded-xl bg-sunken px-3 py-2.5 text-xs leading-relaxed text-muted">
            <DoorOpen className="size-4 shrink-0" />
            حالات حضرت ولم تُخدم في مشاريعك. اضغط على الحالة لخدمتها عندما تحضر في أي يوم، وتخرج من القائمة تلقائياً بعد خدمتها.
          </p>
        )}
      </div>

      {list.length ? (
        <ul className="divide-y divide-line/60">
          {list.map((item) => (
            <Row
              key={item.reception.id + item.project}
              item={item}
              db={db}
              now={now}
              showProject={mine.length > 1 && project === "ALL"}
              showStatus={tab === "all" || item.status === "moved"}
              onPick={onPick}
              onUndo={item.status === "served" && canUndo(item.served, user.id) ? () => setUndo(item.served!) : undefined}
              onBack={
                item.status === "left" && item.left && !item.left.auto && item.reception.date === todayKey()
                  ? () => backToWait(item)
                  : undefined
              }
              backBusy={busyBack === item.reception.id + item.project}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 px-5 py-14 text-center text-muted">
          <CheckCircle2 className="size-9 text-ok" />
          <p className="font-semibold">
            {tab === "wait" ? "لا يوجد أحد بانتظار الخدمة الآن" : tab === "left" ? "لا توجد حالات حضرت ولم تُخدم" : "لا توجد حالات بعد"}
          </p>
          {tab === "wait" && <p className="text-sm">القائمة تتحدث تلقائياً عند تحويل الاستقبال لأي حالة جديدة.</p>}
        </div>
      )}
      <UndoEntryDialog entry={undo} onClose={() => setUndo(null)} />
      <Dialog
        open={confirmLeft}
        onClose={() => !busyLeft && setConfirmLeft(false)}
        title="ترحيل المتبقين؟"
        description={`${waitingMine.length} ${waitingMine.length === 1 ? "حالة" : "حالات"} بانتظار الخدمة في ${mine.map((p) => projectName(db, p)).join(" و")}`}
        footer={
          <>
            <Button size="lg" variant="danger" onClick={doMarkLeft} loading={busyLeft} loadingText="جارٍ الترحيل…">
              <DoorOpen className="size-5" />
              نعم، رحّلهم
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setConfirmLeft(false)} disabled={busyLeft}>
              تراجع
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          تنتقل الحالات إلى &quot;حضرت ولم تُخدم&quot; وتظهر لك هناك لتخدمها عندما تحضر في أي يوم. إذا عادت حالة اليوم، تستطيع إرجاعها للانتظار أو خدمتها
          مباشرة.
        </p>
      </Dialog>
    </Card>
  );
}

function Row({
  item,
  db,
  now,
  showProject,
  showStatus,
  onPick,
  onUndo,
  onBack,
  backBusy,
}: {
  item: QueueItem;
  db: Db;
  now: number;
  showProject: boolean;
  /** شارة الحالة: تكرار لاسم التبويب، فتظهر فقط في "الكل" أو للحالات المحوّلة */
  showStatus: boolean;
  onPick: (i: QueueItem) => void;
  onUndo?: () => void;
  /** إرجاع دور مُرحّل يدوياً اليوم إلى الانتظار */
  onBack?: () => void;
  backBusy?: boolean;
}) {
  const b = db.beneficiaries[item.reception.nid];
  const waited = Math.max(0, Math.round((now - new Date(item.reception.at).getTime()) / 60_000));
  const muted = item.status === "served" || item.status === "moved";
  const isLeft = item.status === "left";
  const leftToday = isLeft && item.reception.date === todayKey();
  const ref = item.reception.referrals?.[item.project];
  const appt = item.served?.noDonor ? appointmentOf(db, item.served.id) : undefined;

  return (
    <li className="flex items-center">
      <button
        onClick={() => onPick(item)}
        className={cn("group flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-start transition hover:bg-sunken/60 sm:px-5", muted && "opacity-75", (onUndo || onBack) && "pe-2 sm:pe-2")}
      >
        <span
          className={cn(
            "num grid size-12 shrink-0 place-items-center rounded-2xl text-xl font-bold",
            item.status === "wait" && "text-white",
            item.status === "served" && "bg-ok-soft text-ok",
            item.status === "moved" && "bg-sunken text-muted line-through",
            isLeft && "bg-bad-soft text-bad",
          )}
          style={item.status === "wait" ? { background: projectColor(db, item.project) } : undefined}
          title={`رقم الدور في ${projectName(db, item.project)}`}
        >
          {item.number}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-bold">{b?.name || "بدون اسم"}</span>
            <IdTypeTag type={b?.type} />
            {showProject && <span className="rounded-md bg-sunken px-1.5 py-0.5 text-xs font-bold">{projectName(db, item.project)}</span>}
            {ref ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-info-soft px-1.5 py-0.5 text-xs font-bold text-info" title={ref.note}>
                <Stethoscope className="size-3" />
                محوّلة من نقطة {ref.from ? projectName(db, ref.from) : userName(db, ref.by)}
              </span>
            ) : (
              item.reception.corrected &&
              !item.reception.corrected.from.length && (
                <span className="inline-flex items-center gap-1 rounded-md bg-info-soft px-1.5 py-0.5 text-xs font-bold text-info">
                  <ArrowLeftRight className="size-3" />
                  تحويل من نقطة
                </span>
              )
            )}
            {item.served?.noDonor && (
              <span className="inline-flex items-center gap-1 rounded-md bg-warn-soft px-1.5 py-0.5 text-xs font-bold text-warn">
                <CalendarClock className="size-3" />
                بدون بت{appt ? ` · موعد ${dayFull(appt.due)}` : ""}
              </span>
            )}
            {item.movedFrom && (
              <span className="inline-flex items-center gap-1 rounded-md bg-warn-soft px-1.5 py-0.5 text-xs font-bold text-warn">
                <PenLine className="size-3" />
                محوّلة من {item.movedFrom.map((p) => projectName(db, p)).join("، ")}
              </span>
            )}
          </span>
          {ref?.note && item.status === "wait" && <span className="mt-0.5 block text-xs font-semibold text-info">ملاحظة: {ref.note}</span>}
          <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
            <span className="num font-semibold tracking-wider text-ink/80">{item.reception.nid}</span>
            <span>
              الاستقبال <span className="num">{formatTime(item.reception.at)}</span>
            </span>
            {item.status === "wait" && (
              <span className={cn("inline-flex items-center gap-1", waited >= 120 ? "font-bold text-bad" : waited >= 30 && "font-bold text-warn")}>
                <Clock className="size-3.5" />
                ينتظر {minutesText(waited)}
              </span>
            )}
            {isLeft && (
              <span className="inline-flex items-center gap-1 font-bold text-bad">
                <DoorOpen className="size-3.5" />
                {leftToday ? "حضرت اليوم" : `حضرت ${weekday(item.reception.date)} ${dayFull(item.reception.date)}`}
                {" · "}
                {item.left?.auto ? "رُحّلت تلقائياً" : `رحّلها ${item.left?.by ? userName(db, item.left.by) : "الموظف"}${item.left?.at ? ` ${formatTime(item.left.at)}` : ""}`}
              </span>
            )}
            {item.status === "served" && item.served && (
              <span>
                خُدمت <span className="num">{formatTime(item.served.at)}</span>
                {item.served.nid !== item.reception.nid && " · بهوية أخرى"}
              </span>
            )}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1">
          {showStatus && item.status === "wait" && <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-bold text-warn">بانتظار</span>}
          {showStatus && item.status === "served" && <span className="rounded-full bg-ok-soft px-2.5 py-1 text-xs font-bold text-ok">خُدمت</span>}
          {showStatus && isLeft && <span className="rounded-full bg-bad-soft px-2.5 py-1 text-xs font-bold text-bad">لم تُخدم</span>}
          {item.status === "moved" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-xs font-bold text-muted">
              <ArrowLeftRight className="size-3" />
              حُوّلت إلى {item.movedTo?.map((p) => projectName(db, p)).join("، ")}
            </span>
          )}
          {!onUndo && !onBack && <ChevronLeft className="size-4 text-muted group-hover:text-brand" />}
        </span>
      </button>
      {onUndo && (
        <button
          onClick={onUndo}
          className="focus-ring me-3 inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-bad/30 px-3 text-sm font-bold text-bad hover:bg-bad-soft sm:me-4"
          aria-label="التراجع عن إدخال الحالة"
          title="التراجع عن إدخال الحالة"
        >
          <RotateCcw className="size-4" />
          <span className="hidden sm:inline">تراجع</span>
        </button>
      )}
      {onBack && (
        <button
          onClick={onBack}
          disabled={backBusy}
          className="focus-ring me-3 inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-bold text-ink hover:bg-sunken disabled:opacity-50 sm:me-4"
          aria-label="إرجاع الحالة إلى الانتظار"
          title="عادت الحالة؟ إرجاعها إلى الانتظار"
        >
          <Undo2 className="size-4" />
          <span className="hidden sm:inline">{backBusy ? "جارٍ…" : "إرجاع للانتظار"}</span>
        </button>
      )}
    </li>
  );
}
