import { cn } from "@/lib/utils";

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label?: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("focus-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition", checked ? "bg-brand" : "bg-line")}
    >
      <span className={cn("absolute size-5 rounded-full bg-white shadow transition-all", checked ? "start-[22px]" : "start-0.5")} />
    </button>
  );
}
