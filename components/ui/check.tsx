import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
        "focus-ring flex min-h-[54px] w-full items-center gap-3 rounded-xl border-2 px-3.5 py-2 text-start transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-ink hover:border-muted/40",
      )}
    >
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-md border-2 transition",
          checked ? "border-brand bg-brand text-white" : "border-line bg-surface",
        )}
      >
        {checked && <Check className="size-4" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block font-bold leading-tight">{children}</span>
        {sub && <span className="mt-0.5 block text-xs font-medium text-muted">{sub}</span>}
      </span>
    </button>
  );
}
