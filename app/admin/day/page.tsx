"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Pencil, Search } from "lucide-react";
import { CenterTabs, ExportButton, PageHead, Segmented, StatCard } from "@/components/admin/bits";
import { AdminEntryDialog } from "@/components/admin/entry-dialog";
import { KindTag } from "@/components/entry/history";
import { Card } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { type CenterFilter, centerName, dayStats, filterCenter, projectName, userName } from "@/lib/queries";
import type { Entry } from "@/lib/types";
import { dayFull, formatTime, normalizeDigits, todayKey, weekday } from "@/lib/utils";

/** الشاشة 6 — تفاصيل يوم */
function DayInner() {
  const params = useSearchParams();
  const { db } = useStore();
  const date = params.get("d") || todayKey();
  const [center, setCenter] = useState<CenterFilter>((params.get("c") as CenterFilter) || "ALL");
  const [project, setProject] = useState(params.get("p") || "");
  const [kind, setKind] = useState<"ALL" | Entry["kind"]>("ALL");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Entry | null>(null);

  const s = useMemo(() => dayStats(db, date, center), [db, date, center]);
  const list = useMemo(() => {
    const term = normalizeDigits(q);
    return filterCenter(db.entries.filter((e) => e.date === date), center)
      .filter((e) => kind === "ALL" || e.kind === kind)
      .filter((e) => !project || e.projects.includes(project))
      .filter((e) => !q || e.nid.includes(term) || (db.beneficiaries[e.nid]?.name ?? "").includes(q.trim()))
      .slice()
      .reverse();
  }, [db, date, center, kind, project, q]);

  return (
    <>
      <Link href="/admin/days" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowRight className="size-4" />
        سجل الأيام
      </Link>
      <PageHead
        title={`${weekday(date)} ${dayFull(date)}`}
        sub="كل إدخالات اليوم، مع إمكانية التعديل والحذف"
        actions={
          <>
            <CenterTabs value={center} onChange={setCenter} />
            <ExportButton label="تصدير اليوم" scope={`يوم ${dayFull(date)}`} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="حالات الاستقبال" value={s.reception} tone="brand" />
        <StatCard label="حالات جديدة" value={s.receptionNew} tone="info" />
        <StatCard label="حالات النقاط" value={s.point} tone="ok" />
        <StatCard label="موظفون" value={s.staff} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setProject("")}
          className={`rounded-xl border px-3 py-1.5 text-sm font-bold ${!project ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface"}`}
        >
          كل المشاريع
        </button>
        {s.projects
          .filter((p) => p.referred || p.served)
          .map((p) => (
            <button
              key={p.code}
              onClick={() => setProject(p.code === project ? "" : p.code)}
              className={`rounded-xl border px-3 py-1.5 text-sm font-bold ${project === p.code ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface"}`}
            >
              {p.name} <span className="num font-semibold text-muted">{p.referred}/{p.served}</span>
            </button>
          ))}
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              aria-label="بحث"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث برقم الهوية أو الاسم"
              className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm outline-hidden focus:border-brand"
            />
          </div>
          <Segmented
            label="نوع الإدخال"
            value={kind}
            onChange={setKind}
            options={[
              { value: "ALL", label: "الكل" },
              { value: "RECEPTION", label: "استقبال" },
              { value: "POINT", label: "نقاط" },
            ]}
          />
          <span className="num text-sm font-semibold text-muted">{list.length} إدخال</span>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 z-10 bg-surface text-xs text-muted shadow-[0_1px_0_var(--color-line)]">
              <tr>
                <th className="px-4 py-2.5 text-start font-semibold">الوقت</th>
                <th className="px-3 py-2.5 text-start font-semibold">الهوية</th>
                <th className="px-3 py-2.5 text-start font-semibold">الاسم</th>
                <th className="px-3 py-2.5 text-start font-semibold">النوع</th>
                <th className="px-3 py-2.5 text-start font-semibold">المشاريع</th>
                <th className="px-3 py-2.5 text-start font-semibold">المركز</th>
                <th className="px-3 py-2.5 text-start font-semibold">الموظف</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {list.map((e) => (
                <tr key={e.id} className="hover:bg-sunken/40">
                  <td className="num px-4 py-2 font-semibold">{formatTime(e.at)}</td>
                  <td className="num px-3 py-2">{e.nid}</td>
                  <td className="px-3 py-2">
                    {db.beneficiaries[e.nid]?.name || <span className="text-muted">—</span>}
                    {e.isNew && <span className="ms-2 rounded bg-info-soft px-1.5 text-[11px] font-bold text-info">جديدة</span>}
                  </td>
                  <td className="px-3 py-2">
                    <KindTag kind={e.kind} />
                  </td>
                  <td className="px-3 py-2">{e.projects.map((p) => projectName(db, p)).join("، ")}</td>
                  <td className="px-3 py-2 text-muted">{centerName(db, e.center, true)}</td>
                  <td className="px-3 py-2 text-muted">{userName(db, e.userId)}</td>
                  <td className="px-2 py-1">
                    <button
                      onClick={() => setEdit(e)}
                      className="focus-ring grid size-8 place-items-center rounded-lg text-brand hover:bg-brand-soft"
                      aria-label="تعديل"
                    >
                      <Pencil className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!list.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted">
                    لا توجد إدخالات مطابقة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <AdminEntryDialog entry={edit} onClose={() => setEdit(null)} />
    </>
  );
}

export default function DayPage() {
  return (
    <Suspense fallback={null}>
      <DayInner />
    </Suspense>
  );
}
