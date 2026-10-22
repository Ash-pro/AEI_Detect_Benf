"use client";

import { Share2 } from "lucide-react";
import type { StaffStats } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function StatsStrip({ stats, isPoint, waiting, onShare }: { stats: StaffStats; isPoint: boolean; waiting?: number; onShare: () => void }) {
  const tiles = isPoint
    ? [
        { label: "حالات خدمتها اليوم", value: stats.total, cls: "text-ok" },
        { label: "بانتظار الخدمة", value: waiting ?? 0, cls: waiting ? "text-warn" : "text-muted" },
        { label: "جديدة على النظام", value: stats.isNew, cls: "text-info" },
      ]
    : [
        { label: "حالاتك اليوم", value: stats.total, cls: "text-ink" },
        { label: "جديدة", value: stats.isNew, cls: "text-info" },
        { label: "متكررة", value: stats.repeat, cls: "text-muted" },
      ];
  return (
    <section aria-label="إحصائياتك اليوم" className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {tiles.map((t) => (
          <div key={t.label}>
            <div className={cn("num text-2xl font-bold leading-none", t.cls)}>{t.value}</div>
            <div className="mt-1 text-xs font-medium text-muted">{t.label}</div>
          </div>
        ))}
        <button
          onClick={onShare}
          className="focus-ring ms-auto inline-flex items-center gap-2 rounded-xl border border-[#128c4a]/40 bg-[#e7f6ec] px-3.5 py-2 text-sm font-bold text-[#0f6b38] hover:bg-[#d6efdf]"
        >
          <Share2 className="size-4" />
          مشاركة إحصائيات اليوم
        </button>
      </div>
      {stats.perProject.some((p) => p.count) && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
          {stats.perProject
            .filter((p) => p.count)
            .map((p) => (
              <span key={p.code} className="rounded-lg bg-sunken px-2.5 py-1 text-xs font-bold">
                {p.name} <span className="num text-muted">{p.count}</span>
              </span>
            ))}
        </div>
      )}
    </section>
  );
}
