"use client";

import { forwardRef } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** حقل الهوية الرئيسي — بحث تلقائي عند اكتمال 9 أرقام صالحة */
export const IdSearch = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (v: string) => void;
    onEnter: () => void;
    onClear: () => void;
    error?: string;
    loading?: boolean;
    disabled?: boolean;
  }
>(function IdSearch({ value, onChange, onEnter, onClear, error, loading, disabled }, ref) {
  return (
    <div>
      <label htmlFor="nid" className="mb-2 block text-sm font-semibold text-muted">
        رقم الهوية
      </label>
      <div
        className={cn(
          "group relative flex items-center rounded-2xl border-2 bg-surface shadow-card transition",
          error ? "border-bad" : "border-line focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15",
        )}
      >
        <span className="ps-4 text-muted sm:ps-5">
          {loading ? <Loader2 className="size-6 animate-spin text-brand" /> : <Search className="size-6" />}
        </span>
        <input
          ref={ref}
          id="nid"
          inputMode="numeric"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          disabled={disabled}
          dir="ltr"
          placeholder="_ _ _ _ _ _ _ _ _"
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby="nid-msg"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEnter();
            if (e.key === "Escape") onClear();
          }}
          className="num h-20 w-full min-w-0 bg-transparent px-2 text-center text-[28px] font-bold tracking-[0.12em] sm:px-4 sm:tracking-[0.28em] text-ink outline-hidden placeholder:text-[20px] placeholder:font-normal placeholder:tracking-[0.2em] placeholder:text-muted/40 sm:h-24 sm:text-[42px]"
        />
        <span className="flex items-center gap-2 pe-2 sm:pe-3">
          <span className={cn("num hidden text-xs font-semibold sm:inline", value.length === 9 ? "text-ink" : "text-muted")}>
            {value.length}/9
          </span>
          {value && (
            <button
              type="button"
              onClick={onClear}
              className="focus-ring grid size-10 place-items-center rounded-xl text-muted hover:bg-sunken"
              aria-label="مسح"
            >
              <X className="size-5" />
            </button>
          )}
        </span>
      </div>
      <p id="nid-msg" className={cn("mt-2 min-h-[22px] text-sm font-semibold", error ? "text-bad" : "text-muted")}>
        {error ?? "أدخل 9 أرقام — يبدأ البحث تلقائياً"}
      </p>
    </div>
  );
});
