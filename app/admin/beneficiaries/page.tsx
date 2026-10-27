"use client";

import { useEffect, useMemo, useState } from "react";
import { Fingerprint, Pencil, Search, UserPlus, UserRound, X } from "lucide-react";
import { BeneficiaryEditor } from "@/components/entry/edit-dialog";
import { IdTypeTag } from "@/components/entry/id-fields";
import { FilterSelect, PageHead, ResetFilters, Segmented, StatCard } from "@/components/admin/bits";
import { AdminEntryDialog } from "@/components/admin/entry-dialog";
import { HistoryRow } from "@/components/entry/history";
import { Card } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { allProjects, entriesOf } from "@/lib/queries";
import type { Entry, IdType } from "@/lib/types";
import { dateKey, formatDate, normalizeArabicName, normalizeDigits, todayKey } from "@/lib/utils";

/** الشاشة 10 — المستفيدون والإدخالات */
export default function BeneficiariesPage() {
  const { db, user } = useStore();
  const canEdit = can(user, "edit_entries");
  const [q, setQ] = useState("");
  const [nid, setNid] = useState<string | null>(null);
  const [edit, setEdit] = useState<Entry | null>(null);
  // فلاتر القائمة
  const [fType, setFType] = useState<"ALL" | IdType | "NONE">("ALL");
  const [fReg, setFReg] = useState<"ALL" | "TODAY" | "MONTH">("ALL");
  const [fProj, setFProj] = useState("ALL");
  const [fSort, setFSort] = useState<"new" | "visits" | "name">("new");
  const [limit, setLimit] = useState(50);
  // سجل المستفيد المختار
  const [hKind, setHKind] = useState<"ALL" | Entry["kind"]>("ALL");

  const all = useMemo(() => Object.values(db.beneficiaries), [db.beneficiaries]);
  const total = all.length;
  const today = todayKey();
  const newToday = useMemo(() => all.filter((b) => dateKey(b.createdAt) === today).length, [all, today]);
  const newMonth = useMemo(() => all.filter((b) => dateKey(b.createdAt).startsWith(today.slice(0, 7))).length, [all, today]);
  /* عدد الإدخالات والمشاريع لكل هوية — يُحسب مرة واحدة */
  const perNid = useMemo(() => {
    const m = new Map<string, { n: number; projects: Set<string> }>();
    db.entries.forEach((e) => {
      const x = m.get(e.nid) ?? { n: 0, projects: new Set<string>() };
      x.n++;
      e.projects.forEach((p) => x.projects.add(p));
      m.set(e.nid, x);
    });
    return m;
  }, [db.entries]);
  const filtering = fType !== "ALL" || fReg !== "ALL" || fProj !== "ALL" || fSort !== "new";
  const clearFilters = () => {
    setFType("ALL");
    setFReg("ALL");
    setFProj("ALL");
    setFSort("new");
  };
  const searching = q.trim().length > 0;
  const results = useMemo(() => {
    const digits = normalizeDigits(q);
    const term = normalizeArabicName(q);
    if (searching && digits.length < 3 && term.length < 2) return [];
    const list = all
      .filter((b) => !searching || (digits.length >= 3 && b.nid.includes(digits)) || (term.length >= 2 && !digits && normalizeArabicName(b.name).includes(term)))
      .filter((b) => fType === "ALL" || (fType === "NONE" ? !b.type : b.type === fType))
      .filter((b) => fReg === "ALL" || (fReg === "TODAY" ? dateKey(b.createdAt) === today : dateKey(b.createdAt).startsWith(today.slice(0, 7))))
      .filter((b) => fProj === "ALL" || perNid.get(b.nid)?.projects.has(fProj));
    if (fSort === "new") list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (fSort === "visits") list.sort((a, b) => (perNid.get(b.nid)?.n ?? 0) - (perNid.get(a.nid)?.n ?? 0));
    if (fSort === "name") list.sort((a, b) => (a.name || "ي").localeCompare(b.name || "ي", "ar"));
    return list;
  }, [all, q, searching, fType, fReg, fProj, fSort, perNid, today]);
  useEffect(() => setLimit(50), [q, fType, fReg, fProj, fSort]);
  const listed = searching || filtering ? results.slice(0, limit) : results.slice(0, 20);

  const b = nid ? db.beneficiaries[nid] : undefined;
  const fullHistory = nid ? entriesOf(db, nid) : [];
  const history = fullHistory.filter((e) => hKind === "ALL" || e.kind === hKind);

  return (
    <>
      <PageHead title="المستفيدون" sub="ابحث عن أي هوية لعرض كل إدخالاتها وتعديلها" />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="المسجلة" value={total} icon={Fingerprint} hint="كل الهويات" />
        <StatCard label="هذا الشهر" value={newMonth} tone="info" icon={UserPlus} hint="هويات جديدة" />
        <StatCard label="اليوم" value={newToday} tone="brand" icon={UserPlus} hint="هويات جديدة" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-line p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                aria-label="بحث"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="رقم الهوية أو الاسم"
                className="h-11 w-full rounded-xl border border-line bg-surface ps-9 pe-9 outline-hidden focus:border-brand"
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
            <div className="mt-2 flex flex-wrap gap-2">
              <FilterSelect
                label="نوع الهوية"
                value={fType}
                all="ALL"
                onChange={setFType}
                className="flex-1"
                options={[
                  { value: "ALL", label: "كل الأنواع" },
                  { value: "MOTHER", label: "أم" },
                  { value: "FATHER", label: "أب" },
                  { value: "CHILD", label: "طفل" },
                  { value: "NONE", label: "بدون نوع" },
                ]}
              />
              <FilterSelect
                label="التسجيل"
                value={fReg}
                all="ALL"
                onChange={setFReg}
                className="flex-1"
                options={[
                  { value: "ALL", label: "كل الأوقات" },
                  { value: "TODAY", label: "سُجلت اليوم" },
                  { value: "MONTH", label: "سُجلت هذا الشهر" },
                ]}
              />
              <FilterSelect
                label="المشروع"
                value={fProj}
                all="ALL"
                onChange={setFProj}
                className="flex-1"
                options={[{ value: "ALL", label: "كل المشاريع" }, ...allProjects(db).map((p) => ({ value: p.code, label: p.name }))]}
              />
              <FilterSelect
                label="الترتيب"
                value={fSort}
                all="new"
                onChange={setFSort}
                className="flex-1"
                options={[
                  { value: "new", label: "الأحدث تسجيلاً" },
                  { value: "visits", label: "الأكثر إدخالات" },
                  { value: "name", label: "الاسم (أ-ي)" },
                ]}
              />
              <ResetFilters show={filtering} onClick={clearFilters} />
            </div>
          </div>
          <div className="num flex items-center justify-between bg-sunken/60 px-4 py-2 text-xs font-semibold text-muted">
            <span>{searching || filtering ? `${results.length.toLocaleString("en-US")} نتيجة` : "آخر المسجلين"}</span>
            {(searching || filtering) && results.length > listed.length && <span>يظهر أول {listed.length}</span>}
          </div>
          <ul className="max-h-[560px] divide-y divide-line/60 overflow-y-auto">
            {listed.map((r) => (
              <li key={r.nid}>
                <button
                  onClick={() => {
                    setNid(r.nid);
                    // الجوال: الانتقال للتفاصيل أسفل النتائج
                    if (window.innerWidth < 1024)
                      requestAnimationFrame(() => document.getElementById("benef-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }));
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-sunken/60 ${nid === r.nid ? "bg-brand-soft" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-semibold">{r.name || <span className="text-muted">بدون اسم</span>}</span>
                      <IdTypeTag type={r.type} />
                    </span>
                    <span className="num text-xs text-muted">{r.nid}</span>
                  </span>
                  <span className="num shrink-0 text-end text-xs text-muted">
                    {perNid.get(r.nid)?.n ?? 0} إدخال
                    {!searching && <span className="block">{formatDate(r.createdAt)}</span>}
                  </span>
                </button>
              </li>
            ))}
            {(searching || filtering) && !results.length && (
              <li className="px-4 py-10 text-center text-sm text-muted">
                {searching ? "لا نتائج. اكتب 3 أرقام على الأقل من الهوية أو حرفين من الاسم" : "لا توجد هويات مطابقة للفلاتر"}
              </li>
            )}
            {(searching || filtering) && results.length > listed.length && (
              <li>
                <button onClick={() => setLimit((n) => n + 50)} className="flex min-h-12 w-full items-center justify-center text-sm font-bold text-brand hover:bg-sunken">
                  عرض المزيد ({(results.length - listed.length).toLocaleString("en-US")})
                </button>
              </li>
            )}
          </ul>
        </Card>

        {b ? (
          <Card id="benef-detail" className="scroll-mt-20 overflow-hidden">
            <div className="space-y-3 border-b border-line p-5">
              {canEdit ? (
                <BeneficiaryEditor key={b.nid} beneficiary={b} />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xl font-bold">{b.name || "بدون اسم"}</span>
                  <IdTypeTag type={b.type} />
                </div>
              )}
              <div className="text-sm text-muted">
                <span className="num font-bold text-ink">{b.nid}</span> · مسجلة منذ <span className="num">{formatDate(b.createdAt)}</span> ·{" "}
                <span className="num">{fullHistory.length}</span> إدخال
              </div>
              {fullHistory.length > 0 && (
                <Segmented
                  label="نوع الإدخال"
                  value={hKind}
                  onChange={setHKind}
                  options={[
                    { value: "ALL", label: "الكل", count: fullHistory.length },
                    { value: "RECEPTION", label: "استقبال", count: fullHistory.filter((e) => e.kind === "RECEPTION").length },
                    { value: "POINT", label: "نقاط", count: fullHistory.filter((e) => e.kind === "POINT").length },
                  ]}
                />
              )}
            </div>
            <ul className="divide-y divide-line/60">
              {history.map((e) => (
                <HistoryRow
                  key={e.id}
                  e={e}
                  db={db}
                  action={
                    canEdit && (
                      <button
                        onClick={() => setEdit(e)}
                        className="focus-ring grid size-8 place-items-center rounded-lg text-brand hover:bg-brand-soft"
                        aria-label="تعديل"
                      >
                        <Pencil className="size-4" />
                      </button>
                    )
                  }
                />
              ))}
            </ul>
          </Card>
        ) : (
          <Card className="hidden flex-col items-center justify-center gap-2 p-14 text-center text-muted lg:flex">
            <UserRound className="size-10" />
            اختر مستفيداً من القائمة لعرض كل إدخالاته وتعديلها
          </Card>
        )}
      </div>
      <AdminEntryDialog entry={edit} onClose={() => setEdit(null)} />
    </>
  );
}
