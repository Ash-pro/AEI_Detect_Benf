"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, FileSpreadsheet, Upload } from "lucide-react";
import { AppGate } from "@/components/shell/app-gate";
import { FEATURES } from "@/lib/features";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { useSession } from "@/lib/session";
import { CENTERS, PROJECTS } from "@/lib/mock-data";

interface UploadItem {
  id: string;
  date: string;
  file: string;
  at: string;
  by: string;
  rows: number;
  matched: number;
  already: number;
  review: number;
  invalid: number;
}

const ITEMS: UploadItem[] = [
  { id: "u1", date: "18/10/2026", file: "unicef_khy_18-10.xlsx", at: "15:42", by: "محمود قديح", rows: 41, matched: 30, already: 6, review: 3, invalid: 2 },
  { id: "u2", date: "14/10/2026", file: "خدمات 14 اكتوبر.xlsx", at: "16:05", by: "محمود قديح", rows: 37, matched: 22, already: 12, review: 2, invalid: 1 },
  { id: "u3", date: "14/10/2026", file: "خدمات 14 اكتوبر - تكملة.xlsx", at: "16:30", by: "محمود قديح", rows: 6, matched: 4, already: 0, review: 1, invalid: 1 },
  { id: "u4", date: "09/10/2026", file: "unicef 9-10.csv", at: "15:10", by: "محمود قديح", rows: 45, matched: 41, already: 2, review: 2, invalid: 0 },
];

/** الشاشة 5 — سجل الرفعات */
function HistoryScreen() {
  const { center, project } = useSession();
  const p = PROJECTS.find((x) => x.code === project)!;
  const c = CENTERS.find((x) => x.code === center)!;
  const [open, setOpen] = useState<UploadItem | null>(null);

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 pb-16 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">سجل الرفعات</h1>
          <p className="mt-1 text-sm text-muted">
            {p.name} · {c.name}
          </p>
        </div>
        <Link href="/uploads">
          <Button>
            <Upload className="size-4" />
            رفع ملف
          </Button>
        </Link>
      </div>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {ITEMS.map((u) => (
            <li key={u.id}>
              <button
                onClick={() => setOpen(u)}
                className="focus-ring flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-start hover:bg-sunken/60"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ok-soft text-ok">
                  <FileSpreadsheet className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{u.file}</span>
                  <span className="block text-sm text-muted">
                    خدمات يوم <span className="num font-semibold text-ink">{u.date}</span> · رُفع{" "}
                    <span className="num">{u.at}</span> بواسطة {u.by}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  <Badge>
                    <span className="num">{u.rows}</span> صف
                  </Badge>
                  <Badge tone="ok">
                    <span className="num">{u.matched}</span> متطابق
                  </Badge>
                  {u.review > 0 && (
                    <Badge tone="warn">
                      <span className="num">{u.review}</span> مراجعة
                    </Badge>
                  )}
                  {u.invalid > 0 && (
                    <Badge tone="bad">
                      <span className="num">{u.invalid}</span> غير صالح
                    </Badge>
                  )}
                </span>
                <ChevronLeft className="size-5 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Dialog open={Boolean(open)} onClose={() => setOpen(null)} title={open?.file ?? ""} description={`خدمات يوم ${open?.date ?? ""}`}>
        {open && (
          <dl className="grid grid-cols-2 gap-3">
            {[
              ["إجمالي الصفوف", open.rows, "text-ink"],
              ["متطابق", open.matched, "text-ok"],
              ["مؤكد سابقاً من النقطة", open.already, "text-info"],
              ["يحتاج مراجعة", open.review, "text-warn"],
              ["غير صالح / مكرر", open.invalid, "text-bad"],
            ].map(([l, v, cls]) => (
              <div key={l as string} className="rounded-xl border border-line p-4">
                <dd className={`num text-2xl font-bold ${cls}`}>{v as number}</dd>
                <dt className="mt-1 text-sm text-muted">{l as string}</dt>
              </div>
            ))}
          </dl>
        )}
      </Dialog>
    </main>
  );
}

export default function HistoryPage() {
  return (
    <AppGate role="PROJECT" enabled={FEATURES.excelUpload}>
      <HistoryScreen />
    </AppGate>
  );
}
