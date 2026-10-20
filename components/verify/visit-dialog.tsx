"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Info } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { FieldError, Textarea } from "@/components/ui/field";
import type { ReceptionView } from "@/lib/logic";
import type { CenterCode, ProjectCode } from "@/lib/types";
import { CENTERS, NEW_ENROLLMENT_REASONS, PROJECTS } from "@/lib/mock-data";
import { cn, formatTime } from "@/lib/utils";

const pName = (p: ProjectCode) => PROJECTS.find((x) => x.code === p)!.name;

/** تسجيل زيارة وتحويل (S2، S5، S6) */
export function VisitDialog({
  open,
  onClose,
  view,
  center,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  view: ReceptionView;
  center: CenterCode;
  onSave: (projects: ProjectCode[], newProjects: { project: ProjectCode; reason: string }[]) => void;
}) {
  const alreadyToday = useMemo(() => new Set(view.todayVisitHere?.referrals ?? []), [view.todayVisitHere]);
  const hereEnrollments = view.enrollments.filter((e) => e.center === center && e.status !== "CLOSED");
  const enrolledHere = new Set(hereEnrollments.map((e) => e.project));
  const others = PROJECTS.filter((p) => !enrolledHere.has(p.code) && !alreadyToday.has(p.code));

  const [selected, setSelected] = useState<Set<ProjectCode>>(new Set());
  const [extra, setExtra] = useState<Map<ProjectCode, { reason: string; note: string }>>(new Map());
  const [showOthers, setShowOthers] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelected(
      new Set(hereEnrollments.filter((e) => e.status === "ACTIVE" && !alreadyToday.has(e.project)).map((e) => e.project)),
    );
    setExtra(new Map());
    setShowOthers(hereEnrollments.length === 0);
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (p: ProjectCode) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(p) ? n.delete(p) : n.add(p);
      return n;
    });

  const toggleExtra = (p: ProjectCode) =>
    setExtra((m) => {
      const n = new Map(m);
      n.has(p) ? n.delete(p) : n.set(p, { reason: "", note: "" });
      return n;
    });

  const total = selected.size + extra.size;

  function save() {
    if (total === 0) return setError("اختر مشروعاً واحداً على الأقل");
    for (const [p, v] of Array.from(extra.entries())) {
      if (!v.reason) return setError(`اختر سبب التحويل إلى ${pName(p)}`);
      if (v.reason === "أخرى" && !v.note.trim()) return setError(`اكتب ملاحظة لسبب التحويل إلى ${pName(p)}`);
    }
    onSave(
      Array.from(selected),
      Array.from(extra.entries()).map(([project, v]) => ({ project, reason: v.note ? `${v.reason}: ${v.note}` : v.reason })),
    );
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "Enter" && t.tagName !== "TEXTAREA" && t.tagName !== "BUTTON") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const merged = Boolean(view.todayVisitHere);
  const otherCenterToday = view.todayVisitElsewhere;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={merged ? "إضافة تحويل على زيارة اليوم" : "تسجيل زيارة"}
      description={view.beneficiary.name}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>
            إلغاء
          </Button>
          <Button size="lg" className="sm:min-w-[220px]" onClick={save} disabled={total === 0}>
            {merged ? "إضافة التحويل" : "حفظ الزيارة"}
            {total > 0 && <span className="num rounded-md bg-white/20 px-1.5 text-sm">{total}</span>}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-5"
      >
        {merged && (
          <div className="flex gap-3 rounded-xl bg-info-soft px-4 py-3 text-sm text-info">
            <Info className="mt-0.5 size-5 shrink-0" />
            <p className="font-semibold">
              يوجد زيارة اليوم الساعة <span className="num">{formatTime(view.todayVisitHere!.occurredAt)}</span>. سيُضاف
              التحويل لنفس الزيارة دون زيادة عدد الزيارات.
            </p>
          </div>
        )}
        {!merged && otherCenterToday && (
          <div className="flex gap-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <p className="font-semibold">
              سُجّلت زيارة اليوم في {CENTERS.find((c) => c.code === otherCenterToday.center)!.name} الساعة{" "}
              <span className="num">{formatTime(otherCenterToday.occurredAt)}</span>. ستُسجّل زيارة منفصلة وتُحال للمراجعة.
            </p>
          </div>
        )}
        {view.restriction?.level === "REVIEW_REQUIRED" && (
          <div className="flex gap-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <p className="font-semibold">الحالة تحت المراجعة. ستُسجّل الزيارة وتُحال للأدمن تلقائياً.</p>
          </div>
        )}

        {hereEnrollments.length > 0 && (
          <section>
            <h3 className="mb-2.5 text-sm font-bold">وين رايحة اليوم؟</h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {hereEnrollments.map((e) => {
                const done = alreadyToday.has(e.project);
                return (
                  <Chip
                    key={e.id}
                    selected={done || selected.has(e.project)}
                    disabled={done}
                    onToggle={() => toggle(e.project)}
                    sub={done ? "محوّلة مسبقاً اليوم" : e.status === "PENDING_APPROVAL" ? "بانتظار الاعتماد" : undefined}
                  >
                    {pName(e.project)}
                  </Chip>
                );
              })}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-line">
          <button
            type="button"
            onClick={() => setShowOthers((s) => !s)}
            aria-expanded={showOthers}
            className="flex w-full items-center gap-2 px-4 py-3 text-start text-sm font-bold"
          >
            {hereEnrollments.length === 0 ? "المشاريع في هذا المركز" : "مشاريع أخرى"}
            <span className="text-xs font-medium text-muted">— تحتاج سبباً واعتماد الأدمن</span>
            <ChevronDown className={cn("ms-auto size-4 text-muted transition", showOthers && "rotate-180")} />
          </button>
          {showOthers && (
            <div className="space-y-2.5 border-t border-line p-4">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {others.map((p) => (
                  <Chip key={p.code} tone="warn" selected={extra.has(p.code)} onToggle={() => toggleExtra(p.code)}>
                    {p.name}
                  </Chip>
                ))}
              </div>

              {Array.from(extra.entries()).map(([p, v]) => (
                <div key={p} className="animate-fade-up rounded-xl bg-warn-soft/60 p-3">
                  <div className="mb-2 text-sm font-bold">سبب التحويل إلى {pName(p)}</div>
                  <div className="flex flex-wrap gap-2">
                    {NEW_ENROLLMENT_REASONS.map((r) => (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setExtra((m) => new Map(m).set(p, { ...v, reason: r }))}
                        className={cn(
                          "focus-ring rounded-lg border px-3 py-2 text-sm font-semibold transition",
                          v.reason === r ? "border-warn bg-warn text-white" : "border-line bg-surface hover:bg-sunken",
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  {v.reason === "أخرى" && (
                    <Textarea
                      className="mt-2 min-h-[64px]"
                      placeholder="اكتب السبب"
                      value={v.note}
                      onChange={(e) => setExtra((m) => new Map(m).set(p, { ...v, note: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <FieldError>{error}</FieldError>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
