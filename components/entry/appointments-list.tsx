"use client";

import { useMemo, useState } from "react";
import { CalendarCheck2, CalendarClock, CalendarX2, ChevronDown, ChevronLeft, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { IdTypeTag } from "./id-fields";
import { projectName } from "@/lib/queries";
import { projectColor } from "@/lib/project-colors";
import { apptStatus, apptWhen, type ApptStatus } from "@/lib/appointments";
import type { Appointment, CenterCode, Db, SessionUser } from "@/lib/types";
import { addDays, cn, dayFull, normalizeArabicName, normalizeDigits, todayKey, weekday } from "@/lib/utils";

const SECTIONS: { id: ApptStatus; label: string; empty: string; icon: typeof CalendarClock; tone: string }[] = [
  { id: "today", label: "مواعيد اليوم", empty: "لا مواعيد اليوم", icon: CalendarClock, tone: "text-ok bg-ok-soft" },
  { id: "missed", label: "فاتها الموعد", empty: "لا مواعيد فائتة", icon: CalendarX2, tone: "text-bad bg-bad-soft" },
  { id: "upcoming", label: "القادمة", empty: "لا مواعيد قادمة", icon: CalendarClock, tone: "text-warn bg-warn-soft" },
  { id: "done", label: "حضرت وخُدمت (آخر 14 يوماً)", empty: "لا يوجد", icon: CalendarCheck2, tone: "text-muted bg-sunken" },
];

/** مواعيد الخدمة بدون تطبيق الممول لمشاريع الموظف في المركز */
export function AppointmentsList({
  db,
  user,
  center,
  onOpen,
}: {
  db: Db;
  user: SessionUser;
  center: CenterCode;
  onOpen: (nid: string) => void;
}) {
  const today = todayKey();
  const [q, setQ] = useState("");
  const [closed, setClosed] = useState<Set<ApptStatus>>(new Set(["done"]));

  const mine = useMemo(() => {
    const digits = normalizeDigits(q);
    const term = normalizeArabicName(q);
    const doneEntryDate = (a: Appointment) => db.entries.find((e) => e.id === a.doneEntry)?.date ?? a.due;
    return db.appointments
      .filter((a) => a.center === center && user.projects.includes(a.project))
      .filter((a) => apptStatus(a, today) !== "done" || doneEntryDate(a) >= addDays(today, -14))
      .filter((a) => !q.trim() || (digits ? a.nid.includes(digits) : normalizeArabicName(db.beneficiaries[a.nid]?.name ?? "").includes(term)));
  }, [db, center, user.projects, today, q]);

  const groups = SECTIONS.map((s) => ({
    ...s,
    items: mine
      .filter((a) => apptStatus(a, today) === s.id)
      .sort((a, b) => (s.id === "missed" || s.id === "done" ? b.due.localeCompare(a.due) : a.due.localeCompare(b.due))),
  }));

  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="space-y-3 border-b border-line px-4 pb-3 pt-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <CalendarClock className="size-5 text-warn" />
            المواعيد — خدمة بدون بت
          </h2>
          <span className="text-xs text-muted">تُغلق تلقائياً عند خدمة الحالة</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {groups.slice(0, 3).map((g) => (
            <div key={g.id} className={cn("rounded-xl px-3 py-2", g.tone)}>
              <div className="num text-xl font-bold leading-tight">{g.items.length}</div>
              <div className="truncate text-[11px] font-semibold opacity-90">{g.label}</div>
            </div>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            aria-label="بحث"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث برقم الهوية أو الاسم"
            className="h-11 w-full rounded-xl border border-line bg-surface ps-9 pe-9 text-sm outline-hidden focus:border-brand"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="مسح البحث" className="absolute end-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-sunken">
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {groups.map((g) => {
        const isClosed = closed.has(g.id);
        return (
          <section key={g.id} aria-label={g.label}>
            <button
              onClick={() =>
                setClosed((s) => {
                  const n = new Set(s);
                  if (n.has(g.id)) n.delete(g.id);
                  else n.add(g.id);
                  return n;
                })
              }
              aria-expanded={!isClosed}
              className="flex w-full items-center gap-2 border-b border-line bg-sunken/50 px-4 py-2.5 text-start sm:px-5"
            >
              <span className={cn("grid size-7 place-items-center rounded-lg", g.tone)}>
                <g.icon className="size-4" />
              </span>
              <span className="font-bold">{g.label}</span>
              <span className="num rounded-full bg-surface px-2 text-xs font-bold leading-5">{g.items.length}</span>
              <ChevronDown className={cn("ms-auto size-4 text-muted transition", isClosed && "-rotate-90")} />
            </button>
            {!isClosed &&
              (g.items.length ? (
                <ul className="divide-y divide-line/60">
                  {g.items.map((a) => {
                    const b = db.beneficiaries[a.nid];
                    const served = db.entries.find((e) => e.id === a.createdEntry);
                    return (
                      <li key={a.id}>
                        <button onClick={() => onOpen(a.nid)} className="group flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-sunken/50 sm:px-5">
                          <span className="grid w-14 shrink-0 place-items-center rounded-xl bg-sunken py-1.5 text-center leading-tight">
                            <span className="num text-lg font-bold">{dayFull(a.due).slice(0, 5)}</span>
                            <span className="text-[10px] font-semibold text-muted">{weekday(a.due)}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate font-bold">{b?.name || "بدون اسم"}</span>
                              <IdTypeTag type={b?.type} />
                              <span className="inline-flex items-center gap-1 rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-bold">
                                <span className="size-2 rounded-full" style={{ background: projectColor(db, a.project) }} />
                                {projectName(db, a.project)}
                              </span>
                              {a.attempt > 1 && <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-bold text-warn">المحاولة {a.attempt}</span>}
                            </span>
                            <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                              <span className="num font-semibold tracking-wider text-ink/80">{a.nid}</span>
                              <span>{apptWhen(a, today)}</span>
                              {served && (
                                <span>
                                  خُدمت بدون بت <span className="num">{dayFull(served.date)}</span>
                                </span>
                              )}
                            </span>
                          </span>
                          <ChevronLeft className="size-4 shrink-0 text-muted group-hover:text-brand" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-5 py-5 text-center text-sm text-muted">{g.empty}</p>
              ))}
          </section>
        );
      })}
    </Card>
  );
}
