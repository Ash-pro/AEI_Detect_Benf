"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { KeyRound, MoreVertical, Pencil, Power, Trash2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const MENU_W = 240;

/** قائمة خيارات المستخدم: نافذة عائمة فوق الصفحة (لا تُقص داخل الجدول)، وورقة سفلية على الجوال */
export function RowMenu({
  onView,
  onEdit,
  onReset,
  onToggle,
  onDelete,
  active,
  manage = true,
  title,
  sub,
}: {
  onView: () => void;
  onEdit: () => void;
  onReset: () => void;
  onToggle: () => void;
  onDelete: () => void;
  active: boolean;
  manage?: boolean;
  title: string;
  sub: string;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const [sheet, setSheet] = useState(false);
  const open = Boolean(pos) || sheet;

  function toggle() {
    if (open) return close();
    if (window.innerWidth < 640) return setSheet(true);
    const r = btn.current!.getBoundingClientRect();
    const h = manage ? 350 : 140;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - MENU_W - 8);
    if (vh - r.bottom >= h + 12) setPos({ top: r.bottom + 6, left, up: false });
    else if (r.top >= h + 12) setPos({ top: r.top - 6, left, up: true });
    // لا مساحة كافية فوق أو تحت: داخل الشاشة بجانب الزر
    else setPos({ top: Math.max(8, vh - h - 8), left: Math.max(8, r.left - MENU_W - 8), up: false });
  }
  function close() {
    setPos(null);
    setSheet(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || btn.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        btn.current?.focus();
      }
    };
    const onMove = () => !sheet && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>("button")?.focus());
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, sheet]);

  const run = (fn: () => void) => () => {
    close();
    fn();
  };
  const item = "focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm font-semibold transition hover:bg-sunken";
  const icon = "grid size-8 shrink-0 place-items-center rounded-lg bg-sunken text-muted";

  const content = (
    <>
      <div className="flex items-center gap-3 border-b border-line px-3 pb-2.5 pt-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand">{title.trim()[0]}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">{title}</span>
          <span className="ltr block truncate text-start text-xs text-muted">{sub}</span>
        </span>
      </div>
      <div className="space-y-0.5 p-1.5">
        <button role="menuitem" className={item} onClick={run(onView)}>
          <span className={icon}><UserRound className="size-4" /></span>
          عرض التفاصيل
        </button>
        {manage && (
          <>
            <button role="menuitem" className={item} onClick={run(onEdit)}>
              <span className={icon}><Pencil className="size-4" /></span>
              تعديل البيانات والصلاحيات
            </button>
            <button role="menuitem" className={item} onClick={run(onReset)}>
              <span className={icon}><KeyRound className="size-4" /></span>
              كلمة مرور جديدة
            </button>
            <button role="menuitem" className={item} onClick={run(onToggle)}>
              <span className={cn(icon, active ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok")}><Power className="size-4" /></span>
              {active ? "إيقاف الحساب" : "تفعيل الحساب"}
            </button>
          </>
        )}
      </div>
      {manage && (
        <div className="border-t border-line p-1.5">
          <button role="menuitem" className={cn(item, "text-bad hover:bg-bad-soft")} onClick={run(onDelete)}>
            <span className={cn(icon, "bg-bad-soft text-bad")}><Trash2 className="size-4" /></span>
            حذف الحساب
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      <button
        ref={btn}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`خيارات ${title}`}
        className={cn(
          "focus-ring grid size-9 place-items-center rounded-lg border text-muted transition",
          open ? "border-brand bg-brand-soft text-brand" : "border-transparent hover:border-line hover:bg-sunken hover:text-ink",
        )}
      >
        <MoreVertical className="size-4" />
      </button>

      {pos &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            className="fixed z-[60] animate-fade-in rounded-2xl border border-line bg-surface shadow-pop"
            style={{ left: pos.left, width: MENU_W, maxHeight: "calc(100vh - 16px)", overflowY: "auto", ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
          >
            {content}
          </div>,
          document.body,
        )}

      {sheet &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-end bg-ink/40 animate-fade-in" onClick={close}>
            <div
              ref={panel}
              role="menu"
              onClick={(e) => e.stopPropagation()}
              className="w-full animate-fade-up rounded-t-3xl bg-surface pb-[max(12px,env(safe-area-inset-bottom))] pt-2 shadow-pop"
            >
              <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line" aria-hidden />
              {content}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
