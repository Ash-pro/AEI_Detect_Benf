"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Info, Save, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckBox } from "@/components/ui/check";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { KindTag } from "./history";
import { useStore } from "@/lib/store";
import type { Beneficiary, Entry, Project } from "@/lib/types";
import { formatTime, isValidNationalId, normalizeDigits } from "@/lib/utils";

/** تعديل بيانات الهوية وإدخالات اليوم للموظف نفسه */
export function EditDialog({
  open,
  onClose,
  beneficiary,
  todayMine,
  projects,
  onMoved,
}: {
  open: boolean;
  onClose: () => void;
  beneficiary: Beneficiary;
  todayMine: Entry[];
  projects: Project[];
  onMoved: (nid: string) => void;
}) {
  const { renameBeneficiary } = useStore();
  const toast = useToast();
  const [name, setName] = useState(beneficiary.name);

  useEffect(() => {
    if (open) setName(beneficiary.name);
  }, [open, beneficiary.name]);

  return (
    <Dialog open={open} onClose={onClose} title="تعديل" description={beneficiary.nid} size="lg">
      <div className="space-y-6">
        <section>
          <Label htmlFor="edit-name">الاسم</Label>
          <div className="flex gap-2">
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="اختياري" />
            <Button
              variant="secondary"
              size="lg"
              disabled={name.trim() === beneficiary.name}
              onClick={() => {
                renameBeneficiary(beneficiary.nid, name);
                toast("تم حفظ الاسم");
              }}
            >
              <Save className="size-4" />
              حفظ
            </Button>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-bold">إدخالاتك اليوم لهذه الهوية</h3>
          {todayMine.length === 0 ? (
            <p className="rounded-xl bg-sunken px-4 py-3 text-sm text-muted">لا توجد إدخالات لك اليوم على هذه الهوية.</p>
          ) : (
            <div className="space-y-3">
              {todayMine.map((e) => (
                <EntryEditor key={e.id} entry={e} projects={projects} onMoved={onMoved} />
              ))}
            </div>
          )}
        </section>

        <p className="flex gap-2 text-sm text-muted">
          <Info className="mt-0.5 size-4 shrink-0" />
          إدخالات الأيام السابقة يعدّلها الأدمن فقط. كل تعديل يُحفظ في سجل التغييرات باسمك.
        </p>
      </div>
    </Dialog>
  );
}

export function EntryEditor({ entry, projects, onMoved }: { entry: Entry; projects: Project[]; onMoved: (nid: string) => void }) {
  const { updateEntryProjects, deleteEntry, moveEntry, db } = useStore();
  const toast = useToast();
  const [sel, setSel] = useState<string[]>(entry.projects);
  const [newId, setNewId] = useState("");
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const changed = sel.slice().sort().join() !== entry.projects.slice().sort().join();
  const options = projects.filter((p) => p.active || entry.projects.includes(p.code));

  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="mb-3 flex items-center gap-2 text-sm">
        <KindTag kind={entry.kind} />
        <span className="num font-semibold">{formatTime(entry.at)}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((p) => (
          <CheckBox
            key={p.code}
            checked={sel.includes(p.code)}
            onChange={(v) => setSel((s) => (v ? (entry.kind === "POINT" ? [p.code] : [...s, p.code]) : s.filter((x) => x !== p.code)))}
          >
            {p.name}
          </CheckBox>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!changed}
          onClick={() => {
            const e = updateEntryProjects(entry.id, sel);
            if (e) setErr(e);
            else {
              setErr("");
              toast("تم تعديل الإدخال");
            }
          }}
        >
          حفظ المشاريع
        </Button>
        {confirmDel ? (
          <>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                deleteEntry(entry.id);
                toast("تم حذف الإدخال", "info");
              }}
            >
              تأكيد الحذف
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDel(false)}>
              تراجع
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" className="text-bad hover:bg-bad-soft" onClick={() => setConfirmDel(true)}>
            <Trash2 className="size-4" />
            حذف الإدخال
          </Button>
        )}
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <Label htmlFor={`mv-${entry.id}`}>تصحيح رقم الهوية</Label>
        <div className="flex gap-2">
          <Input
            id={`mv-${entry.id}`}
            inputMode="numeric"
            dir="ltr"
            className="num text-center tracking-[0.15em]"
            placeholder="الرقم الصحيح"
            value={newId}
            onChange={(e) => {
              setNewId(normalizeDigits(e.target.value).slice(0, 9));
              setErr("");
            }}
          />
          <Button
            variant="secondary"
            size="lg"
            disabled={newId.length !== 9}
            onClick={() => {
              if (db.settings.checkDigit && !isValidNationalId(newId)) return setErr("رقم الهوية غير صالح — تأكد من الأرقام");
              const e = moveEntry(entry.id, newId);
              if (e) return setErr(e);
              toast(db.beneficiaries[newId] ? "نُقل الإدخال إلى الهوية الصحيحة المسجلة" : "تم تصحيح رقم الهوية");
              onMoved(newId);
            }}
          >
            <ArrowLeftRight className="size-4" />
            نقل
          </Button>
        </div>
        <FieldHint>إذا كان الرقم الصحيح مسجلاً، ينتقل هذا الإدخال إليه تلقائياً.</FieldHint>
        <FieldError>{err}</FieldError>
      </div>
    </div>
  );
}
