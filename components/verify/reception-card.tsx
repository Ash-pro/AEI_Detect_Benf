"use client";

import { useState } from "react";
import { Check, ChevronDown, ClipboardPlus, History, Lock, Phone, Plus, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Banner } from "./banner";
import type { ReceptionView, EnrollmentView } from "@/lib/logic";
import { wasServed } from "@/lib/logic";
import type { Beneficiary, CenterCode, IdentityType, Visit } from "@/lib/types";
import { CENTERS, PROJECTS } from "@/lib/mock-data";
import { cn, formatDate, formatShortDate, formatTime, sinceText } from "@/lib/utils";

const centerName = (c: CenterCode) => CENTERS.find((x) => x.code === c)!.short;
const projectName = (p: string) => PROJECTS.find((x) => x.code === p)?.name ?? p;

export function TypeBadge({ typeId, types }: { typeId: string; types: IdentityType[] }) {
  const t = types.find((x) => x.id === typeId);
  return (
    <span className="inline-flex items-center rounded-lg border border-line bg-sunken px-2.5 py-1 text-sm font-bold text-ink">
      {t?.name ?? "—"}
    </span>
  );
}

function EnrollmentShape({ status }: { status: EnrollmentView["status"] }) {
  if (status === "ACTIVE") return <span className="size-3 rounded-full bg-ok" aria-label="نشط" />;
  if (status === "PENDING_APPROVAL")
    return (
      <span className="size-3 overflow-hidden rounded-full border-2 border-warn" aria-label="بانتظار الاعتماد">
        <span className="block h-full w-1/2 bg-warn" />
      </span>
    );
  return <span className="size-3 rounded-full border-2 border-muted/50" aria-label="مغلق" />;
}

function EnrollmentRow({ e, center }: { e: EnrollmentView; center: CenterCode }) {
  const here = e.center === center;
  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3", e.status === "CLOSED" && "opacity-60")}>
      <EnrollmentShape status={e.status} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-bold">{projectName(e.project)}</span>
          <span className={cn("text-xs font-semibold", here ? "text-muted" : "text-khy")}>— {centerName(e.center)}</span>
          {e.status === "PENDING_APPROVAL" && <Badge tone="warn">بانتظار الاعتماد</Badge>}
          {e.status === "CLOSED" && <Badge>مغلق</Badge>}
        </div>
      </div>
      <div className="basis-full ps-6 text-sm text-muted sm:basis-auto sm:shrink-0 sm:ps-0 sm:text-end">
        {e.status === "CLOSED" ? (
          <span>
            <span className="num">{formatShortDate(e.closedAt!)}</span> · {e.closedReason}
          </span>
        ) : e.serviceCount ? (
          <span>
            <span className="num font-semibold text-ink">{e.serviceCount}</span> {e.serviceCount === 1 ? "خدمة" : e.serviceCount === 2 ? "خدمتان" : "خدمات"} · آخرها{" "}
            {sinceText(e.lastService!)}
          </span>
        ) : (
          <span>لا خدمات بعد</span>
        )}
      </div>
    </li>
  );
}

export function VisitRow({ v, view }: { v: Visit; view: ReceptionView }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2.5 text-sm">
      <span className="num w-8 font-bold text-muted">#{v.seq}</span>
      <span className="num w-[92px] font-semibold">
        {formatShortDate(v.occurredAt)} <span className="text-muted">{formatTime(v.occurredAt)}</span>
      </span>
      <span className="w-14 text-xs font-semibold text-muted">{centerName(v.center)}</span>
      <span className="flex flex-1 flex-wrap gap-1.5">
        {v.referrals.map((p) => {
          const served = wasServed(view, v, p);
          return (
            <span
              key={p}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold",
                served ? "bg-ok-soft text-ok" : "bg-sunken text-muted",
              )}
              title={served ? "تأكدت الخدمة" : "لم تتأكد الخدمة"}
            >
              {served && <Check className="size-3" strokeWidth={3} />}
              {projectName(p)}
            </span>
          );
        })}
      </span>
    </li>
  );
}

function Collapsible({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-line">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="focus-ring flex w-full items-center gap-2 px-5 py-3 text-sm font-semibold text-muted hover:bg-sunken/60"
      >
        {icon}
        {title}
        {count !== undefined && <span className="num rounded-full bg-sunken px-2 text-xs">{count}</span>}
        <ChevronDown className={cn("ms-auto size-4 transition", open && "rotate-180")} />
      </button>
      {open && <div className="animate-fade-in pb-2">{children}</div>}
    </div>
  );
}

