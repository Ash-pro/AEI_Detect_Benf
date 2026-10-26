"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Eye, EyeOff, LogIn, TimerOff } from "lucide-react";
import { isStandalone, requestInstall } from "@/components/pwa/install";
import { AuthLayout } from "@/components/shell/auth-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { useStore } from "@/lib/store";
import { useSiteMode } from "@/lib/site-mode";
import { homePath } from "@/lib/roles";
import { centerName } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { CENTER_STYLE } from "@/components/shell/center-theme";
import { PageLoader } from "@/components/ui/page-loader";

/** الشاشة 2 — تسجيل الدخول */
function LoginInner() {
  const { ready, center, user, login, db } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ u?: string; p?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const uRef = useRef<HTMLInputElement>(null);
  const pRef = useRef<HTMLInputElement>(null);
  const { mode } = useSiteMode();

  useEffect(() => {
    if (!ready) return;
    if (user) router.replace(homePath(user.role));
    else if (!center) router.replace("/setup");
  }, [ready, center, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next = {
      u: username.trim() ? undefined : "أدخل اسم المستخدم",
      p: password ? undefined : "أدخل كلمة المرور",
    };
    if (next.u || next.p) {
      setErrors(next);
      (next.u ? uRef : pRef).current?.focus();
      return;
    }
    setBusy(true);
    const r = await login(username.trim(), password);
    setBusy(false);
    if (r.error) {
      // خطأ في بيانات الدخول: لا نعرف أيهما الخاطئ، فنميّز الخانتين ونركّز على كلمة المرور
      const cred = /غير صحيحة|incorrect|invalid/i.test(r.error);
      setErrors(cred ? { u: " ", p: " ", form: r.error } : { form: r.error });
      if (cred) pRef.current?.select();
      return;
    }
    router.replace(homePath(r.user!.role));
  }

  if (!ready || !center) return <PageLoader />;
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
            <Link href="/setup" className="focus-ring -me-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-brand hover:bg-brand-soft">
              تغيير المركز
            </Link>
          </div>
          <h1 className="text-2xl font-bold">تسجيل الدخول</h1>
          <p className="mt-1 text-sm text-muted">الحسابات تُنشأ من إدارة الموقع</p>

          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="u">اسم المستخدم</Label>
              <Input
                ref={uRef}
                id="u"
                autoFocus
                invalid={Boolean(errors.u)}
                aria-invalid={Boolean(errors.u)}
                aria-describedby={errors.u?.trim() ? "u-err" : undefined}
                autoComplete="username"
                autoCapitalize="none"
                dir="ltr"
                className="text-start"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrors((x) => ({ ...x, u: undefined, form: undefined }));
                }}
              />
              {errors.u?.trim() && <FieldError id="u-err">{errors.u}</FieldError>}
            </div>
            <div>
              <Label htmlFor="p">كلمة المرور</Label>
              <div className="relative">
                <Input
                  ref={pRef}
                  id="p"
                  aria-invalid={Boolean(errors.p)}
                  aria-describedby={errors.p?.trim() ? "p-err" : undefined}
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  dir="ltr"
                  className="pl-12 text-start"
                  value={password}
                  invalid={Boolean(errors.p)}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((x) => ({ ...x, p: undefined, form: undefined }));
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
              {errors.p?.trim() && <FieldError id="p-err">{errors.p}</FieldError>}
            </div>
            {errors.form && (
              <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">
                {errors.form}
              </p>
            )}
          </div>

          <Button type="submit" size="lg" block className="mt-6" loading={busy} loadingText="جارٍ الدخول…">
            <LogIn className="size-5" />
            دخول
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

      {mode === "demo" && (
        <div className="mt-5 rounded-2xl border border-dashed border-warn/50 bg-warn-soft/40 p-4">
          <div className="mb-3 text-xs font-bold text-warn">حسابات العرض التجريبي — كلمة المرور 1234</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["admin", "أدمن"],
              ["supervisor", "مشرف"],
              ["reception.khy", "استقبال خانيونس"],
              ["reception.gaza", "استقبال غزة"],
              ["multi.khy", "نقطة WFP + السيلياك · خانيونس"],
              ["unicef.khy", "نقطة UNICEF · خانيونس"],
            ].map(([u, label]) => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  setUsername(u);
                  setPassword("1234");
                  setErrors({});
                }}
                className="focus-ring rounded-xl bg-surface px-3 py-2 text-start text-sm shadow-card hover:bg-sunken"
              >
                <span className="ltr block font-semibold">{u}</span>
                <span className="block text-xs text-muted">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginInner />
    </Suspense>
  );
}
