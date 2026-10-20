import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="grid size-9 place-items-center rounded-xl bg-brand text-brand-ink shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 7h16M4 12h10M4 17h7" />
          <path d="m15 16 2.2 2.2L21 14" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-bold">استقبال المستفيدين</div>
        <div className="text-xs text-muted">أرض الإنسان الفلسطينية الخيرية</div>
      </div>
    </div>
  );
}