export function ReceptionCard({
  view,
  center,
  types,
  onRegister,
  onOpenMember,
}: {
  view: ReceptionView;
  center: CenterCode;
  types: IdentityType[];
  onRegister: () => void;
  onOpenMember: (b: Beneficiary) => void;
}) {
  const [allVisits, setAllVisits] = useState(false);
  const { beneficiary: b, restriction: r } = view;
  const blocked = r?.level === "BLOCKED" || r?.level === "TEMPORARILY_BLOCKED";
  const homeCenter = CENTERS.find((c) => c.code === b.homeCenter)!;

  /* Banner واحد بالأخطر */
  let banner: React.ReactNode = null;
  if (blocked)
    banner = (
      <Banner tone="bad" title={r!.level === "BLOCKED" ? "ممنوعة من التسجيل — منع دائم" : `ممنوعة مؤقتاً حتى ${formatDate(r!.endsAt!)}`}>
        {r!.reason}
      </Banner>
    );
  else if (r?.level === "REVIEW_REQUIRED")
    banner = (
      <Banner tone="review" title="تحت المراجعة — التسجيل مسموح وسيُحال للأدمن">
        {r.reason}
      </Banner>
    );
  else if (view.isOtherCenter)
    banner = (
      <Banner tone="center" title={`مسجلة في ${homeCenter.name}`}>
        حوّل على مشاريع هذا المركز أو اطلب مشروعاً جديداً
      </Banner>
    );
  else if (r?.level === "WARNING")
    banner = (
      <Banner tone="warn" title="تنبيه مسجّل على الحالة">
        {r.reason}
      </Banner>
    );
  else if (view.todayVisitHere)
    banner = (
      <Banner tone="info" title={`لديها زيارة اليوم الساعة ${formatTime(view.todayVisitHere.occurredAt)}`}>
        محوّلة إلى: {view.todayVisitHere.referrals.map(projectName).join("، ")}
      </Banner>
    );
  else if (view.todayVisitElsewhere)
    banner = (
      <Banner tone="warn" title={`سُجّلت لها زيارة اليوم في مركز ${centerName(view.todayVisitElsewhere.center)}`}>
        أي زيارة هنا ستُسجّل منفصلة وتُحال للمراجعة
      </Banner>
    );

  const extraWarning = r?.level === "WARNING" && (view.isOtherCenter || blocked);

  const visible = view.visits.slice(0, 5);

  return (
    <Card className="animate-fade-up overflow-hidden">
      {banner}

      <div className="px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-bold leading-tight sm:text-[28px]">{b.name}</h2>
          <TypeBadge typeId={b.typeId} types={types} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
          <span className="num text-lg font-semibold tracking-wider text-ink">{b.nationalId}</span>
          <span className="inline-flex items-center gap-1.5">
            <Phone className="size-4" />
            <span className="num">{b.phone}</span>
          </span>
          {b.birthDate && (
            <span className="text-sm">
              مواليد <span className="num">{formatDate(b.birthDate)}</span>
            </span>
          )}
          {extraWarning && <Badge tone="warn">عليها تنبيه</Badge>}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span>
            إجمالي الزيارات: <span className="num font-bold">{view.totalVisits}</span>
          </span>
          {view.lastVisit && (
            <span>
              آخر زيارة: <span className="num font-bold">{formatShortDate(view.lastVisit.occurredAt)}</span>{" "}
              <span className="text-muted">({sinceText(view.lastVisit.occurredAt)})</span>
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-line">
        <div className="px-5 pb-1 pt-3 text-xs font-semibold text-muted">المشاريع</div>
        <ul className="divide-y divide-line/70">
          {view.enrollments.map((e) => (
            <EnrollmentRow key={e.id} e={e} center={center} />
          ))}
        </ul>
      </div>

      <Collapsible icon={<History className="size-4" />} title="سجل الزيارات" count={view.totalVisits}>
        <ul className="divide-y divide-line/60">
          {visible.map((v) => (
            <VisitRow key={v.id} v={v} view={view} />
          ))}
        </ul>
        {view.visits.length > 5 && (
          <button onClick={() => setAllVisits(true)} className="mx-5 mt-1 text-sm font-semibold text-brand hover:underline">
            عرض كل الزيارات ({view.visits.length})
          </button>
        )}
      </Collapsible>

      {view.household.length > 0 && (
        <Collapsible icon={<Users className="size-4" />} title="أفراد العائلة" count={view.household.length}>
          <div className="flex flex-wrap gap-2 px-5 pt-1">
            {view.household.map((m) => (
              <button
                key={m.id}
                onClick={() => onOpenMember(m)}
                className="focus-ring inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm hover:bg-sunken"
              >
                <span className="font-semibold">{m.name.split(" ")[0]}</span>
                <span className="text-xs text-muted">{types.find((t) => t.id === m.typeId)?.name}</span>
                <span className="num text-xs text-muted">{m.nationalId}</span>
              </button>
            ))}
          </div>
        </Collapsible>
      )}

      <div className="border-t border-line bg-sunken/50 p-4">
        {blocked ? (
          <Button size="xl" block disabled variant="secondary">
            <Lock className="size-5" />
            التسجيل غير متاح لهذه الحالة
          </Button>
        ) : view.todayVisitHere ? (
          <Button size="xl" block onClick={onRegister}>
            <Plus className="size-6" />
            إضافة تحويل على زيارة اليوم
          </Button>
        ) : (
          <Button size="xl" block onClick={onRegister}>
            <ClipboardPlus className="size-6" />
            تسجيل زيارة
          </Button>
        )}
      </div>

      <Dialog open={allVisits} onClose={() => setAllVisits(false)} title="سجل الزيارات" description={b.name} size="lg">
        <ul className="-mx-5 divide-y divide-line/60 sm:-mx-6">
          {view.visits.map((v) => (
            <VisitRow key={v.id} v={v} view={view} />
          ))}
        </ul>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1 rounded-md bg-ok-soft px-2 py-0.5 font-bold text-ok">
            <Check className="size-3" strokeWidth={3} /> مشروع
          </span>
          تعني أن نقطة المشروع أكدت الخدمة
        </p>
      </Dialog>
    </Card>
  );
}
