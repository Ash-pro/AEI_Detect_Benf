"use client";

import { Share2 } from "lucide-react";
import type { StaffStats } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** إحصائيات الموظف اليوم: شريط مضغوط حتى يبقى حقل الهوية قريباً من الأعلى */
export function StatsStrip({ stats, isPoint, waiting, onShare }: { stats: StaffStats; isPoint: boolean; waiting?: number; onShare: () => void }) {
  const tiles = isPoint
    ? [
        { label: "خدمتها اليوم", value: stats.total, cls: "text-ok" },
        { label: "بانتظار", value: waiting ?? 0, cls: waiting ? "text-warn" : "text-muted" },
        { label: "جديدة", value: stats.isNew, cls: "text-info" },
      ]
    : [
        { label: "حالاتك اليوم", value: stats.total, cls: "text-ink" },
        { label: "جديدة", value: stats.isNew, cls: "text-info" },
        { label: "متكررة", value: stats.repeat, cls: "text-muted" },
      ];
  const projects = stats.perProject.filter((p) => p.count);

  return (
    <section aria-label="إحصائياتك اليوم" className="rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
      <div className="flex items-center gap-1">
        <div className="grid flex-1 grid-cols-3 divide-x divide-x-reverse divide-line">
          {tiles.map((t) => (
            <div key={t.label} className="px-2 text-center first:ps-0 last:pe-0 sm:text-start">
              <div className={cn("num text-xl font-bold leading-none sm:text-2xl", t.cls)}>{t.value}</div>
              <div className="mt-1 truncate text-xs font-medium text-muted sm:text-xs">{t.label}</div>
            </div>
          ))}
        </div>
        <button
          onClick={onShare}
          aria-label="مشاركة إحصائيات اليوم"
          title="مشاركة إحصائيات اليوم"
          className="focus-ring inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[#128c4a]/40 bg-[#e7f6ec] px-3 text-sm font-bold text-[#0f6b38] hover:bg-[#d6efdf]"
        >
          <Share2 className="size-4" />
          <span className="hidden sm:inline">مشاركة</span>
        </button>
      </div>
      {projects.length > 0 && (
        <div className="scroll-fade -mx-4 mt-3 flex gap-1.5 overflow-x-auto border-t border-line px-4 pt-2.5">
          {projects.map((p) => (
            <span key={p.code} className="shrink-0 rounded-lg bg-sunken px-2.5 py-1 text-xs font-bold">
              {p.name} <span className="num text-muted">{p.count}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
