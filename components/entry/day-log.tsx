"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, History, Lock, PenLine, Pencil, Search, Share2 } from "lucide-react";
import { ProjectChip } from "./history";
import { IdTypeTag } from "./id-fields";
import { EntryEditor } from "./edit-dialog";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { activeProjects, projectName, staffStats, type StaffStats } from "@/lib/queries";
import { lastNumber, pointQueue } from "@/lib/queue";
import type { CenterCode, Db, Entry, SessionUser } from "@/lib/types";
import { addDays, casesText, cn, dayFull, dayNum, formatTime, monthKey, monthLabel, normalizeArabicName, normalizeDigits, todayKey, weekday } from "@/lib/utils";

const RECENT_DAYS = 30;

/** سجل إدخالات الموظف بالأيام: قائمة جانبية بالأيام + إدخالات اليوم المختار */
export function DayLog({
  db,
  user,
  center,
  onOpen,
  onShare,
}: {
  db: Db;
  user: SessionUser;
  center: CenterCode;
  onOpen: (nid: string) => void;
  onShare: (date: string, stats: StaffStats) => void;
}) {
  const today = todayKey();
  const isPoint = user.role === "POINT";
  const [date, setDate] = useState(today);
  const [showOld, setShowOld] = useState(false);
  const [q, setQ] = useState("");
  const [project, setProject] = useState("");
  const [sort, setSort] = useState<SortMode>("queue");
  const [edit, setEdit] = useState<Entry | null>(null);

  /* كل إدخالات الموظف في هذا المركز */
  const mine = useMemo(() => db.entries.filter((e) => e.userId === user.id && e.center === center), [db, user.id, center]);

  /* الأيام: اليوم دائماً أولاً، ثم أيام العمل الأحدث فالأقدم */
  const days = useMemo(() => {
    const m = new Map<string, number>();
    mine.forEach((e) => m.set(e.date, (m.get(e.date) ?? 0) + 1));
    if (isPoint) {
      // النقطة: عدد الحالات = عدد الهويات المخدومة
      const sets = new Map<string, Set<string>>();
      mine.forEach((e) => (sets.get(e.date) ?? sets.set(e.date, new Set()).get(e.date)!).add(e.nid));
      sets.forEach((s, d) => m.set(d, s.size));
    }
    if (!m.has(today)) m.set(today, 0);
    return Array.from(m.entries())
      .map(([d, count]) => ({ date: d, count }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [mine, today, isPoint]);

  const cutoff = addDays(today, -RECENT_DAYS);
  const visible = showOld ? days : days.filter((d) => d.date >= cutoff);
  const hiddenOld = days.length - days.filter((d) => d.date >= cutoff).length;

  useEffect(() => {
    setQ("");
    setProject("");
  }, [date]);

  const dayEntries = useMemo(() => mine.filter((e) => e.date === date), [mine, date]);
  const stats = useMemo(() => staffStats(db, user, center, date), [db, user, center, date]);
  const dayProjects = useMemo(() => {
    const set = new Set(dayEntries.flatMap((e) => e.projects));
    return [...db.projects].sort((a, b) => a.order - b.order).map((p) => p.code).filter((c) => set.has(c));
  }, [dayEntries, db.projects]);

  const list = useMemo(() => {
    const digits = normalizeDigits(q);
    const term = normalizeArabicName(q);
    return dayEntries
      .filter((e) => !project || e.projects.includes(project))
      .filter((e) => {
        if (!q.trim()) return true;
        if (digits) return e.nid.includes(digits);
        return normalizeArabicName(db.beneficiaries[e.nid]?.name ?? "").includes(term);
      })
      .sort((a, b) => (sort === "old" ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at)));
  }, [dayEntries, project, q, sort, db.beneficiaries]);

  /* ترتيب الدور: كل مشروع بتسلسله الخاص — الحالة تظهر في قائمة كل مشروع حُوّلت له */
  const groups = useMemo(() => {
    if (sort !== "queue") return [];
    const codes = project ? [project] : dayProjects;
    return codes
      .map((code) => {
        const items: QueueRow[] = list
          .filter((e) => e.projects.includes(code))
          .map((e) => ({ e, project: code, number: isPoint ? pointQueue(db, e).number : e.queue?.[code] }));
        items.sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9) || a.e.at.localeCompare(b.e.at));
        return { code, items };
      })
      .filter((g) => g.items.length);
  }, [sort, project, dayProjects, list, isPoint, db]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    dayEntries.forEach((e) => e.projects.forEach((p) => m.set(p, (m.get(p) ?? 0) + 1)));
    return m;
  }, [dayEntries]);

  const isToday = date === today;
  const months = Array.from(new Set(visible.map((d) => monthKey(d.date))));

  return (
    <div className="animate-fade-up grid gap-4 md:grid-cols-[210px_minmax(0,1fr)]">
      {/* ===== الأيام ===== */}
      <aside aria-label="الأيام" className="min-w-0">
        {/* الجوال: شريط أفقي */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden">
          {visible.map((d) => (
            <button
              key={d.date}
              onClick={() => setDate(d.date)}
              className={cn(
                "flex shrink-0 flex-col items-center rounded-xl border px-3 py-1.5 text-sm font-bold",
                d.date === date ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface",
              )}
            >
              <span>{d.date === today ? "اليوم" : weekday(d.date)}</span>
              <span className={cn("num text-xs font-semibold", d.date === date ? "text-brand-ink/80" : "text-muted")}>
                {dayNum(d.date)} · {d.count}
              </span>
            </button>
          ))}
          {!showOld && hiddenOld > 0 && (
            <button onClick={() => setShowOld(true)} className="shrink-0 rounded-xl border border-dashed border-line px-3 text-sm font-bold text-brand">
              أيام أقدم
            </button>
          )}
        </div>

        {/* الشاشات الأكبر: قائمة جانبية */}
        <Card className="sticky top-24 hidden overflow-hidden md:block">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-bold">
            <CalendarDays className="size-4 text-brand" />
            الأيام
          </div>
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
            {months.map((mk) => (
              <div key={mk}>
                <div className="bg-sunken px-4 py-1.5 text-xs font-semibold text-muted">{monthLabel(mk)}</div>
                <ul>
                  {visible
                    .filter((d) => monthKey(d.date) === mk)
                    .map((d) => (
                      <li key={d.date}>
                        <button
                          onClick={() => setDate(d.date)}
                          aria-current={d.date === date ? "date" : undefined}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 border-s-4 px-3.5 py-2.5 text-start text-sm transition",
                            d.date === date ? "border-brand bg-brand-soft font-bold text-brand" : "border-transparent hover:bg-sunken/60",
                          )}
                        >
                          <span>
                            {d.date === today ? "اليوم · " : ""}
                            {weekday(d.date)} <span className="num">{dayNum(d.date)}</span>
                          </span>
                          <span className={cn("num rounded-full px-2 text-xs leading-5", d.date === date ? "bg-brand text-brand-ink" : "bg-sunken text-muted")}>
                            {d.count}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
          {hiddenOld > 0 && (
            <button
              onClick={() => setShowOld((v) => !v)}
              className="flex w-full items-center justify-center gap-1.5 border-t border-line px-4 py-2.5 text-sm font-bold text-brand hover:bg-sunken/60"
            >
              <History className="size-4" />
              {showOld ? `آخر ${RECENT_DAYS} يوماً فقط` : `أيام أقدم (${hiddenOld})`}
            </button>
          )}
        </Card>
      </aside>

      {/* ===== إدخالات اليوم المختار ===== */}
      <Card className="min-w-0 overflow-hidden">
        <div className="border-b border-line px-4 pb-3 pt-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">
                {isToday && <span className="me-1.5 rounded-md bg-brand-soft px-1.5 py-0.5 text-sm text-brand">اليوم</span>}
                {weekday(date)} <span className="num">{dayFull(date)}</span>
              </h2>
              <p className="mt-0.5 text-sm text-muted">{isPoint ? `${casesText(stats.total)} خدمتها` : `${casesText(stats.total)} في الاستقبال`}</p>
            </div>
            <button
              onClick={() => onShare(date, stats)}
              disabled={!dayEntries.length}
              className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[#128c4a]/40 bg-[#e7f6ec] px-3 py-2 text-sm font-bold text-[#0f6b38] hover:bg-[#d6efdf] disabled:opacity-40"
            >
              <Share2 className="size-4" />
              مشاركة إحصائيات هذا اليوم
            </button>
          </div>

          <DaySummary db={db} stats={stats} isPoint={isPoint} center={center} date={date} />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                aria-label="بحث في إدخالات اليوم"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="بحث برقم الهوية أو الاسم"
                className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm outline-hidden focus:border-brand"
              />
            </div>
            <div role="radiogroup" aria-label="الترتيب" className="flex h-10 rounded-xl bg-sunken p-1">
              {SORTS.map((o) => (
                <button
                  key={o.value}
                  role="radio"
                  aria-checked={sort === o.value}
                  onClick={() => setSort(o.value)}
                  className={cn(
                    "rounded-lg px-2.5 text-sm font-bold transition",
                    sort === o.value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {dayProjects.length > 1 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {["", ...dayProjects].map((p) => (
                <button
                  key={p || "all"}
                  onClick={() => setProject(p)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-bold",
                    project === p ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-muted hover:text-ink",
                  )}
                >
                  {p ? projectName(db, p) : "كل المشاريع"}
                  {p && <span className="num font-semibold opacity-70"> {counts.get(p)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {list.length && sort === "queue" ? (
          <div>
            {groups.map((g) => (
              <section key={g.code} aria-label={`دور ${projectName(db, g.code)}`}>
                <div className="flex items-center justify-between gap-2 border-y border-line bg-sunken px-4 py-2 sm:px-5">
                  <span className="font-bold">
                    دور {projectName(db, g.code)}
                  </span>
                  <span className="text-xs font-semibold text-muted">
                    {casesText(g.items.length)}
                    {!isPoint && (
                      <>
                        {" "}· آخر دور <span className="num">{lastNumber(db, center, g.code, date)}</span>
                      </>
                    )}
                  </span>
                </div>
                <ul className="divide-y divide-line/60">
                  {g.items.map((r) => (
                    <QueueLogRow
                      key={r.e.id + r.project}
                      row={r}
                      db={db}
                      isPoint={isPoint}
                      canEdit={isToday}
                      onOpen={() => onOpen(r.e.nid)}
                      onEdit={() => setEdit(r.e)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : list.length ? (
          <ul className="divide-y divide-line/60">
            {list.map((e) => (
              <LogRow key={e.id} e={e} db={db} isPoint={isPoint} canEdit={isToday} onOpen={() => onOpen(e.nid)} onEdit={() => setEdit(e)} />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-14 text-center text-sm text-muted">
            {dayEntries.length ? "لا نتائج مطابقة" : isToday ? "لا توجد إدخالات لك اليوم بعد" : "لا توجد إدخالات في هذا اليوم"}
          </p>
        )}

        <p className="flex gap-2 border-t border-line px-5 py-3 text-xs text-muted">
          {isToday ? <Pencil className="size-4 shrink-0" /> : <Lock className="size-4 shrink-0" />}
          {isToday
            ? "إدخالات اليوم: تعدّلها أو تحذفها من زر القلم. الضغط على السطر يفتح بطاقة الهوية."
            : "الأيام السابقة للعرض فقط. التعديل عليها للأدمن من سجل الأيام."}
        </p>
      </Card>

      <Dialog open={Boolean(edit)} onClose={() => setEdit(null)} title="تعديل إدخال" description={edit ? `${edit.nid} · ${formatTime(edit.at)}` : ""} size="lg">
        {edit && db.entries.some((x) => x.id === edit.id) ? (
          <EntryEditor
            key={edit.id}
            entry={db.entries.find((x) => x.id === edit.id)!}
            projects={isPoint ? activeProjects(db, center).filter((p) => user.projects.includes(p.code)) : activeProjects(db, center)}
            onMoved={() => setEdit(null)}
          />
        ) : (
          <p className="rounded-xl bg-sunken px-4 py-3 text-sm text-muted">تم حذف هذا الإدخال.</p>
        )}
      </Dialog>
    </div>
  );
}

type SortMode = "queue" | "new" | "old";
const SORTS: { value: SortMode; label: string }[] = [
  { value: "queue", label: "حسب الدور" },
  { value: "new", label: "الأحدث" },
  { value: "old", label: "الأقدم" },
];

interface QueueRow {
  e: Entry;
  project: string;
  number?: number;
}

/** سطر في ترتيب الدور: رقم الدور + المشروع الذي سيخدم الحالة */
function QueueLogRow({
  row,
  db,
  isPoint,
  canEdit,
  onOpen,
  onEdit,
}: {
  row: QueueRow;
  db: Db;
  isPoint: boolean;
  canEdit: boolean;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const { e, project, number } = row;
  const b = db.beneficiaries[e.nid];
  const others = isPoint ? [] : e.projects.filter((p) => p !== project);
  const pq = isPoint ? pointQueue(db, e) : null;
  const otherId = pq?.reception && pq.reception.nid !== e.nid;
  return (
    <li className="flex items-center gap-1 pe-2">
      <button onClick={onOpen} className="group flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-start hover:bg-sunken/50 sm:px-5">
        <span
          className={cn(
            "flex w-16 shrink-0 flex-col items-center justify-center rounded-xl py-1.5 leading-none",
            number ? "bg-brand text-brand-ink" : "bg-sunken text-muted",
          )}
          title="رقم الدور في المشروع"
        >
          <span className="num text-xl font-bold">{number ?? "—"}</span>
          <span className="mt-1 max-w-full truncate px-1 text-[10px] font-bold opacity-90">{number ? projectName(db, project) : "بدون دور"}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-bold">{b?.name || "بدون اسم"}</span>
            <IdTypeTag type={b?.type} />
            {e.isNew && <span className="rounded bg-info-soft px-1.5 text-[11px] font-bold text-info">جديدة</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="num font-semibold tracking-wider text-ink/80">{e.nid}</span>
            <span>
              {isPoint ? "الخدمة" : "الاستقبال"} <span className="num">{formatTime(e.at)}</span>
            </span>
            {e.corrected && (
              <span className="inline-flex items-center gap-1 rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-bold text-warn">
                <PenLine className="size-3" />
                عُدّل التوجيه من {e.corrected.from.map((p) => projectName(db, p)).join("، ")}
              </span>
            )}
            {otherId && <span>على دور {db.beneficiaries[pq!.reception!.nid]?.name || pq!.reception!.nid} (بهوية أخرى)</span>}
          </span>
        </span>
        {others.length > 0 && (
          <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
            <span className="text-[11px] text-muted">ومحوّلة أيضاً إلى</span>
            <span className="flex flex-wrap justify-end gap-1">
              {others.map((p) => (
                <ProjectChip key={p} db={db} code={p} number={e.queue?.[p]} />
              ))}
            </span>
          </span>
        )}
        <ChevronLeft className="hidden size-4 shrink-0 text-muted group-hover:text-brand sm:block" />
      </button>
      {canEdit && (
        <button onClick={onEdit} aria-label="تعديل الإدخال" className="focus-ring grid size-9 shrink-0 place-items-center rounded-lg text-brand hover:bg-brand-soft">
          <Pencil className="size-4" />
        </button>
      )}
    </li>
  );
}

function DaySummary({ db, stats, isPoint, center, date }: { db: Db; stats: StaffStats; isPoint: boolean; center: CenterCode; date: string }) {
  const chips: { label: string; value: number | string; tone?: string }[] = isPoint
    ? [
        { label: "من قائمة الانتظار", value: stats.fromQueue, tone: "text-ok" },
        { label: "بدون دور", value: stats.noQueue },
        ...(stats.corrected ? [{ label: "صُحّح توجيهها", value: stats.corrected, tone: "text-warn" }] : []),
        { label: "جديدة", value: stats.isNew, tone: "text-info" },
      ]
    : [
        { label: "جديدة", value: stats.isNew, tone: "text-info" },
        { label: "متكررة", value: stats.repeat },
        ...stats.types.map((t) => ({ label: t.label, value: t.count })),
      ];
  const projects = stats.perProject.filter((p) => p.count);
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c.label} className="rounded-lg bg-sunken px-2.5 py-1 text-xs font-semibold text-muted">
            {c.label} <span className={cn("num font-bold text-ink", c.tone)}>{c.value}</span>
          </span>
        ))}
      </div>
      {projects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {projects.map((p) => (
            <span key={p.code} className="rounded-lg border border-line px-2.5 py-1 text-xs font-bold">
              {p.name} <span className="num text-muted">{p.count}</span>
              {!isPoint && (
                <span className="font-semibold text-muted">
                  {" "}
                  · آخر دور <span className="num">{lastNumber(db, center, p.code, date)}</span>
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function LogRow({
  e,
  db,
  isPoint,
  canEdit,
  onOpen,
  onEdit,
}: {
  e: Entry;
  db: Db;
  isPoint: boolean;
  canEdit: boolean;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const b = db.beneficiaries[e.nid];
  const pq = isPoint ? pointQueue(db, e) : null;
  const otherId = pq?.reception && pq.reception.nid !== e.nid;

  return (
    <li className="flex items-center gap-1 pe-2">
      <button onClick={onOpen} className="group flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-start hover:bg-sunken/50 sm:px-5">
        <span className="num w-12 shrink-0 font-bold">{formatTime(e.at)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-bold">{b?.name || "بدون اسم"}</span>
            <IdTypeTag type={b?.type} />
            {e.isNew && <span className="rounded bg-info-soft px-1.5 text-[11px] font-bold text-info">جديدة</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="num font-semibold tracking-wider text-ink/80">{e.nid}</span>
            {e.corrected && (
              <span className="inline-flex items-center gap-1 rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-bold text-warn">
                <PenLine className="size-3" />
                عُدّل التوجيه من {e.corrected.from.map((p) => projectName(db, p)).join("، ")}
              </span>
            )}
            {otherId && (
              <span>
                على دور {db.beneficiaries[pq!.reception!.nid]?.name || pq!.reception!.nid} (بهوية أخرى)
              </span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {e.projects.map((p) => (
            <ProjectChip key={p} db={db} code={p} number={isPoint ? pq?.number : e.queue?.[p]} />
          ))}
          {isPoint && !pq?.number && <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-semibold text-muted">بدون دور</span>}
        </span>
        <ChevronLeft className="hidden size-4 shrink-0 text-muted group-hover:text-brand sm:block" />
      </button>
      {canEdit && (
        <button onClick={onEdit} aria-label="تعديل الإدخال" className="focus-ring grid size-9 shrink-0 place-items-center rounded-lg text-brand hover:bg-brand-soft">
          <Pencil className="size-4" />
        </button>
      )}
    </li>
  );
}
