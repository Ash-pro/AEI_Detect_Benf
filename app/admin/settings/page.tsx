"use client";

import { useEffect, useMemo, useState } from "react";
import { History, Lightbulb, ShieldCheck } from "lucide-react";
import { FilterSelect, PageHead, ResetFilters, SearchBox, SectionHead, TableToolbar } from "@/components/admin/bits";
import { SiteModeCard } from "@/components/admin/site-mode-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { userName } from "@/lib/queries";
import type { Settings } from "@/lib/types";
import { dayNum, dateKey, formatTime, normalizeArabicName, normalizeDigits } from "@/lib/utils";

/** الشاشة 11 — الإعدادات */
export default function SettingsPage() {
  const { db, saveSettings } = useStore();
  const toast = useToast();
  const [s, setS] = useState<Settings>(db.settings);
  useEffect(() => setS(db.settings), [db.settings]);
  const dirty = JSON.stringify(s) !== JSON.stringify(db.settings);
  // الحقول التي تغيّرت ولم تُحفظ بعد
  const changed = (k: keyof Settings) => String(s[k]) !== String(db.settings[k]);
  const changedCount = (["hintReception", "hintPoint", "idleMinutes"] as const).filter(changed).length;
  const [saving, setSaving] = useState(false);
  // فلاتر سجل التغييرات
  const [cq, setCq] = useState("");
  const [cAction, setCAction] = useState("ALL");
  const [cUser, setCUser] = useState("ALL");
  const actions = useMemo(() => [...new Set(db.changes.map((c) => c.action))].sort((a, b) => a.localeCompare(b, "ar")), [db.changes]);
  const actors = useMemo(
    () => [...new Set(db.changes.map((c) => c.userId))].map((id) => ({ value: id, label: userName(db, id) })).sort((a, b) => a.label.localeCompare(b.label, "ar")),
    [db],
  );
  const changes = useMemo(() => {
    const term = normalizeArabicName(normalizeDigits(cq) || cq);
    return db.changes
      .filter((c) => cAction === "ALL" || c.action === cAction)
      .filter((c) => cUser === "ALL" || c.userId === cUser)
      .filter((c) => !cq.trim() || normalizeArabicName(c.detail).includes(term) || c.detail.includes(cq.trim()));
  }, [db.changes, cq, cAction, cUser]);
  const cFiltering = Boolean(cq.trim()) || cAction !== "ALL" || cUser !== "ALL";
  async function save() {
    setSaving(true);
    const e = await saveSettings({ ...s, idleMinutes: Math.min(Math.max(Number(s.idleMinutes) || 30, 5), 240) });
    setSaving(false);
    toast(e ?? "تم حفظ الإعدادات", e ? "bad" : "ok");
  }

  return (
    <>
      <PageHead title="الإعدادات" sub="وضع الموقع والتلميحات والأمان وسجل التغييرات" />

      <div className="grid gap-6 lg:grid-cols-2">
        <SiteModeCard />

        <Card className="overflow-hidden">
          <SectionHead title="التلميحات" icon={Lightbulb} sub="تظهر أعلى شاشة الإدخال لكل موظف حسب نوع حسابه" />
          <div className="space-y-5 p-4 sm:p-5">
          <div>
            <Label htmlFor="h-r">
              تلميح موظف الاستقبال {changed("hintReception") && <ChangedTag />}
            </Label>
            <Textarea id="h-r" rows={4} value={s.hintReception} onChange={(e) => setS({ ...s, hintReception: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="h-p">
              تلميح موظف النقطة {changed("hintPoint") && <ChangedTag />}
            </Label>
            <Textarea id="h-p" rows={4} value={s.hintPoint} onChange={(e) => setS({ ...s, hintPoint: e.target.value })} />
          </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <SectionHead title="الأمان" icon={ShieldCheck} />
          <div className="space-y-5 p-4 sm:p-5">
          <div>
            <Label htmlFor="idle">
              الخروج التلقائي بعد عدم النشاط (دقيقة) {changed("idleMinutes") && <ChangedTag />}
            </Label>
            <Input id="idle" type="number" dir="ltr" min={5} max={240} className="num max-w-[160px] text-start" value={s.idleMinutes} onChange={(e) => setS({ ...s, idleMinutes: Number(e.target.value) })} />
          </div>
            <FieldHint>بعد هذه المدة بدون أي نشاط يُسجَّل خروج الموظف تلقائياً (من 5 إلى 240 دقيقة).</FieldHint>
            <FieldHint>رقم الهوية: الشرط الوحيد أن يكون 9 أرقام بالضبط.</FieldHint>
          </div>
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-line px-5 py-4">
            <History className="size-5 text-muted" />
            <h2 className="text-lg font-bold">سجل التغييرات</h2>
            {cFiltering && <span className="num ms-auto text-xs font-semibold text-brand">{changes.length} من {db.changes.length}</span>}
          </div>
          {db.changes.length > 0 && (
            <TableToolbar>
              <SearchBox value={cq} onChange={setCq} placeholder="بحث في التفاصيل (هوية، اسم، مشروع)" />
              <FilterSelect label="نوع التغيير" value={cAction} all="ALL" onChange={setCAction} options={[{ value: "ALL", label: "كل التغييرات" }, ...actions.map((a) => ({ value: a, label: a }))]} className="max-w-[200px]" />
              <FilterSelect label="بواسطة" value={cUser} all="ALL" onChange={setCUser} options={[{ value: "ALL", label: "كل المستخدمين" }, ...actors]} className="max-w-[200px]" />
              <ResetFilters
                show={cFiltering}
                onClick={() => {
                  setCq("");
                  setCAction("ALL");
                  setCUser("ALL");
                }}
              />
            </TableToolbar>
          )}
          {db.changes.length && !changes.length ? (
            <p className="px-5 py-10 text-center text-sm text-muted">لا توجد تغييرات مطابقة للفلاتر</p>
          ) : db.changes.length ? (
            <ul className="max-h-[360px] divide-y divide-line/60 overflow-y-auto">
              {changes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                  <span className="num w-[110px] whitespace-nowrap font-semibold">
                    {dayNum(dateKey(c.at))} <span className="text-muted">{formatTime(c.at)}</span>
                  </span>
                  <span className="rounded-md bg-sunken px-2 py-0.5 text-xs font-bold">{c.action}</span>
                  <span className="flex-1">{c.detail}</span>
                  <span className="text-xs text-muted">{userName(db, c.userId)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted">لا توجد تغييرات بعد. أي تعديل أو حذف من الموظفين أو الأدمن يظهر هنا.</p>
          )}
        </Card>

      </div>

      {/* شريط الحفظ يظهر فقط عند وجود تغييرات */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-6 lg:ps-[248px]">
          <div className="mx-auto flex max-w-3xl animate-fade-up flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-pop">
            <span className="flex-1 text-sm font-bold">
              لديك تغييرات غير محفوظة{changedCount > 1 && <span className="num font-semibold text-muted"> · {changedCount} حقول</span>}
            </span>
            <Button variant="secondary" onClick={() => setS(db.settings)} disabled={saving}>
              تراجع
            </Button>
            <Button onClick={save} loading={saving} loadingText="جارٍ الحفظ…">
              حفظ الإعدادات
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function ChangedTag() {
  return <span className="ms-1.5 rounded-md bg-warn-soft px-1.5 py-0.5 text-xs font-bold text-warn">معدّل</span>;
}
