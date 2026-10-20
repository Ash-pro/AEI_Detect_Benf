"use client";

import { useMemo, useRef, useState } from "react";
import { Baby, Link2, Plus, User, UserRound, UserPlus, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import type { Db, ProjectCode } from "@/lib/types";
import { PROJECTS } from "@/lib/mock-data";
import { cn, isValidPhone, nameParts, normalizeArabicName, normalizeDigits, normalizePhone } from "@/lib/utils";

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  mother: UserRound,
  father: User,
  child: Baby,
};

export interface NewBeneficiaryValues {
  typeId: string;
  newTypeName?: string;
  name: string;
  phone: string;
  birthDate?: string;
  projects: ProjectCode[];
  householdId?: string;
}

/** S1 — تسجيل حالة جديدة + الزيارة الأولى */
export function NewBeneficiaryForm({
  nationalId,
  db,
  onCancel,
  onSubmit,
}: {
  nationalId: string;
  db: Db;
  onCancel: () => void;
  onSubmit: (v: NewBeneficiaryValues) => void;
}) {
  const [typeId, setTypeId] = useState("");
  const [otherType, setOtherType] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState("");
  const [projects, setProjects] = useState<Set<ProjectCode>>(new Set());
  const [linkFamily, setLinkFamily] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const systemTypes = db.identityTypes.filter((t) => t.isSystem);
  const customTypes = db.identityTypes.filter((t) => !t.isSystem);
  const isOther = typeId === "__other";

  const suggestions = useMemo(() => {
    const q = normalizeArabicName(otherType);
    if (!q) return customTypes;
    return db.identityTypes.filter((t) => normalizeArabicName(t.name).includes(q) || q.includes(normalizeArabicName(t.name)));
  }, [otherType, db.identityTypes, customTypes]);

  const phoneMatches = useMemo(() => {
    if (!isValidPhone(phone)) return [];
    const n = normalizePhone(phone);
    return db.beneficiaries.filter((b) => normalizePhone(b.phone) === n);
  }, [phone, db.beneficiaries]);

  const isChild = typeId === "child";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!typeId || (isOther && !otherType.trim())) er.type = "اختر نوع الهوية";
    if (nameParts(name) < 3) er.name = "اكتب الاسم ثلاثياً على الأقل";
    if (!isValidPhone(phone)) er.phone = "رقم جوال غير صحيح — مثال: 0599123456";
    if (projects.size === 0) er.projects = "اختر مشروعاً واحداً على الأقل";
    setErrors(er);
    if (er.name) return nameRef.current?.focus();
    if (er.phone) return phoneRef.current?.focus();
    if (Object.keys(er).length) return;

    const household = linkFamily ? phoneMatches.find((b) => b.householdId)?.householdId ?? (phoneMatches[0] ? `h-${phoneMatches[0].id}` : undefined) : undefined;
    onSubmit({
      typeId: isOther ? "" : typeId,
      newTypeName: isOther ? otherType.trim() : undefined,
      name: name.replace(/\s+/g, " ").trim(),
      phone: normalizePhone(phone),
      birthDate: isChild ? birth || undefined : undefined,
      projects: Array.from(projects),
      householdId: household,
    });
  }

  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line bg-brand-soft/50 px-5 py-4">
        <span className="grid size-11 place-items-center rounded-xl bg-brand text-brand-ink">
          <UserPlus className="size-6" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold">حالة جديدة</h2>
          <p className="text-sm text-muted">
            الهوية <span className="num font-bold text-ink">{nationalId}</span> غير مسجلة. أكمل البيانات لتسجيل الزيارة الأولى.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-6 p-5" noValidate>
        {/* نوع الهوية */}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            نوع الهوية <span className="text-bad">*</span>
          </legend>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="radiogroup">
            {systemTypes.map((t) => {
              const Icon = TYPE_ICONS[t.id] ?? User;
              const on = typeId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setTypeId(t.id);
                    setErrors((e) => ({ ...e, type: "" }));
                  }}
                  className={cn(
                    "focus-ring flex h-[72px] flex-col items-center justify-center gap-1 rounded-xl border-2 text-base font-bold transition",
                    on ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-muted/40",
                  )}
                >
                  <Icon className="size-6" />
                  {t.name}
                </button>
              );
            })}
            <button
              type="button"
              role="radio"
              aria-checked={isOther}
              onClick={() => setTypeId("__other")}
              className={cn(
                "focus-ring flex h-[72px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-base font-bold transition",
                isOther ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:border-muted/40",
              )}
            >
              <Plus className="size-6" />
              أخرى
            </button>
          </div>
          {isOther && (
            <div className="mt-3 animate-fade-up">
              <Input
                autoFocus
                placeholder="اكتب النوع — مثال: جدة"
                value={otherType}
                onChange={(e) => setOtherType(e.target.value)}
              />
              {suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">موجود مسبقاً:</span>
                  {suggestions.map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => {
                        if (t.isSystem) {
                          setTypeId(t.id);
                          setOtherType("");
                        } else setOtherType(t.name);
                      }}
                      className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold hover:bg-sunken"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
              <FieldHint>اختر من الموجود إن وُجد لتجنب التكرار. النوع الجديد يظهر للأدمن للمراجعة.</FieldHint>
            </div>
          )}
          <FieldError>{errors.type}</FieldError>
        </fieldset>

        {/* الاسم والجوال */}
        <div className="grid gap-4 sm:grid-cols-5">
          <div className="sm:col-span-3">
            <Label htmlFor="name" required>
              الاسم
            </Label>
            <Input
              id="name"
              ref={nameRef}
              value={name}
              invalid={Boolean(errors.name)}
              placeholder="الاسم الرباعي"
              onChange={(e) => {
                setName(e.target.value);
                setErrors((x) => ({ ...x, name: "" }));
              }}
            />
            {errors.name ? <FieldError>{errors.name}</FieldError> : <FieldHint>الاسم الرباعي مفضّل</FieldHint>}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="phone" required>
              الجوال
            </Label>
            <Input
              id="phone"
              ref={phoneRef}
              inputMode="tel"
              dir="ltr"
              className="num text-start"
              placeholder="059xxxxxxx"
              value={phone}
              invalid={Boolean(errors.phone)}
              onChange={(e) => {
                setPhone(normalizeDigits(e.target.value).slice(0, 13));
                setErrors((x) => ({ ...x, phone: "" }));
              }}
            />
            <FieldError>{errors.phone}</FieldError>
          </div>
        </div>

        {phoneMatches.length > 0 && (
          <div className="animate-fade-up rounded-xl border border-info/25 bg-info-soft/60 p-4">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 size-5 shrink-0 text-info" />
              <div className="flex-1">
                <p className="text-sm font-bold text-info">هذا الرقم مسجل لـ:</p>
                <ul className="mt-1.5 flex flex-wrap gap-2">
                  {phoneMatches.map((b) => (
                    <li key={b.id} className="rounded-lg bg-surface px-2.5 py-1 text-sm">
                      <span className="font-semibold">{b.name.split(" ").slice(0, 2).join(" ")}</span>{" "}
                      <span className="text-muted">({db.identityTypes.find((t) => t.id === b.typeId)?.name})</span>
                    </li>
                  ))}
                </ul>
                <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={linkFamily}
                    onChange={(e) => setLinkFamily(e.target.checked)}
                    className="size-5 accent-brand"
                  />
                  <Link2 className="size-4 text-muted" />
                  ربط بنفس العائلة
                </label>
              </div>
            </div>
          </div>
        )}

        {isChild && (
          <div className="max-w-xs animate-fade-up">
            <Label htmlFor="birth">تاريخ الميلاد</Label>
            <Input id="birth" type="date" dir="ltr" className="num text-start" value={birth} onChange={(e) => setBirth(e.target.value)} />
            <FieldHint>اختياري</FieldHint>
          </div>
        )}

        {/* المشاريع */}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            التحويل إلى <span className="text-bad">*</span>
            <span className="ms-2 font-normal text-muted">يمكن اختيار أكثر من مشروع</span>
          </legend>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {PROJECTS.map((p) => (
              <Chip
                key={p.code}
                selected={projects.has(p.code)}
                onToggle={() => {
                  setProjects((s) => {
                    const n = new Set(s);
                    n.has(p.code) ? n.delete(p.code) : n.add(p.code);
                    return n;
                  });
                  setErrors((x) => ({ ...x, projects: "" }));
                }}
              >
                {p.name}
              </Chip>
            ))}
          </div>
          <FieldError>{errors.projects}</FieldError>
        </fieldset>

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row">
          <Button variant="secondary" size="lg" onClick={onCancel}>
            إلغاء
          </Button>
          <Button type="submit" size="lg" className="flex-1">
            تسجيل الحالة والزيارة الأولى
            {projects.size > 0 && <span className="num rounded-md bg-white/20 px-1.5 text-sm">{projects.size}</span>}
          </Button>
        </div>
      </form>
    </Card>
  );
}
