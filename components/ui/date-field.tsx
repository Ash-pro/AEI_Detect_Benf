"use client";

import { cn, dayFull } from "@/lib/utils";

/** فتح منتقي التاريخ الأصلي عند الضغط في أي مكان من الحقل */
function openPicker(el: HTMLInputElement) {
  try {
    el.showPicker?.();
  } catch {
    /* بعض المتصفحات لا تدعم showPicker — الحقل نفسه قابل للضغط */
  }
}

/**
 * حقل تاريخ يعرض دائماً بصيغة يوم/شهر/سنة (27/10/2026) مهما كانت لغة المتصفح،
 * مع منتقي التاريخ الأصلي للجهاز فوقه (شفاف).
 */
export function DateField({
  value,
  onChange,
  label,
  min,
  max,
  className,
  id,
}: {
  value: string;
  onChange: (d: string) => void;
  label: string;
  id?: string;
  min?: string;
  max?: string;
  className?: string;
}) {
  return (
    <span className={cn("focus-within:ring-brand/25 relative inline-flex min-w-[118px] items-center justify-center rounded-lg px-3 focus-within:ring-4", className)}>
      <span className="num pointer-events-none text-sm font-bold" dir="ltr" aria-hidden>
        {value ? dayFull(value) : "—"}
      </span>
      <input
        id={id}
        type="date"
        aria-label={label}
        dir="ltr"
        min={min}
        max={max}
        value={value}
        onClick={(e) => openPicker(e.currentTarget)}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  );
}
