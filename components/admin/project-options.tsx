"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Settings2, Stethoscope } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Label } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { CheckBox } from "@/components/ui/check";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import type { CenterCode, Project } from "@/lib/types";
import { cn } from "@/lib/utils";

/** شارات خيارات المشروع + زر فتح الإعداد */
export function ProjectOptionsButton({ project, onOpen, disabled }: { project: Project; onOpen: () => void; disabled?: boolean }) {
  const { db } = useStore();
  const defer = project.deferCenters ?? [];
  const short = (c: CenterCode) => db.centers.find((x) => x.code === c)?.short ?? c;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      aria-label={`خيارات ${project.name}`}
      className="focus-ring inline-flex min-h-10 flex-wrap items-center gap-1 rounded-lg border border-dashed border-line px-2.5 py-1 text-xs font-bold text-muted hover:border-brand hover:text-brand"
    >
      {project.isDoctor && (
        <span className="inline-flex items-center gap-1 rounded bg-info-soft px-1.5 py-0.5 text-info">
          <Stethoscope className="size-3" />
          طبيب
        </span>
      )}
      {defer.length > 0 && (
        <span className="inline-flex items-center gap-1 rounded bg-warn-soft px-1.5 py-0.5 text-warn">
          <CalendarClock className="size-3" />
          بدون بت: {defer.map(short).join("، ")}
        </span>
      )}
      {!project.isDoctor && !defer.length && (
        <span className="inline-flex items-center gap-1">
          <Settings2 className="size-3.5" />
          خيارات
        </span>
      )}
    </button>
  );
}

/** إعداد خيارات المشروع: مشروع طبيب، والخدمة بدون تطبيق الممول + موعد */
export function ProjectOptionsDialog({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const { db, saveProjectOptions } = useStore();
  const toast = useToast();
  const [isDoctor, setIsDoctor] = useState(false);
  const [centers, setCenters] = useState<CenterCode[]>([]);
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!project) return;
    setIsDoctor(Boolean(project.isDoctor));
    setCenters(project.deferCenters ?? []);
    setDays(project.deferDays ?? 14);
    setErr("");
  }, [project]);

  if (!project) return null;

  async function save() {
    if (!project || busy) return;
    if (!(days >= 1 && days <= 90)) return setErr("مدة الموعد من 1 إلى 90 يوماً");
    setBusy(true);
    const e = await saveProjectOptions(project.code, { isDoctor, deferCenters: centers, deferDays: days });
    setBusy(false);
    if (e) return setErr(e);
    toast(`تم حفظ خيارات ${project.name}`);
    onClose();
  }

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={`خيارات ${project.name}`}
      description={project.code}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button size="lg" onClick={save} loading={busy} loadingText="جارٍ الحفظ…">
            حفظ الخيارات
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-line p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", isDoctor ? "bg-info-soft text-info" : "bg-sunken text-muted")}>
              <Stethoscope className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">مشروع طبيب</span>
              <span className="block text-xs leading-relaxed text-muted">
                أي نقطة مشروع تستطيع تحويل الحالة إليه برقم دور (تحويل إضافي)، ويخدم أي حالة حتى لو استفادت من مشاريع أخرى، ولا يُحسب في تقرير التكرار.
              </span>
            </span>
            <Switch checked={isDoctor} onChange={setIsDoctor} label="مشروع طبيب" />
          </label>
        </section>

        <section className="space-y-3 rounded-2xl border border-line p-4">
          <div className="flex items-start gap-3">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", centers.length ? "bg-warn-soft text-warn" : "bg-sunken text-muted")}>
              <CalendarClock className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">خدمة بدون تطبيق الممول (بت) + موعد</span>
              <span className="block text-xs leading-relaxed text-muted">
                يظهر لموظف النقطة زر لتسجيل الحالة مخدومة إذا لم يقبلها تطبيق الممول، ويُحجز لها موعد للعودة. تظهر للاستقبال مخدومة مع إشارة &quot;بدون بت&quot;.
              </span>
            </span>
          </div>
          <div>
            <Label>مفعّل في</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {db.centers.map((c) => (
                <CheckBox
                  key={c.code}
                  checked={centers.includes(c.code)}
                  onChange={(v) => setCenters((l) => (v ? [...l, c.code] : l.filter((x) => x !== c.code)))}
                >
                  {c.name}
                </CheckBox>
              ))}
            </div>
          </div>
          {centers.length > 0 && (
            <div>
              <Label htmlFor="po-days">مدة الموعد الافتراضية (يوم)</Label>
              <input
                id="po-days"
                type="number"
                dir="ltr"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="num h-11 w-32 rounded-xl border border-line bg-surface px-3 text-start font-bold"
              />
              <FieldHint>يستطيع الموظف تغيير الموعد لكل حالة. يوم الجمعة يُنقل للسبت تلقائياً.</FieldHint>
            </div>
          )}
        </section>
        <FieldError>{err}</FieldError>
      </div>
    </Dialog>
  );
}
