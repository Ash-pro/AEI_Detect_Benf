"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { PageHead } from "@/components/admin/bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { userName } from "@/lib/queries";
import type { Settings } from "@/lib/types";
import { dayNum, dateKey, formatTime } from "@/lib/utils";

/** الشاشة 11 — الإعدادات */
export default function SettingsPage() {
  const { db, saveSettings, resetDemo } = useStore();
  const toast = useToast();
  const [s, setS] = useState<Settings>(db.settings);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => setS(db.settings), [db.settings]);
  const dirty = JSON.stringify(s) !== JSON.stringify(db.settings);

  return (
    <>
      <PageHead
        title="الإعدادات"
        actions={
          <Button
            size="lg"
            disabled={!dirty}
            onClick={() => {
              saveSettings({ ...s, idleMinutes: Math.min(Math.max(Number(s.idleMinutes) || 30, 5), 240) });
              toast("تم حفظ الإعدادات");
            }}
          >
            حفظ الإعدادات
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-5 p-5">
          <h2 className="text-lg font-bold">التلميحات</h2>
          <div>
            <Label htmlFor="h-r">تلميح موظف الاستقبال</Label>
            <Textarea id="h-r" value={s.hintReception} onChange={(e) => setS({ ...s, hintReception: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="h-p">تلميح موظف النقطة</Label>
            <Textarea id="h-p" value={s.hintPoint} onChange={(e) => setS({ ...s, hintPoint: e.target.value })} />
          </div>
          <FieldHint>يظهر التلميح أعلى شاشة الإدخال لكل موظف حسب نوع حسابه.</FieldHint>
        </Card>

        <Card className="space-y-5 p-5">
          <h2 className="text-lg font-bold">الأمان</h2>
          <div>
            <Label htmlFor="idle">الخروج التلقائي بعد عدم النشاط (دقيقة)</Label>
            <Input id="idle" type="number" dir="ltr" min={5} max={240} className="num max-w-[160px] text-start" value={s.idleMinutes} onChange={(e) => setS({ ...s, idleMinutes: Number(e.target.value) })} />
          </div>
          <FieldHint>رقم الهوية: الشرط الوحيد أن يكون 9 أرقام بالضبط.</FieldHint>
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-line px-5 py-4">
            <History className="size-5 text-muted" />
            <h2 className="text-lg font-bold">سجل التغييرات</h2>
          </div>
          {db.changes.length ? (
            <ul className="max-h-[360px] divide-y divide-line/60 overflow-y-auto">
              {db.changes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                  <span className="num w-[92px] font-semibold">
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

        <Card className="flex flex-wrap items-center justify-between gap-4 border-dashed p-5 lg:col-span-2">
          <div>
            <h2 className="font-bold">البيانات التجريبية</h2>
            <p className="text-sm text-muted">إرجاع كل المستخدمين والمشاريع والإدخالات إلى بيانات العرض الأصلية. خاص بنسخة التصميم.</p>
          </div>
          {confirmReset ? (
            <div className="flex gap-2">
              <Button
                variant="danger"
                onClick={() => {
                  resetDemo();
                  setConfirmReset(false);
                  toast("تمت إعادة البيانات التجريبية");
                }}
              >
                تأكيد الإعادة
              </Button>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                إلغاء
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="size-4" />
              إعادة البيانات التجريبية
            </Button>
          )}
        </Card>
      </div>
    </>
  );
}
