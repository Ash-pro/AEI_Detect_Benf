"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Info, LogIn, TimerOff } from "lucide-react";
import { AuthLayout } from "@/components/shell/auth-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { CENTERS, USERS } from "@/lib/mock-data";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { CENTER_STYLE } from "@/components/shell/center-theme";

/** الشاشة 2 — تسجيل الدخول */
function LoginInner() {
  const { ready, center, user, login } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ready) return;
    if (!center) router.replace("/setup");
    else if (user) router.replace("/");
  }, [ready, center, user, router]);

  const c = CENTERS.find((x) => x.code === center);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return setError("أدخل اسم المستخدم وكلمة المرور");
    setBusy(true);
    setTimeout(() => {
      const u = login(username, password);
      setBusy(false);
      if (!u) return setError("اسم المستخدم أو كلمة المرور غير صحيحة");
      if (center && !u.centers.includes(center)) return setError(`حسابك غير مسموح له بالعمل في ${c?.name}`);
      router.replace(u.role === "PROJECT" && u.projects.length > 1 ? "/select-project" : "/verify");
    }, 350);
  }

  if (!ready || !c) return <div className="min-h-dvh" />;
  const st = CENTER_STYLE[c.code];

  return (
    <AuthLayout>
      {params.get("idle") && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm font-semibold text-warn">
          <TimerOff className="size-5 shrink-0" />
          تم تسجيل خروجك تلقائياً بعد 30 دقيقة من عدم النشاط
        </div>
      )}
      <Card className="overflow-hidden">
        <div className={cn("h-1.5", st.strip)} />
        <form onSubmit={submit} className="p-6 sm:p-8" noValidate>
          <div className={cn("mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold", st.soft, st.text)}>
            <span className={cn("size-2 rounded-full", st.dot)} />
            {c.name}
          </div>
          <h1 className="text-2xl font-bold">تسجيل الدخول</h1>
          <p className="mt-1 text-sm text-muted">ادخل بحسابك الشخصي. كل عملية تُسجّل باسمك.</p>

          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="u">اسم المستخدم</Label>
              <Input
                id="u"
                ref={userRef}
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
                  className="pe-12 text-start"
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
        </form>
      </Card>

      <div className="mt-5 rounded-2xl border border-dashed border-line p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted">
          <Info className="size-4" />
          حسابات المعاينة (للتصميم فقط) — كلمة المرور 1234
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {USERS.map((u) => (
            <button
              key={u.username}
              type="button"
              onClick={() => {
                setUsername(u.username);
                setPassword(u.password);
                setError("");
              }}
              className="focus-ring rounded-xl bg-surface px-3 py-2 text-start text-sm shadow-card hover:bg-sunken"
            >
              <span className="block font-semibold">{u.fullName}</span>
              <span className="block text-xs text-muted">
                {u.role === "RECEPTION" ? "استقبال" : `مشروع: ${u.projects.join(" + ")}`}
              </span>
            </button>
          ))}
        </div>
      </div>
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
