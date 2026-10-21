"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CenterTabs, ExportButton, PageHead, Segmented } from "@/components/admin/bits";
import { Card } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { activeProjects, allProjects, type CenterFilter, dayStats, months, workedDays } from "@/lib/queries";
import { cn, dayFull, dayNum, monthLabel, todayKey, weekday } from "@/lib/utils";

/** الشاشة 5 — سجل الأيام والتصدير */
export default function DaysPage() {
  const { db } = useStore();
  const router = useRouter();
  const monthList = useMemo(() => months(db), [db]);
  const [month, setMonth] = useState(todayKey().slice(0, 7));
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
  const totals = projects.map((p) => stats.reduce((n, s) => n + val(s, p.code), 0));
  const recTotal = stats.reduce((n, s) => n + s.reception, 0);
  const max = Math.max(1, ...stats.flatMap((s) => projects.map((p) => val(s, p.code))));

  return (
    <>
      <PageHead
        title="سجل الأيام"
        sub={`${days.length} يوم عمل في ${monthLabel(month)}`}
        actions={<ExportButton label={`تصدير ${monthLabel(month)}`} scope={`شهر ${monthLabel(month)}`} />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          aria-label="الشهر"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-10 rounded-xl border border-line bg-surface px-3 text-sm font-bold"
        >
          {monthList.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <CenterTabs value={center} onChange={setCenter} />
        <Segmented
          label="أرقام المشاريع"
          value={mode}
          onChange={setMode}
          options={[
            { value: "served", label: "مخدوم في النقطة" },
            { value: "referred", label: "موجّه من الاستقبال" },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-sunken/70 text-xs text-muted">
              <tr>
                <th className="sticky start-0 bg-sunken px-4 py-3 text-start font-semibold">اليوم</th>
                <th className="px-3 py-3 text-center font-semibold">الاستقبال</th>
                {projects.map((p) => (
                  <th key={p.code} className="px-3 py-3 text-center font-semibold">
                    {p.name}
                  </th>
                ))}
                <th className="px-3 py-3 text-center font-semibold">تصدير</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {stats.map((s) => (
                <tr
                  key={s.date}
                  onClick={() => router.push(`/admin/day?d=${s.date}&c=${center}`)}
                  className="cursor-pointer hover:bg-sunken/50"
                >
                  <td className="sticky start-0 bg-surface px-4 py-2.5">
                    <span className="font-bold">{weekday(s.date)}</span> <span className="num text-muted">{dayNum(s.date)}</span>
                    {s.date === todayKey() && <span className="ms-2 rounded-md bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand">اليوم</span>}
                  </td>
                  <td className="num px-3 py-2.5 text-center font-bold text-brand">{s.reception}</td>
                  {projects.map((p) => {
                    const v = val(s, p.code);
                    return (
                      <td key={p.code} className="px-1.5 py-1.5 text-center">
                        <span
                          className={cn("num block rounded-md py-1 font-semibold", !v && "text-muted/50")}
                          style={{ background: v ? `color-mix(in srgb, var(--color-ok) ${Math.round((v / max) * 26) + 4}%, transparent)` : undefined }}
                        >
                          {v || "–"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <ExportButton label="Excel" scope={`يوم ${dayFull(s.date)}`} size="sm" />
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
              <tfoot className="border-t-2 border-line bg-sunken/70 font-bold">
                <tr>
                  <td className="sticky start-0 bg-sunken px-4 py-3">إجمالي الشهر</td>
                  <td className="num px-3 py-3 text-center text-brand">{recTotal}</td>
                  {totals.map((t, i) => (
                    <td key={projects[i].code} className="num px-3 py-3 text-center">
                      {t}
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
      <p className="mt-3 text-sm text-muted">اضغط على أي يوم لعرض تفاصيله وكل إدخالاته.</p>
    </>
  );
}
