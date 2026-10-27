"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  CalendarClock,
  ChevronDown,
  CopyCheck,
  Fingerprint,
  GitMerge,
  Info,
  Layers,
  Percent,
  Search,
  Share2,
  Users2,
  X,
} from "lucide-react";
import { Bar, CenterTabs, DateField, ExportButton, FilterBar, PageHead, SectionHead, Segmented, StatCard } from "@/components/admin/bits";
import { IdTypeTag } from "@/components/entry/id-fields";
import { ShareDialog } from "@/components/entry/share-dialog";
import { Card } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { allProjects, type CenterFilter, centerName, projectName, userName } from "@/lib/queries";
import type { Db } from "@/lib/types";
import { overlapReport, pairKey, type OverlapRow, type OverlapScope } from "@/lib/overlap";
import { projectColor, projectSoft } from "@/lib/project-colors";
import { addDays, cn, dayFull, dateKey, formatTime, normalizeArabicName, normalizeDigits, todayKey, weekday } from "@/lib/utils";

type Period = "today" | "7" | "month" | "30" | "custom";
type Sort = "projects" | "recent" | "services";
const PAGE = 40;

/** تقرير التكرار: الهويات التي خدمها أكثر من مشروع */
export default function OverlapPage() {
  const { db } = useStore();
  const today = todayKey();
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [center, setCenter] = useState<CenterFilter>("ALL");
  const [scope, setScope] = useState<OverlapScope>("period");
  const [q, setQ] = useState("");
  const [project, setProject] = useState("");
  const [pair, setPair] = useState<[string, string] | null>(null);
  const [sort, setSort] = useState<Sort>("projects");
  const [open, setOpen] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [share, setShare] = useState(false);
  // الجوال: التقرير مقسّم لتبويبات بدل صفحة طويلة جداً (الشاشات الكبيرة تعرض كل الأقسام)
  const [mview, setMview] = useState<"summary" | "matrix" | "list">("summary");
  const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
  /** فتح قائمة الهويات بعد اختيار مشروع أو زوج */
  const toList = (always = false) => {
    setMview("list");
    if (always || isMobile()) requestAnimationFrame(() => document.getElementById("overlap-list")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const range = useMemo((): [string, string] => {
    if (period === "today") return [today, today];
    if (period === "7") return [addDays(today, -6), today];
    if (period === "30") return [addDays(today, -29), today];
    if (period === "month") return [`${today.slice(0, 7)}-01`, today];
    return from <= to ? [from, to] : [to, from];
  }, [period, from, to, today]);

  const r = useMemo(() => overlapReport(db, range[0], range[1], center, scope), [db, range, center, scope]);
  useEffect(() => setShown(PAGE), [range, center, scope, q, project, pair, sort]);

  /* المشاريع التي ظهرت في التقرير، بترتيبها في النظام */
  const projects = useMemo(() => allProjects(db).filter((p) => r.perProject.has(p.code)), [db, r]);
  const pairList = useMemo(() => [...r.pairs.entries()].map(([k, n]) => ({ a: k.split("|")[0], b: k.split("|")[1], n })).sort((x, y) => y.n - x.n), [r.pairs]);
  const maxPair = Math.max(1, ...pairList.map((p) => p.n));
  const rate = r.servedIds ? Math.round((r.rows.length / r.servedIds) * 1000) / 10 : 0;
  const top = pairList[0];

  const list = useMemo(() => {
    const digits = normalizeDigits(q);
    const term = normalizeArabicName(q);
    const has = (row: OverlapRow, c: string) => row.projects.some((p) => p.code === c);
    return r.rows
      .filter((row) => !project || has(row, project))
      .filter((row) => !pair || (has(row, pair[0]) && has(row, pair[1])))
      .filter((row) => !q.trim() || (digits ? row.nid.includes(digits) : normalizeArabicName(db.beneficiaries[row.nid]?.name ?? "").includes(term)))
      .sort((a, b) =>
        sort === "recent"
          ? b.last.localeCompare(a.last)
          : sort === "services"
            ? b.services.length - a.services.length || b.projects.length - a.projects.length
            : b.projects.length - a.projects.length || b.services.length - a.services.length,
      );
  }, [r.rows, project, pair, q, sort, db.beneficiaries]);

  const periodLabel = range[0] === range[1] ? dayFull(range[0]) : `${dayFull(range[0])} – ${dayFull(range[1])}`;
  const shareText = useMemo(() => {
    const lines = [
      "🔁 تقرير تكرار الخدمة — أرض الإنسان",
      `الفترة: ${periodLabel}${center === "ALL" ? "" : ` · ${centerName(db, center)}`}`,
      scope === "day" ? "النطاق: نفس الهوية في أكثر من مشروع بنفس اليوم" : "النطاق: نفس الهوية في أكثر من مشروع خلال الفترة",
      "",
      `هويات مكررة: ${r.rows.length} من ${r.servedIds} هوية مخدومة (${rate}%)`,
      `خدمات على هويات مكررة: ${r.dupServices}`,
    ];
    if (pairList.length) {
      lines.push("", "أكثر المشاريع تداخلاً:");
      pairList.slice(0, 5).forEach((p) => lines.push(`• ${projectName(db, p.a)} + ${projectName(db, p.b)}: ${p.n}`));
    }
    return lines.join("\n");
  }, [periodLabel, center, scope, r, rate, pairList, db]);

  return (
    <>
      <PageHead
        title="تقرير التكرار"
        sub="الهويات التي خدمها أكثر من مشروع — حسب إدخالات نقاط المشاريع"
        actions={
          <>
            <button
              onClick={() => setShare(true)}
              disabled={!r.rows.length}
              className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-bold hover:bg-sunken disabled:opacity-40"
            >
              <Share2 className="size-4" />
              مشاركة الملخص
            </button>
            <ExportButton label="تصدير التقرير" scope="تقرير التكرار" />
          </>
        }
      />

      <FilterBar>
        <Segmented
          label="الفترة"
          className="max-sm:scroll-fade"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "today", label: "اليوم" },
            { value: "7", label: "7 أيام" },
            { value: "month", label: "هذا الشهر" },
            { value: "30", label: "30 يوماً" },
            { value: "custom", label: "مخصص" },
          ]}
        />
        {period === "custom" && (
          <div className="flex items-center gap-1.5 rounded-xl bg-sunken p-1">
            <DateField label="من" max={today} value={from} onChange={setFrom} className="h-10 bg-surface shadow-sm" />
            <span className="px-0.5 text-xs font-bold text-muted">إلى</span>
            <DateField label="إلى" max={today} value={to} onChange={setTo} className="h-10 bg-surface shadow-sm" />
          </div>
        )}
        <CenterTabs value={center} onChange={setCenter} />
        <Segmented
          label="نطاق التكرار"
          value={scope}
          onChange={setScope}
          options={[
            { value: "period", label: "خلال الفترة" },
            { value: "day", label: "بنفس اليوم" },
          ]}
        />
      </FilterBar>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="هويات مكررة"
          value={r.rows.length}
          tone={r.rows.length ? "warn" : "ok"}
          icon={CopyCheck}
          hint={`من ${r.servedIds.toLocaleString("en-US")} هوية مخدومة`}
        />
        <StatCard label="نسبة التكرار" value={rate} suffix="%" tone={rate >= 20 ? "warn" : "ink"} icon={Percent} hint="من الهويات المخدومة" />
        <StatCard label="خدمات الهويات المكررة" value={r.dupServices} tone="info" icon={Layers} hint={`من ${r.servedServices.toLocaleString("en-US")} خدمة`} />
        <StatCard
          label="أكثر تداخل"
          value={top ? top.n : "—"}
          icon={GitMerge}
          hint={top ? `${projectName(db, top.a)} + ${projectName(db, top.b)}` : "لا يوجد"}
        />
      </div>

      {r.rows.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center gap-2 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-ok-soft text-ok">
            <CopyCheck className="size-7" />
          </span>
          <p className="text-lg font-bold">لا يوجد تكرار في هذه الفترة</p>
          <p className="max-w-md text-sm text-muted">
            لم تُخدم أي هوية في أكثر من مشروع {scope === "day" ? "بنفس اليوم" : "خلال الفترة"}. جرّب فترة أطول أو مركزاً آخر.
          </p>
        </Card>
      ) : (
        <>
          {/* تبويبات الجوال */}
          <div className="sticky top-14 z-20 -mx-4 mt-5 bg-bg/90 px-4 py-2 backdrop-blur lg:hidden">
            <Segmented
              label="أقسام التقرير"
              value={mview}
              onChange={setMview}
              className="flex w-full [&>button]:flex-1"
              options={[
                { value: "summary", label: "الملخص" },
                { value: "matrix", label: "المصفوفة" },
                { value: "list", label: "الهويات", count: list.length },
              ]}
            />
          </div>

          <div className="grid gap-6 max-lg:mt-3 lg:mt-6">
            {/* مصفوفة التداخل */}
            <Card className={cn("overflow-hidden", mview !== "matrix" && "max-lg:hidden")}>
              <SectionHead title="مصفوفة التداخل بين المشاريع" icon={GitMerge} sub="عدد الهويات المشتركة بين كل مشروعين. اضغط على أي خانة لعرض هوياتها" />
              <div className="overflow-x-auto p-3 sm:p-4">
                <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-1 text-xs">
                  <thead>
                    <tr>
                      <th className="w-32" />
                      {projects.map((p) => (
                        <th key={p.code} className="px-1 pb-1 align-bottom font-bold" title={p.name}>
                          <span className="mx-auto mb-1 block size-2 rounded-full" style={{ background: projectColor(db, p.code) }} />
                          <span className="block truncate">{p.name}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((row) => (
                      <tr key={row.code}>
                        <th className="whitespace-nowrap pe-2 text-start font-bold">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="size-2 rounded-full" style={{ background: projectColor(db, row.code) }} />
                            <span className="max-w-[130px] truncate">{row.name}</span>
                          </span>
                        </th>
                        {projects.map((col) => {
                          if (row.code === col.code) {
                            const pp = r.perProject.get(row.code)!;
                            return (
                              <td
                                key={col.code}
                                className="h-11 min-w-11 rounded-lg bg-sunken/60 text-center text-xs text-muted"
                                title={`${row.name}: ${pp.served} هوية مخدومة`}
                              >
                                <span className="num">{pp.served}</span>
                              </td>
                            );
                          }
                          const n = r.pairs.get(pairKey(row.code, col.code)) ?? 0;
                          const on = pair && pairKey(pair[0], pair[1]) === pairKey(row.code, col.code);
                          return (
                            <td key={col.code} className="p-0">
                              <button
                                disabled={!n}
                                onClick={() => {
                                  setPair(on ? null : [row.code, col.code]);
                                  setProject("");
                                  toList(true);
                                }}
                                title={`${row.name} + ${col.name}: ${n} هوية`}
                                className={cn(
                                  "num grid h-11 w-full min-w-11 place-items-center rounded-lg text-sm font-bold transition",
                                  n ? "hover:ring-2 hover:ring-ink/30" : "text-muted/40",
                                  on && "ring-2 ring-ink",
                                )}
                                style={
                                  n
                                    ? {
                                        background: `color-mix(in srgb, var(--color-warn) ${Math.round((n / maxPair) * 70) + 12}%, var(--color-surface))`,
                                        color: n / maxPair > 0.55 ? "white" : undefined,
                                      }
                                    : undefined
                                }
                              >
                                {n || "·"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="flex gap-2 border-t border-line px-4 py-3 text-xs text-muted sm:px-5">
                <Info className="size-4 shrink-0" />
                القطر الرمادي = عدد الهويات التي خدمها المشروع. الخانة الأغمق = تداخل أكبر.
              </p>
            </Card>

            <div className={cn("grid min-w-0 gap-6 lg:grid-cols-2", mview !== "summary" && "max-lg:hidden")}>
              {/* أكثر الأزواج */}
              <Card className="overflow-hidden">
                <SectionHead title="أكثر المشاريع تداخلاً" icon={ArrowDownWideNarrow} />
                <ul className="divide-y divide-line/60">
                  {pairList.slice(0, 6).map((p) => {
                    const on = pair && pairKey(pair[0], pair[1]) === pairKey(p.a, p.b);
                    return (
                      <li key={p.a + p.b}>
                        <button
                          onClick={() => {
                            setPair(on ? null : [p.a, p.b]);
                            setProject("");
                            if (!on) toList();
                          }}
                          className={cn("w-full space-y-1.5 px-4 py-2.5 text-start hover:bg-sunken/50 sm:px-5", on && "bg-warn-soft/60")}
                        >
                          <span className="flex items-center justify-between gap-2 text-sm">
                            <span className="flex min-w-0 items-center gap-1.5 font-bold">
                              <Dot c={projectColor(db, p.a)} />
                              <span className="truncate">{projectName(db, p.a)}</span>
                              <span className="text-muted">+</span>
                              <Dot c={projectColor(db, p.b)} />
                              <span className="truncate">{projectName(db, p.b)}</span>
                            </span>
                            <span className="num shrink-0 font-bold">{p.n}</span>
                          </span>
                          <Bar value={p.n} max={maxPair} color="var(--color-warn)" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              {/* التوزيع */}
              <Card className="overflow-hidden">
                <SectionHead title="عدد المشاريع لكل هوية مكررة" icon={Users2} />
                <div className="grid grid-cols-[repeat(auto-fit,minmax(84px,1fr))] gap-2 p-4 sm:p-5">
                  {[...r.spread.entries()]
                    .sort((a, b) => a[0] - b[0])
                    .map(([n, c]) => (
                      <div key={n} className="rounded-xl bg-sunken px-3 py-3 text-center">
                        <div className="num text-2xl font-bold">{c}</div>
                        <div className="text-xs font-semibold text-muted">
                          في <span className="num">{n}</span> مشاريع
                        </div>
                        <div className="num mt-1 text-xs font-bold text-warn">{Math.round((c / r.rows.length) * 100)}%</div>
                      </div>
                    ))}
                </div>
              </Card>
            </div>
          </div>

          {/* نسبة التداخل لكل مشروع */}
          <Card className={cn("mt-6 overflow-hidden", mview !== "summary" && "max-lg:hidden")}>
            <SectionHead title="نسبة التداخل لكل مشروع" icon={Percent} sub="من الهويات التي خدمها المشروع، كم منها خدمها مشروع آخر أيضاً" />
            <ul className="grid gap-x-8 gap-y-3 p-4 sm:grid-cols-2 sm:p-5">
              {projects
                .map((p) => ({ p, s: r.perProject.get(p.code)! }))
                .sort((a, b) => b.s.shared / b.s.served - a.s.shared / a.s.served)
                .map(({ p, s }) => {
                  const pct = Math.round((s.shared / s.served) * 100);
                  return (
                    <li key={p.code}>
                      <button
                        onClick={() => {
                          setProject(project === p.code ? "" : p.code);
                          setPair(null);
                          if (project !== p.code) toList();
                        }}
                        className="focus-ring w-full space-y-1.5 rounded-lg text-start"
                      >
                        <span className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex items-center gap-1.5 font-bold">
                            <Dot c={projectColor(db, p.code)} />
                            {p.name}
                          </span>
                          <span className="num text-xs text-muted">
                            <b className="text-ink">{s.shared}</b> من {s.served} · <b className={pct >= 30 ? "text-warn" : "text-ink"}>{pct}%</b>
                          </span>
                        </span>
                        <Bar value={s.shared} max={s.served} color={projectColor(db, p.code)} />
                      </button>
                    </li>
                  );
                })}
            </ul>
          </Card>

          {/* القائمة التفصيلية */}
          <Card id="overlap-list" className={cn("scroll-mt-32 overflow-hidden max-lg:mt-3 lg:mt-6 lg:scroll-mt-4", mview !== "list" && "max-lg:hidden")}>
            <SectionHead title="الهويات المكررة" icon={Fingerprint} sub={`${list.length} هوية · ${periodLabel}`} />
            <div className="space-y-3 border-b border-line p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <input
                    aria-label="بحث"
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
                <Segmented
                  label="الترتيب"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: "projects", label: "الأكثر مشاريع" },
                    { value: "services", label: "الأكثر خدمات" },
                    { value: "recent", label: "الأحدث" },
                  ]}
                />
              </div>
              <div className="scroll-fade -mx-3 flex gap-2 overflow-x-auto px-3 pb-0.5 sm:-mx-4 sm:px-4 sm:pe-10">
                {pair ? (
                  <button
                    onClick={() => setPair(null)}
                    className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border-2 border-warn bg-warn-soft px-3 text-sm font-bold text-warn"
                  >
                    {projectName(db, pair[0])} + {projectName(db, pair[1])}
                    <X className="size-4" />
                  </button>
                ) : null}
                <button
                  onClick={() => {
                    setProject("");
                    setPair(null);
                  }}
                  className={cn(
                    "min-h-10 shrink-0 rounded-xl border px-3 text-sm font-bold",
                    !project && !pair ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface",
                  )}
                >
                  الكل <span className="num font-semibold text-muted">{r.rows.length}</span>
                </button>
                {projects.map((p) => {
                  const on = project === p.code;
                  const c = projectColor(db, p.code);
                  return (
                    <button
                      key={p.code}
                      onClick={() => {
                        setProject(on ? "" : p.code);
                        setPair(null);
                      }}
                      className={cn(
                        "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-bold",
                        !on && "border-line bg-surface",
                      )}
                      style={on ? { borderColor: c, background: projectSoft(c), color: c } : undefined}
                    >
                      <Dot c={c} />
                      {p.name} <span className="num font-semibold text-muted">{r.perProject.get(p.code)!.shared}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* رؤوس الأعمدة */}
            <div className="hidden border-b border-line bg-sunken/50 px-5 py-2 text-xs font-semibold text-muted md:grid md:grid-cols-[minmax(0,1.1fr)_110px_minmax(0,1.6fr)_90px_120px_32px] md:gap-3">
              <span>المستفيد</span>
              <span>رقم الهوية</span>
              <span>المشاريع وعدد الخدمات</span>
              <span className="text-center">الخدمات</span>
              <span>آخر خدمة</span>
              <span />
            </div>

            <ul className="divide-y divide-line/60">
              {list.slice(0, shown).map((row) => {
                const b = db.beneficiaries[row.nid];
                const isOpen = open === row.nid;
                return (
                  <li key={row.nid} className={cn(isOpen && "bg-sunken/30")}>
                    <button
                      onClick={() => setOpen(isOpen ? null : row.nid)}
                      aria-expanded={isOpen}
                      className="flex w-full items-start gap-3 px-4 py-3 text-start hover:bg-sunken/40 sm:px-5 md:grid md:grid-cols-[minmax(0,1.1fr)_110px_minmax(0,1.6fr)_90px_120px_32px] md:items-center"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warn-soft text-sm font-bold text-warn md:hidden">
                        <span className="num">{row.projects.length}</span>
                      </span>
                      <span className="min-w-0 flex-1 space-y-1 md:contents">
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="truncate font-bold">{b?.name || "بدون اسم"}</span>
                          <IdTypeTag type={b?.type} />
                          {row.sameDays.length > 0 && (
                            <span
                              className="inline-flex items-center gap-1 rounded-md bg-bad-soft px-1.5 py-0.5 text-xs font-bold text-bad"
                              title={row.sameDays.map(dayFull).join("، ")}
                            >
                              <CalendarClock className="size-3" />
                              بنفس اليوم{row.sameDays.length > 1 ? ` ×${row.sameDays.length}` : ""}
                            </span>
                          )}
                        </span>
                        <span className="num block text-xs font-semibold tracking-wider text-ink/80 md:text-sm">{row.nid}</span>
                        <span className="flex flex-wrap gap-1">
                          {row.projects.map((p) => (
                            <span
                              key={p.code}
                              className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold"
                              style={{ background: projectSoft(projectColor(db, p.code)), color: projectColor(db, p.code) }}
                            >
                              {projectName(db, p.code)}
                              <span className="num rounded bg-surface/80 px-1 text-xs text-ink">{p.count}</span>
                            </span>
                          ))}
                        </span>
                        <span className="num hidden text-center font-bold md:block">{row.services.length}</span>
                        <span className="block text-xs text-muted md:text-sm">
                          <span className="md:hidden">آخر خدمة </span>
                          {dayFull(dateKey(row.last))} <span className="num">{formatTime(row.last)}</span>
                        </span>
                      </span>
                      <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted transition md:mt-0", isOpen && "rotate-180")} />
                    </button>

                    {isOpen && <Timeline row={row} db={db} />}
                  </li>
                );
              })}
            </ul>
            {!list.length && <p className="px-4 py-12 text-center text-sm text-muted">لا توجد هويات مطابقة للفلتر</p>}
            {list.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
                <span className="num text-muted">
                  عرض {Math.min(shown, list.length)} من {list.length}
                </span>
                {shown < list.length && (
                  <button
                    onClick={() => setShown((n) => n + PAGE)}
                    className="focus-ring min-h-10 rounded-xl border border-line px-4 font-bold text-brand hover:bg-brand-soft"
                  >
                    عرض {Math.min(PAGE, list.length - shown)} أخرى
                  </button>
                )}
              </div>
            )}
          </Card>
        </>
      )}

      <p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted">
        <Info className="size-4 shrink-0" />
        التكرار يُحسب من الخدمات التي سجّلتها نقاط المشاريع فقط، ومشاريع الطبيب مستثناة لأنها خدمة طبية إضافية. &quot;خلال الفترة&quot;: نفس الهوية خدمها مشروعان أو أكثر في أي يوم ضمن الفترة. &quot;بنفس
        اليوم&quot;: خدمها مشروعان أو أكثر في اليوم ذاته. لوحة التحكم تعرض آخر 62 يوماً.
      </p>

      <ShareDialog open={share} onClose={() => setShare(false)} title="مشاركة ملخص التكرار" text={shareText} />
    </>
  );
}

/** الخط الزمني لخدمات هوية واحدة */
function Timeline({ row, db }: { row: OverlapRow; db: Db }) {
  const days = [...new Set(row.services.map((s) => s.date))];
  return (
    <div className="border-t border-line/60 px-4 pb-4 pt-3 sm:px-5 md:ps-16">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          <b className="num text-ink">{row.services.length}</b> خدمة في <b className="num text-ink">{days.length}</b> يوم
        </span>
        <span>المراكز: {row.centers.map((c) => centerName(db, c, true)).join("، ")}</span>
      </div>
      <ol className="relative space-y-2 border-s-2 border-line ps-4">
        {days.map((d) => {
          const items = row.services.filter((s) => s.date === d);
          const multi = new Set(items.flatMap((s) => s.projects)).size > 1;
          return (
            <Fragment key={d}>
              <li className="relative">
                <span className={cn("absolute -start-[23px] top-1 size-3 rounded-full border-2 border-surface", multi ? "bg-bad" : "bg-muted/50")} />
                <div className="text-xs font-bold">
                  {weekday(d)} <span className="num">{dayFull(d)}</span>
                  {multi && <span className="ms-2 rounded bg-bad-soft px-1.5 text-xs text-bad">أكثر من مشروع</span>}
                </div>
                <ul className="mt-1 space-y-1">
                  {items.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                      <span className="num w-[68px] shrink-0 whitespace-nowrap text-xs text-muted">{formatTime(s.at)}</span>
                      {s.projects.map((p) => (
                        <span key={p} className="inline-flex items-center gap-1 font-bold" style={{ color: projectColor(db, p) }}>
                          <Dot c={projectColor(db, p)} />
                          {projectName(db, p)}
                        </span>
                      ))}
                      <span className="text-xs text-muted">
                        · {userName(db, s.userId)} · {centerName(db, s.center, true)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}

function Dot({ c }: { c: string }) {
  return <span className="size-2 shrink-0 rounded-full" style={{ background: c }} aria-hidden />;
}
