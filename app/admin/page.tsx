"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Info, Share2 } from "lucide-react";
import { Bar, CenterTabs, ExportButton, PageHead, StatCard } from "@/components/admin/bits";
import { Card } from "@/components/ui/card";
import { ShareDialog } from "@/components/entry/share-dialog";
import { HistoryRow } from "@/components/entry/history";
import { useStore } from "@/lib/store";
import { adminShareText, type CenterFilter, dayStats, filterCenter, workedDays } from "@/lib/queries";
import { dayFull, todayKey, weekday } from "@/lib/utils";

/** الشاشة 4 — لوحة الأدمن الرئيسية */
export default function AdminHome() {
  const { db } = useStore();
  const [date, setDate] = useState(todayKey());
  const [center, setCenter] = useState<CenterFilter>("ALL");
  const [share, setShare] = useState(false);

  const s = useMemo(() => dayStats(db, date, center), [db, date, center]);
  const prevDay = useMemo(() => workedDays(db, center).find((d) => d < date), [db, center, date]);
  const p = useMemo(() => (prevDay ? dayStats(db, prevDay, center) : null), [db, prevDay, center]);
  const latest = useMemo(
    () => filterCenter(db.entries.filter((e) => e.date === date), center).slice(-8).reverse(),
    [db, date, center],
  );
  const max = Math.max(1, ...s.projects.map((x) => Math.max(x.referred, x.served)));
  const rows = s.projects.filter((x) => db.projects.find((pp) => pp.code === x.code)?.active || x.referred || x.served);

  return (
    <>
      <PageHead
        title="لوحة التحكم"
        sub={`${weekday(date)} ${dayFull(date)}`}
        actions={
          <>
            <input
              type="date"
              aria-label="اليوم"
              dir="ltr"
              max={todayKey()}
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="num h-10 rounded-xl border border-line bg-surface px-3 text-sm font-semibold"
            />
            <CenterTabs value={center} onChange={setCenter} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="حالات الاستقبال" value={s.reception} delta={p ? s.reception - p.reception : null} tone="brand" />
        <StatCard label="حالات جديدة" value={s.receptionNew} delta={p ? s.receptionNew - p.receptionNew : null} tone="info" />
        <StatCard label="حالات النقاط" value={s.point} delta={p ? s.point - p.point : null} tone="ok" />
        <StatCard label="موظفون عملوا اليوم" value={s.staff} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-lg font-bold">المشاريع</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShare(true)}
                className="focus-ring inline-flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm font-bold hover:bg-sunken"
              >
                <Share2 className="size-4" />
                مشاركة الملخص
              </button>
              <ExportButton label="تصدير اليوم" scope={`يوم ${dayFull(date)}`} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm sm:min-w-[560px]">
              <thead className="bg-sunken/70 text-xs text-muted">
                <tr>
                  <th className="px-5 py-2.5 text-start font-semibold">المشروع</th>
                  <th className="px-3 py-2.5 text-start font-semibold">موجّه من الاستقبال</th>
                  <th className="px-3 py-2.5 text-start font-semibold">مخدوم في النقطة</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {rows.map((r) => (
                  <tr key={r.code} className="group hover:bg-sunken/50">
                    <td className="px-5 py-3">
                      <Link href={`/admin/day?d=${date}&c=${center}&p=${r.code}`} className="font-bold group-hover:text-brand">
                        {r.name}
                      </Link>
                      {center === "ALL" && (r.referred > 0 || r.served > 0) && (
                        <div className="mt-0.5 text-xs text-muted">
                          غزة <span className="num">{r.byCenter.GAZA.referred}/{r.byCenter.GAZA.served}</span> · خانيونس{" "}
                          <span className="num">{r.byCenter.KHY.referred}/{r.byCenter.KHY.served}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className="num w-9 font-bold">{r.referred}</span>
                        <div className="hidden flex-1 sm:block"><Bar value={r.referred} max={max} /></div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className="num w-9 font-bold">{r.served}</span>
                        <div className="hidden flex-1 sm:block"><Bar value={r.served} max={max} tone="ok" /></div>
                      </div>
                    </td>
                    <td className="pe-4">
                      <Link href={`/admin/day?d=${date}&c=${center}&p=${r.code}`} aria-label={`تفاصيل ${r.name}`}>
                        <ChevronLeft className="size-4 text-muted group-hover:text-brand" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex gap-2 border-t border-line px-5 py-3 text-xs text-muted">
            <Info className="size-4 shrink-0" />
            الرقمان منفصلان: الاستقبال يسجّل هوية ولي الأمر، والنقطة تسجّل هوية من خدمته (قد يكون الطفل).
          </p>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-lg font-bold">آخر الإدخالات</h2>
            <Link href={`/admin/day?d=${date}&c=${center}`} className="text-sm font-semibold text-brand hover:underline">
              كل إدخالات اليوم
            </Link>
          </div>
          {latest.length ? (
            <ul className="divide-y divide-line/60">
              {latest.map((e) => (
                <HistoryRow key={e.id} e={e} db={db} />
              ))}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted">لا توجد إدخالات في هذا اليوم</p>
          )}
        </Card>
      </div>

      <ShareDialog open={share} onClose={() => setShare(false)} title="مشاركة ملخص اليوم" text={adminShareText(db, s, center)} />
    </>
  );
}
