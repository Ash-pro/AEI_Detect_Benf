"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History,
  ListOrdered,
  Lock,
  PenLine,
  Pencil,
  Search,
  Share2,
  X,
} from "lucide-react";
import { EntryBadges, ProjectChip } from "./history";
import { IdTypeTag } from "./id-fields";
import { EntryEditor } from "./edit-dialog";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { activeProjects, correctionText, projectName, staffStats, type StaffStats } from "@/lib/queries";
import { lastNumber, pointQueue } from "@/lib/queue";
import { projectColor, projectSoft } from "@/lib/project-colors";
import type { CenterCode, Db, Entry, SessionUser } from "@/lib/types";
import { addDays, cn, dayFull, dayNum, formatTime, monthKey, monthLabel, normalizeArabicName, normalizeDigits, todayKey, weekday } from "@/lib/utils";

const RECENT_DAYS = 30;
/** اليوم المزدحم: نعرض أول مجموعة من الأسطر ثم "عرض المزيد" حتى لا تطول الصفحة على الجوال */
const PAGE = 30;

type SortMode = "queue" | "new" | "old";
const SORTS: { value: SortMode; label: string; icon: typeof ListOrdered }[] = [
  { value: "queue", label: "حسب الدور", icon: ListOrdered },
  { value: "new", label: "الأحدث", icon: ArrowDownWideNarrow },
  { value: "old", label: "الأقدم", icon: ArrowUpWideNarrow },
];

