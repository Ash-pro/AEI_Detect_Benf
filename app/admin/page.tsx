"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Clock3, CopyCheck, Hourglass, Info, LayoutList, Share2, Stethoscope, Store, Trophy, UserPlus, Users } from "lucide-react";
import {
  CenterTabs,
  CoverageBar,
  DateStepper,
  ExportButton,
  FilterBar,
  FilterCount,
  FilterSelect,
  HourChart,
  Legend,
  PageHead,
  ResetFilters,
  SearchBox,
  SectionHead,
  Segmented,
  StatCard,
  TableToolbar,
  coverage,
} from "@/components/admin/bits";
import { Card } from "@/components/ui/card";
import { ShareDialog } from "@/components/entry/share-dialog";
import { WaitingDialog, type WaitMode } from "@/components/admin/waiting-dialog";
import { HistoryRow } from "@/components/entry/history";
import { useStore } from "@/lib/store";
import { adminShareText, type CenterFilter, dayStats, filterCenter, hourly, workedDays } from "@/lib/queries";
import { dayFull, formatTime, hourLabel, normalizeArabicName, todayKey, weekday } from "@/lib/utils";
import { projectColor } from "@/lib/project-colors";
import { overlapReport } from "@/lib/overlap";
import { can } from "@/lib/permissions";

