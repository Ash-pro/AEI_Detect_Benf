"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TimerReset } from "lucide-react";
import { useStore } from "@/lib/store";
import { homePath, isBackOffice, isStaff } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";

const WARN_SECONDS = 60;

/** يحمي الشاشات: المركز ← الدخول ← نوع الحساب، مع الخروج التلقائي بعد الخمول */
export function AppGate({ children, area }: { children: React.ReactNode; area: "staff" | "admin" }) {
  const { ready, center, user, logout, db } = useStore();
  const router = useRouter();
  const last = useRef(Date.now());
  const [warn, setWarn] = useState<number | null>(null);
  const idle = db.settings.idleMinutes || 30;

  const wrongArea = user && ((area === "admin") !== isBackOffice(user.role));

  useEffect(() => {
    if (!ready) return;
    if (!user && !center) router.replace("/setup");
    else if (!user) router.replace("/login");
    else if (wrongArea) router.replace(homePath(user.role, user.permissions));
    else if (isStaff(user.role) && !center) router.replace("/setup");
  }, [ready, center, user, wrongArea, router]);

  useEffect(() => {
    if (!user) return;
    const bump = () => {
      last.current = Date.now();
      setWarn(null);
    };
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = window.setInterval(() => {
      const left = idle * 60 - Math.floor((Date.now() - last.current) / 1000);
      if (left <= 0) {
        logout();
        router.replace("/login?idle=1");
      } else if (left <= WARN_SECONDS) setWarn(left);
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(t);
    };
  }, [user, logout, router, idle]);

  if (!ready || !user || wrongArea || (isStaff(user.role) && !center)) return <PageLoader />;

  return (
    <>
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
    </>
  );
}
