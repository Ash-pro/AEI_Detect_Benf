"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, FolderKanban } from "lucide-react";
import { AuthLayout } from "@/components/shell/auth-layout";
import { Card } from "@/components/ui/card";
import { PROJECTS } from "@/lib/mock-data";
import { useSession } from "@/lib/session";

/** يظهر فقط لموظف مشروع مرتبط بأكثر من مشروع */
export default function SelectProjectPage() {
  const { ready, center, user, setProject } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!center) router.replace("/setup");
    else if (!user) router.replace("/login");
    else if (user.role !== "PROJECT" || user.projects.length < 2) router.replace("/verify");
  }, [ready, center, user, router]);

  if (!user) return <div className="min-h-dvh" />;

  return (
    <AuthLayout>
      <Card className="p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-sunken text-muted">
            <FolderKanban className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">أهلاً {user.fullName.split(" ")[0]}</h1>
            <p className="text-sm text-muted">اختر المشروع الذي تعمل عليه الآن. يمكنك التبديل لاحقاً من الأعلى.</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {user.projects.map((code) => {
            const p = PROJECTS.find((x) => x.code === code)!;
            return (
              <button
                key={code}
                onClick={() => {
                  setProject(code);
                  router.replace("/verify");
                }}
                className="focus-ring group flex w-full items-center gap-4 rounded-2xl border-2 border-line p-4 text-start transition hover:border-brand hover:bg-brand-soft/40"
              >
                <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-sm font-bold text-brand">
                  {p.code.slice(0, 3)}
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-bold">{p.name}</span>
                  <span className="text-sm text-muted">{p.nameAr}</span>
                </span>
                <ChevronLeft className="size-5 text-muted transition group-hover:-translate-x-1 group-hover:text-brand" />
              </button>
            );
          })}
        </div>
      </Card>
    </AuthLayout>
  );
}
