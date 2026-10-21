"use client";

import { useMemo, useState } from "react";
import { Pencil, Search, UserRound } from "lucide-react";
import { PageHead } from "@/components/admin/bits";
import { AdminEntryDialog } from "@/components/admin/entry-dialog";
import { HistoryRow } from "@/components/entry/history";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { entriesOf } from "@/lib/queries";
import type { Entry } from "@/lib/types";
import { formatDate, normalizeArabicName, normalizeDigits } from "@/lib/utils";

/** الشاشة 10 — المستفيدون والإدخالات */
export default function BeneficiariesPage() {
  const { db, renameBeneficiary } = useStore();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [nid, setNid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<Entry | null>(null);

  const total = Object.keys(db.beneficiaries).length;
  const results = useMemo(() => {
    const digits = normalizeDigits(q);
    const term = normalizeArabicName(q);
    if (!q.trim() || (digits.length < 3 && term.length < 2)) return [];
    return Object.values(db.beneficiaries)
      .filter((b) => (digits.length >= 3 && b.nid.includes(digits)) || (term.length >= 2 && !digits && normalizeArabicName(b.name).includes(term)))
      .slice(0, 30);
  }, [db.beneficiaries, q]);

  const b = nid ? db.beneficiaries[nid] : undefined;
  const history = nid ? entriesOf(db, nid) : [];

  return (
    <>
      <PageHead title="المستفيدون" sub={`${total.toLocaleString("en-US")} هوية مسجلة`} />
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
                className="h-11 w-full rounded-xl border border-line bg-surface ps-9 pe-3 outline-hidden focus:border-brand"
              />
            </div>
          </div>
          <ul className="max-h-[560px] divide-y divide-line/60 overflow-y-auto">
            {results.map((r) => (
              <li key={r.nid}>
                <button
                  onClick={() => {
                    setNid(r.nid);
                    setName(r.name);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-sunken/60 ${nid === r.nid ? "bg-brand-soft" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{r.name || <span className="text-muted">بدون اسم</span>}</span>
                    <span className="num text-xs text-muted">{r.nid}</span>
                  </span>
                  <span className="num shrink-0 text-xs text-muted">{entriesOf(db, r.nid).length} إدخال</span>
                </button>
              </li>
            ))}
            {q && !results.length && <li className="px-4 py-10 text-center text-sm text-muted">لا نتائج</li>}
            {!q && <li className="px-4 py-10 text-center text-sm text-muted">ابحث برقم الهوية (3 أرقام على الأقل) أو بالاسم</li>}
          </ul>
        </Card>

        {b ? (
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-end gap-3 border-b border-line p-5">
              <div className="min-w-[220px] flex-1">
                <Label htmlFor="b-name">الاسم</Label>
                <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="بدون اسم" />
              </div>
              <Button
                variant="secondary"
                size="lg"
                disabled={name.trim() === b.name}
                onClick={() => {
                  renameBeneficiary(b.nid, name);
                  toast("تم حفظ الاسم");
                }}
              >
                حفظ الاسم
              </Button>
              <div className="w-full text-sm text-muted">
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
          <Card className="flex flex-col items-center justify-center gap-2 p-14 text-center text-muted">
            <UserRound className="size-10" />
            اختر مستفيداً من نتائج البحث لعرض كل إدخالاته وتعديلها
          </Card>
        )}
      </div>
      <AdminEntryDialog entry={edit} onClose={() => setEdit(null)} />
    </>
  );
}
