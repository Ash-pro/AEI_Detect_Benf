import { cn } from "@/lib/utils";

/** شعار أرض الإنسان */
export function AeiLogo({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/aei-logo-256.png" alt="شعار أرض الإنسان" width={256} height={256} className={cn("size-10 shrink-0 object-contain", className)} />;
}

export function BrandMark({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <AeiLogo className={size === "lg" ? "size-14" : "size-10"} />
      <div className="leading-tight">
        <div className={cn("font-bold", size === "lg" ? "text-lg" : "text-[15px]")}>استقبال المستفيدين</div>
        <div className={cn("text-muted", size === "lg" ? "text-sm" : "text-xs")}>أرض الإنسان الفلسطينية الخيرية</div>
      </div>
    </div>
  );
}
