"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { EntryEditor } from "@/components/entry/edit-dialog";
import { useStore } from "@/lib/store";
import { allProjects, centerName, userName } from "@/lib/queries";
import type { Entry } from "@/lib/types";
import { dayFull } from "@/lib/utils";

/** تعديل أي إدخال من الأدمن (بما فيها الأيام السابقة) */
export function AdminEntryDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const { db, renameBeneficiary } = useStore();
  const toast = useToast();
  const b = entry ? db.beneficiaries[entry.nid] : undefined;
  const [name, setName] = useState("");
  useEffect(() => setName(b?.name ?? ""), [b?.name, entry?.id]);
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
          {b && (
            <div>
              <Label htmlFor="adm-name">اسم المستفيد</Label>
              <div className="flex gap-2">
                <Input id="adm-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="بدون اسم" />
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={name.trim() === b.name}
                  onClick={() => {
                    renameBeneficiary(b.nid, name);
                    toast("تم حفظ الاسم");
                  }}
                >
                  <Save className="size-4" />
                  حفظ
                </Button>
              </div>
            </div>
          )}
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