/** الشاشة 4 — لوحة الأدمن الرئيسية */
export default function AdminHome() {
  const { db, user } = useStore();
  const [date, setDate] = useState(todayKey());
  const [center, setCenter] = useState<CenterFilter>("ALL");
  const [share, setShare] = useState(false);
  // نافذة المنتظرين: "ALL" أو رمز مشروع
  const [waitOpen, setWaitOpen] = useState<{ project?: string; mode: WaitMode } | null>(null);
  const isToday = date === todayKey();
  // فلاتر جدول المشاريع وآخر الإدخالات
  const [pq, setPq] = useState("");
  const [pShow, setPShow] = useState<"ALL" | "WAITING" | "LOW" | "ACTIVE">("ALL");
  const [pSort, setPSort] = useState<"order" | "referred" | "served" | "waiting" | "low">("order");
  const [lastKind, setLastKind] = useState<"ALL" | "RECEPTION" | "POINT">("ALL");

  const allDays = useMemo(() => workedDays(db, center), [db, center]);
  const s = useMemo(() => dayStats(db, date, center), [db, date, center]);
  const prevDay = useMemo(() => allDays.find((d) => d < date), [allDays, date]);
  const p = useMemo(() => (prevDay ? dayStats(db, prevDay, center) : null), [db, prevDay, center]);
  const dayList = useMemo(
    () =>
      filterCenter(
        db.entries.filter((e) => e.date === date),
        center,
      ).sort((a, b) => a.at.localeCompare(b.at)),
    [db, date, center],
  );
  const latest = useMemo(() => dayList.filter((e) => lastKind === "ALL" || e.kind === lastKind).slice(-8).reverse(), [dayList, lastKind]);
  const hours = useMemo(() => hourly(dayList), [dayList]);

  const rows = s.projects.filter((x) => db.projects.find((pp) => pp.code === x.code)?.active || x.referred || x.served);
  const totals = rows.reduce((a, r) => ({ referred: a.referred + r.referred, fromReception: a.fromReception + r.fromReception, fromPoints: a.fromPoints + r.fromPoints, served: a.served + r.served, waiting: a.waiting + r.waiting, left: a.left + r.left }), {
    referred: 0,
    left: 0,
    fromReception: 0,
    fromPoints: 0,
    served: 0,
    waiting: 0,
  });
  const pct = coverage(totals.served, totals.referred);
  const pFiltering = Boolean(pq.trim()) || pShow !== "ALL" || pSort !== "order";
  const shown = useMemo(() => {
    const term = normalizeArabicName(pq.toLowerCase());
    const rate = (r: (typeof rows)[number]) => coverage(r.served, r.referred) ?? 999;
    const list = rows
      .filter((r) => !term || normalizeArabicName(r.name.toLowerCase()).includes(term) || r.code.toLowerCase().includes(term))
      .filter((r) =>
        pShow === "WAITING" ? r.waiting > 0 : pShow === "LOW" ? r.referred > 0 && rate(r) < 80 : pShow === "ACTIVE" ? r.referred > 0 || r.served > 0 : true,
      );
    if (pSort === "referred") list.sort((a, b) => b.referred - a.referred);
    if (pSort === "served") list.sort((a, b) => b.served - a.served);
    if (pSort === "waiting") list.sort((a, b) => b.waiting - a.waiting);
    if (pSort === "low") list.sort((a, b) => rate(a) - rate(b));
    return list;
  }, [rows, pq, pShow, pSort]);
  const shownTotals = shown.reduce((a, r) => ({ referred: a.referred + r.referred, fromReception: a.fromReception + r.fromReception, fromPoints: a.fromPoints + r.fromPoints, served: a.served + r.served, waiting: a.waiting + r.waiting, left: a.left + r.left }), {
    referred: 0,
    left: 0,
    fromReception: 0,
    fromPoints: 0,
    served: 0,
    waiting: 0,
  });
  const dupToday = useMemo(() => overlapReport(db, date, date, center, "day").rows.length, [db, date, center]);
  const busiest = [...rows].sort((a, b) => b.referred - a.referred)[0];
  const sum = hours.reception.map((v, i) => v + hours.point[i]);
  const peak = sum.some(Boolean) ? sum.indexOf(Math.max(...sum)) : null;
  const staffRec = new Set(dayList.filter((e) => e.kind === "RECEPTION").map((e) => e.userId)).size;
  const router = useRouter();
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
          label={isToday ? "بانتظار الخدمة" : "حضرت ولم تُخدم"}
          value={isToday ? totals.waiting : totals.waiting + totals.left}
          tone={(isToday ? totals.waiting : totals.left) ? "warn" : "ink"}
          icon={Hourglass}
          hint={isToday && totals.left ? `حضرت ولم تُخدم ${totals.left}` : pct === null ? "لا تحويلات" : `نسبة الخدمة ${pct}%`}
          onClick={() => setWaitOpen({ mode: isToday && (totals.waiting || !totals.left) ? "wait" : "left" })}
          action={totals.waiting || totals.left ? "عرض القائمة" : undefined}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <SectionHead title="المشاريع" sub="اضغط على أي مشروع لعرض إدخالاته" icon={LayoutList} />
            <TableToolbar>
              <SearchBox value={pq} onChange={setPq} placeholder="بحث عن مشروع" />
              <FilterSelect
                label="عرض"
                value={pShow}
                all="ALL"
                onChange={setPShow}
                options={[
                  { value: "ALL", label: "كل المشاريع" },
                  { value: "ACTIVE", label: "عليها حركة اليوم" },
                  { value: "WAITING", label: isToday ? "عليها انتظار" : "لم تُخدم كلها" },
                  { value: "LOW", label: "نسبة خدمة أقل من 80%" },
                ]}
              />
              <FilterSelect
                label="الترتيب"
                value={pSort}
                all="order"
                onChange={setPSort}
                options={[
                  { value: "order", label: "ترتيب المشاريع" },
                  { value: "referred", label: "الأكثر تحويلاً" },
                  { value: "served", label: "الأكثر خدمة" },
                  { value: "waiting", label: isToday ? "الأكثر انتظاراً" : "الأكثر غير مخدوم" },
                  { value: "low", label: "الأقل نسبة خدمة" },
                ]}
              />
              <ResetFilters
                show={pFiltering}
                onClick={() => {
                  setPq("");
                  setPShow("ALL");
                  setPSort("order");
                }}
              />
            </TableToolbar>
            <FilterCount shown={shown.length} total={rows.length} noun="مشروع" />
            {!shown.length && <p className="px-4 py-10 text-center text-sm text-muted">لا توجد مشاريع مطابقة</p>}
            {/* الجوال: بطاقة لكل مشروع */}
            <ul className="divide-y divide-line/70 sm:hidden">
              {shown.map((r) => (
                <li key={r.code}>
                  <Link href={href(r.code)} className="flex items-center gap-3 px-4 py-3 active:bg-sunken">
                    <span className="h-11 w-1.5 shrink-0 rounded-full" style={{ background: projectColor(db, r.code) }} />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block truncate font-bold">{r.name}</span>
                      <span className="block">
                        <span className="num text-xs text-muted">
                          استقبال <b className="text-ink">{r.fromReception}</b>
                          {r.fromPoints > 0 && (
                            <>
                              {" "}
                              · نقاط <b className="text-info">{r.fromPoints}</b>
                            </>
                          )}{" "}
                          · مخدوم <b className="text-ok">{r.served}</b>
                          {r.waiting > 0 && (
                            <>
                              {" "}
                              · <b className="text-warn">{r.waiting}</b> بانتظار
                            </>
                          )}
                          {r.left > 0 && (
                            <>
                              {" "}
                              · <b className="text-bad">{r.left}</b> لم تُخدم
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
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-sunken/60 text-xs text-muted">
                  <tr>
                    <th className="px-5 py-2.5 text-start font-semibold">المشروع</th>
                    <th className="px-3 py-2.5 text-center font-semibold" title="حوّلها موظف الاستقبال للمشروع">
                      من الاستقبال
                    </th>
                    <th className="px-3 py-2.5 text-center font-semibold" title="حوّلتها نقطة مشروع آخر، أو خدمتها النقطة مباشرة بدون تحويل">
                      من النقاط
                    </th>
                    <th className="px-3 py-2.5 text-center font-semibold">مخدوم</th>
                    <th className="px-3 py-2.5 text-center font-semibold">{isToday ? "بانتظار" : "لم تُخدم"}</th>
                    <th className="px-3 py-2.5 text-start font-semibold">نسبة الخدمة</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {shown.map((r) => (
                    <tr key={r.code} className="group cursor-pointer hover:bg-sunken/50" onClick={() => router.push(href(r.code))}>
                      <td className="px-5 py-3">
                        <Link href={href(r.code)} onClick={(e) => e.stopPropagation()} className="focus-ring inline-flex min-h-9 items-center gap-2 rounded-md font-bold group-hover:text-brand">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: projectColor(db, r.code) }} />
                          {r.name}
                        </Link>
                        {center === "ALL" && (r.referred > 0 || r.served > 0) ? (
                          <div className="mt-0.5 text-xs text-muted" title="محوّل / مخدوم في كل مركز">
                            غزة{" "}
                            <span className="num">
                              {r.byCenter.GAZA.referred}/{r.byCenter.GAZA.served}
                            </span>{" "}
                            · خانيونس{" "}
                            <span className="num">
                              {r.byCenter.KHY.referred}/{r.byCenter.KHY.served}
                            </span>
                          </div>
                        ) : r.lastQueue > 0 && center !== "ALL" ? (
                          <div className="mt-0.5 text-xs text-muted">
                            آخر دور <span className="num">{r.lastQueue}</span>
                          </div>
                        ) : null}
                      </td>
                      <td className="num px-3 py-3 text-center font-bold">{r.fromReception}</td>
                      <td className="px-3 py-3 text-center" title={r.fromPoints ? `تحويل مسجّل من نقطة: ${r.pointReferrals} · خدمة مباشرة بدون تحويل: ${r.direct}` : undefined}>
                        <span className={`num font-bold ${r.fromPoints ? "text-info" : "text-muted"}`}>{r.fromPoints}</span>
                        {r.fromPoints > 0 && (
                          <span className="num mt-0.5 block whitespace-nowrap text-xs font-medium text-muted">
                            {r.pointReferrals ? `تحويل ${r.pointReferrals}` : ""}
                            {r.pointReferrals && r.direct ? " · " : ""}
                            {r.direct ? `مباشر ${r.direct}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="num px-3 py-3 text-center font-bold text-ok">{r.served}</td>
                      <td className="px-3 py-3 text-center">
                        {r.waiting ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setWaitOpen({ project: r.code, mode: "wait" });
                            }}
                            title={`عرض المنتظرين في ${r.name}`}
                            className="focus-ring num inline-flex min-h-9 min-w-10 items-center justify-center rounded-lg bg-warn-soft px-2 font-bold text-warn underline-offset-2 hover:underline hover:ring-2 hover:ring-warn/30"
                          >
                            {r.waiting}
                          </button>
                        ) : (
                          <span className="num inline-block min-w-8 rounded-md px-1.5 py-0.5 font-bold text-muted">0</span>
                        )}
                        {r.left > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setWaitOpen({ project: r.code, mode: "left" });
                            }}
                            title={`حضرت ولم تُخدم في ${r.name}`}
                            className="focus-ring num mt-1 block w-full whitespace-nowrap rounded-md px-1 text-xs font-bold text-bad hover:underline"
                          >
                            لم تُخدم {r.left}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <CoverageBar served={r.served} referred={r.referred} />
                      </td>
                      <td className="pe-3">
                        <Link href={href(r.code)} onClick={(e) => e.stopPropagation()} aria-label={`تفاصيل ${r.name}`} className="grid size-10 place-items-center rounded-lg hover:bg-sunken">
                          <ChevronLeft className="size-4 text-muted group-hover:text-brand" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {shown.length > 1 && (
                  <tfoot className="border-t-2 border-line bg-sunken/50 font-bold">
                    <tr>
                      <td className="px-5 py-3">{shown.length < rows.length ? "إجمالي المعروض" : "الإجمالي"}</td>
                      <td className="num px-3 py-3 text-center">{shownTotals.fromReception}</td>
                      <td className="num px-3 py-3 text-center text-info">{shownTotals.fromPoints}</td>
                      <td className="num px-3 py-3 text-center text-ok">{shownTotals.served}</td>
                      <td className="num px-3 py-3 text-center text-warn">
                        {shownTotals.waiting}
                        {shownTotals.left > 0 && <span className="block text-xs text-bad">لم تُخدم {shownTotals.left}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <CoverageBar served={shownTotals.served} referred={shownTotals.referred} />
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <p className="flex gap-2 border-t border-line px-5 py-3 text-xs leading-relaxed text-muted">
              <Info className="size-4 shrink-0" />
              من الاستقبال: حوّلها موظف الاستقبال. من النقاط: حوّلتها نقطة مشروع آخر (مثل تحويل الطبيب)، أو خدمتها النقطة مباشرة بدون تحويل. نسبة الخدمة =
              المخدوم ÷ (من الاستقبال + من النقاط)، فتصل 100% عندما يُخدم كل المحوّلين.
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
              <Fact label="موظفون عملوا" icon={Users} value={s.staff ? `${s.staff} · ${staffRec} استقبال، ${s.staff - staffRec} نقاط` : "—"} />
            </dl>
            {can(user, "overlap") && (
              <Link href="/admin/overlap" className="flex items-center gap-3 border-t border-line bg-warn-soft/40 px-4 py-3 text-sm hover:bg-warn-soft sm:px-5">
                <CopyCheck className="size-5 shrink-0 text-warn" />
                <span className="flex-1">
                  <span className="block font-bold">هويات خدمها أكثر من مشروع اليوم</span>
                  <span className="block text-xs text-muted">افتح تقرير التكرار للتفاصيل</span>
                </span>
                <span className="num text-lg font-bold text-warn">{dupToday}</span>
                <ChevronLeft className="size-4 text-muted" />
              </Link>
            )}
          </Card>

          <Card className="overflow-hidden">
            <SectionHead
              title="آخر الإدخالات"
              sub={
                <Segmented
                  label="نوع الإدخال"
                  value={lastKind}
                  onChange={setLastKind}
                  className="mt-1.5"
                  options={[
                    { value: "ALL", label: "الكل" },
                    { value: "RECEPTION", label: "استقبال" },
                    { value: "POINT", label: "نقاط" },
                  ]}
                />
              }
              actions={
                <Link
                  href={href()}
                  className="-me-2 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand hover:bg-brand-soft"
                >
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

      <WaitingDialog
        open={waitOpen !== null}
        mode={waitOpen?.mode}
        onClose={() => setWaitOpen(null)}
        date={date}
        center={center}
        project={waitOpen?.project}
      />
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
