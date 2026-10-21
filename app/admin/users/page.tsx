"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { KeyRound, MoreVertical, Pencil, Plus, Power, Search, Trash2, UserRound } from "lucide-react";
import { PageHead, Segmented } from "@/components/admin/bits";
import {
  DeleteUserDialog,
  ResetPasswordDialog,
  RoleBadge,
  UserDetailDialog,
  UserFormDialog,
} from "@/components/admin/user-dialogs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { canManageUser, isStaff } from "@/lib/roles";
import { centerName, lastActivity, projectName } from "@/lib/queries";
import type { CenterCode, Role, User } from "@/lib/types";
import { cn, formatTime, normalizeArabicName, sinceText, todayKey } from "@/lib/utils";

type RoleFilter = Role | "ALL";
type StatusFilter = "ALL" | "ACTIVE" | "OFF";
const ROLE_ORDER: Record<Role, number> = { ADMIN: 0, SUPERVISOR: 1, RECEPTION: 2, POINT: 3 };

/** الشاشة 8 — المستخدمون */
export default function UsersPage() {
  const { db, saveUser, user: me } = useStore();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [center, setCenter] = useState<CenterCode | "ALL">("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [viewing, setViewing] = useState<User | null>(null);

  const today = todayKey();
  const todayCounts = useMemo(() => {
    const m = new Map<string, number>();
    db.entries.forEach((e) => e.date === today && m.set(e.userId, (m.get(e.userId) ?? 0) + 1));
    return m;
  }, [db.entries, today]);

  const isSup = me?.role === "SUPERVISOR";
  // المشرف يرى كل المستخدمين ما عدا حسابات الأدمن
  const visibleUsers = useMemo(() => (isSup ? db.users.filter((u) => u.role !== "ADMIN") : db.users), [db.users, isSup]);
  const can = (u: User) => canManageUser(me?.role, u.role) && (me?.role === "ADMIN" || u.id !== me?.id);

  const users = useMemo(() => {
    const term = normalizeArabicName(q.toLowerCase());
    return visibleUsers
      .filter((u) => role === "ALL" || u.role === role)
      .filter((u) => center === "ALL" || u.centers.includes(center))
      .filter((u) => status === "ALL" || (status === "ACTIVE" ? u.active : !u.active))
      .filter(
        (u) =>
          !term ||
          normalizeArabicName(u.fullName).includes(term) ||
          u.username.includes(term) ||
          u.projects.some((p) => projectName(db, p).toLowerCase().includes(term)),
      )
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || Number(b.active) - Number(a.active) || a.fullName.localeCompare(b.fullName, "ar"));
  }, [db, visibleUsers, q, role, center, status]);

  const counts = {
    all: visibleUsers.length,
    active: visibleUsers.filter((u) => u.active).length,
    reception: db.users.filter((u) => u.role === "RECEPTION").length,
    point: db.users.filter((u) => u.role === "POINT").length,
    admin: db.users.filter((u) => u.role === "ADMIN").length,
    supervisor: db.users.filter((u) => u.role === "SUPERVISOR").length,
  };

  function toggleActive(u: User) {
    if (!canManageUser(me?.role, u.role)) return toast("لا تملك صلاحية تعديل هذا الحساب", "bad");
    if (u.id === me?.id) return toast("لا يمكنك إيقاف حسابك أنت", "bad");
    if (u.role === "ADMIN" && u.active && db.users.filter((x) => x.role === "ADMIN" && x.active).length <= 1)
      return toast("لا يمكن إيقاف آخر حساب أدمن مفعّل", "bad");
    saveUser({ ...u, active: !u.active });
    toast(u.active ? `تم إيقاف حساب ${u.fullName}` : `تم تفعيل حساب ${u.fullName}`);
  }

  const openEdit = (u: User) => {
    setViewing(null);
    setEditing(u);
    setFormOpen(true);
  };

  return (
    <>
      <PageHead
        title="المستخدمون"
        sub={`${counts.all} حساب · ${counts.active} مفعّل`}
        actions={
          <Button
            size="lg"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-5" />
            مستخدم جديد
          </Button>
        }
      />

      <div className={cn("mb-4 grid grid-cols-2 gap-3", isSup ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
        {[
          { label: "استقبال", value: counts.reception, r: "RECEPTION" as Role },
          { label: "نقاط المشاريع", value: counts.point, r: "POINT" as Role },
          { label: "مشرفون", value: counts.supervisor, r: "SUPERVISOR" as Role },
          { label: "أدمن", value: counts.admin, r: "ADMIN" as Role },
        ]
          .filter((t) => !(isSup && t.r === "ADMIN"))
          .map((t) => (
          <button
            key={t.r}
            onClick={() => setRole(role === t.r ? "ALL" : t.r)}
            className={cn(
              "focus-ring rounded-2xl border bg-surface p-4 text-start shadow-card transition",
              role === t.r ? "border-brand ring-2 ring-brand/20" : "border-line hover:border-muted/40",
            )}
          >
            <div className="num text-2xl font-bold">{t.value}</div>
            <div className="mt-1">
              <RoleBadge role={t.r} />
            </div>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              aria-label="بحث"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالاسم أو اسم المستخدم أو المشروع"
              className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm outline-hidden focus:border-brand"
            />
          </div>
          <Segmented
            label="النوع"
            value={role}
            onChange={setRole}
            options={[
              { value: "ALL", label: "الكل" },
              { value: "RECEPTION", label: "استقبال" },
              { value: "POINT", label: "نقاط" },
              { value: "SUPERVISOR", label: "مشرف" },
              ...(isSup ? [] : [{ value: "ADMIN" as RoleFilter, label: "أدمن" }]),
            ]}
          />
          <select
            aria-label="المركز"
            value={center}
            onChange={(e) => setCenter(e.target.value as CenterCode | "ALL")}
            className="h-10 rounded-xl border border-line bg-surface px-3 text-sm font-semibold"
          >
            <option value="ALL">كل المراكز</option>
            {db.centers.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="الحالة"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="h-10 rounded-xl border border-line bg-surface px-3 text-sm font-semibold"
          >
            <option value="ALL">كل الحالات</option>
            <option value="ACTIVE">مفعّل</option>
            <option value="OFF">موقوف</option>
          </select>
        </div>

        {/* جدول للشاشات العريضة */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-sunken/70 text-xs text-muted">
              <tr>
                <th className="px-5 py-3 text-start font-semibold">الموظف</th>
                <th className="px-3 py-3 text-start font-semibold">النوع</th>
                <th className="px-3 py-3 text-start font-semibold">المراكز</th>
                <th className="px-3 py-3 text-start font-semibold">المشاريع</th>
                <th className="px-3 py-3 text-center font-semibold">اليوم</th>
                <th className="px-3 py-3 text-start font-semibold">آخر نشاط</th>
                <th className="px-3 py-3 text-center font-semibold">مفعّل</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {users.map((u) => {
                const last = lastActivity(db, u.id);
                return (
                  <tr key={u.id} className={cn("hover:bg-sunken/40", !u.active && "opacity-60")}>
                    <td className="px-5 py-3">
                      <button onClick={() => setViewing(u)} className="flex items-center gap-3 text-start">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken font-bold text-muted">{u.fullName.trim()[0]}</span>
                        <span>
                          <span className="block font-bold hover:text-brand">
                            {u.fullName}
                            {u.id === me?.id && <span className="ms-1.5 text-xs font-semibold text-muted">(أنت)</span>}
                          </span>
                          <span className="ltr block text-start text-xs text-muted">{u.username}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold">
                      {!isStaff(u.role) ? <span className="text-muted">الكل</span> : u.centers.map((c) => centerName(db, c, true)).join("، ")}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.projects.length ? (
                          u.projects.map((p) => (
                            <span key={p} className="rounded-md bg-sunken px-1.5 py-0.5 text-xs font-bold">
                              {projectName(db, p)}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted">{u.role === "RECEPTION" ? "كل المشاريع" : "—"}</span>
                        )}
                      </div>
                    </td>
                    <td className="num px-3 py-3 text-center font-bold">{todayCounts.get(u.id) ?? 0}</td>
                    <td className="px-3 py-3 text-xs text-muted">
                      {last ? (
                        <>
                          {sinceText(last)} <span className="num">{formatTime(last)}</span>
                        </>
                      ) : (
                        "لم يعمل بعد"
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Switch checked={u.active} disabled={!can(u)} onChange={() => toggleActive(u)} label={`تفعيل ${u.fullName}`} />
                    </td>
                    <td className="px-2 py-3">
                      <RowMenu
                        onView={() => setViewing(u)}
                        onEdit={() => openEdit(u)}
                        onReset={() => setResetting(u)}
                        onToggle={() => toggleActive(u)}
                        onDelete={() => setDeleting(u)}
                        active={u.active}
                        manage={can(u)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* بطاقات للجوال */}
        <ul className="divide-y divide-line/60 md:hidden">
          {users.map((u) => (
            <li key={u.id} className={cn("flex items-start gap-3 p-4", !u.active && "opacity-60")}>
              <button onClick={() => setViewing(u)} className="grid size-10 shrink-0 place-items-center rounded-full bg-sunken font-bold text-muted">
                {u.fullName.trim()[0]}
              </button>
              <div className="min-w-0 flex-1">
                <button onClick={() => setViewing(u)} className="block text-start font-bold">
                  {u.fullName}
                </button>
                <div className="ltr text-start text-xs text-muted">{u.username}</div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <RoleBadge role={u.role} />
                  {isStaff(u.role) && <span className="text-xs font-semibold text-muted">{u.centers.map((c) => centerName(db, c, true)).join("، ")}</span>}
                  {u.projects.map((p) => (
                    <span key={p} className="rounded-md bg-sunken px-1.5 py-0.5 text-xs font-bold">
                      {projectName(db, p)}
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 text-xs text-muted">
                  اليوم: <span className="num font-bold text-ink">{todayCounts.get(u.id) ?? 0}</span> إدخال
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Switch checked={u.active} disabled={!can(u)} onChange={() => toggleActive(u)} label={`تفعيل ${u.fullName}`} />
                <RowMenu
                  onView={() => setViewing(u)}
                  onEdit={() => openEdit(u)}
                  onReset={() => setResetting(u)}
                  onToggle={() => toggleActive(u)}
                  onDelete={() => setDeleting(u)}
                  active={u.active}
                  manage={can(u)}
                />
              </div>
            </li>
          ))}
        </ul>

        {!users.length && (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center text-muted">
            <UserRound className="size-8" />
            لا يوجد مستخدمون مطابقون للبحث
          </div>
        )}
      </Card>

      <UserFormDialog open={formOpen} user={editing} onClose={() => setFormOpen(false)} />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
      <DeleteUserDialog user={deleting} onClose={() => setDeleting(null)} />
      <UserDetailDialog user={viewing} onClose={() => setViewing(null)} onEdit={viewing && can(viewing) ? openEdit : undefined} />
    </>
  );
}

function RowMenu({
  onView,
  onEdit,
  onReset,
  onToggle,
  onDelete,
  active,
  manage = true,
}: {
  onView: () => void;
  onEdit: () => void;
  onReset: () => void;
  onToggle: () => void;
  onDelete: () => void;
  active: boolean;
  manage?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm font-semibold hover:bg-sunken";
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="خيارات"
        className="focus-ring grid size-8 place-items-center rounded-lg text-muted hover:bg-sunken"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div className="absolute end-0 top-full z-30 mt-1 w-56 animate-fade-up rounded-xl border border-line bg-surface p-1.5 shadow-pop">
          <button className={item} onClick={run(onView)}>
            <UserRound className="size-4 text-muted" />
            عرض التفاصيل
          </button>
          {manage && (
            <>
          <button className={item} onClick={run(onEdit)}>
            <Pencil className="size-4 text-muted" />
            تعديل
          </button>
          <button className={item} onClick={run(onReset)}>
            <KeyRound className="size-4 text-muted" />
            إعادة تعيين كلمة المرور
          </button>
          <button className={item} onClick={run(onToggle)}>
            <Power className="size-4 text-muted" />
            {active ? "إيقاف الحساب" : "تفعيل الحساب"}
          </button>
          <button className={cn(item, "text-bad hover:bg-bad-soft")} onClick={run(onDelete)}>
            <Trash2 className="size-4" />
            حذف
          </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
