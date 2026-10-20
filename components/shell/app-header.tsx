"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileSpreadsheet, History, KeyRound, LogOut, ScanLine, Wifi, WifiOff } from "lucide-react";
import { useSession } from "@/lib/session";
import { CENTERS, PROJECTS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { FEATURES } from "@/lib/features";
import { CENTER_STYLE } from "./center-theme";

export function AppHeader() {
  const { center, user, project, online, setProject, logout } = useSession();
  const router = useRouter();
  const path = usePathname();
  const [menu, setMenu] = useState<null | "user" | "project">(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!center || !user) return null;
  const c = CENTERS.find((x) => x.code === center)!;
  const st = CENTER_STYLE[center];
  const isProject = user.role === "PROJECT";
  const multi = isProject && user.projects.length > 1;
  const proj = PROJECTS.find((p) => p.code === project);

  const tabs =
    isProject && FEATURES.excelUpload
      ? [
          { href: "/verify", label: "التحقق", icon: ScanLine },
          { href: "/uploads", label: "رفع Excel", icon: FileSpreadsheet },
          { href: "/uploads/history", label: "سجل الرفعات", icon: History },
        ]
      : [];

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur" ref={ref}>
      <div className={cn("h-1.5 w-full", st.strip)} />
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            online ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad",
          )}
          role="status"
        >
          {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          {online ? "متصل" : "غير متصل"}
        </span>

        <div className="flex min-w-0 items-center gap-2 text-[15px]">
          <span className={cn("size-2.5 shrink-0 rounded-full", st.dot)} />
          <span className={cn("truncate font-bold", st.text)}>
            <span className="sm:hidden">{c.short}</span>
            <span className="hidden sm:inline">{c.name}</span>
          </span>
        </div>

        {isProject && (
          <div className="relative">
            <button
              disabled={!multi}
              onClick={() => setMenu(menu === "project" ? null : "project")}
              className={cn(
                "focus-ring inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-sm font-bold",
                multi ? "hover:bg-sunken" : "cursor-default",
              )}
            >
              {proj?.name ?? "—"}
              {multi && <ChevronDown className="size-4 text-muted" />}
            </button>
            {menu === "project" && (
              <div className="absolute start-0 top-full z-50 mt-2 w-52 animate-fade-up rounded-xl border border-line bg-surface p-1.5 shadow-pop">
                {user.projects.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setProject(p);
                      setMenu(null);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-start text-sm font-semibold hover:bg-sunken",
                      p === project && "bg-brand-soft text-brand",
                    )}
                  >
                    {PROJECTS.find((x) => x.code === p)?.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <nav className="ms-4 hidden items-center gap-1 md:flex">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition",
                path === t.href ? "bg-sunken text-ink" : "text-muted hover:text-ink",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="relative ms-auto">
          <button
            onClick={() => setMenu(menu === "user" ? null : "user")}
            className="focus-ring flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-sunken"
          >
            <span className="grid size-8 place-items-center rounded-full bg-sunken text-sm font-bold text-muted">
              {user.fullName.trim()[0]}
            </span>
            <span className="hidden text-start leading-tight sm:block">
              <span className="block text-sm font-semibold">{user.fullName}</span>
              <span className="block text-xs text-muted">{isProject ? "موظف مشروع" : "موظف استقبال"}</span>
            </span>
            <ChevronDown className="size-4 text-muted" />
          </button>
          {menu === "user" && (
            <div className="absolute end-0 top-full z-50 mt-2 w-56 animate-fade-up rounded-xl border border-line bg-surface p-1.5 shadow-pop">
              <Link href="/account" onClick={() => setMenu(null)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-sunken">
                <KeyRound className="size-4 text-muted" />
                الحساب وكلمة المرور
              </Link>
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

      {tabs.length > 0 && (
        <nav className="flex border-t border-line md:hidden">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold",
                path === t.href ? "border-b-2 border-brand text-brand" : "text-muted",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </Link>
          ))}
        </nav>
      )}
      <div className="border-b border-line" />
    </header>
  );
}