interface QueueRow {
  e: Entry;
  project: string;
  number?: number;
}

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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [more, setMore] = useState<Record<string, number>>({});
  const limitOf = (k: string) => more[k] ?? PAGE;
  const showMore = (k: string) => setMore((m) => ({ ...m, [k]: (m[k] ?? PAGE) + PAGE * 2 }));

  /* كل إدخالات الموظف في هذا المركز */
  const mine = useMemo(() => db.entries.filter((e) => e.userId === user.id && e.center === center), [db, user.id, center]);

  /* الأيام: اليوم دائماً أولاً، ثم أيام العمل الأحدث فالأقدم */
  const days = useMemo(() => {
    const sets = new Map<string, Set<string>>();
    mine.forEach((e) => {
      if (!sets.has(e.date)) sets.set(e.date, new Set());
      sets.get(e.date)!.add(isPoint ? e.nid : e.id);
    });
    if (!sets.has(today)) sets.set(today, new Set());
    return Array.from(sets.entries())
      .map(([d, s]) => ({ date: d, count: s.size }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [mine, today, isPoint]);

  const cutoff = addDays(today, -RECENT_DAYS);
  const visible = showOld ? days : days.filter((d) => d.date >= cutoff);
  const hiddenOld = days.length - days.filter((d) => d.date >= cutoff).length;
  const maxCount = Math.max(1, ...visible.map((d) => d.count));

  useEffect(() => {
    setQ("");
    setProject("");
    setMore({});
  }, [date]);
  /* اليوم المزدحم: نفتح أول مشروع فقط حتى تبقى القائمة قصيرة، والباقي بضغطة */
  const autoKey = `${date}|${center}`;
  const [autoFor, setAutoFor] = useState("");

  const dayEntries = useMemo(() => mine.filter((e) => e.date === date), [mine, date]);
  const stats = useMemo(() => staffStats(db, user, center, date), [db, user, center, date]);
  const dayProjects = useMemo(() => {
    const set = new Set(dayEntries.flatMap((e) => e.projects));
    return [...db.projects].sort((a, b) => a.order - b.order).map((p) => p.code).filter((c) => set.has(c));
  }, [dayEntries, db.projects]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    dayEntries.forEach((e) => e.projects.forEach((p) => m.set(p, (m.get(p) ?? 0) + 1)));
    return m;
  }, [dayEntries]);

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

  useEffect(() => {
    if (autoFor === autoKey || sort !== "queue" || !groups.length) return;
    setAutoFor(autoKey);
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    setCollapsed(new Set(total > 15 ? groups.slice(1).map((g) => g.code) : []));
  }, [autoFor, autoKey, sort, groups]);
  const allOpen = groups.every((g) => !collapsed.has(g.code));

  const isToday = date === today;
  const months = Array.from(new Set(visible.map((d) => monthKey(d.date))));
  const idx = days.findIndex((d) => d.date === date);
  const newer = idx > 0 ? days[idx - 1].date : null;
  const older = idx >= 0 && idx < days.length - 1 ? days[idx + 1].date : null;
  const goto = (d: string) => {
    if (d < cutoff) setShowOld(true);
    setDate(d);
  };

  const kpis = isPoint
    ? [
        { label: "حالات خدمتها", value: stats.total, cls: "text-ok" },
        { label: "من قائمة الانتظار", value: stats.fromQueue, cls: "text-ink" },
        { label: "بدون دور", value: stats.noQueue, cls: "text-muted" },
        { label: "جديدة على النظام", value: stats.isNew, cls: "text-info" },
      ]
    : [
        { label: "حالات الاستقبال", value: stats.total, cls: "text-ink" },
        { label: "جديدة", value: stats.isNew, cls: "text-info" },
        { label: "متكررة", value: stats.repeat, cls: "text-muted" },
      ];
  const typesLine = !isPoint && stats.types.length ? stats.types.map((t) => `${t.label} ${t.count}`).join(" · ") : "";

  return (
    <div className="animate-fade-up grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
      {/* ===== الأيام ===== */}
      <aside aria-label="الأيام" className="min-w-0">
        {/* الجوال: شريط أفقي */}
        <div className="scroll-fade -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden">
          {visible.map((d) => (
            <button
              key={d.date}
              onClick={() => setDate(d.date)}
              aria-current={d.date === date ? "date" : undefined}
              className={cn(
                "flex min-h-12 shrink-0 flex-col items-center justify-center rounded-xl border px-3 text-sm font-bold",
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
            <button onClick={() => setShowOld(true)} className="min-h-12 shrink-0 rounded-xl border border-dashed border-line px-3 text-sm font-bold text-brand">
              أيام أقدم
            </button>
          )}
        </div>

        {/* الشاشات الأكبر: قائمة جانبية مع مؤشر حجم العمل لكل يوم */}
        <Card className="sticky top-[150px] hidden overflow-hidden md:block">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-bold">
            <CalendarDays className="size-4 text-brand" />
            الأيام
            <span className="ms-auto text-xs font-semibold text-muted">{isPoint ? "حالة" : "إدخال"}</span>
          </div>
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
            {months.map((mk) => (
              <div key={mk}>
                <div className="sticky top-0 z-10 bg-sunken px-4 py-1.5 text-xs font-semibold text-muted">{monthLabel(mk)}</div>
                <ul>
                  {visible
                    .filter((d) => monthKey(d.date) === mk)
                    .map((d) => {
                      const on = d.date === date;
                      return (
                        <li key={d.date}>
                          <button
                            onClick={() => setDate(d.date)}
                            aria-current={on ? "date" : undefined}
                            className={cn(
                              "relative flex w-full items-center gap-2 border-s-4 px-3.5 py-2.5 text-start text-sm transition",
                              on ? "border-brand bg-brand-soft font-bold text-brand" : "border-transparent hover:bg-sunken/60",
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">
                                {d.date === today ? "اليوم · " : ""}
                                {weekday(d.date)} <span className="num">{dayNum(d.date)}</span>
                              </span>
                              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-line/70">
                                <span className={cn("block h-full rounded-full", on ? "bg-brand" : "bg-muted/40")} style={{ width: `${(d.count / maxCount) * 100}%` }} />
                              </span>
                            </span>
                            <span className={cn("num w-8 shrink-0 text-end text-sm font-bold", on ? "text-brand" : "text-muted")}>{d.count}</span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
          {hiddenOld > 0 && (
            <button
              onClick={() => setShowOld((v) => !v)}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 border-t border-line px-4 py-2.5 text-sm font-bold text-brand hover:bg-sunken/60"
            >
              <History className="size-4" />
              {showOld ? `آخر ${RECENT_DAYS} يوماً فقط` : `أيام أقدم (${hiddenOld})`}
            </button>
          )}
        </Card>
      </aside>

      {/* ===== إدخالات اليوم المختار ===== */}
      <Card className="min-w-0 overflow-hidden">
        <div className="space-y-4 border-b border-line px-4 pb-4 pt-4 sm:px-5">
          {/* العنوان والتنقل بين الأيام */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => newer && goto(newer)}
              disabled={!newer}
              aria-label="اليوم التالي"
              title="اليوم التالي"
              className="focus-ring grid size-10 shrink-0 place-items-center rounded-xl border border-line text-muted hover:bg-sunken hover:text-ink disabled:opacity-30"
            >
              <ChevronRight className="size-5" />
            </button>
            <div className="min-w-0 flex-1 text-center sm:text-start">
              <h2 className="truncate text-lg font-bold">
                {weekday(date)} <span className="num">{dayFull(date)}</span>
              </h2>
              <p className="text-xs text-muted">
                {isToday ? <span className="font-bold text-brand">اليوم · </span> : null}
                {isToday ? "إدخالاتك حتى الآن" : "للعرض فقط"}
                {typesLine && <span className="num"> · {typesLine}</span>}
              </p>
            </div>
            <button
              onClick={() => older && goto(older)}
              disabled={!older}
              aria-label="اليوم السابق"
              title="اليوم السابق"
              className="focus-ring grid size-10 shrink-0 place-items-center rounded-xl border border-line text-muted hover:bg-sunken hover:text-ink disabled:opacity-30"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => onShare(date, stats)}
              disabled={!dayEntries.length}
              aria-label="مشاركة إحصائيات هذا اليوم"
              title="مشاركة إحصائيات هذا اليوم"
              className="focus-ring inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#128c4a]/40 bg-[#e7f6ec] px-3 text-sm font-bold text-[#0f6b38] hover:bg-[#d6efdf] disabled:opacity-40"
            >
              <Share2 className="size-4" />
              <span className="hidden lg:inline">مشاركة</span>
            </button>
          </div>

          {/* المؤشرات */}
          <div className={cn("grid gap-2", isPoint ? "grid-cols-4" : "grid-cols-3")}>
            {kpis.map((k) => (
              <div key={k.label} className="min-w-0 rounded-xl bg-sunken px-2.5 py-2 sm:px-3">
                <div className={cn("num text-lg font-bold leading-tight sm:text-xl", k.cls)}>{k.value}</div>
                <div className="truncate text-xs font-semibold text-muted" title={k.label}>
                  {k.label}
                </div>
              </div>
            ))}
          </div>

          {/* البحث والترتيب */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                aria-label="بحث في إدخالات اليوم"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="بحث برقم الهوية أو الاسم"
                className="h-11 w-full rounded-xl border border-line bg-surface ps-9 pe-9 text-sm outline-hidden focus:border-brand"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  aria-label="مسح البحث"
                  className="absolute end-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-sunken"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div role="radiogroup" aria-label="الترتيب" className="flex h-11 rounded-xl bg-sunken p-1">
              {SORTS.map((o) => (
                <button
                  key={o.value}
                  role="radio"
                  aria-checked={sort === o.value}
                  onClick={() => setSort(o.value)}
                  title={o.label}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 text-sm font-bold transition",
                    sort === o.value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
                  )}
                >
                  <o.icon className="size-4" />
                  <span className={o.value === "queue" ? "" : "hidden sm:inline"}>{o.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* المشاريع: فلتر وملخص في صف واحد */}
          {dayProjects.length > 0 && (
            <div className="scroll-fade -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:-mx-5 sm:px-5 sm:pe-10">
              <FilterChip on={!project} onClick={() => setProject("")} label="كل المشاريع" count={dayEntries.length} />
              {dayProjects.map((p) => (
                <FilterChip
                  key={p}
                  on={project === p}
                  onClick={() => setProject(project === p ? "" : p)}
                  label={projectName(db, p)}
                  count={counts.get(p) ?? 0}
                  color={projectColor(db, p)}
                  sub={!isPoint ? `آخر دور ${lastNumber(db, center, p, date)}` : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* رؤوس الأعمدة على الشاشات الكبيرة */}
        {list.length > 0 && (
          <div className="hidden border-b border-line bg-sunken/50 px-5 py-2 text-xs font-semibold text-muted md:grid md:grid-cols-[76px_minmax(0,1fr)_112px_76px_minmax(0,0.9fr)_84px] md:items-center md:gap-3">
            <span>{sort === "queue" ? "الدور" : "الوقت"}</span>
            <span>المستفيد</span>
            <span>رقم الهوية</span>
            <span>{sort === "queue" ? "الوقت" : ""}</span>
            <span>{sort === "queue" ? (isPoint ? "" : "محوّلة أيضاً إلى") : "المشاريع والدور"}</span>
            <span className="text-end">
              {sort === "queue" && groups.length > 1 && (
                <button
                  onClick={() => setCollapsed(new Set(allOpen ? groups.map((g) => g.code) : []))}
                  className="focus-ring min-h-9 rounded-lg px-2.5 font-bold text-brand hover:bg-brand-soft"
                >
                  {allOpen ? "طيّ الكل" : "فتح الكل"}
                </button>
              )}
            </span>
          </div>
        )}

        {list.length && sort === "queue" ? (
          <div>
            {groups.length > 1 && (
              <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-muted sm:px-5 md:hidden">
                <span>{groups.length} مشاريع</span>
                <button
                  onClick={() => setCollapsed(new Set(allOpen ? groups.map((g) => g.code) : []))}
                  className="min-h-9 rounded-lg px-2 font-bold text-brand hover:bg-brand-soft"
                >
                  {allOpen ? "طيّ الكل" : "فتح الكل"}
                </button>
              </div>
            )}
            {groups.map((g) => {
              const c = projectColor(db, g.code);
              const closed = collapsed.has(g.code);
              return (
                <section key={g.code} aria-label={`دور ${projectName(db, g.code)}`}>
                  <button
                    onClick={() =>
                      setCollapsed((s) => {
                        const n = new Set(s);
                        if (n.has(g.code)) n.delete(g.code);
                        else n.add(g.code);
                        return n;
                      })
                    }
                    aria-expanded={!closed}
                    className="flex w-full items-center gap-2 border-b border-s-[6px] border-line px-4 py-2.5 text-start sm:px-5"
                    style={{ background: projectSoft(c), borderInlineStartColor: c }}
                  >
                    <span className="size-3 shrink-0 rounded-full" style={{ background: c }} aria-hidden />
                    <span className="font-bold" style={{ color: c }}>
                      دور {projectName(db, g.code)}
                    </span>
                    <span className="num rounded-full bg-surface px-2 text-xs font-bold leading-5 text-ink">{g.items.length}</span>
                    {!isPoint && (
                      <span className="text-xs font-semibold text-muted">
                        آخر دور <span className="num">{lastNumber(db, center, g.code, date)}</span>
                      </span>
                    )}
                    <ChevronDown className={cn("ms-auto size-4 text-muted transition", closed && "-rotate-90")} />
                  </button>
                  {!closed && (
                    <>
                      <ul className="divide-y divide-line/60">
                        {g.items.slice(0, limitOf(g.code)).map((r) => (
                          <Row key={r.e.id + r.project} e={r.e} db={db} isPoint={isPoint} canEdit={isToday} mode="queue" project={r.project} number={r.number} onOpen={() => onOpen(r.e.nid)} onEdit={() => setEdit(r.e)} />
                        ))}
                      </ul>
                      <MoreButton shown={limitOf(g.code)} total={g.items.length} onClick={() => showMore(g.code)} />
                    </>
                  )}
                </section>
              );
            })}
          </div>
        ) : list.length ? (
          <>
            <ul className="divide-y divide-line/60">
              {list.slice(0, limitOf("time")).map((e) => (
                <Row key={e.id} e={e} db={db} isPoint={isPoint} canEdit={isToday} mode="time" onOpen={() => onOpen(e.nid)} onEdit={() => setEdit(e)} />
              ))}
            </ul>
            <MoreButton shown={limitOf("time")} total={list.length} onClick={() => showMore("time")} />
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
            <CalendarDays className="size-9 text-muted/60" />
            <p className="font-semibold text-muted">
              {dayEntries.length ? "لا نتائج مطابقة للبحث" : isToday ? "لا توجد إدخالات لك اليوم بعد" : "لا توجد إدخالات في هذا اليوم"}
            </p>
            {dayEntries.length > 0 && (
              <button onClick={() => { setQ(""); setProject(""); }} className="text-sm font-bold text-brand hover:underline">
                مسح البحث والفلتر
              </button>
            )}
          </div>
        )}

        <p className="flex gap-2 border-t border-line px-5 py-3 text-xs text-muted">
          {isToday ? <Pencil className="size-4 shrink-0" /> : <Lock className="size-4 shrink-0" />}
          {isToday
            ? "الضغط على السطر يفتح بطاقة الهوية، وزر القلم لتعديل إدخالك أو حذفه."
            : "الأيام السابقة للعرض فقط. التعديل عليها للأدمن من سجل الأيام."}
        </p>
      </Card>

      <Dialog open={Boolean(edit)} onClose={() => setEdit(null)} title="تعديل إدخال" description={edit ? `${edit.nid} · ${formatTime(edit.at)}` : ""} size="lg">
        {edit && db.entries.some((x) => x.id === edit.id) ? (
          <EntryEditor
            key={edit.id}
            entry={db.entries.find((x) => x.id === edit.id)!}
            projects={isPoint && edit.kind === "POINT" ? activeProjects(db, center).filter((p) => user.projects.includes(p.code)) : activeProjects(db, center)}
            onMoved={() => setEdit(null)}
          />
        ) : (
          <p className="rounded-xl bg-sunken px-4 py-3 text-sm text-muted">تم حذف هذا الإدخال.</p>
        )}
      </Dialog>
    </div>
  );
}

function MoreButton({ shown, total, onClick }: { shown: number; total: number; onClick: () => void }) {
  if (total <= shown) return null;
  return (
    <button
      onClick={onClick}
      className="focus-ring flex min-h-12 w-full items-center justify-center gap-1.5 border-t border-line bg-sunken/40 px-4 text-sm font-bold text-brand hover:bg-sunken"
    >
      <ChevronDown className="size-4" />
      عرض المزيد <span className="num font-semibold text-muted">({total - shown})</span>
    </button>
  );
}

function FilterChip({ on, onClick, label, count, color, sub }: { on: boolean; onClick: () => void; label: string; count: number; color?: string; sub?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "focus-ring flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-start transition",
        on ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-muted/40",
      )}
      style={on && color ? { borderColor: color, background: projectSoft(color) } : undefined}
    >
      {color && <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />}
      <span className="leading-tight">
        <span className={cn("block text-sm font-bold", on && !color && "text-brand")} style={on && color ? { color } : undefined}>
          {label} <span className="num font-semibold text-muted">{count}</span>
        </span>
        {sub && <span className="num block text-xs font-semibold text-muted">{sub}</span>}
      </span>
    </button>
  );
}

/** سطر في السجل: أعمدة على الشاشات الكبيرة، وبطاقة مضغوطة على الجوال */
function Row({
  e,
  db,
  isPoint,
  canEdit,
  mode,
  project,
  number,
  onOpen,
  onEdit,
}: {
  e: Entry;
  db: Db;
  isPoint: boolean;
  canEdit: boolean;
  mode: "queue" | "time";
  project?: string;
  number?: number;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const b = db.beneficiaries[e.nid];
  const pq = isPoint ? pointQueue(db, e) : null;
  const otherId = pq?.reception && pq.reception.nid !== e.nid;
  const isReferral = isPoint && e.kind === "RECEPTION";
  const others = mode === "queue" && !isPoint ? e.projects.filter((p) => p !== project) : [];
  const color = project ? projectColor(db, project) : undefined;

  const lead =
    mode === "queue" ? (
      <span
        className={cn("flex h-12 w-[60px] shrink-0 flex-col items-center justify-center rounded-xl leading-none md:w-[76px]", number ? "text-white" : "bg-sunken text-muted")}
        style={number ? { background: color } : undefined}
        title={number ? `رقم الدور في ${projectName(db, project!)}` : "بدون دور"}
      >
        <span className="num text-xl font-bold">{number ?? "—"}</span>
        <span className="mt-0.5 max-w-full truncate px-1 text-[11px] font-bold opacity-90">{number ? projectName(db, project!) : "بدون دور"}</span>
      </span>
    ) : (
      <span className="num w-[68px] shrink-0 whitespace-nowrap text-sm font-bold md:w-[76px]">{formatTime(e.at)}</span>
    );

  return (
    <li className="group flex items-center gap-1 pe-2 hover:bg-sunken/40">
      <button
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-start sm:px-5 md:grid md:grid-cols-[76px_minmax(0,1fr)_112px_76px_minmax(0,0.9fr)] md:gap-3"
      >
        {lead}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-bold">{b?.name || "بدون اسم"}</span>
            <IdTypeTag type={b?.type} />
            {e.isNew && <span className="rounded bg-info-soft px-1.5 text-xs font-bold text-info">جديدة</span>}
            <EntryBadges e={e} db={db} />
            {isReferral && <span className="rounded bg-info-soft px-1.5 text-xs font-bold text-info">تحويل منك</span>}
          </span>
          {/* الجوال: الهوية والوقت تحت الاسم */}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted md:hidden">
            <span className="num font-semibold tracking-wider text-ink/80">{e.nid}</span>
            {mode === "queue" && <span className="num">{formatTime(e.at)}</span>}
            {others.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 font-semibold">
                <span className="size-1.5 rounded-full" style={{ background: projectColor(db, p) }} aria-hidden />
                {projectName(db, p)}
                {e.queue?.[p] ? (
                  <span className="num rounded px-1 text-[11px] leading-4 text-white" style={{ background: projectColor(db, p) }}>
                    {e.queue[p]}
                  </span>
                ) : null}
              </span>
            ))}
          </span>
          {(e.corrected || otherId) && (
            <span className="mt-1 flex flex-wrap gap-1 text-xs">
              {e.corrected && !isReferral && (
                <span className="inline-flex items-center gap-1 rounded-md bg-warn-soft px-1.5 py-0.5 font-bold text-warn">
                  <PenLine className="size-3" />
                  {correctionText(db, e.corrected)}
                </span>
              )}
              {otherId && (
                <span className="rounded-md bg-sunken px-1.5 py-0.5 font-semibold text-muted">
                  على دور {db.beneficiaries[pq!.reception!.nid]?.name || pq!.reception!.nid} (بهوية أخرى)
                </span>
              )}
            </span>
          )}
        </span>
        <span className="num hidden text-sm font-semibold tracking-wider text-ink/80 md:block">{e.nid}</span>
        <span className="num hidden whitespace-nowrap text-sm text-muted md:block">{mode === "queue" ? formatTime(e.at) : ""}</span>
        <span className="hidden flex-wrap gap-1 md:flex">
          {mode === "time" &&
            e.projects.map((p) => <ProjectChip key={p} db={db} code={p} number={isPoint ? pq?.number : e.queue?.[p]} />)}
          {mode === "time" && isPoint && !pq?.number && !isReferral && (
            <span className="rounded-md bg-sunken px-1.5 py-0.5 text-xs font-semibold text-muted">بدون دور</span>
          )}
          {others.map((p) => (
            <ProjectChip key={p} db={db} code={p} number={e.queue?.[p]} />
          ))}
        </span>
        {/* الجوال: المشاريع في وضع الوقت */}
        {mode === "time" && (
          <span className="flex shrink-0 flex-col items-end gap-1 md:hidden">
            {e.projects.map((p) => (
              <ProjectChip key={p} db={db} code={p} number={isPoint ? pq?.number : e.queue?.[p]} />
            ))}
          </span>
        )}
      </button>
      <span className="flex w-[84px] shrink-0 items-center justify-end gap-1">
        {canEdit && (
          <button
            onClick={onEdit}
            aria-label="تعديل الإدخال"
            title="تعديل الإدخال"
            className="focus-ring grid size-10 place-items-center rounded-lg text-brand hover:bg-brand-soft"
          >
            <Pencil className="size-4" />
          </button>
        )}
        <button onClick={onOpen} aria-label="فتح بطاقة الهوية" title="فتح بطاقة الهوية" className="focus-ring hidden size-10 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-brand sm:grid">
          <ChevronLeft className="size-4" />
        </button>
      </span>
    </li>
  );
}
