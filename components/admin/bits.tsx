"use client";

import { ChevronLeft, ChevronRight, FileSpreadsheet, type LucideIcon } from "lucide-react";
import type { CenterFilter } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { useToast } from "@/components/ui/toast";
import { addDays, cn, hourLabel, monthLabel, todayKey } from "@/lib/utils";
import { DateField } from "@/components/ui/date-field";

export { DateField };

export function PageHead({
  title,
  sub,
  actions,
  eyebrow,
}: {
  title: string;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6 sm:gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1">{eyebrow}</div>}
        <h1 className="text-xl font-bold tracking-tight sm:text-[26px]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** شريط الفلاتر: يجمع اليوم/الشهر والمركز وباقي الأدوات في سطر واحد واضح */
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-5 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2 shadow-card sm:gap-3", className)}>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex max-w-full overflow-x-auto rounded-xl bg-sunken p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "focus-ring min-h-9 shrink-0 whitespace-nowrap rounded-lg px-3.5 text-sm font-bold transition",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="num ms-1.5 text-xs font-semibold text-muted">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function CenterTabs({ value, onChange }: { value: CenterFilter; onChange: (v: CenterFilter) => void }) {
  const { db } = useStore();
  return (
    <Segmented
      label="المركز"
      value={value}
      onChange={onChange}
      options={[{ value: "ALL", label: "كل المراكز" }, ...db.centers.map((c) => ({ value: c.code, label: c.short }))]}
    />
  );
}

/** التنقل بين الأيام: سابق / التاريخ / تالي + زر "اليوم" */
export function DateStepper({ value, onChange, days }: { value: string; onChange: (d: string) => void; days?: string[] }) {
  const today = todayKey();
  // إن وُجدت قائمة أيام العمل ننتقل بينها، وإلا يوماً بيوم
  const sorted = days ? [...new Set([...days, today])].sort() : null;
  const i = sorted ? sorted.indexOf(value) : -1;
  const prev = sorted ? (i > 0 ? sorted[i - 1] : i === -1 ? sorted.filter((d) => d < value).pop() : undefined) : addDays(value, -1);
  const next = sorted ? (i >= 0 && i < sorted.length - 1 ? sorted[i + 1] : i === -1 ? sorted.find((d) => d > value) : undefined) : value < today ? addDays(value, 1) : undefined;
  const btn = "focus-ring grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-sunken p-1">
      <button onClick={() => prev && onChange(prev)} disabled={!prev} aria-label="اليوم السابق" title="اليوم السابق" className={btn}>
        <ChevronRight className="size-5" />
      </button>
      <DateField label="اليوم" value={value} max={today} onChange={onChange} className="h-10 bg-surface shadow-sm" />
      <button onClick={() => next && onChange(next)} disabled={!next} aria-label="اليوم التالي" title="اليوم التالي" className={btn}>
        <ChevronLeft className="size-5" />
      </button>
      {value !== today && (
        <button onClick={() => onChange(today)} className="focus-ring h-10 rounded-lg px-3 text-sm font-bold text-brand hover:bg-surface">
          اليوم
        </button>
      )}
    </div>
  );
}

export function MonthSelect({ value, onChange, months }: { value: string; onChange: (m: string) => void; months: string[] }) {
  const list = months.includes(value) ? months : [value, ...months];
  return (
    <select
      aria-label="الشهر"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="focus-ring h-11 rounded-xl border-0 bg-sunken px-3 text-sm font-bold"
    >
      {list.map((m) => (
        <option key={m} value={m}>
          {monthLabel(m)}
        </option>
      ))}
    </select>
  );
}

const TONES = {
  ink: { text: "text-ink", tile: "bg-sunken text-muted" },
  brand: { text: "text-brand", tile: "bg-brand-soft text-brand" },
  info: { text: "text-info", tile: "bg-info-soft text-info" },
  ok: { text: "text-ok", tile: "bg-ok-soft text-ok" },
  warn: { text: "text-warn", tile: "bg-warn-soft text-warn" },
};

