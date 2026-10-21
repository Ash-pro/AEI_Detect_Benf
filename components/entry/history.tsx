"use client";

import { PenLine, Store, Stethoscope } from "lucide-react";
import type { Db, Entry } from "@/lib/types";
import { centerName, projectName, userName } from "@/lib/queries";
import { cn, dayNum, formatTime } from "@/lib/utils";

export function KindTag({ kind }: { kind: Entry["kind"] }) {
  return kind === "RECEPTION" ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-info-soft px-1.5 py-0.5 text-[11px] font-bold text-info">
      <Store className="size-3" />
      استقبال
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md bg-ok-soft px-1.5 py-0.5 text-[11px] font-bold text-ok">
      <Stethoscope className="size-3" />
      نقطة
    </span>
  );
}

export function HistoryRow({ e, db, action }: { e: Entry; db: Db; action?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2.5 text-sm">
      <span className="num w-[92px] shrink-0 font-semibold">
        {dayNum(e.date)} <span className="text-muted">{formatTime(e.at)}</span>
      </span>
      <KindTag kind={e.kind} />
      <span className="flex flex-1 flex-wrap items-center gap-1.5">
        {e.projects.map((p) => (
          <span key={p} className="rounded-md bg-sunken px-2 py-0.5 text-xs font-bold">
            {projectName(db, p)}
          </span>
        ))}
        {e.corrected && (
          <span
            className="inline-flex items-center gap-1 rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-bold text-warn"
            title={`كان: ${e.corrected.from.map((p) => projectName(db, p)).join("، ")}`}
          >
            <PenLine className="size-3" />
            عُدّل التوجيه من {e.corrected.from.map((p) => projectName(db, p)).join("، ")}
          </span>
        )}
      </span>
      <span className={cn("text-xs text-muted")}>
        {centerName(db, e.center, true)} · {userName(db, e.userId)}
      </span>
      {action}
    </li>
  );
}
