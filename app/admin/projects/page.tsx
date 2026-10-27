"use client";

import { ProjectOptionsButton, ProjectOptionsDialog } from "@/components/admin/project-options";
import { useBusy } from "@/lib/use-busy";
import { Spinner } from "@/components/ui/spinner";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Building2, Check, Plus } from "lucide-react";
import { PageHead } from "@/components/admin/bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckBox } from "@/components/ui/check";
import { Dialog } from "@/components/ui/dialog";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { CENTER_STYLE } from "@/components/shell/center-theme";
import { useStore } from "@/lib/store";
import { allProjects } from "@/lib/queries";
import { PALETTE, projectColor } from "@/lib/project-colors";
import type { CenterCode, Project } from "@/lib/types";
import { cn, todayKey } from "@/lib/utils";

/** لون الدور المميز للمشروع */
function ColorPicker({ color, name, onPick }: { color: string; name: string; onPick: (c: string) => void }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const open = Boolean(pos);
  const setOpen = (v: boolean) => !v && setPos(null);
  return (
    <div className="relative shrink-0">
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />}
      <button
        onClick={(e) => {
          if (open) return setOpen(false);
          const r = e.currentTarget.getBoundingClientRect();
          setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
        }}
        aria-label={`لون دور ${name}`}
        aria-expanded={open}
        title="لون الدور"
        className="focus-ring grid size-8 place-items-center rounded-lg border border-line bg-surface"
      >
        <span className="size-5 rounded-md" style={{ background: color }} />
      </button>
      {open && (
        <div className="fixed z-50 w-[188px] rounded-xl border border-line bg-surface p-2 shadow-pop" style={{ top: pos!.top, right: pos!.right }}>
          <div className="mb-1.5 px-1 text-xs font-semibold text-muted">لون الدور</div>
          <div className="grid grid-cols-5 gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => {
                  onPick(c);
                  setOpen(false);
                }}
                aria-label={c}
                className={cn("grid size-8 place-items-center rounded-lg", c === color && "ring-2 ring-ink ring-offset-2")}
                style={{ background: c }}
              >
                {c === color && <Check className="size-4 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** الشاشة 9 — المشاريع والمراكز */
export default function ProjectsPage() {
  const { db, saveProject, moveProject, renameCenter } = useStore();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [options, setOptions] = useState<Project | null>(null);
  const list = allProjects(db);
  const month = todayKey().slice(0, 7);
  const monthCounts = useMemo(() => {
    const m = new Map<string, number>();
    db.entries.forEach((e) => e.date.startsWith(month) && e.kind === "POINT" && e.projects.forEach((p) => m.set(p, (m.get(p) ?? 0) + 1)));
    return m;
  }, [db.entries, month]);
  const staffCount = (code: string) => db.users.filter((u) => u.projects.includes(code) && u.active).length;

  /** حفظ مع رسالة نجاح أو خطأ */
  const { busy, run } = useBusy();
  const save = (p: Project, ok: string | undefined, key: string) =>
    run(key, async () => {
      const e = await saveProject(p);
      if (e) toast(e, "bad");
      else if (ok) toast(ok);
    });
  const move = (code: string, dir: -1 | 1) => run(`${code}:${dir}`, () => moveProject(code, dir));

  const toggleCenter = (p: Project, c: CenterCode) => {
    const centers = p.centers.includes(c) ? p.centers.filter((x) => x !== c) : [...p.centers, c];
    if (!centers.length) return toast("المشروع يجب أن يظهر في مركز واحد على الأقل", "bad");
    void save({ ...p, centers }, undefined, `${p.code}:${c}`);
  };

  return (
    <>
      <PageHead
        title="المشاريع والمراكز"
        sub="ترتيب المشاريع هنا هو ترتيبها في مربعات الاختيار عند الموظفين. لون كل مشروع يميّز أرقام دوره في كل الشاشات"
        actions={
          <Button size="lg" onClick={() => setAdding(true)}>
            <Plus className="size-5" />
            مشروع جديد
          </Button>
        }
      />

      {/* بطاقات للجوال */}
      <div className="space-y-3 md:hidden">
        {list.map((p, i) => (
          <Card key={p.code} className={cn("p-4", !p.active && "bg-sunken/40")}>
            <div className="flex items-start gap-2">
              <ColorPicker color={projectColor(db, p.code)} name={p.name} onPick={(color) => save({ ...p, color }, `تم تغيير لون ${p.name}`, `${p.code}:color`)} />
              <div className="min-w-0 flex-1">
                <NameCell project={p} saving={busy === `${p.code}:name`} onSave={(name) => save({ ...p, name }, "تم حفظ اسم المشروع", `${p.code}:name`)} />
                <code className="mt-0.5 block px-2 text-start text-[11px] text-muted">{p.code}</code>
                <div className="mt-1.5 px-1">
                  <ProjectOptionsButton project={p} onOpen={() => setOptions(p)} />
                </div>
              </div>
              <Switch
                checked={p.active}
                onChange={(v) => {
                  void save({ ...p, active: v }, v ? `تم تفعيل ${p.name}` : `تم إيقاف ${p.name}. يختفي من الاختيار ويبقى في السجلات`, `${p.code}:active`);
                }}
                loading={busy === `${p.code}:active`}
                label={`تفعيل ${p.name}`}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {db.centers.map((c) => (
                <button
                  key={c.code}
                  role="checkbox"
                  aria-checked={p.centers.includes(c.code)}
                  onClick={() => toggleCenter(p, c.code)}
                  disabled={busy === `${p.code}:${c.code}`}
                  className={cn(
                    "focus-ring inline-flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm font-bold",
                    p.centers.includes(c.code) ? "border-brand bg-brand-soft text-brand" : "border-line text-muted",
                  )}
                >
                  {busy === `${p.code}:${c.code}` ? (
                    <Spinner className="size-4 text-brand" />
                  ) : (
                    <span className={cn("grid size-4 place-items-center rounded border-2", p.centers.includes(c.code) ? "border-brand bg-brand text-white" : "border-line")}>
                      {p.centers.includes(c.code) && <Check className="size-3" strokeWidth={3} />}
                    </span>
                  )}
                  {c.short}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-xs text-muted">
              <span>
                موظفو النقطة <b className="num text-ink">{staffCount(p.code)}</b> · خدمات الشهر <b className="num text-ink">{monthCounts.get(p.code) ?? 0}</b>
              </span>
              <span className="flex gap-1">
                <button disabled={i === 0 || busy !== null} onClick={() => move(p.code, -1)} className="focus-ring grid size-9 place-items-center rounded-lg border border-line disabled:opacity-30" aria-label={`رفع ${p.name}`}>
                  {busy === `${p.code}:-1` ? <Spinner className="size-4" /> : <ArrowUp className="size-4" />}
                </button>
                <button disabled={i === list.length - 1 || busy !== null} onClick={() => move(p.code, 1)} className="focus-ring grid size-9 place-items-center rounded-lg border border-line disabled:opacity-30" aria-label={`إنزال ${p.name}`}>
                  {busy === `${p.code}:1` ? <Spinner className="size-4" /> : <ArrowDown className="size-4" />}
                </button>
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-sunken/70 text-xs text-muted">
              <tr>
                <th className="w-20 px-4 py-3 text-start font-semibold">الترتيب</th>
                <th className="px-3 py-3 text-start font-semibold">المشروع</th>
                {db.centers.map((c) => (
                  <th key={c.code} className="px-3 py-3 text-center font-semibold">
                    يظهر في {c.short}
                  </th>
                ))}
                <th className="px-3 py-3 text-center font-semibold">موظفو النقطة</th>
                <th className="px-3 py-3 text-center font-semibold">خدمات الشهر</th>
                <th className="px-3 py-3 text-center font-semibold">مفعّل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {list.map((p, i) => (
                <tr key={p.code} className={cn(!p.active && "bg-sunken/40")}>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <button
                        disabled={i === 0 || busy !== null}
                        onClick={() => move(p.code, -1)}
                        className="focus-ring grid size-8 place-items-center rounded-lg border border-line hover:bg-sunken disabled:opacity-30"
                        aria-label={`رفع ${p.name}`}
                      >
                        {busy === `${p.code}:-1` ? <Spinner className="size-4" /> : <ArrowUp className="size-4" />}
                      </button>
                      <button
                        disabled={i === list.length - 1 || busy !== null}
                        onClick={() => move(p.code, 1)}
                        className="focus-ring grid size-8 place-items-center rounded-lg border border-line hover:bg-sunken disabled:opacity-30"
                        aria-label={`إنزال ${p.name}`}
                      >
                        {busy === `${p.code}:1` ? <Spinner className="size-4" /> : <ArrowDown className="size-4" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <ColorPicker color={projectColor(db, p.code)} name={p.name} onPick={(color) => save({ ...p, color }, `تم تغيير لون ${p.name}`, `${p.code}:color`)} />
                      <div className="min-w-0 flex-1">
                        <NameCell project={p} saving={busy === `${p.code}:name`} onSave={(name) => save({ ...p, name }, "تم حفظ اسم المشروع", `${p.code}:name`)} />
                        <span className="mt-0.5 flex flex-wrap items-center gap-2">
                          <code className="text-start text-[11px] text-muted">{p.code}</code>
                          <ProjectOptionsButton project={p} onOpen={() => setOptions(p)} />
                        </span>
                      </div>
                    </div>
                  </td>
                  {db.centers.map((c) => (
                    <td key={c.code} className="px-3 py-2.5 text-center">
                      <button
                        role="checkbox"
                        aria-checked={p.centers.includes(c.code)}
                        aria-label={`${p.name} في ${c.name}`}
                        onClick={() => toggleCenter(p, c.code)}
                        disabled={busy === `${p.code}:${c.code}`}
                        className={cn(
                          "focus-ring relative mx-auto grid size-7 place-items-center rounded-md border-2 after:absolute after:-inset-2",
                          p.centers.includes(c.code) ? "border-brand bg-brand text-white" : "border-line",
                        )}
                      >
                        {busy === `${p.code}:${c.code}` ? (
                          <Spinner className={cn("size-4", !p.centers.includes(c.code) && "text-brand")} />
                        ) : (
                          p.centers.includes(c.code) && <Check className="size-4" strokeWidth={3} />
                        )}
                      </button>
                    </td>
                  ))}
                  <td className="num px-3 py-2.5 text-center font-semibold">{staffCount(p.code)}</td>
                  <td className="num px-3 py-2.5 text-center font-semibold">{monthCounts.get(p.code) ?? 0}</td>
                  <td className="px-3 py-2.5 text-center">
                    <Switch
                      checked={p.active}
                      onChange={(v) => {
                        void save({ ...p, active: v }, v ? `تم تفعيل ${p.name}` : `تم إيقاف ${p.name}. يختفي من الاختيار ويبقى في السجلات`, `${p.code}:active`);
                      }}
                      loading={busy === `${p.code}:active`}
                      label={`تفعيل ${p.name}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <h2 className="mb-3 mt-10 text-lg font-bold">المراكز</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {db.centers.map((c) => (
          <CenterCard
            key={c.code}
            code={c.code}
            name={c.name}
            saving={busy === `center:${c.code}`}
            onSave={(n) =>
              run(`center:${c.code}`, async () => {
                await renameCenter(c.code, n);
                toast("تم حفظ اسم المركز");
              })
            }
          />
        ))}
      </div>

      <AddProjectDialog open={adding} onClose={() => setAdding(false)} />
      <ProjectOptionsDialog project={options ? db.projects.find((x) => x.code === options.code) ?? null : null} onClose={() => setOptions(null)} />
    </>
  );
}

function NameCell({ project, onSave, saving }: { project: Project; onSave: (name: string) => void; saving?: boolean }) {
  const [v, setV] = useState(project.name);
  const dirty = v.trim() !== project.name && v.trim();
  return (
    <div className="flex items-center gap-2">
      <input
        aria-label="اسم المشروع"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && dirty && onSave(v.trim())}
        className="h-9 w-full max-w-[220px] rounded-lg border border-transparent bg-transparent px-2 font-bold hover:border-line focus:border-brand focus:bg-surface focus:outline-hidden"
      />
      {(dirty || saving) && (
        <Button size="sm" loading={saving} onClick={() => onSave(v.trim())}>
          حفظ
        </Button>
      )}
    </div>
  );
}

function CenterCard({ code, name, onSave, saving }: { code: CenterCode; name: string; onSave: (n: string) => void; saving?: boolean }) {
  const [v, setV] = useState(name);
  const st = CENTER_STYLE[code];
  return (
    <Card className="relative overflow-hidden p-5">
      <span className={cn("absolute inset-y-0 start-0 w-1.5", st.strip)} />
      <div className="flex items-center gap-3">
        <span className={cn("grid size-11 place-items-center rounded-xl", st.soft, st.text)}>
          <Building2 className="size-6" />
        </span>
        <div className="flex-1">
          <Label htmlFor={`c-${code}`}>اسم المركز</Label>
          <div className="flex gap-2">
            <Input id={`c-${code}`} value={v} onChange={(e) => setV(e.target.value)} />
            <Button variant="secondary" size="lg" disabled={!v.trim() || v.trim() === name} loading={saving} onClick={() => onSave(v)}>
              حفظ
            </Button>
          </div>
          <FieldHint>
            الرمز <code className="ltr">{code}</code> · لون المركز ثابت في الواجهة
          </FieldHint>
        </div>
      </div>
    </Card>
  );
}

function AddProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, saveProject } = useStore();
  const toast = useToast();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [centers, setCenters] = useState<CenterCode[]>(["GAZA", "KHY"]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    const c = code.trim().toUpperCase();
    if (!name.trim()) return setErr("اكتب اسم المشروع");
    if (!/^[A-Z0-9_]{2,12}$/.test(c)) return setErr("الرمز من 2 إلى 12 حرفاً إنجليزياً كبيراً أو أرقام");
    if (db.projects.some((p) => p.code === c)) return setErr("هذا الرمز مستخدم لمشروع آخر");
    if (!centers.length) return setErr("اختر مركزاً واحداً على الأقل");
    setBusy(true);
    const e = await saveProject({ code: c, name: name.trim(), active: true, order: db.projects.length + 1, centers });
    setBusy(false);
    if (e) return setErr(e);
    toast(`تمت إضافة ${name.trim()}`);
    setName("");
    setCode("");
    setErr("");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="مشروع جديد"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>
            إلغاء
          </Button>
          <Button size="lg" onClick={submit} loading={busy} loadingText="جارٍ الإضافة…">
            إضافة المشروع
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="np-name" required>
            اسم المشروع كما يظهر للموظفين
          </Label>
          <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="np-code" required>
            الرمز
          </Label>
          <Input id="np-code" dir="ltr" className="text-start uppercase" placeholder="مثال: IMC" value={code} onChange={(e) => setCode(e.target.value)} />
          <FieldHint>يُستخدم في التقارير وملفات Excel، ولا يتغير بعد الإضافة</FieldHint>
        </div>
        <div>
          <Label>يظهر في</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {db.centers.map((c) => (
              <CheckBox
                key={c.code}
                checked={centers.includes(c.code)}
                onChange={() => setCenters((l) => (l.includes(c.code) ? l.filter((x) => x !== c.code) : [...l, c.code]))}
              >
                {c.name}
              </CheckBox>
            ))}
          </div>
        </div>
        <FieldError>{err}</FieldError>
      </div>
    </Dialog>
  );
}
