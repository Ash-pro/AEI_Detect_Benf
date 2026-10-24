"use client";

import { useState } from "react";
import { Database, Eye, EyeOff, FlaskConical, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldError, Input, Label } from "@/components/ui/field";
import { useSiteMode } from "@/lib/site-mode";
import { cn } from "@/lib/utils";

/** التبديل بين الوضع الحقيقي والعرض التجريبي على مستوى الموقع كله */
export function SiteModeCard() {
  const { mode, enableDemo, disableDemo } = useSiteMode();
  const demo = mode === "demo";
  const [confirm, setConfirm] = useState(false);
  const [login, setLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  async function goDemo() {
    setBusy(true);
    setErr("");
    const e = await enableDemo();
    setBusy(false);
    if (e) setErr(e);
  }

  async function goLive(cred?: { username: string; password: string }) {
    setBusy(true);
    setErr("");
    const r = await disableDemo(cred);
    setBusy(false);
    if (r === "NEED_LOGIN") return setLogin(true);
    if (r) setErr(r);
  }

  return (
    <Card className={cn("overflow-hidden lg:col-span-2", demo && "border-warn/50")}>
      <div className="flex flex-wrap items-center gap-4 p-5">
        <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", demo ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok")}>
          {demo ? <FlaskConical className="size-6" /> : <Database className="size-6" />}
        </span>
        <div className="min-w-[220px] flex-1">
          <h2 className="text-lg font-bold">وضع الموقع</h2>
          <p className="mt-0.5 text-sm text-muted">
            {demo ? (
              <>
                الموقع الآن في <b className="text-warn">العرض التجريبي</b> على كل الأجهزة: بيانات وحسابات تجريبية في المتصفح، ولا شيء يُحفظ في قاعدة البيانات.
              </>
            ) : (
              <>
                الموقع الآن في <b className="text-ok">الوضع الحقيقي</b>: كل الإدخالات تُحفظ في قاعدة البيانات.
              </>
            )}
          </p>
        </div>
        {demo ? (
          <Button size="lg" disabled={busy} onClick={() => goLive()}>
            <Database className="size-5" />
            {busy ? "جارٍ التحويل…" : "الرجوع للوضع الحقيقي"}
          </Button>
        ) : (
          <Button size="lg" variant="secondary" disabled={busy} onClick={() => setConfirm(true)}>
            <FlaskConical className="size-5" />
            تشغيل العرض التجريبي
          </Button>
        )}
      </div>
      {err && !login && !confirm && (
        <div className="border-t border-line px-5 py-3">
          <FieldError>{err}</FieldError>
        </div>
      )}

      {/* تأكيد تشغيل العرض التجريبي */}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="تشغيل العرض التجريبي"
        description="يتحول الموقع كله لبيانات تجريبية"
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={() => setConfirm(false)}>
              إلغاء
            </Button>
            <Button size="lg" disabled={busy} onClick={goDemo}>
              {busy ? "جارٍ التشغيل…" : "تشغيل العرض التجريبي"}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="flex gap-2 rounded-xl bg-warn-soft px-4 py-3 font-semibold text-warn">
            <TriangleAlert className="size-5 shrink-0" />
            كل الموظفين على كل الأجهزة سيدخلون العرض التجريبي، ولن تُحفظ أي إدخالات حقيقية حتى ترجع للوضع الحقيقي.
          </p>
          <ul className="list-disc space-y-1 ps-5 text-muted">
            <li>بياناتك الحقيقية تبقى محفوظة كما هي ولا تتأثر.</li>
            <li>الدخول في العرض التجريبي بحسابات تجريبية، كلمة المرور لكلها <b className="ltr text-ink">1234</b>.</li>
            <li>للرجوع: ادخل بحساب <b className="ltr text-ink">admin</b> التجريبي ← الإعدادات ← "الرجوع للوضع الحقيقي"، ثم أكّد ببيانات أدمن حقيقي.</li>
          </ul>
          <FieldError>{err}</FieldError>
        </div>
      </Dialog>

      {/* تأكيد الرجوع ببيانات أدمن حقيقي */}
      <Dialog
        open={login}
        onClose={() => setLogin(false)}
        title="الرجوع للوضع الحقيقي"
        description="أكّد بحساب أدمن من النظام الحقيقي"
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={() => setLogin(false)}>
              إلغاء
            </Button>
            <Button size="lg" disabled={busy || !username || !password} onClick={() => goLive({ username, password })}>
              {busy ? "جارٍ التحقق…" : "تأكيد والرجوع"}
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (username && password) void goLive({ username, password });
          }}
        >
          <div>
            <Label htmlFor="real-u">اسم المستخدم</Label>
            <Input id="real-u" dir="ltr" className="text-start" autoCapitalize="none" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="real-p">كلمة المرور</Label>
            <div className="relative">
              <Input
                id="real-p"
                dir="ltr"
                type={show ? "text" : "password"}
                className="pl-12 text-start"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="focus-ring absolute end-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-sunken"
                aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <FieldError>{err}</FieldError>
          <button type="submit" hidden />
        </form>
      </Dialog>
    </Card>
  );
}
