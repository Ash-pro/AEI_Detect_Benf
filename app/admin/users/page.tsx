"use client";

import { useBusy } from "@/lib/use-busy";
import { useMemo, useState } from "react";
import { Plus, Power, Search, ShieldCheck, UserRound } from "lucide-react";
import { PERMS } from "@/lib/permissions";
import { RowMenu } from "@/components/admin/row-menu";
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
import { Dialog } from "@/components/ui/dialog";
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

  const { busy, run } = useBusy();
  // إيقاف الحساب يحتاج تأكيداً حتى لا يُوقف بالخطأ أثناء التمرير
  const [stopping, setStopping] = useState<User | null>(null);
  function toggleActive(u: User, confirmed = false) {
    if (!canManageUser(me?.role, u.role)) return toast("لا تملك صلاحية تعديل هذا الحساب", "bad");
    if (u.id === me?.id) return toast("لا يمكنك إيقاف حسابك أنت", "bad");
    if (u.role === "ADMIN" && u.active && db.users.filter((x) => x.role === "ADMIN" && x.active).length <= 1)
      return toast("لا يمكن إيقاف آخر حساب أدمن مفعّل", "bad");
    if (u.active && !confirmed) return setStopping(u);
    void run(u.id, async () => {
      const e = await saveUser({ ...u, active: !u.active });
      toast(e ?? (u.active ? `تم إيقاف حساب ${u.fullName}` : `تم تفعيل حساب ${u.fullName}`), e ? "bad" : "ok");
    });
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
                <th className="px-3 py-3 text-start font-semibold">المشاريع / الصلاحيات</th>
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
                      <button onClick={() => setViewing(u)} className="focus-ring flex min-h-11 items-center gap-3 rounded-lg text-start">
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
                      <div className="flex flex-wrap items-center gap-1">
                        <RoleBadge role={u.role} />
                        {!u.active && <OffBadge />}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold">
                      {!isStaff(u.role) ? <span className="text-muted">الكل</span> : u.centers.map((c) => centerName(db, c, true)).join("، ")}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.role === "SUPERVISOR" ? (
                          <PermsButton u={u} editable={me?.role === "ADMIN"} onEdit={() => openEdit(u)} />
                        ) : u.projects.length ? (
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
                      <Switch checked={u.active} disabled={!can(u)} loading={busy === u.id} onChange={() => toggleActive(u)} label={`تفعيل ${u.fullName}`} />
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
                        title={u.fullName}
                        sub={u.username}
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
                <button onClick={() => setViewing(u)} className="focus-ring block min-h-10 rounded-lg text-start font-bold">
                  {u.fullName}
                  {u.id === me?.id && <span className="ms-1.5 text-xs font-semibold text-muted">(أنت)</span>}
                </button>
                <div className="ltr text-start text-xs text-muted">{u.username}</div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <RoleBadge role={u.role} />
                  {!u.active && <OffBadge />}
                  {isStaff(u.role) && <span className="text-xs font-semibold text-muted">{u.centers.map((c) => centerName(db, c, true)).join("، ")}</span>}
                  {u.role === "SUPERVISOR" && <PermsButton u={u} editable={me?.role === "ADMIN"} onEdit={() => openEdit(u)} />}
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
              {/* الجوال: الإيقاف والتفعيل من قائمة الخيارات (مع تأكيد) بدل مفتاح سهل اللمس بالخطأ */}
              <div className="flex flex-col items-end gap-2">
                <RowMenu
                  onView={() => setViewing(u)}
                  onEdit={() => openEdit(u)}
                  onReset={() => setResetting(u)}
                  onToggle={() => toggleActive(u)}
                  onDelete={() => setDeleting(u)}
                  active={u.active}
                  manage={can(u)}
                  title={u.fullName}
                  sub={u.username}
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

      <Dialog
        open={Boolean(stopping)}
        onClose={() => setStopping(null)}
        title="إيقاف الحساب؟"
        description={stopping ? `${stopping.fullName} · ${stopping.username}` : ""}
        footer={
          <>
            <Button
              variant="danger"
              size="lg"
              onClick={() => {
                const u = stopping;
                setStopping(null);
                if (u) toggleActive(u, true);
              }}
            >
              <Power className="size-5" />
              نعم، أوقف الحساب
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setStopping(null)}>
              تراجع
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          لن يتمكن من تسجيل الدخول حتى تعيد تفعيله. إدخالاته السابقة تبقى كما هي.
        </p>
      </Dialog>

      <UserFormDialog open={formOpen} user={editing} onClose={() => setFormOpen(false)} />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
      <DeleteUserDialog user={deleting} onClose={() => setDeleting(null)} />
      <UserDetailDialog user={viewing} onClose={() => setViewing(null)} onEdit={viewing && can(viewing) ? openEdit : undefined} />
    </>
  );
}

function OffBadge() {
  return <span className="rounded-md bg-bad-soft px-1.5 py-0.5 text-xs font-bold text-bad">موقوف</span>;
}

/** عدد صلاحيات المشرف — والضغط عليه يفتح تعديلها */
function PermsButton({ u, editable, onEdit }: { u: User; editable: boolean; onEdit: () => void }) {
  const n = u.permissions.length;
  const body = (
    <>
      <ShieldCheck className="size-3.5" />
      <span className="num">{n}</span> {n === 1 ? "صلاحية" : "صلاحيات"}
    </>
  );
  const cls = cn(
    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold",
    n ? "bg-brand-soft text-brand" : "bg-warn-soft text-warn",
  );
  return editable ? (
    <button onClick={onEdit} className={cn(cls, "focus-ring min-h-9 px-2 hover:ring-2 hover:ring-brand/30")} title={PERMS.filter((p) => u.permissions.includes(p.key)).map((p) => p.label).join("، ")}>
      {body}
      <span className="font-semibold opacity-70">· تعديل</span>
    </button>
  ) : (
    <span className={cls}>{body}</span>
  );
}
