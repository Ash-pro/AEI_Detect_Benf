"use client";

import { useMemo, useState } from "react";
import { Award, CalendarRange, Clock3, Gauge, LayoutList, LineChart as LineIcon, Stethoscope, Store, UserPlus } from "lucide-react";
import { Bar, CenterTabs, CoverageBar, ExportButton, FilterBar, FilterSelect, HourChart, Legend, MonthSelect, PageHead, SearchBox, SectionHead, Segmented, StatCard, TableToolbar, coverage } from "@/components/admin/bits";
import { Card } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { type CenterFilter, dayStats, filterCenter, hourly, months, projectName, staffRanking, workedDays } from "@/lib/queries";
import { projectColor } from "@/lib/project-colors";
import { dayNum, hourLabel, monthLabel, normalizeArabicName, todayKey } from "@/lib/utils";

const WEEK = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** الشاشة 7 — التقارير الشهرية */
export default function ReportsPage() {
  const { db } = useStore();
  const monthList = useMemo(() => months(db), [db]);
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const [center, setCenter] = useState<CenterFilter>("ALL");
  // فلاتر جدول المشاريع وترتيب الموظفين
  const [pq, setPq] = useState("");
  const [pSort, setPSort] = useState<"referred" | "served" | "low" | "high">("referred");
  const [role, setRole] = useState<"ALL" | "RECEPTION" | "POINT">("ALL");
  const [rq, setRq] = useState("");
  const [topN, setTopN] = useState<"10" | "ALL">("10");

  const days = useMemo(() => workedDays(db, center, month).slice().reverse(), [db, center, month]);
  const stats = useMemo(() => days.map((d) => dayStats(db, d, center)), [db, days, center]);
  // اليوم الحالي غير مكتمل: يدخل في المجاميع، ولا يدخل في الرسم والمتوسط حتى لا يظهر هبوط وهمي
  const today = todayKey();
  const fullDays = days.filter((d) => d !== today);
  const fullStats = stats.filter((s) => s.date !== today);
  const totals = useMemo(() => {
    const rec = stats.reduce((n, s) => n + s.reception, 0);
    const nw = stats.reduce((n, s) => n + s.receptionNew, 0);
    const pt = stats.reduce((n, s) => n + s.point, 0);
    const projects = db.projects
      .map((p) => ({
        code: p.code,
        name: p.name,
        referred: stats.reduce((n, s) => n + (s.projects.find((x) => x.code === p.code)?.referred ?? 0), 0),
        fromReception: stats.reduce((n, s) => n + (s.projects.find((x) => x.code === p.code)?.fromReception ?? 0), 0),
        fromPoints: stats.reduce((n, s) => n + (s.projects.find((x) => x.code === p.code)?.fromPoints ?? 0), 0),
        served: stats.reduce((n, s) => n + (s.projects.find((x) => x.code === p.code)?.served ?? 0), 0),
      }))
      .filter((p) => p.referred || p.served)
      .sort((a, b) => b.referred - a.referred);
    const referred = projects.reduce((n, p) => n + p.referred, 0);
    const served = projects.reduce((n, p) => n + p.served, 0);
    const fullRec = fullStats.reduce((n, s) => n + s.reception, 0);
    return { rec, nw, pt, projects, referred, served, avg: fullStats.length ? Math.round(fullRec / fullStats.length) : 0 };
  }, [stats, fullStats, db.projects]);
  const fullRanking = useMemo(() => staffRanking(db, new Set(days), center), [db, days, center]);
  const ranking = useMemo(() => {
    const term = normalizeArabicName(rq);
    const list = fullRanking
      .filter((r) => role === "ALL" || r.user!.role === role)
      .filter((r) => !term || normalizeArabicName(r.user!.fullName).includes(term));
    return topN === "10" ? list.slice(0, 10) : list;
  }, [fullRanking, role, rq, topN]);
  const projRows = useMemo(() => {
    const term = normalizeArabicName(pq.toLowerCase());
    const rate = (p: { served: number; referred: number }) => coverage(p.served, p.referred) ?? 999;
    const list = totals.projects.filter((p) => !term || normalizeArabicName(p.name.toLowerCase()).includes(term) || p.code.toLowerCase().includes(term));
    if (pSort === "referred") list.sort((a, b) => b.referred - a.referred);
    if (pSort === "served") list.sort((a, b) => b.served - a.served);
    if (pSort === "low") list.sort((a, b) => rate(a) - rate(b));
    if (pSort === "high") list.sort((a, b) => rate(b) - rate(a));
    return list;
  }, [totals.projects, pq, pSort]);
  const monthEntries = useMemo(() => filterCenter(db.entries.filter((e) => e.date.startsWith(month)), center), [db, month, center]);
  const hours = useMemo(() => hourly(monthEntries), [monthEntries]);
  const hourSum = hours.reception.map((v, i) => v + hours.point[i]);
  const peak = hourSum.some(Boolean) ? hourSum.indexOf(Math.max(...hourSum)) : null;
  /* متوسط الاستقبال حسب يوم الأسبوع (أيام مكتملة فقط) */
  const byWeekday = useMemo(() => {
    const acc = WEEK.map(() => ({ sum: 0, n: 0 }));
    fullStats.forEach((s) => {
      const w = new Date(`${s.date}T12:00:00Z`).getUTCDay();
      acc[w].sum += s.reception;
      acc[w].n++;
    });
    return acc.map((a, i) => ({ day: WEEK[i], avg: a.n ? Math.round(a.sum / a.n) : 0, n: a.n })).filter((x) => x.n);
  }, [fullStats]);
  const maxW = Math.max(1, ...byWeekday.map((w) => w.avg));
  const maxRank = Math.max(1, ...ranking.map((r) => r.count));
  const pct = coverage(totals.served, totals.referred);

  return (
    <>
      <PageHead
        title="التقارير"
        sub={`${monthLabel(month)} · ${days.length} يوم عمل`}
        actions={<ExportButton label="تصدير الشهر" scope={`شهر ${monthLabel(month)}`} />}
      />

      <FilterBar>
        <MonthSelect value={month} onChange={setMonth} months={monthList} />
        <CenterTabs value={center} onChange={setCenter} />
      </FilterBar>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="حالات الاستقبال" value={totals.rec} tone="brand" icon={Store} hint={`متوسط ${totals.avg} يومياً`} />
        <StatCard label="حالات جديدة" value={totals.nw} tone="info" icon={UserPlus} hint={totals.rec ? `${Math.round((totals.nw / totals.rec) * 100)}% من الاستقبال` : undefined} />
        <StatCard label="خُدمت في النقاط" value={totals.pt} tone="ok" icon={Stethoscope} />
        <StatCard
          label="نسبة الخدمة"
          value={pct === null ? "—" : pct}
          suffix={pct === null ? undefined : "%"}
          tone={pct === null ? "ink" : pct >= 80 ? "ok" : "warn"}
          icon={Gauge}
          hint={`${totals.served.toLocaleString("en-US")} من ${totals.referred.toLocaleString("en-US")} محوّل`}
        />
      </div>

      <Card className="mt-6 overflow-hidden">
        <SectionHead
          title="الحالات يومياً"
          icon={LineIcon}
          actions={
            <Legend
              items={[
                { label: "الاستقبال", cls: "bg-brand" },
                { label: "النقاط", cls: "bg-ok" },
              ]}
            />
          }
        />
        <div className="p-4 sm:p-5">
          <LineChart labels={fullDays.map(dayNum)} a={fullStats.map((s) => s.reception)} b={fullStats.map((s) => s.point)} />
          {days.includes(today) && <p className="mt-2 text-xs text-muted">اليوم لم يكتمل بعد، فلا يظهر في الرسم ولا في المتوسط.</p>}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <SectionHead title="أوقات الذروة" icon={Clock3} sub={peak !== null ? `أكثر ساعة ازدحاماً: ${hourLabel(peak)}` : undefined} />
          <div className="p-4 sm:p-5">
            <HourChart reception={hours.reception} point={hours.point} />
          </div>
        </Card>
        <Card className="overflow-hidden">
          <SectionHead title="متوسط الاستقبال حسب يوم الأسبوع" icon={CalendarRange} />
          <ul className="space-y-3 p-4 sm:p-5">
            {byWeekday.map((w) => (
              <li key={w.day} className="grid grid-cols-[72px_minmax(0,1fr)_40px] items-center gap-3 text-sm">
                <span className="font-semibold">{w.day}</span>
                <Bar value={w.avg} max={maxW} />
                <span className="num text-end font-bold">{w.avg}</span>
              </li>
            ))}
            {!byWeekday.length && <li className="py-8 text-center text-sm text-muted">لا توجد أيام مكتملة بعد</li>}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <SectionHead title="المشاريع خلال الشهر" icon={LayoutList} sub="محوّل من الاستقبال ومن النقاط · مخدوم في النقطة · نسبة الخدمة" />
          <TableToolbar>
            <SearchBox value={pq} onChange={setPq} placeholder="بحث عن مشروع" />
            <FilterSelect
              label="الترتيب"
              value={pSort}
              all="referred"
              onChange={setPSort}
              options={[
                { value: "referred", label: "الأكثر تحويلاً" },
                { value: "served", label: "الأكثر خدمة" },
                { value: "low", label: "الأقل نسبة خدمة" },
                { value: "high", label: "الأعلى نسبة خدمة" },
              ]}
            />
          </TableToolbar>
          <ul className="divide-y divide-line/60">
            {projRows.map((p) => (
              <li key={p.code} className="space-y-2 px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-bold">
                    <span className="size-2.5 rounded-full" style={{ background: projectColor(db, p.code) }} />
                    {p.name}
                  </span>
                  <span className="num text-muted">
                    استقبال <b className="text-ink">{p.fromReception}</b> · نقاط <b className="text-info">{p.fromPoints}</b> · مخدوم <b className="text-ok">{p.served}</b>
                  </span>
                </div>
                <CoverageBar served={p.served} referred={p.referred} compact />
              </li>
            ))}
            {!projRows.length && <li className="py-10 text-center text-sm text-muted">{totals.projects.length ? "لا توجد مشاريع مطابقة" : "لا توجد بيانات"}</li>}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <SectionHead title="الموظفون الأكثر إدخالاً" icon={Award} sub={`${fullRanking.length} موظف عملوا هذا الشهر`} />
          <TableToolbar>
            <SearchBox value={rq} onChange={setRq} placeholder="بحث باسم الموظف" />
            <Segmented
              label="نوع الحساب"
              value={role}
              onChange={setRole}
              options={[
                { value: "ALL", label: "الكل" },
                { value: "RECEPTION", label: "استقبال" },
                { value: "POINT", label: "نقاط" },
              ]}
            />
            <FilterSelect
              label="العدد"
              value={topN}
              all="10"
              onChange={setTopN}
              options={[
                { value: "10", label: "أعلى 10" },
                { value: "ALL", label: "كل الموظفين" },
              ]}
            />
          </TableToolbar>
          <ul className="divide-y divide-line/60">
            {ranking.map((r, i) => (
              <li key={r.user!.id} className="grid grid-cols-[28px_minmax(0,1fr)_56px] items-center gap-3 px-4 py-2.5 sm:px-5">
                <span className={`num grid size-7 place-items-center rounded-full text-xs font-bold ${i < 3 ? "bg-brand text-brand-ink" : "bg-sunken text-muted"}`}>{i + 1}</span>
                <span className="min-w-0 space-y-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{r.user!.fullName}</span>
                    <span className="truncate text-xs text-muted">
                      {r.user!.role === "RECEPTION" ? "استقبال" : `نقطة ${r.user!.projects.map((c) => projectName(db, c)).join(" + ")}`}
                    </span>
                  </span>
                  <Bar value={r.count} max={maxRank} tone={r.user!.role === "RECEPTION" ? "brand" : "ok"} />
                </span>
                <span className="num text-end font-bold">{r.count.toLocaleString("en-US")}</span>
              </li>
            ))}
            {!ranking.length && <li className="py-10 text-center text-sm text-muted">{fullRanking.length ? "لا يوجد موظفون مطابقون" : "لا توجد بيانات"}</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}

/** رسم خطي بسيط بـ SVG */
function LineChart({ labels, a, b }: { labels: string[]; a: number[]; b: number[] }) {
  if (!labels.length) return <p className="py-10 text-center text-sm text-muted">لا توجد بيانات</p>;
  const W = 900;
  const H = 240;
  const pad = { l: 36, r: 12, t: 12, b: 28 };
  const max = Math.max(...a, ...b, 1);
  const step = Math.ceil(max / 4 / 10) * 10 || 1;
  const top = step * 4;
  const x = (i: number) => pad.l + (labels.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (labels.length - 1));
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
  const path = (arr: number[]) => arr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const every = Math.ceil(labels.length / 12);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[240px] w-full min-w-[560px]" role="img" aria-label="الحالات يومياً" direction="ltr">
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k}>
            <line x1={pad.l} x2={W - pad.r} y1={y(k * step)} y2={y(k * step)} stroke="var(--color-line)" strokeDasharray={k ? "3 4" : undefined} />
            <text x={pad.l - 8} y={y(k * step) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">
              {k * step}
            </text>
          </g>
        ))}
        <path d={`${path(a)} L${x(a.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="var(--color-brand)" opacity="0.08" />
        <path d={path(a)} fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={path(b)} fill="none" stroke="var(--color-ok)" strokeWidth="2.5" strokeLinejoin="round" />
        {a.map((v, i) => (
          <circle key={`a${i}`} cx={x(i)} cy={y(v)} r={i === a.length - 1 ? 4.5 : 2.5} fill="var(--color-brand)" />
        ))}
        {b.map((v, i) => (
          <circle key={`b${i}`} cx={x(i)} cy={y(v)} r={i === b.length - 1 ? 4.5 : 2.5} fill="var(--color-ok)" />
        ))}
        {labels.map((l, i) =>
          i % every === 0 || i === labels.length - 1 ? (
            <text key={l} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-muted)">
              {l}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
