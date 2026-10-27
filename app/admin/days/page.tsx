"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck2, ChevronLeft, Stethoscope, Store, TrendingUp } from "lucide-react";
import { CenterTabs, CoverageBar, ExportButton, FilterBar, MonthSelect, PageHead, Segmented, StatCard } from "@/components/admin/bits";
import { Card } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { activeProjects, allProjects, type CenterFilter, dayStats, months, workedDays } from "@/lib/queries";
import { projectColor } from "@/lib/project-colors";
import { cn, dayNum, monthLabel, todayKey, weekday } from "@/lib/utils";

/** الشاشة 5 — سجل الأيام والتصدير */
export default function DaysPage() {
  const { db } = useStore();
  const router = useRouter();
  const today = todayKey();
  const monthList = useMemo(() => months(db), [db]);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [center, setCenter] = useState<CenterFilter>("ALL");
  const [mode, setMode] = useState<"served" | "referred">("served");

  const days = useMemo(() => workedDays(db, center, month), [db, center, month]);
  const stats = useMemo(() => days.map((d) => dayStats(db, d, center)), [db, days, center]);
  const projects = useMemo(() => {
    const used = new Set(stats.flatMap((s) => s.projects.filter((p) => p.referred || p.served).map((p) => p.code)));
    const act = new Set(activeProjects(db).map((p) => p.code));
    return allProjects(db).filter((p) => act.has(p.code) || used.has(p.code));
  }, [db, stats]);

  const val = (s: (typeof stats)[number], code: string) => {
    const r = s.projects.find((p) => p.code === code)!;
    return mode === "served" ? r.served : r.referred;
  };
  const sumP = (s: (typeof stats)[number], k: "served" | "referred") => s.projects.reduce((n, p) => n + p[k], 0);
  const totals = projects.map((p) => stats.reduce((n, s) => n + val(s, p.code), 0));
  const recTotal = stats.reduce((n, s) => n + s.reception, 0);
  const ptTotal = stats.reduce((n, s) => n + s.point, 0);
  const full = stats.filter((s) => s.date !== today);
  const avg = full.length ? Math.round(full.reduce((n, s) => n + s.reception, 0) / full.length) : 0;
  const best = [...stats].sort((a, b) => b.reception - a.reception)[0];
  const max = Math.max(1, ...stats.flatMap((s) => projects.map((p) => val(s, p.code))));
  const open = (d: string) => router.push(`/admin/day?d=${d}&c=${center}`);

  return (
    <>
      <PageHead
        title="سجل الأيام"
        sub={`${days.length} يوم عمل في ${monthLabel(month)}`}
        actions={<ExportButton label={`تصدير ${monthLabel(month)}`} scope={`شهر ${monthLabel(month)}`} />}
      />

      <FilterBar>
        <MonthSelect value={month} onChange={setMonth} months={monthList} />
        <CenterTabs value={center} onChange={setCenter} />
      </FilterBar>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="أيام العمل" value={days.length} icon={CalendarCheck2} hint={monthLabel(month)} />
        <StatCard label="حالات الاستقبال" value={recTotal} tone="brand" icon={Store} hint={`متوسط ${avg} يومياً`} />
        <StatCard label="خُدمت في النقاط" value={ptTotal} tone="ok" icon={Stethoscope} />
        <StatCard
          label="أعلى يوم استقبال"
          value={best ? best.reception : 0}
          tone="info"
          icon={TrendingUp}
          hint={best ? `${weekday(best.date)} ${dayNum(best.date)}` : undefined}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-base font-bold sm:text-lg">الأيام</h2>
            <p className="text-xs text-muted">اضغط على أي يوم لعرض تفاصيله وكل إدخالاته</p>
          </div>
          <Segmented
            label="أرقام المشاريع"
            value={mode}
            onChange={setMode}
            options={[
              { value: "served", label: "مخدوم" },
              { value: "referred", label: "موجّه" },
            ]}
          />
        </div>

        {/* الجوال: قائمة أيام */}
        <ul className="divide-y divide-line/60 md:hidden">
          {stats.map((s) => (
            <li key={s.date}>
              <Link href={`/admin/day?d=${s.date}&c=${center}`} className="flex items-center gap-3 px-4 py-3 active:bg-sunken">
                <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl text-center leading-tight", s.date === today ? "bg-brand text-brand-ink" : "bg-sunken")}>
                  <span>
                    <span className="num block text-lg font-bold">{dayNum(s.date).split("/")[0]}</span>
                    <span className="block text-[11px] font-semibold opacity-80">{weekday(s.date)}</span>
                  </span>
                </span>
                <span className="min-w-0 flex-1 space-y-1.5">
                  <span className="num flex gap-3 text-sm">
                    <span>
                      استقبال <b className="text-brand">{s.reception}</b>
                    </span>
                    <span>
                      نقاط <b className="text-ok">{s.point}</b>
                    </span>
                  </span>
                  <CoverageBar served={sumP(s, "served")} referred={sumP(s, "referred")} compact />
                </span>
                <ChevronLeft className="size-4 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
          {!stats.length && <li className="px-4 py-12 text-center text-sm text-muted">لا توجد أيام عمل في هذا الشهر</li>}
        </ul>

        {/* الشاشات الأكبر: جدول حراري */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-sunken/60 text-xs text-muted">
              <tr>
                <th className="sticky start-0 z-10 bg-sunken px-4 py-3 text-start font-semibold">اليوم</th>
                <th className="px-3 py-3 text-center font-semibold">الاستقبال</th>
                {projects.map((p) => (
                  <th key={p.code} className="px-2 py-3 text-center font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <span className="size-2 rounded-full" style={{ background: projectColor(db, p.code) }} />
                      {p.name}
                    </span>
                  </th>
                ))}
                <th className="min-w-[150px] px-3 py-3 text-start font-semibold">نسبة الخدمة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {stats.map((s) => (
                <tr
                  key={s.date}
                  tabIndex={0}
                  onClick={() => open(s.date)}
                  onKeyDown={(e) => e.key === "Enter" && open(s.date)}
                  className="group cursor-pointer outline-hidden hover:bg-sunken/50 focus-visible:bg-brand-soft/50"
                >
                  <td className="sticky start-0 bg-surface px-4 py-2.5 group-hover:bg-sunken">
                    <span className="whitespace-nowrap">
                      <span className="font-bold">{weekday(s.date)}</span> <span className="num text-muted">{dayNum(s.date)}</span>
                      {s.date === today && <span className="ms-2 rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-bold text-brand">اليوم</span>}
                    </span>
                  </td>
                  <td className="num px-3 py-2.5 text-center font-bold text-brand">{s.reception}</td>
                  {projects.map((p) => {
                    const v = val(s, p.code);
                    return (
                      <td key={p.code} className="px-1 py-1.5 text-center">
                        <span
                          className={cn("num block rounded-md py-1 font-semibold", !v && "text-muted/50")}
                          style={{ background: v ? `color-mix(in srgb, var(--color-ok) ${Math.round((v / max) * 26) + 4}%, transparent)` : undefined }}
                        >
                          {v || "–"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5">
                    <CoverageBar served={sumP(s, "served")} referred={sumP(s, "referred")} />
                  </td>
                </tr>
              ))}
              {!stats.length && (
                <tr>
                  <td colSpan={projects.length + 3} className="px-4 py-12 text-center text-muted">
                    لا توجد أيام عمل في هذا الشهر
                  </td>
                </tr>
              )}
            </tbody>
            {stats.length > 0 && (
              <tfoot className="border-t-2 border-line bg-sunken/60 font-bold">
                <tr>
                  <td className="sticky start-0 bg-sunken px-4 py-3">إجمالي الشهر</td>
                  <td className="num px-3 py-3 text-center text-brand">{recTotal}</td>
                  {totals.map((t, i) => (
                    <td key={projects[i].code} className="num px-2 py-3 text-center">
                      {t}
                    </td>
                  ))}
                  <td className="px-3 py-3">
                    <CoverageBar served={stats.reduce((n, s) => n + sumP(s, "served"), 0)} referred={stats.reduce((n, s) => n + sumP(s, "referred"), 0)} />
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </>
  );
}
