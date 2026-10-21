"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, LogOut, Wifi, WifiOff } from "lucide-react";
import { isStandalone, requestInstall } from "@/components/pwa/install";
import { useStore } from "@/lib/store";
import { centerName, projectName } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { CENTER_STYLE } from "./center-theme";

/** هيدر شاشة الموظف */
export function StaffHeader() {
  const { center, user, online, logout, db } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!center || !user) return null;
  const st = CENTER_STYLE[center];
  const roleLabel =
    user.role === "POINT" ? `نقطة ${user.projects.map((p) => projectName(db, p)).join(" + ")}` : "استقبال";

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur" ref={ref}>
      <div className={cn("h-1.5 w-full", st.strip)} />
      <div className="mx-auto flex h-16 max-w-3xl items-center gap-2.5 px-4">
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            online ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad",
          )}
          role="status"
        >
          {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          <span className="hidden sm:inline">{online ? "متصل" : "غير متصل"}</span>
        </span>
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("size-2.5 shrink-0 rounded-full", st.dot)} />
          <span className={cn("shrink-0 font-bold", st.text)}>{centerName(db, center, true)}</span>
          <span className="truncate rounded-lg border border-line px-2 py-0.5 text-sm font-bold">{roleLabel}</span>
        </div>
        <div className="relative ms-auto">
          <button
            onClick={() => setOpen((o) => !o)}
            className="focus-ring flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-sunken"
            aria-expanded={open}
          >
            <span className="grid size-8 place-items-center rounded-full bg-sunken text-sm font-bold text-muted">
              {user.fullName.trim()[0]}
            </span>
            <span className="hidden text-sm font-semibold sm:block">{user.fullName}</span>
            <ChevronDown className="size-4 text-muted" />
          </button>
          {open && (
            <div className="absolute end-0 top-full z-50 mt-2 w-56 animate-fade-up rounded-xl border border-line bg-surface p-1.5 shadow-pop">
              <div className="px-3 py-2 text-xs text-muted">
                {user.fullName}
                <div className="ltr text-start">{user.username}</div>
              </div>
              {!isStandalone() && (
                <button
                  onClick={() => {
                    setOpen(false);
                    requestInstall();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-sunken"
                >
                  <Download className="size-4 text-muted" />
                  تثبيت التطبيق
                </button>
              )}
              <button
                onClick={() => {
                  logout();
                  router.replace("/login");
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-bad hover:bg-bad-soft"
              >
                <LogOut className="size-4" />
                تسجيل الخروج
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="border-b border-line" />
    </header>
  );
}
