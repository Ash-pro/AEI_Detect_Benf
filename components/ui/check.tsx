import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** يمنع كسر رموز المشاريع عند الشرطة (TSFP-WFP لا تنقسم لسطرين) */
const keepCode = (n: React.ReactNode) => (typeof n === "string" ? n.replace(/-/g, "-\u2060") : n);

/** مربع اختيار كبير مناسب للمس */
export function CheckBox({
  checked,
  onChange,
  children,
  sub,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  sub?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "focus-ring flex min-h-[54px] w-full items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-start transition sm:gap-3 sm:px-3.5",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-ink hover:border-muted/40",
      )}
    >
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-md border-2 transition sm:size-6",
          checked ? "border-brand bg-brand text-white" : "border-line bg-surface",
        )}
      >
        {checked && <Check className="size-4" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-tight break-words min-[400px]:text-[15px] sm:text-base">{keepCode(children)}</span>
        {sub && <span className="mt-0.5 block text-xs font-medium text-muted">{sub}</span>}
      </span>
    </button>
  );
}
