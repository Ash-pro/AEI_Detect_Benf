"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CopyCheck, Download, CalendarDays, FolderKanban, LayoutDashboard, LineChart, LogOut, Menu, Search, Settings, Users, X } from "lucide-react";
import { BrandMark } from "@/components/shell/brand-mark";
import { SyncStatus } from "@/components/shell/sync-status";
import { isStandalone, requestInstall } from "@/components/pwa/install";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { pathAllowed } from "@/lib/permissions";

type Group = "daily" | "analysis" | "manage";
const GROUPS: { id: Group; label: string }[] = [
  { id: "daily", label: "المتابعة اليومية" },
  { id: "analysis", label: "التحليل" },
  { id: "manage", label: "الإدارة" },
];
const NAV: { href: string; label: string; short: string; icon: typeof LayoutDashboard; group: Group; supervisor?: boolean; main?: boolean }[] = [
  { href: "/admin", label: "الرئيسية", short: "الرئيسية", icon: LayoutDashboard, group: "daily", main: true },
  { href: "/admin/days", label: "سجل الأيام", short: "الأيام", icon: CalendarDays, group: "daily", supervisor: true, main: true },
  { href: "/admin/beneficiaries", label: "المستفيدون", short: "المستفيدون", icon: Search, group: "daily", main: true },
  { href: "/admin/reports", label: "التقارير", short: "التقارير", icon: LineChart, group: "analysis" },
  { href: "/admin/overlap", label: "تقرير التكرار", short: "التكرار", icon: CopyCheck, group: "analysis" },
  { href: "/admin/users", label: "المستخدمون", short: "المستخدمون", icon: Users, group: "manage", supervisor: true, main: true },
  { href: "/admin/projects", label: "المشاريع والمراكز", short: "المشاريع", icon: FolderKanban, group: "manage", supervisor: true },
  { href: "/admin/settings", label: "الإعدادات", short: "الإعدادات", icon: Settings, group: "manage" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, logout } = useStore();
  // المشرف: الصفحات حسب صلاحياته فقط
  const nav = NAV.filter((n) => pathAllowed(user, n.href));
  const [more, setMore] = useState(false);
  // الجوال: شريط سفلي بأهم الصفحات، والباقي في "المزيد"
  const primary = nav.length <= 4 ? nav : nav.filter((n) => n.main).slice(0, 4);
  const secondary = nav.filter((n) => !primary.includes(n));
  const current = nav.find((n) => (n.href === "/admin" ? path === "/admin" : path.startsWith(n.href)) || (n.href === "/admin/days" && path.startsWith("/admin/day")));
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href)) || (href === "/admin/days" && path.startsWith("/admin/day"));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden border-e border-line bg-surface lg:flex lg:flex-col">
        <div className="sticky top-0 flex h-dvh flex-col">
          <div className="px-5 py-5">
            <BrandMark />
          </div>
          <nav className="flex-1 space-y-5 overflow-y-auto px-3 pt-1" aria-label="لوحة التحكم">
            {GROUPS.map((g) => {
              const items = nav.filter((n) => n.group === g.id);
              if (!items.length) return null;
              return (
                <div key={g.id}>
                  <div className="mb-1 px-3 text-xs font-bold tracking-wide text-muted/80">{g.label}</div>
                  <div className="space-y-0.5">
                    {items.map((n) => {
                      const on = isActive(n.href);
                      return (
                        <Link
                          key={n.href}
                          href={n.href}
                          aria-current={on ? "page" : undefined}
                          className={cn(
                            "focus-ring relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition",
                            on ? "bg-brand-soft text-brand" : "text-muted hover:bg-sunken hover:text-ink",
                          )}
                        >
                          {on && <span className="absolute inset-y-2 start-0 w-1 rounded-full bg-brand" aria-hidden />}
                          <n.icon className="size-5" />
                          {n.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
          {!isStandalone() && (
            <div className="px-3 pb-2">
              <button
                onClick={requestInstall}
                className="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold text-muted hover:bg-sunken hover:text-ink"
              >
                <Download className="size-5" />
                تثبيت التطبيق
              </button>
            </div>
          )}
          <div className="border-t border-line p-3">
            <SyncStatus variant="line" className="mb-1 w-full justify-start" />
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <span className="grid size-9 place-items-center rounded-full bg-sunken font-bold text-muted">{user?.fullName.trim()[0]}</span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-bold">{user?.fullName}</div>
                <div className="text-xs text-muted">{user?.role === "SUPERVISOR" ? "مشرف" : "أدمن"} · <span className="ltr inline-block">{user?.username}</span></div>
              </div>
              <button
                onClick={() => {
                  logout();
                  router.replace("/login");
                }}
                className="focus-ring grid size-9 place-items-center rounded-lg text-bad hover:bg-bad-soft"
                aria-label="تسجيل الخروج"
                title="تسجيل الخروج"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <BrandMark />
            <span className="flex min-w-0 items-center gap-2">
              {current && <span className="truncate text-sm font-bold text-muted">{current.label}</span>}
              <SyncStatus />
            </span>
          </div>
        </header>

        {/* شريط التنقل السفلي على الجوال */}
        <nav
          aria-label="لوحة التحكم"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          <div className="mx-auto flex max-w-xl">
            {primary.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-bold transition",
                  isActive(n.href) ? "text-brand" : "text-muted",
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full", isActive(n.href) && "bg-brand-soft")}>
                  <n.icon className="size-5" />
                </span>
                {n.short}
              </Link>
            ))}
            <button
              onClick={() => setMore(true)}
              aria-expanded={more}
              className={cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-bold",
                secondary.some((n) => isActive(n.href)) ? "text-brand" : "text-muted",
              )}
            >
              <span className={cn("grid h-7 w-12 place-items-center rounded-full", secondary.some((n) => isActive(n.href)) && "bg-brand-soft")}>
                <Menu className="size-5" />
              </span>
              المزيد
            </button>
          </div>
        </nav>

        {more && (
          <div className="fixed inset-0 z-50 flex items-end bg-ink/40 animate-fade-in lg:hidden" onClick={() => setMore(false)}>
            <div
              className="w-full animate-fade-up rounded-t-3xl bg-surface p-3 pb-[max(16px,env(safe-area-inset-bottom))] shadow-pop"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center gap-3 rounded-2xl bg-sunken px-3 py-2.5">
                <span className="grid size-10 place-items-center rounded-full bg-surface font-bold text-muted">{user?.fullName.trim()[0]}</span>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate font-bold">{user?.fullName}</div>
                  <div className="ltr text-start text-xs text-muted">{user?.username}</div>
                </div>
                <button onClick={() => setMore(false)} aria-label="إغلاق" className="focus-ring grid size-10 place-items-center rounded-xl text-muted hover:bg-surface">
                  <X className="size-5" />
                </button>
              </div>
              {secondary.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setMore(false)}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold",
                    isActive(n.href) ? "bg-brand-soft text-brand" : "hover:bg-sunken",
                  )}
                >
                  <n.icon className="size-5 text-muted" />
                  {n.label}
                </Link>
              ))}
              {!isStandalone() && (
                <button
                  onClick={() => {
                    setMore(false);
                    requestInstall();
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-semibold hover:bg-sunken"
                >
                  <Download className="size-5 text-muted" />
                  تثبيت التطبيق
                </button>
              )}
              <button
                onClick={() => {
                  setMore(false);
                  logout();
                  router.replace("/login");
                }}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-bad hover:bg-bad-soft"
              >
                <LogOut className="size-5" />
                تسجيل الخروج
              </button>
            </div>
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-20 lg:pt-8">{children}</main>
      </div>
    </div>
  );
}
