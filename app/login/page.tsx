"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Eye, EyeOff, LogIn, TimerOff } from "lucide-react";
import { isStandalone, requestInstall } from "@/components/pwa/install";
import { AuthLayout } from "@/components/shell/auth-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { useStore } from "@/lib/store";
import { homePath } from "@/lib/roles";
import { centerName } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { CENTER_STYLE } from "@/components/shell/center-theme";

/** الشاشة 2 — تسجيل الدخول */
function LoginInner() {
  const { ready, center, user, login, db } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (user) router.replace(homePath(user.role));
    else if (!center) router.replace("/setup");
  }, [ready, center, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!username || !password) return setError("أدخل اسم المستخدم وكلمة المرور");
    setBusy(true);
    const r = await login(username, password);
    setBusy(false);
    if (r.error) return setError(r.error);
    router.replace(homePath(r.user!.role));
  }

  if (!ready || !center) return <div className="min-h-dvh" />;
  const st = CENTER_STYLE[center];

  return (
    <AuthLayout>
      {params.get("idle") && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm font-semibold text-warn">
          <TimerOff className="size-5 shrink-0" />
          تم تسجيل خروجك تلقائياً بسبب عدم النشاط
        </div>
      )}
      <Card className="overflow-hidden">
        <div className={cn("h-1.5", st.strip)} />
        <form onSubmit={submit} className="p-6 sm:p-8" noValidate>
          <div className="mb-6 flex items-center justify-between gap-3">
            <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold", st.soft, st.text)}>
              <span className={cn("size-2 rounded-full", st.dot)} />
              {centerName(db, center)}
            </span>
            <Link href="/setup" className="text-sm font-semibold text-brand hover:underline">
              تغيير المركز
            </Link>
          </div>
          <h1 className="text-2xl font-bold">تسجيل الدخول</h1>
          <p className="mt-1 text-sm text-muted">الحسابات تُنشأ من إدارة الموقع</p>

          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="u">اسم المستخدم</Label>
              <Input
                id="u"
                autoFocus
                autoComplete="username"
                autoCapitalize="none"
                dir="ltr"
                className="text-start"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
              />
            </div>
            <div>
              <Label htmlFor="p">كلمة المرور</Label>
              <div className="relative">
                <Input
                  id="p"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  dir="ltr"
                  className="pl-12 text-start"
                  value={password}
                  invalid={Boolean(error)}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="focus-ring absolute end-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-sunken"
                  aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <FieldError>{error}</FieldError>
            </div>
          </div>

          <Button type="submit" size="lg" block className="mt-6" disabled={busy}>
            <LogIn className="size-5" />
            {busy ? "جارٍ الدخول…" : "دخول"}
          </Button>
          {!isStandalone() && (
            <button
              type="button"
              onClick={requestInstall}
              className="focus-ring mx-auto mt-4 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-soft"
            >
              <Download className="size-4" />
              تثبيت التطبيق على هذا الجهاز
            </button>
          )}
        </form>
      </Card>

    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <LoginInner />
    </Suspense>
  );
}
