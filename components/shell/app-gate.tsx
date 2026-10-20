"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TimerReset } from "lucide-react";
import { useSession } from "@/lib/session";
import { AppHeader } from "./app-header";
import { Button } from "@/components/ui/button";

const IDLE_MINUTES = 30;
const WARN_SECONDS = 60;

/** يحمي الشاشات التشغيلية: مركز الجهاز ← الدخول ← المشروع، مع الخروج التلقائي بعد الخمول */
export function AppGate({
  children,
  role,
  enabled = true,
}: {
  children: React.ReactNode;
  role?: "PROJECT" | "RECEPTION";
  /** false = الشاشة مخفية بمفتاح ميزة، ويُعاد التوجيه للتحقق */
  enabled?: boolean;
}) {
  const { ready, center, user, project, logout } = useSession();
  const router = useRouter();
  const last = useRef(Date.now());
  const [warn, setWarn] = useState<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!center) router.replace("/setup");
    else if (!user) router.replace("/login");
    else if (user.role === "PROJECT" && !project) router.replace("/select-project");
    else if ((role && user.role !== role) || !enabled) router.replace("/verify");
  }, [ready, center, user, project, router, role, enabled]);

  useEffect(() => {
    if (!user) return;
    const bump = () => {
      last.current = Date.now();
      setWarn(null);
    };
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = window.setInterval(() => {
      const left = IDLE_MINUTES * 60 - Math.floor((Date.now() - last.current) / 1000);
      if (left <= 0) {
        logout();
        router.replace("/login?idle=1");
      } else if (left <= WARN_SECONDS) setWarn(left);
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(t);
    };
  }, [user, logout, router]);

  if (!ready || !center || !user || (user.role === "PROJECT" && !project) || (role && user.role !== role) || !enabled) {
    return <div className="min-h-dvh" />;
  }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      {children}
      {warn !== null && (
        <div className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[min(92vw,460px)] animate-fade-up items-center gap-3 rounded-2xl border border-warn/30 bg-surface p-4 shadow-pop">
          <TimerReset className="size-6 shrink-0 text-warn" />
          <p className="flex-1 text-sm font-semibold">
            سيتم تسجيل الخروج تلقائياً خلال <span className="num">{warn}</span> ثانية بسبب عدم النشاط
          </p>
          <Button size="sm" variant="secondary" onClick={() => setWarn(null)}>
            متابعة
          </Button>
        </div>
      )}
    </div>
  );
}
