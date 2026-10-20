"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleSlash,
  Clock4,
  FileWarning,
  MapPinOff,
  ShieldX,
  UserX,
  CircleCheckBig,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldError, Label, Textarea } from "@/components/ui/field";
import { TypeBadge } from "./reception-card";
import type { PointView } from "@/lib/logic";
import type { CenterCode, IdentityType, PointStatus, Project } from "@/lib/types";
import { CENTERS, EXCEPTION_REASONS, PROJECTS } from "@/lib/mock-data";
import { cn, formatDate, formatTime, sinceText } from "@/lib/utils";

type Tone = "ok" | "warn" | "bad" | "info";

const toneCls: Record<Tone, string> = {
  ok: "bg-ok text-white",
  warn: "bg-warn text-white",
  bad: "bg-bad text-white",
  info: "bg-info text-white",
};

interface StatusSpec {
  tone: Tone;
  icon: LucideIcon;
  title: string;
  sub?: string;
  action: string;
  canConfirm: boolean;
  canException: boolean;
}

function spec(v: PointView, project: Project): StatusSpec {
  const pn = project.name;
  const vt = v.visitToday;
  const cn2 = (c: CenterCode) => CENTERS.find((x) => x.code === c)!.name;
  const map: Record<PointStatus, () => StatusSpec> = {
    P1_REFERRED: () => ({
      tone: "ok",
      icon: CheckCircle2,
      title: `محوّلة اليوم إلى ${pn}`,
      sub: `الاستقبال ${formatTime(vt!.occurredAt)} · زيارة #${vt!.seq}`,
      action: "",
      canConfirm: true,
      canException: false,
    }),
    P2_REFERRED_PENDING: () => ({
      tone: "ok",
      icon: CheckCircle2,
      title: `محوّلة اليوم إلى ${pn}`,
      sub: `مشروع جديد للحالة — بانتظار اعتماد الأدمن · الاستقبال ${formatTime(vt!.occurredAt)}`,
      action: "",
      canConfirm: true,
      canException: false,
    }),
    P3_NOT_REFERRED_TODAY: () => ({
      tone: "warn",
      icon: AlertTriangle,
      title: `غير محوّلة اليوم إلى ${pn}`,
      sub: `مرّت على الاستقبال ${formatTime(vt!.occurredAt)} ومحوّلة إلى: ${vt!.referrals.map((p) => PROJECTS.find((x) => x.code === p)!.name).join("، ")}`,
      action: "وجّه المستفيد للاستقبال لإضافة التحويل",
      canConfirm: false,
      canException: true,
    }),
    P4_WRONG_PROJECT: () => ({
      tone: "bad",
      icon: CircleSlash,
      title: "غير مسجلة في مشروعك",
      sub: `لا يوجد ارتباط بـ ${pn} لهذه الحالة`,
      action: "وجّه المستفيد للاستقبال",
      canConfirm: false,
      canException: true,
    }),
    P5_WRONG_CENTER: () => ({
      tone: "bad",
      icon: MapPinOff,
      title: "مسجلة في مركز آخر",
      sub: vt
        ? `زيارة اليوم في ${cn2(vt.center)} الساعة ${formatTime(vt.occurredAt)}`
        : `مرتبطة بـ ${pn} في ${cn2(v.enrollment!.center)}`,
      action: "وجّه المستفيد للاستقبال",
      canConfirm: false,
      canException: true,
    }),
    P6_NO_VISIT: () => ({
      tone: "bad",
      icon: Clock4,
      title: "لم تمر على الاستقبال اليوم",
      sub: `مرتبطة بـ ${pn} لكن لا توجد زيارة استقبال اليوم`,
      action: "وجّه المستفيد للاستقبال أولاً",
      canConfirm: false,
      canException: true,
    }),
    P7_UNKNOWN: () => ({
      tone: "bad",
      icon: UserX,
      title: "هوية غير مسجلة",
      sub: "لا يوجد ملف لهذه الهوية في النظام",
      action: "يرجى التوجه للاستقبال لتسجيل الحالة",
      canConfirm: false,
      canException: false,
    }),
    P8_ALREADY_SERVED: () => ({
      tone: "info",
      icon: CircleCheckBig,
      title: `تمت خدمتها اليوم الساعة ${formatTime(v.service!.servedAt)}`,
      sub: `بواسطة ${v.service!.servedBy}`,
      action: "لا يمكن تأكيد الخدمة مرة ثانية",
      canConfirm: false,
      canException: false,
    }),
    P9_CLOSED: () => ({
      tone: "bad",
      icon: FileWarning,
      title: `الارتباط بـ ${pn} مغلق`,
      sub: `أُغلق ${formatDate(v.enrollment!.closedAt!)} — ${v.enrollment!.closedReason}`,
      action: "للمراجعة تواصل مع الأدمن",
      canConfirm: false,
      canException: true,
    }),
    P10_BLOCKED: () => ({
      tone: "bad",
      icon: Ban,
      title: v.restriction?.level === "BLOCKED" ? "ممنوعة من الخدمة" : `ممنوعة مؤقتاً حتى ${formatDate(v.restriction!.endsAt!)}`,
      sub: v.restriction?.reason,
      action: "لا يمكن تقديم الخدمة. أبلغ الأدمن عند الحاجة",
      canConfirm: false,
      canException: false,
    }),
  };
  return map[v.status]();
}

