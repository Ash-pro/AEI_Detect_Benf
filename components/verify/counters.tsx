import { cn } from "@/lib/utils";

export function CounterStrip({
  title,
  items,
}: {
  title: React.ReactNode;
  items: { label: string; value: number; tone?: "ok" | "warn" | "info" | "neutral" }[];
}) {
  const tone = {
    ok: "text-ok",
    warn: "text-warn",
    info: "text-info",
    neutral: "text-ink",
  } as const;
  return (
    <section aria-label="عداد اليوم" className="rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
      <div className="mb-2 text-xs font-semibold text-muted">{title}</div>
      <dl className="grid grid-cols-2 gap-y-3 sm:flex sm:divide-x sm:divide-x-reverse sm:divide-line">
        {items.map((it) => (
          <div key={it.label} className="sm:flex-1 sm:px-4 sm:first:ps-0">
            <dd className={cn("num text-start text-2xl font-bold leading-none", tone[it.tone ?? "neutral"])}>{it.value}</dd>
            <dt className="mt-1 text-xs font-medium text-muted">{it.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
