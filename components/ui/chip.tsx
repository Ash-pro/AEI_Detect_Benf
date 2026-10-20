import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Chip({
  selected,
  onToggle,
  children,
  sub,
  disabled,
  tone = "brand",
}: {
  selected: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  sub?: React.ReactNode;
  disabled?: boolean;
  tone?: "brand" | "warn";
}) {
  const on = tone === "warn" ? "border-warn bg-warn-soft text-warn" : "border-brand bg-brand-soft text-brand";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "focus-ring group flex min-h-[56px] items-center gap-3 rounded-xl border-2 px-4 py-2 text-start transition",
        "disabled:cursor-not-allowed disabled:opacity-40",
        selected ? on : "border-line bg-surface text-ink hover:border-muted/40",
      )}
    >
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-md border-2 transition",
          selected ? (tone === "warn" ? "border-warn bg-warn text-white" : "border-brand bg-brand text-white") : "border-line",
        )}
      >
        {selected && <Check className="size-4" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold leading-tight">{children}</span>
        {sub && <span className="mt-0.5 block text-xs font-normal text-muted">{sub}</span>}
      </span>
    </button>
  );
}
