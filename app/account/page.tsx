"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, LogOut, MonitorSmartphone, UserRound } from "lucide-react";
import { AppGate } from "@/components/shell/app-gate";
import { Card, SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { useSession } from "@/lib/session";
import { CENTERS, PROJECTS } from "@/lib/mock-data";

/** الشاشة 23 — الحساب وكلمة المرور */
function AccountScreen() {
  const { user, center, logout } = useSession();
  const router = useRouter();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const u = user!;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    if (!cur) return setError("أدخل كلمة المرور الحالية");
    if (next.length < 8) return setError("كلمة المرور الجديدة 8 أحرف على الأقل");
    if (next !== again) return setError("كلمتا المرور غير متطابقتين");
    setError("");
    setCur("");
    setNext("");
    setAgain("");
    setSaved(true);
  }

  const rows: [string, React.ReactNode][] = [
    ["الاسم", u.fullName],
    ["اسم المستخدم", <span key="u" className="ltr">{u.username}</span>],
    ["الدور", u.role === "PROJECT" ? "موظف مشروع" : "موظف استقبال"],
    [
      "المراكز المسموحة",
      <span key="c" className="flex flex-wrap gap-1.5">
        {u.centers.map((c) => (
          <Badge key={c}>{CENTERS.find((x) => x.code === c)!.name}</Badge>
        ))}
      </span>,
    ],
  ];
  if (u.role === "PROJECT")
    rows.push([
      "المشاريع",
      <span key="p" className="flex flex-wrap gap-1.5">
        {u.projects.map((p) => (
          <Badge key={p} tone="brand">
            {PROJECTS.find((x) => x.code === p)!.name}
          </Badge>
        ))}
      </span>,
    ]);

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 pb-16 pt-6">
      <h1 className="text-2xl font-bold">الحساب</h1>

      <Card className="p-5">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <UserRound className="size-4" />
            البيانات
          </span>
        </SectionTitle>
        <dl className="divide-y divide-line/70">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <dt className="text-sm text-muted">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <FieldHint>تعديل البيانات والصلاحيات من الأدمن.</FieldHint>
      </Card>

      <Card className="p-5">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <MonitorSmartphone className="size-4" />
            هذا الجهاز
          </span>
        </SectionTitle>
        <div className="flex items-center justify-between">
          <span className="font-semibold">{CENTERS.find((c) => c.code === center)!.name}</span>
          <span className="text-sm text-muted">تغيير المركز من صلاحية الأدمن</span>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <KeyRound className="size-4" />
            تغيير كلمة المرور
          </span>
        </SectionTitle>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="cur">كلمة المرور الحالية</Label>
            <Input id="cur" type="password" dir="ltr" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="new">الجديدة</Label>
              <Input id="new" type="password" dir="ltr" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="again">تأكيد الجديدة</Label>
              <Input id="again" type="password" dir="ltr" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
            </div>
          </div>
          <FieldError>{error}</FieldError>
          {saved && (
            <p className="flex items-center gap-2 text-sm font-semibold text-ok">
              <CheckCircle2 className="size-4" />
              تم تغيير كلمة المرور
            </p>
          )}
          <Button type="submit">حفظ كلمة المرور</Button>
        </form>
      </Card>

      <Button
        variant="secondary"
        className="text-bad"
        onClick={() => {
          logout();
          router.replace("/login");
        }}
      >
        <LogOut className="size-4" />
        تسجيل الخروج
      </Button>
    </main>
  );
}

export default function AccountPage() {
  return (
    <AppGate>
      <AccountScreen />
    </AppGate>
  );
}