export function StatCard({
  label,
  value,
  delta,
  tone = "ink",
  icon: Icon,
  hint,
  suffix,
}: {
  label: string;
  value: number | string;
  delta?: number | null;
  tone?: keyof typeof TONES;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  suffix?: string;
}) {
  const t = TONES[tone];
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="line-clamp-2 text-[13px] font-semibold leading-snug text-muted sm:text-sm" title={label}>{label}</div>
        {Icon && (
          <span className={cn("hidden size-9 shrink-0 place-items-center rounded-xl xl:grid", t.tile)} aria-hidden>
            <Icon className="size-[18px]" />
          </span>
        )}
      </div>
      <div className={cn("num mt-1 text-[28px] font-bold leading-none sm:text-[32px]", t.text)}>
        {typeof value === "number" ? value.toLocaleString("en-US") : value}
        {suffix && <span className="ms-0.5 text-lg">{suffix}</span>}
      </div>
      <div className="mt-auto pt-2 text-xs font-semibold">
        {delta !== undefined && delta !== null ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
              delta > 0 ? "bg-ok-soft text-ok" : delta < 0 ? "bg-bad-soft text-bad" : "bg-sunken text-muted",
            )}
            title="مقارنة بيوم العمل السابق"
          >
            {delta === 0 ? "مثل السابق" : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)}`}
            <span className="hidden font-medium sm:inline">{delta === 0 ? "" : " عن السابق"}</span>
          </span>
        ) : hint ? (
          <span className="block truncate text-muted">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}

/** مؤشرات مضغوطة في صف واحد للجوال — بديل لبطاقات StatCard حتى لا تدفع القائمة للأسفل */
export function StatStrip({
  items,
  className,
}: {
  items: { label: string; value: number | string; tone?: keyof typeof TONES; hint?: string }[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5 rounded-2xl border border-line bg-surface p-1.5 shadow-card", className)} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0 rounded-xl bg-sunken/60 px-2 py-2 text-center">
          <div className={cn("num text-xl font-bold leading-tight", TONES[i.tone ?? "ink"].text)}>
            {typeof i.value === "number" ? i.value.toLocaleString("en-US") : i.value}
          </div>
          <div className="mt-0.5 text-xs font-semibold leading-tight text-muted">{i.label}</div>
          {i.hint && <div className="num mt-0.5 truncate text-xs text-muted/80">{i.hint}</div>}
        </div>
      ))}
    </div>
  );
}

export function SectionHead({ title, sub, icon: Icon, actions }: { title: string; sub?: React.ReactNode; icon?: LucideIcon; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && <Icon className="size-5 shrink-0 text-muted" />}
        <div className="min-w-0">
          <h2 className="text-base font-bold sm:text-lg">{title}</h2>
          {sub && <p className="text-xs text-muted">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** زر تصدير Excel — التصدير الفعلي قيد التجهيز */
export function ExportButton({ label, scope, size = "md" }: { label: string; scope: string; size?: "sm" | "md" }) {
  const toast = useToast();
  const { user } = useStore();
  if (!can(user, "export")) return null;
  return (
    <button
      onClick={() => toast(`تصدير ${scope} إلى Excel قيد التجهيز وسيتوفر قريباً`, "info")}
      className={cn(
        "focus-ring inline-flex items-center gap-2 rounded-xl border border-ok/40 bg-ok-soft font-bold text-ok hover:bg-ok/15",
        size === "sm" ? "min-h-9 px-2.5 py-1 text-xs" : "min-h-10 px-3.5 py-2 text-sm",
      )}
    >
      <FileSpreadsheet className={size === "sm" ? "size-3.5" : "size-4"} />
      {label}
    </button>
  );
}

export function Bar({ value, max, tone = "brand", color }: { value: number; max: number; tone?: "brand" | "ok"; color?: string }) {
  const w = max ? Math.max((value / max) * 100, value ? 2 : 0) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-sunken">
      <div className={cn("h-full rounded-full", !color && (tone === "brand" ? "bg-brand" : "bg-ok"))} style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

/** نسبة الخدمة = مخدوم في النقطة ÷ موجّه من الاستقبال */
export function coverage(served: number, referred: number): number | null {
  return referred ? Math.round((served / referred) * 100) : null;
}

export function CoverageBar({ served, referred, compact }: { served: number; referred: number; compact?: boolean }) {
  const pct = coverage(served, referred);
  // أكثر من 100%: النقطة خدمت حالات لم تمر على الاستقبال — تُعرض كتنبيه لا كإنجاز
  const over = pct !== null && pct > 100;
  const tone = pct === null ? "text-muted" : over ? "text-info" : pct >= 80 ? "text-ok" : pct >= 50 ? "text-warn" : "text-bad";
  const bg = pct === null ? "" : over ? "bg-info" : pct >= 80 ? "bg-ok" : pct >= 50 ? "bg-warn" : "bg-bad";
  return (
    <div
      className={cn("flex items-center gap-2.5", compact ? "w-full" : "min-w-[140px]")}
      title={
        over
          ? `خدمت النقطة ${served} حالة مقابل ${referred} محوّلة من الاستقبال — الفرق حالات خُدمت دون المرور على الاستقبال`
          : "نسبة الخدمة: المخدوم في النقطة من الموجّه من الاستقبال"
      }
    >
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
        {pct !== null && <div className={cn("h-full rounded-full", bg, over && "bg-[repeating-linear-gradient(135deg,var(--color-info)_0_6px,color-mix(in_srgb,var(--color-info)_60%,white)_6px_12px)]")} style={{ width: `${Math.min(pct, 100)}%` }} />}
      </div>
      <span className={cn("num inline-flex w-12 shrink-0 items-center justify-end gap-0.5 text-end text-sm font-bold", tone)}>
        {pct === null ? "—" : `${pct}%`}
      </span>
    </div>
  );
}

/** توزيع الحالات على ساعات اليوم */
export function HourChart({ reception, point, height = 150 }: { reception: number[]; point: number[]; height?: number }) {
  const total = reception.map((v, i) => v + point[i]);
  const used = total.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  if (!used.length) return <p className="py-10 text-center text-sm text-muted">لا توجد بيانات</p>;
  const from = Math.min(...used);
  const to = Math.max(...used);
  const hours = Array.from({ length: to - from + 1 }, (_, k) => from + k);
  const max = Math.max(...hours.map((h) => total[h]), 1);
  const peak = hours.reduce((a, h) => (total[h] > total[a] ? h : a), hours[0]);
  return (
    <div>
      <div className="flex items-end gap-1 sm:gap-1.5" style={{ height }} dir="ltr">
        {hours.map((h) => (
          <div key={h} className="group relative flex h-full flex-1 flex-col justify-end" title={`${hourLabel(h)}: استقبال ${reception[h]} · نقاط ${point[h]}`}>
            <span className={cn("num mb-1 text-center text-[11px] font-bold", h === peak ? "text-ink" : "text-transparent group-hover:text-muted")}>{total[h]}</span>
            <div className="flex flex-col overflow-hidden rounded-t-md" style={{ height: `${(total[h] / max) * 100}%`, minHeight: total[h] ? 3 : 0 }}>
              <div className="bg-ok" style={{ flex: point[h] }} />
              <div className="bg-brand" style={{ flex: reception[h] }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1 border-t border-line pt-1.5 sm:gap-1.5" dir="ltr">
        {hours.map((h, i) => (
          <span key={h} dir="rtl" className={cn("num flex-1 whitespace-nowrap text-center text-[11px] text-muted", i % (hours.length > 10 ? 2 : 1) && "invisible")}>
            {hourLabel(h)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; cls: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs font-semibold text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <i className={cn("size-2.5 rounded-sm", i.cls)} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
