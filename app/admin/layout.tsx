"use client";

import { AppGate } from "@/components/shell/app-gate";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppGate area="admin">
      <AdminShell>{children}</AdminShell>
    </AppGate>
  );
}
