"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, FileSpreadsheet, History, RotateCcw, UploadCloud } from "lucide-react";
import { AppGate } from "@/components/shell/app-gate";
import { FEATURES } from "@/lib/features";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/field";
import { useSession } from "@/lib/session";
import { CENTERS, PROJECTS } from "@/lib/mock-data";
import { cn, isValidNationalId, normalizeDigits, todayKey } from "@/lib/utils";

type RowStatus = "VALID" | "INVALID" | "DUPLICATE";
interface Row {
  n: number;
  raw: string;
  normalized: string;
  status: RowStatus;
}

/* محاكاة قراءة الملف — في التطبيق الفعلي SheetJS في المتصفح */
function mockParse(): Row[] {
  const raws = [
    "401234562", "٤٠٢٣٤٥٦٧٢", " 803456789 ", "404567893", "905678124", "406781237",
    "807892344", "408913457", "909124562", "401029384", "4.01234562E+8", "12345", "909124562",
    "802130492", "403241508", "402 345 672", "98765432x",
  ];
  const seen = new Set<string>();
  return raws.map((raw, i) => {
    let normalized = normalizeDigits(raw.includes("E+") ? "" : raw);
    let status: RowStatus = "VALID";
    if (!isValidNationalId(normalized)) status = "INVALID";
    else if (seen.has(normalized)) status = "DUPLICATE";
    seen.add(normalized);
    if (raw.includes("E+")) normalized = "";
    return { n: i + 2, raw, normalized, status };
  });
}

const STATUS_UI: Record<RowStatus, { label: string; tone: "ok" | "bad" | "warn" }> = {
  VALID: { label: "صالح", tone: "ok" },
  INVALID: { label: "غير صالح", tone: "bad" },
  DUPLICATE: { label: "مكرر في الملف", tone: "warn" },
};

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const items = ["رفع الملف", "المعاينة", "النتيجة"];
  return (
    <ol className="flex items-center gap-2">
      {items.map((t, i) => {
        const n = i + 1;
        const done = n < step;
        const on = n === step;
        return (
          <li key={t} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                done ? "bg-brand text-brand-ink" : on ? "bg-ink text-white" : "bg-sunken text-muted",
              )}
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : <span className="num">{n}</span>}
            </span>
            <span className={cn("text-sm font-semibold", on ? "text-ink" : "text-muted")}>{t}</span>
            {n < 3 && <span className={cn("h-0.5 flex-1 rounded", done ? "bg-brand" : "bg-line")} />}
          </li>
        );
      })}
    </ol>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "ok" | "bad" | "warn" | "info" | "neutral" }) {
  const c = { ok: "text-ok", bad: "text-bad", warn: "text-warn", info: "text-info", neutral: "text-ink" }[tone];
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className={cn("num text-3xl font-bold", c)}>{value}</div>
      <div className="mt-1 text-sm font-medium text-muted">{label}</div>
    </div>
  );
}

