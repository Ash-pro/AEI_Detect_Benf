"use client";

import { Dialog } from "@/components/ui/dialog";
import { BeneficiaryEditor, EntryEditor } from "@/components/entry/edit-dialog";
import { useStore } from "@/lib/store";
import { allProjects, centerName, userName } from "@/lib/queries";
import type { Entry } from "@/lib/types";
import { dayFull } from "@/lib/utils";

/** تعديل أي إدخال من الأدمن (بما فيها الأيام السابقة) */
export function AdminEntryDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const { db } = useStore();
  const b = entry ? db.beneficiaries[entry.nid] : undefined;
  const live = entry ? db.entries.find((e) => e.id === entry.id) : undefined;

  return (
    <Dialog
      open={Boolean(entry)}
      onClose={onClose}
      size="lg"
      title="تعديل إدخال"
      description={entry ? `${entry.nid} · ${dayFull(entry.date)} · ${centerName(db, entry.center)} · ${userName(db, entry.userId)}` : ""}
    >
      {entry && (
        <div className="space-y-5">
          {b && <BeneficiaryEditor key={b.nid} beneficiary={b} />}
          {live ? (
            <EntryEditor key={live.id + live.nid} entry={live} projects={allProjects(db)} onMoved={() => onClose()} />
          ) : (
            <p className="rounded-xl bg-sunken px-4 py-3 text-sm text-muted">تم حذف هذا الإدخال.</p>
          )}
        </div>
      )}
    </Dialog>
  );
}
