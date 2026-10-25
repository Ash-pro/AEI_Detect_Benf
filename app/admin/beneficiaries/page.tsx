"use client";

import { useMemo, useState } from "react";
import { Fingerprint, Pencil, Search, UserPlus, UserRound, X } from "lucide-react";
import { BeneficiaryEditor } from "@/components/entry/edit-dialog";
import { IdTypeTag } from "@/components/entry/id-fields";
import { PageHead, StatCard } from "@/components/admin/bits";
import { AdminEntryDialog } from "@/components/admin/entry-dialog";
import { HistoryRow } from "@/components/entry/history";
import { Card } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { entriesOf } from "@/lib/queries";
import type { Entry } from "@/lib/types";
import { dateKey, formatDate, normalizeArabicName, normalizeDigits, todayKey } from "@/lib/utils";

/** الشاشة 10 — المستفيدون والإدخالات */
export default function BeneficiariesPage() {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const [nid, setNid] = useState<string | null>(null);
  const [edit, setEdit] = useState<Entry | null>(null);

  const all = useMemo(() => Object.values(db.beneficiaries), [db.beneficiaries]);
  const total = all.length;
  const today = todayKey();
  const newToday = useMemo(() => all.filter((b) => dateKey(b.createdAt) === today).length, [all, today]);
  const newMonth = useMemo(() => all.filter((b) => dateKey(b.createdAt).startsWith(today.slice(0, 7))).length, [all, today]);
  const recent = useMemo(() => [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20), [all]);
  const searching = q.trim().length > 0;
  const results = useMemo(() => {
    const digits = normalizeDigits(q);
    const term = normalizeArabicName(q);
    if (!q.trim() || (digits.length < 3 && term.length < 2)) return [];
    return all
      .filter((b) => (digits.length >= 3 && b.nid.includes(digits)) || (term.length >= 2 && !digits && normalizeArabicName(b.name).includes(term)))
      .slice(0, 30);
  }, [all, q]);

  const b = nid ? db.beneficiaries[nid] : undefined;
  const history = nid ? entriesOf(db, nid) : [];

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
                <button onClick={() => setQ("")} aria-label="مسح البحث" className="absolute end-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-sunken">
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
          {!searching && <div className="bg-sunken/60 px-4 py-2 text-xs font-semibold text-muted">آخر المسجلين</div>}
          <ul className="max-h-[560px] divide-y divide-line/60 overflow-y-auto">
            {(searching ? results : recent).map((r) => (
              <li key={r.nid}>
                <button
                  onClick={() => {
                    setNid(r.nid);
                    // الجوال: الانتقال للتفاصيل أسفل النتائج
                    if (window.innerWidth < 1024) requestAnimationFrame(() => document.getElementById("benef-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }));
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
                    {entriesOf(db, r.nid).length} إدخال
                    {!searching && <span className="block">{formatDate(r.createdAt)}</span>}
                  </span>
                </button>
              </li>
            ))}
            {searching && !results.length && (
              <li className="px-4 py-10 text-center text-sm text-muted">لا نتائج. اكتب 3 أرقام على الأقل من الهوية أو حرفين من الاسم</li>
            )}
          </ul>
        </Card>

        {b ? (
          <Card id="benef-detail" className="scroll-mt-20 overflow-hidden">
            <div className="space-y-3 border-b border-line p-5">
              <BeneficiaryEditor key={b.nid} beneficiary={b} />
              <div className="text-sm text-muted">
                <span className="num font-bold text-ink">{b.nid}</span> · مسجلة منذ <span className="num">{formatDate(b.createdAt)}</span> ·{" "}
                <span className="num">{history.length}</span> إدخال
              </div>
            </div>
            <ul className="divide-y divide-line/60">
              {history.map((e) => (
                <HistoryRow
                  key={e.id}
                  e={e}
                  db={db}
                  action={
                    <button onClick={() => setEdit(e)} className="focus-ring grid size-8 place-items-center rounded-lg text-brand hover:bg-brand-soft" aria-label="تعديل">
                      <Pencil className="size-4" />
                    </button>
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
