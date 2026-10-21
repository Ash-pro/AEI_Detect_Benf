"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, FolderKanban, LayoutDashboard, LineChart, LogOut, Search, Settings, Users } from "lucide-react";
import { BrandMark } from "@/components/shell/brand-mark";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; supervisor?: boolean }[] = [
  { href: "/admin", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/admin/days", label: "سجل الأيام", icon: CalendarDays, supervisor: true },
  { href: "/admin/reports", label: "التقارير", icon: LineChart },
  { href: "/admin/users", label: "المستخدمون", icon: Users, supervisor: true },
  { href: "/admin/projects", label: "المشاريع والمراكز", icon: FolderKanban, supervisor: true },
  { href: "/admin/beneficiaries", label: "المستفيدون", icon: Search },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, logout } = useStore();
  const nav = user?.role === "SUPERVISOR" ? NAV.filter((n) => n.supervisor) : NAV;
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href)) || (href === "/admin/days" && path.startsWith("/admin/day"));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden border-e border-line bg-surface lg:flex lg:flex-col">
        <div className="sticky top-0 flex h-dvh flex-col">
          <div className="px-5 py-5">
            <BrandMark />
          </div>
          <nav className="flex-1 space-y-0.5 px-3" aria-label="لوحة التحكم">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition",
                  isActive(n.href) ? "bg-brand-soft text-brand" : "text-muted hover:bg-sunken hover:text-ink",
                )}
              >
                <n.icon className="size-5" />
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-line p-3">
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <span className="grid size-9 place-items-center rounded-full bg-sunken font-bold text-muted">{user?.fullName.trim()[0]}</span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-bold">{user?.fullName}</div>
                <div className="ltr text-start text-xs text-muted">{user?.username}</div>
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
          <div className="flex h-14 items-center justify-between px-4">
            <BrandMark />
            <button
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className="focus-ring grid size-9 place-items-center rounded-lg text-bad hover:bg-bad-soft"
              aria-label="تسجيل الخروج"
            >
              <LogOut className="size-4" />
            </button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="لوحة التحكم">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold",
                  isActive(n.href) ? "bg-brand-soft text-brand" : "text-muted",
                )}
              >
                <n.icon className="size-4" />
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
      </div>
    </div>
  );
}
