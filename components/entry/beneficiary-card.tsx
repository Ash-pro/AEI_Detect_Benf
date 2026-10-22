"use client";

import { useState } from "react";
import { CalendarClock, History, Pencil, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { HistoryRow, KindTag, ProjectChip } from "./history";
import { IdTypeTag } from "./id-fields";
import type { Beneficiary, Db, Entry } from "@/lib/types";
import { centerName, projectName, userName } from "@/lib/queries";
import { dayFull, formatDate, formatTime, sinceText, todayKey, weekday } from "@/lib/utils";

/** بطاقة الهوية: البيانات + آخر زيارة + سجل الزيارات + زر التعديل */
export function BeneficiaryCard({
  db,
  beneficiary,
  history,
  status,
  onEdit,
}: {
  db: Db;
  beneficiary: Beneficiary;
  history: Entry[];
  status?: React.ReactNode;
  onEdit: () => void;
}) {
  const [all, setAll] = useState(false);
  // آخر زيارة: آخر زيارة قبل اليوم، وإلا إدخال اليوم
  const today = todayKey();
  const last = history.find((e) => e.date !== today) ?? history[0];
  const rest = history.filter((e) => e !== last);
  const visits = new Set(history.filter((e) => e.kind === "RECEPTION").map((e) => e.date + e.center)).size;

  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="flex items-start gap-3 px-5 pb-4 pt-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sunken text-muted">
          <UserRound className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold leading-snug sm:text-2xl">
            <span className={beneficiary.name ? "" : "num tracking-wider"}>{beneficiary.name || beneficiary.nid}</span>
            <IdTypeTag type={beneficiary.type} className="text-sm" />
          </h2>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted">
            {beneficiary.name && <span className="num font-semibold tracking-wider text-ink">{beneficiary.nid}</span>}
            <span>
              مسجلة منذ <span className="num">{formatDate(beneficiary.createdAt)}</span>
            </span>
            <span>
              زيارات الاستقبال: <span className="num font-bold text-ink">{visits}</span>
            </span>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-bold text-brand hover:bg-brand-soft"
        >
          <Pencil className="size-4" />
          تعديل
        </button>
      </div>

      {status}

      {last && (
        <div className="border-t border-line bg-sunken/60 px-5 py-3.5">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted">
            <CalendarClock className="size-4" />
            آخر زيارة
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-xl font-bold text-ink">{sinceText(last.at)}</span>
            <span className="font-semibold">
              {weekday(last.date)} <span className="num">{dayFull(last.date)}</span>
              <span className="num text-muted"> · {formatTime(last.at)}</span>
            </span>
            <KindTag kind={last.kind} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm">
            {last.projects.map((p) => (
              <ProjectChip key={p} db={db} code={p} number={last.queue?.[p]} tone="surface" />
            ))}
            <span className="text-muted">
              · {centerName(db, last.center)} · {userName(db, last.userId)}
            </span>
            {last.corrected && (
              <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-bold text-warn">
                عُدّل التوجيه من {last.corrected.from.map((p) => projectName(db, p)).join("، ")} بواسطة {userName(db, last.corrected.by)}
              </span>
            )}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div className="border-t border-line">
          <div className="flex items-center gap-2 px-5 pb-1 pt-3 text-xs font-semibold text-muted">
            <History className="size-4" />
            سجل الزيارات
          </div>
          <ul className="divide-y divide-line/60">
            {rest.slice(0, 5).map((e) => (
              <HistoryRow key={e.id} e={e} db={db} />
            ))}
          </ul>
          {history.length > 6 && (
            <button onClick={() => setAll(true)} className="px-5 pb-3 pt-1 text-sm font-semibold text-brand hover:underline">
              عرض الكل (<span className="num">{history.length}</span>)
            </button>
          )}
        </div>
      )}

      <Dialog open={all} onClose={() => setAll(false)} title="سجل الزيارات" description={beneficiary.name ? `${beneficiary.name} · ${beneficiary.nid}` : beneficiary.nid} size="lg">
        <ul className="-mx-5 divide-y divide-line/60 sm:-mx-6">
          {history.map((e) => (
            <HistoryRow key={e.id} e={e} db={db} />
          ))}
        </ul>
      </Dialog>
    </Card>
  );
}
