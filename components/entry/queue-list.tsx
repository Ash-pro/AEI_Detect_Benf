"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, CheckCircle2, ChevronLeft, Clock, ListOrdered, PenLine } from "lucide-react";
import { IdTypeTag } from "./id-fields";
import { Card } from "@/components/ui/card";
import { projectName } from "@/lib/queries";
import { projectColor } from "@/lib/project-colors";
import { projectQueue, type QueueItem } from "@/lib/queue";
import type { CenterCode, Db, SessionUser } from "@/lib/types";
import { cn, formatTime, minutesText } from "@/lib/utils";

type Tab = "wait" | "served" | "all";

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

  // تحديث مدة الانتظار كل 30 ثانية
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const mine = user.projects;
  const all = useMemo(() => {
    const list = mine.flatMap((p) => projectQueue(db, center, p));
    // أكثر من مشروع: ترتيب حسب وقت الاستقبال ثم رقم الدور
    return mine.length > 1 ? list.sort((a, b) => a.reception.at.localeCompare(b.reception.at) || a.number - b.number) : list;
  }, [db, center, mine]);

  const scoped = project === "ALL" ? all : all.filter((x) => x.project === project);
  const counts = {
    wait: scoped.filter((x) => x.status === "wait").length,
    served: scoped.filter((x) => x.status === "served").length,
    all: scoped.length,
  };
  const list = tab === "all" ? scoped : tab === "wait" ? scoped.filter((x) => x.status === "wait") : scoped.filter((x) => x.status !== "wait");

  const tabs: { value: Tab; label: string; n: number }[] = [
    { value: "wait", label: "بانتظار", n: counts.wait },
    { value: "served", label: "خُدمت", n: counts.served + scoped.filter((x) => x.status === "moved").length },
    { value: "all", label: "الكل", n: counts.all },
  ];

  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="border-b border-line px-4 pb-3 pt-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ListOrdered className="size-5 text-brand" />
            قائمة الانتظار — {mine.map((p) => projectName(db, p)).join(" و")}
          </h2>
          <span className="text-xs text-muted">مرتبة حسب الدور ووقت الاستقبال</span>
        </div>

        {mine.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["ALL", ...mine].map((p) => (
              <button
                key={p}
                onClick={() => setProject(p)}
                className={cn(
                  "rounded-lg border px-3 py-1 text-sm font-bold",
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
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-bold transition",
                tab === t.value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "num min-w-6 rounded-full px-1.5 text-xs leading-5",
                  t.value === "wait" && t.n ? "bg-warn text-white" : "bg-line/70 text-ink",
                )}
              >
                {t.n}
              </span>
            </button>
          ))}
        </div>
      </div>

      {list.length ? (
        <ul className="divide-y divide-line/60">
          {list.map((item) => (
            <Row key={item.reception.id + item.project} item={item} db={db} now={now} showProject={mine.length > 1} onPick={onPick} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 px-5 py-14 text-center text-muted">
          <CheckCircle2 className="size-9 text-ok" />
          <p className="font-semibold">{tab === "wait" ? "لا يوجد أحد بانتظار الخدمة الآن" : "لا توجد حالات بعد"}</p>
          {tab === "wait" && <p className="text-sm">القائمة تتحدث تلقائياً عند تحويل الاستقبال لأي حالة جديدة.</p>}
        </div>
      )}
    </Card>
  );
}

function Row({ item, db, now, showProject, onPick }: { item: QueueItem; db: Db; now: number; showProject: boolean; onPick: (i: QueueItem) => void }) {
  const b = db.beneficiaries[item.reception.nid];
  const waited = Math.max(0, Math.round((now - new Date(item.reception.at).getTime()) / 60_000));
  const muted = item.status !== "wait";

  return (
    <li>
      <button
        onClick={() => onPick(item)}
        className={cn("group flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-sunken/60 sm:px-5", muted && "opacity-75")}
      >
        <span
          className={cn(
            "num grid size-12 shrink-0 place-items-center rounded-2xl text-xl font-bold",
            item.status === "wait" && "text-white",
            item.status === "served" && "bg-ok-soft text-ok",
            item.status === "moved" && "bg-sunken text-muted line-through",
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
            {showProject && <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-bold">{projectName(db, item.project)}</span>}
            {item.reception.corrected && !item.reception.corrected.from.length && (
              <span className="inline-flex items-center gap-1 rounded-md bg-info-soft px-1.5 py-0.5 text-[11px] font-bold text-info">
                <ArrowLeftRight className="size-3" />
                تحويل من نقطة
              </span>
            )}
            {item.movedFrom && (
              <span className="inline-flex items-center gap-1 rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-bold text-warn">
                <PenLine className="size-3" />
                محوّلة من {item.movedFrom.map((p) => projectName(db, p)).join("، ")}
              </span>
            )}
          </span>
          <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
            <span className="num font-semibold tracking-wider text-ink/80">{item.reception.nid}</span>
            <span>
              الاستقبال <span className="num">{formatTime(item.reception.at)}</span>
            </span>
            {item.status === "wait" && (
              <span className={cn("inline-flex items-center gap-1", waited >= 30 && "font-bold text-warn")}>
                <Clock className="size-3.5" />
                ينتظر {minutesText(waited)}
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
          {item.status === "wait" && <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-bold text-warn">بانتظار</span>}
          {item.status === "served" && <span className="rounded-full bg-ok-soft px-2.5 py-1 text-xs font-bold text-ok">خُدمت</span>}
          {item.status === "moved" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-xs font-bold text-muted">
              <ArrowLeftRight className="size-3" />
              حُوّلت إلى {item.movedTo?.map((p) => projectName(db, p)).join("، ")}
            </span>
          )}
          <ChevronLeft className="size-4 text-muted group-hover:text-brand" />
        </span>
      </button>
    </li>
  );
}
