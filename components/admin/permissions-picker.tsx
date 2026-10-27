"use client";

import {
  BarChart3,
  CalendarDays,
  CopyCheck,
  FileSpreadsheet,
  FolderKanban,
  LayoutDashboard,
  type LucideIcon,
  PencilLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PERM_GROUPS, PERM_PRESETS, PERMS, type Perm } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const ICONS: Record<Perm, LucideIcon> = {
  home: LayoutDashboard,
  days: CalendarDays,
  beneficiaries: Search,
  reports: BarChart3,
  overlap: CopyCheck,
  export: FileSpreadsheet,
  edit_entries: PencilLine,
  users: Users,
  projects: FolderKanban,
};

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** اختيار صلاحيات المشرف: قوالب جاهزة + مفتاح لكل صلاحية */
export function PermissionsPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (k: Perm, on: boolean) => onChange(on ? [...new Set([...value, k])] : value.filter((x) => x !== k));

  return (
    <fieldset className="overflow-hidden rounded-2xl border border-line">
      <legend className="sr-only">صلاحيات المشرف</legend>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-sunken/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-brand" />
          <span className="font-bold">صلاحيات المشرف</span>
          <span className="num rounded-full bg-surface px-2 text-xs font-bold leading-5">
            {value.length} من {PERMS.length}
          </span>
        </div>
        <span className="text-xs text-muted">تُطبَّق فوراً بعد الحفظ</span>
      </div>

      {/* قوالب سريعة */}
      <div className="grid grid-cols-3 gap-2 border-b border-line p-3">
        {PERM_PRESETS.map((p) => {
          const on = same(value, p.perms);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange([...p.perms])}
              aria-pressed={on}
              className={cn(
                "focus-ring rounded-xl border-2 px-2.5 py-2 text-start transition",
                on ? "border-brand bg-brand-soft" : "border-line hover:border-muted/40",
              )}
            >
              <span className={cn("block text-sm font-bold", on && "text-brand")}>{p.label}</span>
              <span className="block text-xs leading-snug text-muted">{p.desc}</span>
            </button>
          );
        })}
      </div>

      {PERM_GROUPS.map((g) => (
        <div key={g.id} className="border-b border-line last:border-0">
          <div className="px-4 pb-1 pt-3 text-xs font-bold tracking-wide text-muted">{g.label}</div>
          <ul>
            {PERMS.filter((p) => p.group === g.id).map((p) => {
              const Icon = ICONS[p.key];
              const on = value.includes(p.key);
              return (
                <li key={p.key}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-sunken/50">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl transition", on ? (p.sensitive ? "bg-warn-soft text-warn" : "bg-brand-soft text-brand") : "bg-sunken text-muted")}>
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                        {p.label}
                        {p.sensitive && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-warn-soft px-1.5 text-[11px] font-bold text-warn">
                            <ShieldAlert className="size-3" />
                            تعديل بيانات
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-muted">{p.desc}</span>
                    </span>
                    <Switch checked={on} onChange={(v) => toggle(p.key, v)} label={p.label} />
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {value.length === 0 && (
        <p className="border-t border-line bg-warn-soft/60 px-4 py-2.5 text-xs font-semibold text-warn">
          بدون أي صلاحية لن يرى المشرف أي صفحة بعد الدخول.
        </p>
      )}
    </fieldset>
  );
}

/** عرض مختصر للصلاحيات (في تفاصيل المستخدم والقائمة) */
export function PermissionChips({ value, max }: { value: string[]; max?: number }) {
  const list = PERMS.filter((p) => value.includes(p.key));
  if (!list.length) return <span className="text-xs font-semibold text-warn">بدون صلاحيات</span>;
  const shown = max ? list.slice(0, max) : list;
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((p) => {
        const Icon = ICONS[p.key];
        return (
          <span
            key={p.key}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold",
              p.sensitive ? "bg-warn-soft text-warn" : "bg-sunken text-ink/80",
            )}
          >
            <Icon className="size-3" />
            {p.label}
          </span>
        );
      })}
      {max && list.length > max && <span className="num rounded-md bg-sunken px-1.5 py-0.5 text-xs font-bold text-muted">+{list.length - max}</span>}
    </span>
  );
}
