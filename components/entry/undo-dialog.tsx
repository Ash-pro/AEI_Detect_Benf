"use client";

import { useState } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { IdTypeTag } from "./id-fields";
import { ProjectChip } from "./history";
import { useStore } from "@/lib/store";
import { pointQueue } from "@/lib/queue";
import type { Entry } from "@/lib/types";
import { formatTime, todayKey } from "@/lib/utils";

/** هل يستطيع موظف النقطة التراجع عن هذا الإدخال؟ (إدخال خدمته هو، اليوم) */
export function canUndo(entry: Entry | undefined, userId: string | undefined): entry is Entry {
  return Boolean(entry && userId && entry.kind === "POINT" && entry.userId === userId && entry.date === todayKey());
}

/** تأكيد التراجع عن إدخال حالة لدى موظف النقطة */
export function UndoEntryDialog({ entry, onClose, onDone }: { entry: Entry | null; onClose: () => void; onDone?: (e: Entry) => void }) {
  const { db, deleteEntry } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!entry) return null;
  const b = db.beneficiaries[entry.nid];
  const q = pointQueue(db, entry);
  const onlyEntry = db.entries.filter((x) => x.nid === entry.nid).length === 1;

  async function confirm() {
    if (!entry || busy) return;
    setBusy(true);
    setErr("");
    const e = await deleteEntry(entry.id);
    setBusy(false);
    if (e) return setErr(e);
    toast(q.number ? `تم التراجع — عادت الحالة لقائمة الانتظار (دور ${q.number})` : "تم التراجع عن إدخال الحالة", "info");
    onDone?.(entry);
    onClose();
  }

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title="التراجع عن إدخال الحالة"
      description="هل أنت متأكد من التراجع عن إدخال الحالة؟"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>
            خروج
          </Button>
          <Button variant="danger" size="lg" className="sm:min-w-[160px]" onClick={confirm} loading={busy} loadingText="جارٍ التراجع…" autoFocus>
            <RotateCcw className="size-5" />
            متأكد
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-line p-4">
          {q.number ? (
            <span className="num grid size-12 shrink-0 place-items-center rounded-xl bg-sunken text-xl font-bold">{q.number}</span>
          ) : null}
          <span className="min-w-0 flex-1 space-y-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-bold">{b?.name || "بدون اسم"}</span>
              <IdTypeTag type={b?.type} />
            </span>
            <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="num font-semibold tracking-wider text-ink/80">{entry.nid}</span>
              <span>
                أُدخلت <span className="num">{formatTime(entry.at)}</span>
              </span>
            </span>
            <span className="flex flex-wrap gap-1">
              {entry.projects.map((p) => (
                <ProjectChip key={p} db={db} code={p} />
              ))}
            </span>
          </span>
        </div>
        <p className="flex gap-2 rounded-xl bg-warn-soft px-4 py-3 text-sm font-semibold text-warn">
          <TriangleAlert className="size-5 shrink-0" />
          {q.number ? "يُلغى تسجيل الخدمة وتعود الحالة لقائمة الانتظار بنفس رقم دورها." : "يُلغى تسجيل الخدمة لهذه الحالة اليوم."}{" "}
          {onlyEntry ? "ولأنها أول مرة للحالة في النظام، يُحذف ملفها أيضاً." : "ملف المستفيد يبقى كما هو."}
        </p>
        <FieldError>{err}</FieldError>
      </div>
    </Dialog>
  );
}
