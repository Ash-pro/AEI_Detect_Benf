"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Hourglass, Pencil, Search, Stethoscope, Store, UserPlus, X } from "lucide-react";
import { CenterTabs, DateStepper, ExportButton, FilterBar, PageHead, Segmented, StatCard, coverage } from "@/components/admin/bits";
import { AdminEntryDialog } from "@/components/admin/entry-dialog";
import { EntryBadges, KindTag, ProjectChip } from "@/components/entry/history";
import { projectColor, projectSoft } from "@/lib/project-colors";
import { IdTypeTag } from "@/components/entry/id-fields";
import { Card } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { type CenterFilter, centerName, dayStats, filterCenter, userName, workedDays } from "@/lib/queries";
import type { Entry } from "@/lib/types";
import { cn, dayFull, formatTime, normalizeArabicName, normalizeDigits, todayKey, weekday } from "@/lib/utils";

const PAGE = 50;

/** الشاشة 6 — تفاصيل يوم */
function DayInner() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const { db, user } = useStore();
  const canEdit = can(user, "edit_entries");
  const date = params.get("d") || todayKey();
  const isToday = date === todayKey();
  const [center, setCenter] = useState<CenterFilter>((params.get("c") as CenterFilter) || "ALL");
  const [project, setProject] = useState(params.get("p") || "");
  const [kind, setKind] = useState<"ALL" | Entry["kind"]>("ALL");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [edit, setEdit] = useState<Entry | null>(null);

  const go = (d: string) => router.replace(`${path}?d=${d}&c=${center}${project ? `&p=${project}` : ""}`, { scroll: false });
  useEffect(() => setShown(PAGE), [date, center, project, kind, q]);

  const days = useMemo(() => workedDays(db, center), [db, center]);
  const s = useMemo(() => dayStats(db, date, center), [db, date, center]);
  const dayAll = useMemo(() => filterCenter(db.entries.filter((e) => e.date === date), center), [db, date, center]);
  const byProject = useMemo(() => dayAll.filter((e) => !project || e.projects.includes(project)), [dayAll, project]);
  const list = useMemo(() => {
    const digits = normalizeDigits(q);
    const term = normalizeArabicName(q);
    return byProject
      .filter((e) => kind === "ALL" || e.kind === kind)
      .filter((e) => !q.trim() || (digits ? e.nid.includes(digits) : normalizeArabicName(db.beneficiaries[e.nid]?.name ?? "").includes(term)))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [db.beneficiaries, byProject, kind, q]);
  const waiting = s.projects.reduce((n, p) => n + p.waiting, 0);
  const referred = s.projects.reduce((n, p) => n + p.referred, 0);
  const served = s.projects.reduce((n, p) => n + p.served, 0);
  const pct = coverage(served, referred);
  const visible = list.slice(0, shown);
  const projRows = s.projects.filter((p) => p.referred || p.served);

  return (
    <>
      <Link href="/admin/days" className="-ms-2 mb-1 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-muted hover:bg-sunken hover:text-ink">
        <ArrowRight className="size-4" />
        سجل الأيام
      </Link>
      <PageHead
        title={`${weekday(date)} ${dayFull(date)}`}
        sub={canEdit ? "كل إدخالات اليوم، مع إمكانية التعديل والحذف" : "كل إدخالات اليوم"}
        actions={<ExportButton label="تصدير اليوم" scope={`يوم ${dayFull(date)}`} />}
      />

      <FilterBar>
        <DateStepper value={date} onChange={go} days={days} />
        <CenterTabs value={center} onChange={setCenter} />
      </FilterBar>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="حالات الاستقبال" value={s.reception} tone="brand" icon={Store} hint={`${s.staff} موظف عملوا`} />
        <StatCard label="حالات جديدة" value={s.receptionNew} tone="info" icon={UserPlus} hint={s.reception ? `${Math.round((s.receptionNew / s.reception) * 100)}% من الاستقبال` : undefined} />
        <StatCard label="خُدمت في النقاط" value={s.point} tone="ok" icon={Stethoscope} hint={pct === null ? undefined : `نسبة الخدمة ${pct}%`} />
        <StatCard label={isToday ? "بانتظار الخدمة" : "لم تُخدم"} value={waiting} tone={waiting ? "warn" : "ink"} icon={Hourglass} />
      </div>

      {/* المشاريع: فلتر مع موجّه/مخدوم */}
      {projRows.length > 0 && (
        <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <button
            onClick={() => setProject("")}
            aria-pressed={!project}
            className={cn(
              "focus-ring min-h-12 shrink-0 rounded-xl border px-3.5 text-sm font-bold",
              !project ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface hover:border-muted/40",
            )}
          >
            كل المشاريع <span className="num ms-1 font-semibold text-muted">{dayAll.length}</span>
          </button>
          {projRows.map((p) => {
            const c = projectColor(db, p.code);
            const on = project === p.code;
            return (
              <button
                key={p.code}
                onClick={() => setProject(on ? "" : p.code)}
                aria-pressed={on}
                className={cn("focus-ring flex min-h-12 shrink-0 items-center gap-2 rounded-xl border px-3 text-start", on ? "" : "border-line bg-surface hover:border-muted/40")}
                style={on ? { borderColor: c, background: projectSoft(c) } : undefined}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: c }} />
                <span className="leading-tight">
                  <span className="block text-sm font-bold" style={on ? { color: c } : undefined}>
                    {p.name}
                  </span>
                  <span className="num block text-[11px] font-semibold text-muted">
                    موجّه {p.referred} · مخدوم {p.served}
                    {p.waiting ? ` · بانتظار ${p.waiting}` : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 sm:gap-3 sm:p-4">
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
              <button onClick={() => setQ("")} aria-label="مسح البحث" className="absolute end-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-sunken">
                <X className="size-4" />
              </button>
            )}
          </div>
          <Segmented
            label="نوع الإدخال"
            value={kind}
            onChange={setKind}
            options={[
              { value: "ALL", label: "الكل", count: byProject.length },
              { value: "RECEPTION", label: "استقبال", count: byProject.filter((e) => e.kind === "RECEPTION").length },
              { value: "POINT", label: "نقاط", count: byProject.filter((e) => e.kind === "POINT").length },
            ]}
          />
        </div>

        {/* الجوال: بطاقة لكل إدخال */}
        <ul className="divide-y divide-line/60 md:hidden">
          {visible.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-4 py-3">
              <span className="num w-[62px] shrink-0 whitespace-nowrap pt-0.5 text-sm font-bold">{formatTime(e.at)}</span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate font-bold">{db.beneficiaries[e.nid]?.name || "—"}</span>
                  <IdTypeTag type={db.beneficiaries[e.nid]?.type} />
                  {e.isNew && <span className="rounded bg-info-soft px-1.5 text-[11px] font-bold text-info">جديدة</span>}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <span className="num font-semibold tracking-wider text-ink/80">{e.nid}</span>
                  <KindTag kind={e.kind} />
                  <span>
                    {centerName(db, e.center, true)} · {userName(db, e.userId)}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1">
                  {e.projects.map((p) => (
                    <ProjectChip key={p} db={db} code={p} number={e.queue?.[p]} />
                  ))}
                  <EntryBadges e={e} db={db} />
                </span>
              </span>
              {canEdit && (
                <button onClick={() => setEdit(e)} className="focus-ring grid size-10 shrink-0 place-items-center rounded-lg text-brand hover:bg-brand-soft" aria-label="تعديل">
                  <Pencil className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-sunken/60 text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 text-start font-semibold">الوقت</th>
                <th className="px-3 py-2.5 text-start font-semibold">المستفيد</th>
                <th className="px-3 py-2.5 text-start font-semibold">الهوية</th>
                <th className="px-3 py-2.5 text-start font-semibold">الإدخال</th>
                <th className="px-3 py-2.5 text-start font-semibold">المشاريع · الدور</th>
                <th className="px-3 py-2.5 text-start font-semibold">الموظف</th>
                {canEdit && <th className="w-12" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {visible.map((e) => (
                <tr key={e.id} className="hover:bg-sunken/40">
                  <td className="num whitespace-nowrap px-4 py-2.5 font-semibold">{formatTime(e.at)}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="font-semibold">{db.beneficiaries[e.nid]?.name || <span className="text-muted">—</span>}</span>
                      <IdTypeTag type={db.beneficiaries[e.nid]?.type} />
                      {e.isNew && <span className="rounded bg-info-soft px-1.5 text-[11px] font-bold text-info">جديدة</span>}
                    </span>
                  </td>
                  <td className="num px-3 py-2.5 tracking-wider">{e.nid}</td>
                  <td className="px-3 py-2.5">
                    <KindTag kind={e.kind} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap gap-1">
                      {e.projects.map((p) => (
                        <ProjectChip key={p} db={db} code={p} number={e.queue?.[p]} />
                      ))}
                      <EntryBadges e={e} db={db} />
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                    {userName(db, e.userId)}
                    {center === "ALL" && <span className="block text-[11px]">{centerName(db, e.center, true)}</span>}
                  </td>
                  {canEdit && (
                    <td className="px-2 py-1">
                      <button onClick={() => setEdit(e)} className="focus-ring grid size-9 place-items-center rounded-lg text-brand hover:bg-brand-soft" aria-label="تعديل">
                        <Pencil className="size-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!list.length && (
          <div className="px-4 py-14 text-center text-sm text-muted">
            {dayAll.length ? "لا توجد إدخالات مطابقة" : "لا توجد إدخالات في هذا اليوم"}
            {(q || kind !== "ALL" || project) && dayAll.length > 0 && (
              <button
                onClick={() => {
                  setQ("");
                  setKind("ALL");
                  setProject("");
                }}
                className="mx-auto mt-2 block font-bold text-brand hover:underline"
              >
                مسح الفلاتر
              </button>
            )}
          </div>
        )}

        {list.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
            <span className="num text-muted">
              عرض {visible.length} من {list.length}
            </span>
            {shown < list.length && (
              <button onClick={() => setShown((n) => n + PAGE)} className="focus-ring min-h-10 rounded-xl border border-line px-4 font-bold text-brand hover:bg-brand-soft">
                عرض {Math.min(PAGE, list.length - shown)} أخرى
              </button>
            )}
          </div>
        )}
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
