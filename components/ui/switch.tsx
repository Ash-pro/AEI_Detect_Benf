import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export function Switch({
  checked,
  onChange,
  label,
  id,
  disabled,
  loading,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  id?: string;
  disabled?: boolean;
  /** أثناء الحفظ: مؤشر دوّار داخل المقبض والمفتاح غير قابل للضغط */
  loading?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      onClick={() => onChange(!checked)}
      className={cn(
        "focus-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition after:absolute after:-inset-x-1 after:-inset-y-2.5 disabled:cursor-not-allowed",
        loading ? "cursor-wait" : "disabled:opacity-40",
        checked ? "bg-brand" : "bg-line",
      )}
    >
      <span className={cn("absolute grid size-5 place-items-center rounded-full bg-white shadow transition-all", checked ? "start-[22px]" : "start-0.5")}>
        {loading && <Spinner className="size-3.5 text-brand" />}
      </span>
    </button>
  );
}
