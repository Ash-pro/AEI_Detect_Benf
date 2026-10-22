"use client";

import { forwardRef } from "react";
import { Baby, User, UserRound } from "lucide-react";
import { Input, Label } from "@/components/ui/field";
import { ID_TYPES, idTypeLabel } from "@/lib/queue";
import type { IdType } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<IdType, typeof User> = { MOTHER: UserRound, FATHER: User, CHILD: Baby };

/** اختيار نوع الهوية: أب / أم / طفل */
export function IdTypePicker({ value, onChange, invalid }: { value?: IdType; onChange: (t: IdType) => void; invalid?: boolean }) {
  return (
    <div role="radiogroup" aria-label="نوع الهوية" className="grid grid-cols-3 gap-2">
      {ID_TYPES.map((t) => {
        const Icon = ICONS[t.value];
        const on = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(t.value)}
            className={cn(
              "focus-ring flex h-12 items-center justify-center gap-2 rounded-xl border-2 text-base font-bold transition",
              on ? "border-brand bg-brand-soft text-brand" : invalid ? "border-bad/50 bg-surface" : "border-line bg-surface hover:border-muted/40",
            )}
          >
            <Icon className="size-5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** حقلا الاسم ونوع الهوية للحالة الجديدة أو التعديل */
export const IdFields = forwardRef<
  HTMLInputElement,
  {
    name: string;
    type?: IdType;
    onName: (v: string) => void;
    onType: (t: IdType) => void;
    onEnter?: () => void;
    showErrors?: boolean;
    idPrefix?: string;
  }
>(function IdFields({ name, type, onName, onType, onEnter, showErrors, idPrefix = "new" }, ref) {
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div>
        <Label htmlFor={`${idPrefix}-name`} required>
          الاسم <span className="font-normal text-muted">(الأول يكفي)</span>
        </Label>
        <Input
          ref={ref}
          id={`${idPrefix}-name`}
          value={name}
          autoComplete="off"
          invalid={showErrors && !name.trim()}
          placeholder="مثل: سعاد أو سعاد محمد"
          onChange={(e) => onName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        />
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-ink">
          نوع الهوية<span className="ms-1 text-bad">*</span>
        </span>
        <IdTypePicker value={type} onChange={onType} invalid={showErrors && !type} />
      </div>
    </div>
  );
});

/** شارة نوع الهوية */
export function IdTypeTag({ type, className }: { type?: IdType; className?: string }) {
  if (!type) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold",
        type === "CHILD" ? "bg-warn-soft text-warn" : type === "FATHER" ? "bg-info-soft text-info" : "bg-brand-soft text-brand",
        className,
      )}
    >
      {idTypeLabel(type)}
    </span>
  );
}
