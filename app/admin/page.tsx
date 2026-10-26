"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Clock3, CopyCheck, Hourglass, Info, LayoutList, Share2, Stethoscope, Store, Trophy, UserPlus, Users } from "lucide-react";
import { CenterTabs, CoverageBar, DateStepper, ExportButton, FilterBar, HourChart, Legend, PageHead, SectionHead, StatCard, coverage } from "@/components/admin/bits";
import { Card } from "@/components/ui/card";
import { ShareDialog } from "@/components/entry/share-dialog";
import { HistoryRow } from "@/components/entry/history";
import { useStore } from "@/lib/store";
import { adminShareText, type CenterFilter, dayStats, filterCenter, hourly, workedDays } from "@/lib/queries";
import { dayFull, formatTime, hourLabel, todayKey, weekday } from "@/lib/utils";
import { projectColor } from "@/lib/project-colors";
import { overlapReport } from "@/lib/overlap";

/** الشاشة 4 — لوحة الأدمن الرئيسية */
export default function AdminHome() {
  const { db } = useStore();
  const [date, setDate] = useState(todayKey());
  const [center, setCenter] = useState<CenterFilter>("ALL");
  const [share, setShare] = useState(false);
  const isToday = date === todayKey();

  const allDays = useMemo(() => workedDays(db, center), [db, center]);
  const s = useMemo(() => dayStats(db, date, center), [db, date, center]);
  const prevDay = useMemo(() => allDays.find((d) => d < date), [allDays, date]);
  const p = useMemo(() => (prevDay ? dayStats(db, prevDay, center) : null), [db, prevDay, center]);
  const dayList = useMemo(
    () => filterCenter(db.entries.filter((e) => e.date === date), center).sort((a, b) => a.at.localeCompare(b.at)),
    [db, date, center],
  );
  const latest = useMemo(() => dayList.slice(-8).reverse(), [dayList]);
  const hours = useMemo(() => hourly(dayList), [dayList]);

  const rows = s.projects.filter((x) => db.projects.find((pp) => pp.code === x.code)?.active || x.referred || x.served);
  const totals = rows.reduce((a, r) => ({ referred: a.referred + r.referred, served: a.served + r.served, waiting: a.waiting + r.waiting }), { referred: 0, served: 0, waiting: 0 });
  const pct = coverage(totals.served, totals.referred);
  const dupToday = useMemo(() => overlapReport(db, date, date, center, "day").rows.length, [db, date, center]);
  const busiest = [...rows].sort((a, b) => b.referred - a.referred)[0];
  const sum = hours.reception.map((v, i) => v + hours.point[i]);
  const peak = sum.some(Boolean) ? sum.indexOf(Math.max(...sum)) : null;
  const staffRec = new Set(dayList.filter((e) => e.kind === "RECEPTION").map((e) => e.userId)).size;
  const href = (code?: string) => `/admin/day?d=${date}&c=${center}${code ? `&p=${code}` : ""}`;

  return (
    <>
      <PageHead
        title="لوحة التحكم"
        sub={
          <>
            {weekday(date)} <span className="num">{dayFull(date)}</span>
            {isToday && <span className="ms-2 rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-bold text-brand">مباشر</span>}
          </>
        }
        actions={
          <>
            <button
              onClick={() => setShare(true)}
              disabled={!dayList.length}
              className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-bold hover:bg-sunken disabled:opacity-40"
            >
              <Share2 className="size-4" />
              مشاركة الملخص
            </button>
            <ExportButton label="تصدير اليوم" scope={`يوم ${dayFull(date)}`} />
          </>
        }
      />

      <FilterBar>
        <DateStepper value={date} onChange={setDate} days={allDays} />
        <CenterTabs value={center} onChange={setCenter} />
      </FilterBar>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="حالات الاستقبال" value={s.reception} delta={p ? s.reception - p.reception : null} tone="brand" icon={Store} />
        <StatCard label="حالات جديدة" value={s.receptionNew} delta={p ? s.receptionNew - p.receptionNew : null} tone="info" icon={UserPlus} />
        <StatCard label="خُدمت في النقاط" value={s.point} delta={p ? s.point - p.point : null} tone="ok" icon={Stethoscope} />
        <StatCard
          label={isToday ? "بانتظار الخدمة" : "لم تُخدم"}
          value={totals.waiting}
          tone={totals.waiting ? "warn" : "ink"}
          icon={Hourglass}
          hint={pct === null ? "لا تحويلات" : `نسبة الخدمة ${pct}%`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <SectionHead title="المشاريع" sub="اضغط على أي مشروع لعرض إدخالاته" icon={LayoutList} />
            {/* الجوال: بطاقة لكل مشروع */}
            <ul className="divide-y divide-line/70 sm:hidden">
              {rows.map((r) => (
                <li key={r.code}>
                  <Link href={href(r.code)} className="flex items-center gap-3 px-4 py-3 active:bg-sunken">
                    <span className="h-11 w-1.5 shrink-0 rounded-full" style={{ background: projectColor(db, r.code) }} />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block truncate font-bold">{r.name}</span>
                      <span className="block">
                        <span className="num text-xs text-muted">
                          موجّه <b className="text-ink">{r.referred}</b> · مخدوم <b className="text-ok">{r.served}</b>
                          {r.waiting > 0 && (
                            <>
                              {" "}
                              · <b className="text-warn">{r.waiting}</b> بانتظار
                            </>
                          )}
                        </span>
                      </span>
                      <CoverageBar served={r.served} referred={r.referred} compact />
                    </span>
                    <ChevronLeft className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="bg-sunken/60 text-xs text-muted">
                  <tr>
                    <th className="px-5 py-2.5 text-start font-semibold">المشروع</th>
                    <th className="px-3 py-2.5 text-center font-semibold">موجّه</th>
                    <th className="px-3 py-2.5 text-center font-semibold">مخدوم</th>
                    <th className="px-3 py-2.5 text-center font-semibold">{isToday ? "بانتظار" : "لم تُخدم"}</th>
                    <th className="px-3 py-2.5 text-start font-semibold">نسبة الخدمة</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {rows.map((r) => (
                    <tr key={r.code} className="group hover:bg-sunken/50">
                      <td className="px-5 py-3">
                        <Link href={href(r.code)} className="flex items-center gap-2 font-bold group-hover:text-brand">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: projectColor(db, r.code) }} />
                          {r.name}
                        </Link>
                        {center === "ALL" && (r.referred > 0 || r.served > 0) ? (
                          <div className="mt-0.5 text-xs text-muted">
                            غزة <span className="num">{r.byCenter.GAZA.referred}/{r.byCenter.GAZA.served}</span> · خانيونس{" "}
                            <span className="num">{r.byCenter.KHY.referred}/{r.byCenter.KHY.served}</span>
                          </div>
                        ) : r.lastQueue > 0 && center !== "ALL" ? (
                          <div className="mt-0.5 text-xs text-muted">
                            آخر دور <span className="num">{r.lastQueue}</span>
                          </div>
                        ) : null}
                      </td>
                      <td className="num px-3 py-3 text-center font-bold">{r.referred}</td>
                      <td className="num px-3 py-3 text-center font-bold text-ok">{r.served}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`num inline-block min-w-8 rounded-md px-1.5 py-0.5 font-bold ${r.waiting ? "bg-warn-soft text-warn" : "text-muted"}`}>{r.waiting}</span>
                      </td>
                      <td className="px-3 py-3">
                        <CoverageBar served={r.served} referred={r.referred} />
                      </td>
                      <td className="pe-3">
                        <Link href={href(r.code)} aria-label={`تفاصيل ${r.name}`} className="grid size-10 place-items-center rounded-lg hover:bg-sunken">
                          <ChevronLeft className="size-4 text-muted group-hover:text-brand" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {rows.length > 1 && (
                  <tfoot className="border-t-2 border-line bg-sunken/50 font-bold">
                    <tr>
                      <td className="px-5 py-3">الإجمالي</td>
                      <td className="num px-3 py-3 text-center">{totals.referred}</td>
                      <td className="num px-3 py-3 text-center text-ok">{totals.served}</td>
                      <td className="num px-3 py-3 text-center text-warn">{totals.waiting}</td>
                      <td className="px-3 py-3">
                        <CoverageBar served={totals.served} referred={totals.referred} />
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <p className="flex gap-2 border-t border-line px-5 py-3 text-xs leading-relaxed text-muted">
              <Info className="size-4 shrink-0" />
              موجّه: حوّلها الاستقبال للمشروع. مخدوم: سجّلتها نقطة المشروع. نسبة الخدمة = المخدوم ÷ الموجّه، وقد تتجاوز 100% إذا خدمت النقطة حالات لم تمر على الاستقبال.
            </p>
          </Card>

          <Card className="overflow-hidden">
            <SectionHead
              title="الحالات حسب الساعة"
              icon={Clock3}
              sub={peak !== null ? `الذروة: ${hourLabel(peak)} (${sum[peak]} حالة)` : undefined}
              actions={
                <Legend
                  items={[
                    { label: "استقبال", cls: "bg-brand" },
                    { label: "نقاط", cls: "bg-ok" },
                  ]}
                />
              }
            />
            <div className="p-4 sm:p-5">
              <HourChart reception={hours.reception} point={hours.point} />
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <SectionHead title="خلاصة اليوم" icon={Trophy} />
            <dl className="divide-y divide-line/60 text-sm">
              <Fact label="نسبة الخدمة الكلية" value={pct === null ? "—" : `${pct}%`} strong />
              <Fact label="أكثر مشروع تحويلاً" value={busiest?.referred ? `${busiest.name} · ${busiest.referred}` : "—"} />
              <Fact label="ساعة الذروة" value={peak !== null ? hourLabel(peak) : "—"} />
              <Fact label="أول إدخال" value={dayList[0] ? formatTime(dayList[0].at) : "—"} />
              <Fact label="آخر إدخال" value={dayList.length ? formatTime(dayList[dayList.length - 1].at) : "—"} />
              <Fact
                label="موظفون عملوا"
                icon={Users}
                value={s.staff ? `${s.staff} · ${staffRec} استقبال، ${s.staff - staffRec} نقاط` : "—"}
              />
            </dl>
            <Link
              href="/admin/overlap"
              className="flex items-center gap-3 border-t border-line bg-warn-soft/40 px-4 py-3 text-sm hover:bg-warn-soft sm:px-5"
            >
              <CopyCheck className="size-5 shrink-0 text-warn" />
              <span className="flex-1">
                <span className="block font-bold">هويات خدمها أكثر من مشروع اليوم</span>
                <span className="block text-xs text-muted">افتح تقرير التكرار للتفاصيل</span>
              </span>
              <span className="num text-lg font-bold text-warn">{dupToday}</span>
              <ChevronLeft className="size-4 text-muted" />
            </Link>
          </Card>

          <Card className="overflow-hidden">
            <SectionHead
              title="آخر الإدخالات"
              actions={
                <Link href={href()} className="-me-2 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand hover:bg-brand-soft">
                  عرض الكل
                  <ChevronLeft className="size-4" />
                </Link>
              }
            />
            {latest.length ? (
              <ul className="divide-y divide-line/60">
                {latest.map((e) => (
                  <HistoryRow key={e.id} e={e} db={db} person timeOnly />
                ))}
              </ul>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-muted">لا توجد إدخالات في هذا اليوم</p>
            )}
          </Card>
        </div>
      </div>

      <ShareDialog open={share} onClose={() => setShare(false)} title="مشاركة ملخص اليوم" text={adminShareText(db, s, center)} />
    </>
  );
}

function Fact({ label, value, strong, icon: Icon }: { label: string; value: string; strong?: boolean; icon?: typeof Users }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <dt className="flex items-center gap-1.5 text-muted">
        {Icon && <Icon className="size-4" />}
        {label}
      </dt>
      <dd className={strong ? "num text-lg font-bold text-ink" : "num text-end font-bold"}>{value}</dd>
    </div>
  );
}
