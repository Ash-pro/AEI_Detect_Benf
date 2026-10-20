import { AlertTriangle, Ban, Info, MapPin, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type BannerTone = "bad" | "warn" | "info" | "center";

const map = {
  bad: { cls: "bg-bad-soft text-bad border-bad/20", Icon: Ban },
  warn: { cls: "bg-warn-soft text-warn border-warn/25", Icon: AlertTriangle },
  info: { cls: "bg-info-soft text-info border-info/20", Icon: Info },
  center: { cls: "bg-khy/10 text-khy border-khy/20", Icon: MapPin },
  review: { cls: "bg-warn-soft text-warn border-warn/25", Icon: ShieldAlert },
};

export function Banner({
  tone,
  title,
  children,
  icon,
}: {
  tone: keyof typeof map;
  title: React.ReactNode;
  children?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const { cls, Icon } = map[tone];
  return (
    <div className={cn("flex gap-3 border-b px-5 py-3.5", cls)} role="alert">
      <span className="mt-0.5 shrink-0">{icon ?? <Icon className="size-5" />}</span>
      <div className="min-w-0">
        <div className="font-bold leading-snug">{title}</div>
        {children && <div className="mt-0.5 text-sm font-medium opacity-90">{children}</div>}
      </div>
    </div>
  );
}
