"use client";

import { PenLine, Store, Stethoscope } from "lucide-react";
import type { Db, Entry } from "@/lib/types";
import { centerName, correctionText, projectName, userName } from "@/lib/queries";
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

export function HistoryRow({
  e,
  db,
  action,
  person,
  timeOnly,
}: {
  e: Entry;
  db: Db;
  action?: React.ReactNode;
  /** إظهار اسم المستفيد ورقم هويته (في القوائم العامة) */
  person?: boolean;
  /** الوقت فقط بدون التاريخ (قوائم يوم واحد) */
  timeOnly?: boolean;
}) {
  const b = person ? db.beneficiaries[e.nid] : undefined;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2.5 text-sm">
      <span className={cn("num shrink-0 font-semibold", timeOnly ? "w-12" : "w-[132px]")}>
        {!timeOnly && <>{dayFull(e.date)} </>}
        <span className={timeOnly ? "" : "text-muted"}>{formatTime(e.at)}</span>
      </span>
      {person && (
        <span className="flex min-w-0 basis-full items-center gap-1.5 sm:basis-auto">
          <span className="truncate font-bold">{b?.name || "—"}</span>
          {b?.type && (
            <span className="shrink-0 rounded bg-sunken px-1.5 text-[11px] font-bold text-muted">
              {b.type === "MOTHER" ? "أم" : b.type === "FATHER" ? "أب" : "طفل"}
            </span>
          )}
          <span className="num shrink-0 text-xs text-muted">{e.nid}</span>
        </span>
      )}
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
            {correctionText(db, e.corrected)}
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
