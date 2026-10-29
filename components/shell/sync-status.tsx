"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** بعد هذه المدة بدون تحديث نعتبر البيانات متأخرة */
const STALE_MS = 60_000;

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 15) return "الآن";
  if (s < 60) return `قبل ${s} ث`;
  const m = Math.round(s / 60);
  return m === 1 ? "قبل دقيقة" : `قبل ${m} د`;
}

/**
 * حالة مزامنة البيانات + زر تحديث يدوي:
 * أخضر = محدّث، أصفر = آخر تحديث قديم، أحمر = لا اتصال أو فشل التحديث (يُعاد تلقائياً).
 * - variant="pill": في الهيدر (أيقونة فقط على الجوال)
 * - variant="line": سطر صغير فوق القوائم
 */
export function SyncStatus({ variant = "pill", className }: { variant?: "pill" | "line"; className?: string }) {
  const { sync, syncNow, online, user } = useStore();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => setNow(Date.now()), [sync.at]);
  if (!user) return null;

  const age = sync.at ? now - sync.at : Infinity;
  const bad = !online || sync.failing;
  const stale = !bad && age > STALE_MS;
  const tone = bad ? "bad" : stale ? "warn" : "ok";
  const text = !online
    ? "غير متصل"
    : sync.failing
      ? "تعذّر التحديث · إعادة المحاولة"
      : sync.at
        ? `محدّث ${ago(age)}`
        : "جارٍ التحميل";
  const title = `${text}${sync.live ? "" : " · التحديث اللحظي يعيد الاتصال"} — اضغط للتحديث الآن`;
  const Icon = bad ? WifiOff : sync.busy ? RefreshCw : Wifi;

  if (variant === "line") {
    return (
      <button
        type="button"
        onClick={() => void syncNow()}
        disabled={sync.busy}
        title={title}
        aria-label={`تحديث القائمة — ${text}`}
        className={cn(
          "focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition hover:bg-sunken disabled:cursor-wait",
          tone === "ok" && "text-muted",
          tone === "warn" && "text-warn",
          tone === "bad" && "text-bad",
          className,
        )}
      >
        <span className={cn("size-2 shrink-0 rounded-full", tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : "bg-bad", sync.busy && "animate-pulse")} />
        <span className="num">{sync.busy ? "جارٍ التحديث…" : text}</span>
        <RefreshCw className={cn("size-3.5 shrink-0", sync.busy && "animate-spin")} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      disabled={sync.busy}
      title={title}
      aria-label={`حالة الاتصال: ${text}. اضغط للتحديث`}
      className={cn(
        "focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition disabled:cursor-wait",
        tone === "ok" && "bg-ok-soft text-ok hover:bg-ok/15",
        tone === "warn" && "bg-warn-soft text-warn hover:bg-warn/15",
        tone === "bad" && "bg-bad-soft text-bad hover:bg-bad/15",
        className,
      )}
    >
      <Icon className={cn("size-3.5", sync.busy && "animate-spin")} />
      <span className="num hidden sm:inline">{sync.busy ? "جارٍ التحديث…" : text}</span>
    </button>
  );
}
