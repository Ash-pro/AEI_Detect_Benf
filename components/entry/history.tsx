"use client";

import { PenLine, Store, Stethoscope } from "lucide-react";
import type { Db, Entry } from "@/lib/types";
import { centerName, projectName, userName } from "@/lib/queries";
import { projectColor } from "@/lib/project-colors";
import { cn, dayFull, formatTime } from "@/lib/utils";

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

/** شارة مشروع مع رقم الدور إن وُجد */
export function ProjectChip({ db, code, number, tone = "sunken" }: { db: Db; code: string; number?: number; tone?: "sunken" | "surface" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold",
        tone === "surface" ? "bg-surface shadow-sm" : "bg-sunken",
      )}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ background: projectColor(db, code) }} aria-hidden />
      {projectName(db, code)}
      {number ? (
        <span className="num rounded px-1 text-[11px] leading-4 text-white" style={{ background: projectColor(db, code) }} title="رقم الدور">
          {number}
        </span>
      ) : null}
    </span>
  );
}

export function HistoryRow({ e, db, action }: { e: Entry; db: Db; action?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2.5 text-sm">
      <span className="num w-[132px] shrink-0 font-semibold">
        {dayFull(e.date)} <span className="text-muted">{formatTime(e.at)}</span>
      </span>
      <KindTag kind={e.kind} />
      <span className="flex flex-1 flex-wrap items-center gap-1.5">
        {e.projects.map((p) => (
          <ProjectChip key={p} db={db} code={p} number={e.queue?.[p]} />
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
      <span className="text-xs text-muted">
        {centerName(db, e.center, true)} · {userName(db, e.userId)}
      </span>
      {action}
    </li>
  );
}