export function PointCard({
  view,
  project,
  types,
  onConfirm,
  onException,
  onDone,
}: {
  view: PointView;
  project: Project;
  types: IdentityType[];
  onConfirm: () => void;
  onException: (reason: string, note: string) => void;
  onDone: () => void;
}) {
  const s = spec(view, project);
  const [exOpen, setExOpen] = useState(false);
  const showException = s.canException && project.allowException;
  const b = view.beneficiary;

  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className={cn("flex items-center gap-4 px-5 py-5 sm:px-6", toneCls[s.tone])} role="status" aria-live="polite">
        <s.icon className="size-10 shrink-0 sm:size-12" strokeWidth={2.2} />
        <div className="min-w-0">
          <div className="text-xl font-bold leading-snug sm:text-2xl">{s.title}</div>
          {s.sub && <div className="mt-1 text-sm font-medium opacity-90 sm:text-base">{s.sub}</div>}
        </div>
      </div>

      {b && (
        <div className="px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl font-bold leading-tight">{b.name}</h2>
            <TypeBadge typeId={b.typeId} types={types} />
          </div>
          <div className="num mt-1 text-start text-lg font-semibold tracking-wider text-muted">{b.nationalId}</div>
          <div className="mt-3 text-sm">
            {view.lastService ? (
              <>
                آخر خدمة في {project.name}: <span className="font-bold">{sinceText(view.lastService.servedAt)}</span>{" "}
                <span className="text-muted">
                  · <span className="num">{view.serviceCount}</span> {view.serviceCount === 1 ? "خدمة" : view.serviceCount === 2 ? "خدمتان" : "خدمات"}
                </span>
              </>
            ) : (
              <span className="text-muted">لا خدمات سابقة في {project.name}</span>
            )}
          </div>
          {view.restriction?.level === "WARNING" && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-warn-soft px-3 py-1.5 text-sm font-semibold text-warn">
              <ShieldX className="size-4" />
              {view.restriction.reason}
            </div>
          )}
        </div>
      )}

      <div className={cn("border-t border-line bg-sunken/50 p-4", !b && "border-t-0")}>
        {s.canConfirm ? (
          <Button size="xl" variant="ok" block onClick={onConfirm} autoFocus>
            <CheckCircle2 className="size-6" />
            تأكيد الخدمة
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-lg font-bold">{s.action}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" variant="secondary" className="flex-1" onClick={onDone} autoFocus>
                التالي
              </Button>
              {showException && (
                <Button size="lg" variant="ghost" className="flex-1 border border-dashed border-warn/50 text-warn hover:bg-warn-soft" onClick={() => setExOpen(true)}>
                  خدمة استثنائية
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <ExceptionDialog
        open={exOpen}
        onClose={() => setExOpen(false)}
        name={b?.name ?? ""}
        statusTitle={s.title}
        onSubmit={(r, n) => {
          setExOpen(false);
          onException(r, n);
        }}
      />
    </Card>
  );
}

function ExceptionDialog({
  open,
  onClose,
  name,
  statusTitle,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  statusTitle: string;
  onSubmit: (reason: string, note: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function submit() {
    if (!reason) return setError("اختر السبب");
    if (note.trim().length < 5) return setError("اكتب ملاحظة توضح السبب");
    onSubmit(reason, note.trim());
    setReason("");
    setNote("");
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="خدمة استثنائية"
      description={name}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>
            إلغاء
          </Button>
          <Button size="lg" className="bg-warn hover:bg-warn/90 sm:min-w-[200px]" onClick={submit}>
            تسجيل الخدمة وإحالتها للمراجعة
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex gap-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <p className="font-semibold">
            الحالة: {statusTitle}. ستُسجّل الخدمة فوراً وتظهر للأدمن في المراجعة باسمك.
          </p>
        </div>
        <div>
          <Label required>السبب</Label>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {EXCEPTION_REASONS.map((r) => (
              <button
                type="button"
                role="radio"
                aria-checked={reason === r}
                key={r}
                onClick={() => {
                  setReason(r);
                  setError("");
                }}
                className={cn(
                  "focus-ring rounded-xl border-2 px-4 py-3 text-start text-sm font-semibold transition",
                  reason === r ? "border-warn bg-warn-soft text-warn" : "border-line hover:bg-sunken",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="ex-note" required>
            ملاحظة
          </Label>
          <Textarea id="ex-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="وضّح ما حدث بإيجاز" />
          <FieldError>{error}</FieldError>
        </div>
      </div>
    </Dialog>
  );
}