/** الشاشة 4 — رفع Excel (مسار احتياطي) */
function UploadScreen() {
  const { center, project } = useSession();
  const p = PROJECTS.find((x) => x.code === project)!;
  const c = CENTERS.find((x) => x.code === center)!;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [date, setDate] = useState(todayKey());
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"ALL" | RowStatus>("ALL");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(
    () => ({
      total: rows.length,
      valid: rows.filter((r) => r.status === "VALID").length,
      invalid: rows.filter((r) => r.status === "INVALID").length,
      dup: rows.filter((r) => r.status === "DUPLICATE").length,
    }),
    [rows],
  );

  function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setBusy(true);
    setTimeout(() => {
      setRows(mockParse());
      setBusy(false);
      setStep(2);
    }, 600);
  }

  function restart() {
    setFile(null);
    setRows([]);
    setFilter("ALL");
    setStep(1);
  }

  const shown = filter === "ALL" ? rows : rows.filter((r) => r.status === filter);

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 pb-16 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">رفع ملف الخدمات</h1>
          <p className="mt-1 text-sm text-muted">
            مسار احتياطي للأيام التي لم تُستخدم فيها شاشة التحقق. الحالات المؤكدة من النقطة لا تُحسب مرتين.
          </p>
        </div>
        <Link href="/uploads/history" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
          <History className="size-4" />
          سجل الرفعات
        </Link>
      </div>

      <Card className="p-5">
        <Steps step={step} />
      </Card>

      {step === 1 && (
        <Card className="animate-fade-up space-y-6 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>المشروع</Label>
              <div className="flex h-12 items-center rounded-xl bg-sunken px-4 font-bold">{p.name}</div>
            </div>
            <div>
              <Label>المركز</Label>
              <div className="flex h-12 items-center rounded-xl bg-sunken px-4 font-bold">{c.name}</div>
            </div>
            <div>
              <Label htmlFor="date" required>
                تاريخ الخدمة
              </Label>
              <div className="relative">
                <Input id="date" type="date" dir="ltr" className="num" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition",
              drag ? "border-brand bg-brand-soft/60" : "border-line bg-sunken/40",
            )}
          >
            {busy ? (
              <>
                <FileSpreadsheet className="size-12 animate-pulse text-brand" />
                <p className="mt-3 font-bold">جارٍ قراءة {file?.name}…</p>
              </>
            ) : (
              <>
                <span className="grid size-16 place-items-center rounded-2xl bg-surface text-brand shadow-card">
                  <UploadCloud className="size-8" />
                </span>
                <p className="mt-4 text-lg font-bold">اسحب ملف Excel هنا</p>
                <p className="mt-1 text-sm text-muted">أو اختره من الجهاز — xlsx / xls / csv</p>
                <Button className="mt-5" size="lg" onClick={() => fileRef.current?.click()}>
                  اختيار ملف
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => pick(e.target.files?.[0])}
                />
              </>
            )}
          </div>
          <p className="text-sm text-muted">
            الملف يحتوي على عمود واحد على الأقل بأرقام الهويات. يتم تنظيف الأرقام تلقائياً (المسافات، الأرقام العربية، تنسيق Excel).
          </p>
        </Card>
      )}

      {step === 2 && (
        <div className="animate-fade-up space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="إجمالي الصفوف" value={counts.total} />
            <Stat label="صالح" value={counts.valid} tone="ok" />
            <Stat label="غير صالح" value={counts.invalid} tone="bad" />
            <Stat label="مكرر في الملف" value={counts.dup} tone="warn" />
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
              <span className="inline-flex items-center gap-2 px-2 text-sm font-semibold">
                <FileSpreadsheet className="size-4 text-ok" />
                <span className="ltr">{file?.name}</span>
              </span>
              <div className="ms-auto flex gap-1 rounded-xl bg-sunken p-1">
                {(["ALL", "VALID", "INVALID", "DUPLICATE"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                      filter === f ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
                    )}
                  >
                    {f === "ALL" ? "الكل" : STATUS_UI[f].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2.5 text-start font-semibold">الصف</th>
                    <th className="px-4 py-2.5 text-start font-semibold">القيمة في الملف</th>
                    <th className="px-4 py-2.5 text-start font-semibold">بعد التنظيف</th>
                    <th className="px-4 py-2.5 text-start font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {shown.map((r) => (
                    <tr key={r.n} className={cn(r.status === "INVALID" && "bg-bad-soft/40")}>
                      <td className="num px-4 py-2.5 text-muted">{r.n}</td>
                      <td className="px-4 py-2.5">
                        <code className="ltr rounded bg-sunken px-1.5 py-0.5 text-xs">{r.raw}</code>
                      </td>
                      <td className="num px-4 py-2.5 font-semibold">{r.normalized || "—"}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={STATUS_UI[r.status].tone}>{STATUS_UI[r.status].label}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" size="lg" onClick={restart}>
              <ArrowRight className="size-4" />
              تغيير الملف
            </Button>
            <Button size="lg" className="flex-1" onClick={() => setStep(3)} disabled={counts.valid === 0}>
              اعتماد <span className="num">{counts.valid}</span> صفاً صالحاً ومطابقتها
            </Button>
          </div>
          {counts.invalid > 0 && (
            <p className="text-sm text-muted">الصفوف غير الصالحة تُحفظ مع الملف للرجوع إليها ولا تدخل المطابقة.</p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="animate-fade-up space-y-4">
          <Card className="flex items-center gap-4 p-5">
            <span className="grid size-12 place-items-center rounded-full bg-ok-soft text-ok">
              <Check className="size-7" strokeWidth={3} />
            </span>
            <div>
              <h2 className="text-xl font-bold">تمت مطابقة الملف</h2>
              <p className="text-sm text-muted">
                {p.name} · {c.name} · <span className="num">{date}</span>
              </p>
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="متطابق — اعتماد تلقائي" value={5} tone="ok" />
            <Stat label="مؤكد سابقاً من النقطة" value={3} tone="info" />
            <Stat label="يحتاج مراجعة" value={4} tone="warn" />
            <Stat label="غير صالح / مكرر" value={counts.invalid + counts.dup} tone="bad" />
          </div>
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold text-muted">تفاصيل الحالات المحالة للمراجعة</h3>
            <ul className="divide-y divide-line/70 text-sm">
              {[
                { code: "NO_RECEPTION_VISIT", label: "لم تمر على الاستقبال", n: 1 },
                { code: "NOT_REFERRED_TODAY", label: "غير محوّلة لهذا المشروع اليوم", n: 1 },
                { code: "WRONG_CENTER", label: "مسجلة في مركز آخر", n: 1 },
                { code: "UNKNOWN_ID", label: "هوية غير مسجلة", n: 1 },
              ].map((r) => (
                <li key={r.code} className="flex items-center justify-between py-2.5">
                  <span>
                    {r.label} <code className="ltr ms-2 text-xs text-muted">{r.code}</code>
                  </span>
                  <span className="num font-bold">{r.n}</span>
                </li>
              ))}
            </ul>
          </Card>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="lg" variant="secondary" onClick={restart}>
              <RotateCcw className="size-4" />
              رفع ملف آخر
            </Button>
            <Link href="/uploads/history" className="flex-1">
              <Button size="lg" block>
                سجل الرفعات
              </Button>
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

export default function UploadsPage() {
  return (
    <AppGate role="PROJECT" enabled={FEATURES.excelUpload}>
      <UploadScreen />
    </AppGate>
  );
}

