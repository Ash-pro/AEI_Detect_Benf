"use client";

import { FileSpreadsheet } from "lucide-react";
import type { CenterFilter } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function PageHead({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6 sm:gap-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "focus-ring rounded-lg px-3.5 py-1.5 text-sm font-bold transition",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
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

export function StatCard({
  label,
  value,
  delta,
  tone = "ink",
}: {
  label: string;
  value: number;
  delta?: number | null;
  tone?: "ink" | "brand" | "info" | "ok";
}) {
  const cls = { ink: "text-ink", brand: "text-brand", info: "text-info", ok: "text-ok" }[tone];
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="truncate text-[13px] font-semibold text-muted sm:text-sm">{label}</div>
      <div className={cn("num mt-1.5 text-[28px] font-bold leading-none sm:mt-2 sm:text-[34px]", cls)}>{value.toLocaleString("en-US")}</div>
      {delta !== undefined && delta !== null && (
        <div
          className={cn("mt-2 truncate text-xs font-semibold", delta > 0 ? "text-ok" : delta < 0 ? "text-bad" : "text-muted")}
          title="مقارنة بيوم العمل السابق"
        >
          {delta === 0 ? "مثل السابق" : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)}`}
          <span className="hidden sm:inline">{delta === 0 ? "" : " عن يوم العمل السابق"}</span>
        </div>
      )}
    </div>
  );
}

/** زر تصدير Excel — التصدير الفعلي قيد التجهيز */
export function ExportButton({ label, scope, size = "md" }: { label: string; scope: string; size?: "sm" | "md" }) {
  const toast = useToast();
  return (
    <button
      onClick={() => toast(`تصدير ${scope} إلى Excel قيد التجهيز وسيتوفر قريباً`, "info")}
      className={cn(
        "focus-ring inline-flex items-center gap-2 rounded-xl border border-ok/40 bg-ok-soft font-bold text-ok hover:bg-ok/15",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2.5 text-sm",
      )}
    >
      <FileSpreadsheet className={size === "sm" ? "size-3.5" : "size-4"} />
      {label}
    </button>
  );
}

export function Bar({ value, max, tone = "brand" }: { value: number; max: number; tone?: "brand" | "ok" }) {
  const w = max ? Math.max((value / max) * 100, value ? 2 : 0) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-sunken">
      <div className={cn("h-full rounded-full", tone === "brand" ? "bg-brand" : "bg-ok")} style={{ width: `${w}%` }} />
    </div>
  );
}
