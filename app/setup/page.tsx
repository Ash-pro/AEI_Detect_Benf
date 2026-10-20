"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Lock, MonitorSmartphone } from "lucide-react";
import { AuthLayout } from "@/components/shell/auth-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { CENTERS } from "@/lib/mock-data";
import { useSession } from "@/lib/session";
import type { CenterCode } from "@/lib/types";
import { cn, normalizeDigits } from "@/lib/utils";
import { CENTER_STYLE } from "@/components/shell/center-theme";

/** الشاشة 1 — اختيار مركز الجهاز (مرة واحدة، بواسطة الأدمن) */
export default function SetupPage() {
  const { setCenter } = useSession();
  const router = useRouter();
  const [picked, setPicked] = useState<CenterCode | null>(null);
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");

  const center = CENTERS.find((c) => c.code === picked);

  function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length < 4) return setError("أدخل رمز الأدمن المكوّن من 4 أرقام على الأقل");
    setCenter(picked);
    router.replace("/login");
  }

  return (
    <AuthLayout footer="يتم هذا الإعداد مرة واحدة لكل جهاز. تغييره لاحقاً من صلاحية الأدمن فقط.">
      {step === "pick" ? (
        <Card className="p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-sunken text-muted">
              <MonitorSmartphone className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">اختر مركز هذا الجهاز</h1>
              <p className="text-sm text-muted">كل الزيارات والخدمات من هذا الجهاز ستُسجّل باسم المركز المختار</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
            {CENTERS.map((c) => {
              const st = CENTER_STYLE[c.code];
              const on = picked === c.code;
              return (
                <button
                  key={c.code}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPicked(c.code)}
                  className={cn(
                    "focus-ring relative flex flex-col items-start gap-6 overflow-hidden rounded-2xl border-2 p-5 text-start transition",
                    on ? (c.code === "GAZA" ? "border-gaza bg-gaza/5" : "border-khy bg-khy/5") : "border-line hover:border-muted/40",
                  )}
                >
                  <span className={cn("absolute inset-x-0 top-0 h-1.5", st.strip)} />
                  <span className={cn("grid size-12 place-items-center rounded-xl", st.soft, st.text)}>
                    <Building2 className="size-6" />
                  </span>
                  <span>
                    <span className="block text-lg font-bold">{c.name}</span>
                    <span className="text-sm text-muted">{c.code}</span>
                  </span>
                  <span
                    className={cn(
                      "absolute end-5 top-6 size-5 rounded-full border-2",
                      on ? cn("border-[6px]", c.code === "GAZA" ? "border-gaza" : "border-khy") : "border-line",
                    )}
                  />
                </button>
              );
            })}
          </div>

          <Button size="lg" block className="mt-6" disabled={!picked} onClick={() => setStep("confirm")}>
            متابعة
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className={cn("h-1.5", center && CENTER_STYLE[center.code].strip)} />
          <form onSubmit={confirm} className="p-6 sm:p-8">
            <button
              type="button"
              onClick={() => setStep("pick")}
              className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
            >
              <ArrowRight className="size-4" />
              تغيير الاختيار
            </button>
            <h1 className="text-xl font-bold leading-relaxed">
              سيتم تثبيت هذا الجهاز على{" "}
              <span className={cn(center && CENTER_STYLE[center.code].text)}>{center?.name}</span>
            </h1>
            <p className="mt-2 text-sm text-muted">لا يمكن للموظفين تغيير المركز. التغيير يحتاج الأدمن مع إعادة تسجيل الدخول.</p>

            <div className="mt-6 space-y-4">
              <div>
                <Label htmlFor="label">اسم الجهاز</Label>
                <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="مثال: استقبال 2 — الطابق الأرضي" />
              </div>
              <div>
                <Label htmlFor="pin" required>
                  رمز الأدمن
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    className="ps-10 num text-start tracking-[0.4em]"
                    value={pin}
                    invalid={Boolean(error)}
                    onChange={(e) => {
                      setPin(normalizeDigits(e.target.value).slice(0, 8));
                      setError("");
                    }}
                    autoFocus
                  />
                </div>
                <FieldError>{error}</FieldError>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="secondary" size="lg" onClick={() => setStep("pick")}>
                إلغاء
              </Button>
              <Button type="submit" size="lg" className="flex-1">
                تثبيت الجهاز على {center?.short}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </AuthLayout>
  );
}
