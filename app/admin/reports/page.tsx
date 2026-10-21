"use client";

import { useMemo, useState } from "react";
import { Bar, CenterTabs, ExportButton, PageHead, StatCard } from "@/components/admin/bits";
import { Card } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { type CenterFilter, dayStats, months, staffRanking, workedDays } from "@/lib/queries";
import { dayNum, monthLabel, todayKey } from "@/lib/utils";

/** الشاشة 7 — التقارير الشهرية */
export default function ReportsPage() {
  const { db } = useStore();
  const monthList = useMemo(() => months(db), [db]);
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const [center, setCenter] = useState<CenterFilter>("ALL");

  const days = useMemo(() => workedDays(db, center, month).slice().reverse(), [db, center, month]);
  const stats = useMemo(() => days.map((d) => dayStats(db, d, center)), [db, days, center]);
  const totals = useMemo(() => {
    const rec = stats.reduce((n, s) => n + s.reception, 0);
    const nw = stats.reduce((n, s) => n + s.receptionNew, 0);
    const pt = stats.reduce((n, s) => n + s.point, 0);
    const projects = db.projects
      .map((p) => ({
        name: p.name,
        referred: stats.reduce((n, s) => n + (s.projects.find((x) => x.code === p.code)?.referred ?? 0), 0),
        served: stats.reduce((n, s) => n + (s.projects.find((x) => x.code === p.code)?.served ?? 0), 0),
      }))
      .filter((p) => p.referred || p.served)
      .sort((a, b) => b.served - a.served);
    return { rec, nw, pt, projects, avg: stats.length ? Math.round(rec / stats.length) : 0 };
  }, [stats, db.projects]);
  const ranking = useMemo(() => staffRanking(db, new Set(days), center).slice(0, 10), [db, days, center]);
  const maxP = Math.max(1, ...totals.projects.map((p) => Math.max(p.referred, p.served)));

  return (
    <>
      <PageHead
        title="التقارير"
        sub={`${monthLabel(month)} · ${days.length} يوم عمل`}
        actions={
          <>
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
            <ExportButton label="تصدير الشهر" scope={`شهر ${monthLabel(month)}`} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="حالات الاستقبال" value={totals.rec} tone="brand" />
        <StatCard label="حالات جديدة" value={totals.nw} tone="info" />
        <StatCard label="حالات النقاط" value={totals.pt} tone="ok" />
        <StatCard label="متوسط الاستقبال اليومي" value={totals.avg} />
      </div>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">الحالات يومياً</h2>
          <div className="flex gap-4 text-xs font-semibold text-muted">
            <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-5 rounded bg-brand" />الاستقبال</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-5 rounded bg-ok" />النقاط</span>
          </div>
        </div>
        <LineChart labels={days.map(dayNum)} a={stats.map((s) => s.reception)} b={stats.map((s) => s.point)} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-lg font-bold">المشاريع خلال الشهر</h2>
          <ul className="space-y-4">
            {totals.projects.map((p) => (
              <li key={p.name}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-bold">{p.name}</span>
                  <span className="num text-muted">
                    موجّه <b className="text-ink">{p.referred}</b> · مخدوم <b className="text-ink">{p.served}</b>
                  </span>
                </div>
                <div className="space-y-1">
                  <Bar value={p.referred} max={maxP} />
                  <Bar value={p.served} max={maxP} tone="ok" />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <h2 className="px-5 pb-3 pt-5 text-lg font-bold">الموظفون حسب عدد الإدخالات</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line/60">
              {ranking.map((r, i) => (
                <tr key={r.user!.id}>
                  <td className="num w-10 px-5 py-2.5 text-muted">{i + 1}</td>
                  <td className="py-2.5 font-semibold">{r.user!.fullName}</td>
                  <td className="px-3 py-2.5 text-xs text-muted">
                    {r.user!.role === "RECEPTION" ? "استقبال" : `نقطة ${r.user!.projects.join(" + ")}`}
                  </td>
                  <td className="num px-5 py-2.5 text-end font-bold">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
