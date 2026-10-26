"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { AppGate } from "@/components/shell/app-gate";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { firstAllowedPath, pathAllowed } from "@/lib/permissions";

/** المشرف: يرى فقط الصفحات التي أسندها له الأدمن */
function PermissionGuard({ children }: { children: React.ReactNode }) {
  const { user } = useStore();
  const path = usePathname();
  const router = useRouter();
  const allowed = pathAllowed(user, path);
  const fallback = firstAllowedPath(user);

  useEffect(() => {
    if (!allowed && fallback && fallback !== path) router.replace(fallback);
  }, [allowed, fallback, path, router]);

  if (allowed) return <>{children}</>;
  if (fallback) return null;
  return (
    <Card className="mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-warn-soft text-warn">
        <ShieldOff className="size-7" />
      </span>
      <h1 className="text-lg font-bold">لا توجد صلاحيات مسندة لحسابك</h1>
      <p className="text-sm text-muted">تواصل مع أدمن النظام ليحدد الصفحات التي يمكنك الوصول إليها.</p>
    </Card>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppGate area="admin">
      <AdminShell>
        <PermissionGuard>{children}</PermissionGuard>
      </AdminShell>
    </AppGate>
  );
}
