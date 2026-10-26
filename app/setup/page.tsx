"use client";

import { useRouter } from "next/navigation";
import { Building2, ChevronLeft } from "lucide-react";
import { AuthLayout } from "@/components/shell/auth-layout";
import { Card } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CENTER_STYLE } from "@/components/shell/center-theme";
import { PageLoader } from "@/components/ui/page-loader";

/** الشاشة 1 — اختيار المركز */
export default function SetupPage() {
  const { db, center, setCenter, ready } = useStore();
  const router = useRouter();
  if (!ready) return <PageLoader />;

  return (
    <AuthLayout footer="يُحفظ المركز على هذا الجهاز. يمكن تغييره من شاشة الدخول.">
      <Card className="p-6 sm:p-8">
        <h1 className="text-xl font-bold">اختر المركز</h1>
        <p className="mt-1 text-sm text-muted">كل الإدخالات من هذا الجهاز ستُسجّل باسم المركز المختار</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {db.centers.map((c) => {
            const st = CENTER_STYLE[c.code];
            return (
              <button
                key={c.code}
                onClick={() => {
                  setCenter(c.code);
                  router.replace("/login");
                }}
                className={cn(
                  "focus-ring group relative flex items-center gap-4 overflow-hidden rounded-2xl border-2 p-5 text-start transition hover:shadow-card",
                  center === c.code ? (c.code === "GAZA" ? "border-gaza" : "border-khy") : "border-line",
                )}
              >
                <span className={cn("absolute inset-y-0 start-0 w-1.5", st.strip)} />
                <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl", st.soft, st.text)}>
                  <Building2 className="size-6" />
                </span>
                <span className="flex-1 text-lg font-bold">{c.name}</span>
                <ChevronLeft className="size-5 text-muted transition group-hover:-translate-x-1" />
              </button>
            );
          })}
        </div>
      </Card>
    </AuthLayout>
  );
}
