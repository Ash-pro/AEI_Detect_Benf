"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, CheckCircle2, Info, PenLine, TriangleAlert } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckBox } from "@/components/ui/check";
import { FieldError } from "@/components/ui/field";
import { useStore } from "@/lib/store";
import { centerName, projectName, userName } from "@/lib/queries";
import { projectColor } from "@/lib/project-colors";
import type { Entry, Project, SessionUser } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";

const names = (db: Parameters<typeof projectName>[0], list: string[]) => list.map((p) => projectName(db, p)).join("، ");

/**
 * لوحة "توجيه اليوم" لموظف النقطة:
 * تقول له بوضوح هل الحالة محوّلة لمشروعه، أم لمشروع آخر، أم لم تمر على الاستقبال.
 */
export function RoutingPanel({
  reception,
  user,
  center,
  onFix,
}: {
  reception?: Entry;
  user: SessionUser;
  center: string;
  onFix: () => void;
}) {
  const { db } = useStore();
  const mine = user.projects;

  if (!reception) {
    return (
      <div className="flex gap-3 rounded-2xl border border-line bg-sunken px-4 py-3.5 text-sm">
        <Info className="mt-0.5 size-5 shrink-0 text-muted" />
        <div>
          <div className="font-bold">لم تمر على الاستقبال اليوم</div>
          <div className="mt-0.5 text-muted">معلومة فقط، ويمكنك إدخال الخدمة. إذا كانت الحالة لمشروع آخر، وجّهها مباشرة إلى نقطة ذلك المشروع دون الرجوع للاستقبال.</div>
        </div>
      </div>
    );
  }

  const forMe = reception.projects.filter((p) => mine.includes(p));
  const others = reception.projects.filter((p) => !mine.includes(p));
  const ok = forMe.length > 0;

  return (
    <div className={cn("overflow-hidden rounded-2xl border-2", ok ? "border-ok/40 bg-ok-soft" : "border-warn/50 bg-warn-soft")}>
      <div className="flex gap-3 px-4 py-3.5">
        {ok ? <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-ok" /> : <TriangleAlert className="mt-0.5 size-6 shrink-0 text-warn" />}
        <div className="min-w-0 flex-1">
          <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-lg font-bold leading-snug", ok ? "text-ok" : "text-warn")}>
            <span>{ok ? `محوّلة إلى مشروعك: ${names(db, forMe)}` : `محوّلة إلى ${names(db, others)} — ليست لمشروعك`}</span>
            {ok &&
              forMe.map((p) =>
                reception.queue?.[p] ? (
                  <span key={p} className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-0.5 text-base text-ink shadow-sm">
                    {forMe.length > 1 && <span className="text-sm text-muted">{projectName(db, p)}</span>}
                    الدور{" "}
                    <span className="num rounded-md px-2 text-xl text-white" style={{ background: projectColor(db, p) }}>
                      {reception.queue[p]}
                    </span>
                  </span>
                ) : null,
              )}
          </div>
          <div className="mt-1 text-sm text-ink/80">
            الاستقبال <span className="num">{formatTime(reception.at)}</span> · {userName(db, reception.userId)}
            {reception.center !== center && ` · ${centerName(db, reception.center)}`}
            {ok && others.length > 0 && <> · ومحوّلة أيضاً إلى {names(db, others)}</>}
          </div>
          {reception.corrected && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-surface/70 px-2 py-1 text-xs font-bold text-warn">
              <PenLine className="size-3.5" />
              عُدّل التوجيه من {names(db, reception.corrected.from)} بواسطة {userName(db, reception.corrected.by)}{" "}
              <span className="num">{formatTime(reception.corrected.at)}</span>
            </div>
          )}
          {!ok && (
            <div className="mt-2 font-bold text-ink">وجّه المستفيد إلى نقطة {names(db, others)}، ولا تُدخل الخدمة هنا إلا إذا خدمته فعلاً.</div>
          )}
        </div>
      </div>
      <button
        onClick={onFix}
        className="focus-ring flex w-full items-center justify-center gap-2 border-t border-black/5 bg-surface/60 px-4 py-2.5 text-sm font-bold text-ink hover:bg-surface"
      >
        <ArrowLeftRight className="size-4" />
        التوجيه خاطئ؟ تعديل التوجيه
      </button>
    </div>
  );
}

/** نافذة تعديل توجيه الاستقبال من نقطة المشروع — لا تُسجّل خدمة */
export function RoutingDialog({
  open,
  onClose,
  reception,
  projects,
  myEntries,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  reception?: Entry;
  projects: Project[];
  myEntries: Entry[];
  onDone: (projects: string[]) => void;
}) {
  const { db, correctRouting } = useStore();
  const [sel, setSel] = useState<string[]>([]);
  const [del, setDel] = useState<string[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open || !reception) return;
    setSel(reception.projects);
    setDel(myEntries.map((e) => e.id));
    setErr("");
  }, [open, reception, myEntries]);

  if (!reception) return null;
  const changed = sel.slice().sort().join() !== reception.projects.slice().sort().join();

  function save() {
    const e = correctRouting(reception!.id, sel, del);
    if (e) return setErr(e);
    onDone(sel);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="تعديل التوجيه"
      description="يغيّر المشروع الذي حوّل إليه الاستقبال اليوم، ولا يسجّل أي خدمة"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>
            إلغاء
          </Button>
          <Button size="lg" className="sm:min-w-[220px]" disabled={!changed || !sel.length} onClick={save}>
            حفظ التوجيه الصحيح
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-sunken px-4 py-3 text-sm">
          <span className="text-muted">التوجيه الحالي من الاستقبال:</span>{" "}
          <span className="font-bold">{names(db, reception.projects)}</span>
          <span className="text-muted">
            {" "}
            · <span className="num">{formatTime(reception.at)}</span> · {userName(db, reception.userId)}
          </span>
        </div>

        <fieldset>
          <legend className="mb-2.5 text-sm font-bold">المشروع الصحيح</legend>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {projects.map((p) => (
              <CheckBox
                key={p.code}
                checked={sel.includes(p.code)}
                onChange={(v) => {
                  setErr("");
                  setSel((s) => (v ? [...s, p.code] : s.filter((x) => x !== p.code)));
                }}
              >
                {p.name}
              </CheckBox>
            ))}
          </div>
        </fieldset>

        {myEntries.length > 0 && (
          <div className="rounded-xl border border-bad/30 bg-bad-soft/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-bad">
              <TriangleAlert className="size-4" />
              أدخلتَ خدمة لهذه الحالة اليوم
            </div>
            <div className="space-y-2">
              {myEntries.map((e) => (
                <CheckBox
                  key={e.id}
                  checked={del.includes(e.id)}
                  onChange={(v) => setDel((d) => (v ? [...d, e.id] : d.filter((x) => x !== e.id)))}
                  sub={`أُدخلت ${formatTime(e.at)}`}
                >
                  حذف إدخال الخدمة في {names(db, e.projects)}
                </CheckBox>
              ))}
            </div>
          </div>
        )}

        <p className="flex gap-2 text-sm text-muted">
          <Info className="mt-0.5 size-4 shrink-0" />
          بعد الحفظ: وجّه المستفيد إلى نقطة المشروع الصحيح. موظف تلك النقطة سيرى أن الحالة محوّلة إليه، مع ملاحظة أن التوجيه عُدّل.
        </p>
        <FieldError>{err}</FieldError>
      </div>
    </Dialog>
  );
}
