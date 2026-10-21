"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppGate } from "@/components/shell/app-gate";
import { AdminShell } from "@/components/admin/admin-shell";
import { useStore } from "@/lib/store";
import { supervisorAllowed } from "@/lib/roles";

function SupervisorGuard({ children }: { children: React.ReactNode }) {
  const { user } = useStore();
  const path = usePathname();
  const router = useRouter();
  const blocked = user?.role === "SUPERVISOR" && !supervisorAllowed(path);
  useEffect(() => {
    if (blocked) router.replace("/admin/days");
  }, [blocked, router]);
  return blocked ? null : <>{children}</>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppGate area="admin">
      <AdminShell>
        <SupervisorGuard>{children}</SupervisorGuard>
      </AdminShell>
    </AppGate>
  );
}
