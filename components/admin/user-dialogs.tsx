"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardList, Copy, Eye, EyeOff, KeyRound, RefreshCw, ShieldCheck, Stethoscope, Store, TriangleAlert } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckBox } from "@/components/ui/check";
import { Switch } from "@/components/ui/switch";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { HistoryRow } from "@/components/entry/history";
import { useStore } from "@/lib/store";
import { isStaff } from "@/lib/roles";
import { allProjects, lastActivity } from "@/lib/queries";
import type { CenterCode, Role, User } from "@/lib/types";
import { cn, formatDate, formatTime, sinceText, todayKey, uuid } from "@/lib/utils";
import { useBusy } from "@/lib/use-busy";
import { DEFAULT_SUPERVISOR_PERMS } from "@/lib/permissions";
import { PermissionChips, PermissionsPicker } from "./permissions-picker";

export const ROLE_META: Record<Role, { label: string; desc: string; icon: typeof Store; cls: string }> = {
  RECEPTION: { label: "استقبال", desc: "يدخل هوية الحالة ويحوّلها للمشاريع", icon: Store, cls: "bg-info-soft text-info" },
  POINT: { label: "نقطة مشروع", desc: "يدخل كل حالة يخدمها في مشروعه", icon: Stethoscope, cls: "bg-ok-soft text-ok" },
  SUPERVISOR: { label: "مشرف", desc: "صلاحيات يحددها الأدمن: متابعة وتقارير وإدارة", icon: ClipboardList, cls: "bg-warn-soft text-warn" },
  ADMIN: { label: "أدمن", desc: "لوحة التحكم الكاملة وإدارة الموقع", icon: ShieldCheck, cls: "bg-brand-soft text-brand" },
};

export function RoleBadge({ role }: { role: Role }) {
  const m = ROLE_META[role];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold", m.cls)}>
      <m.icon className="size-3.5" />
      {m.label}
    </span>
  );
}

export function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function CopyField({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-brand/40 bg-brand-soft/50 p-2 ps-4">
      <code className="ltr flex-1 text-start text-xl font-bold tracking-wider">{value}</code>
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setOk(true);
            setTimeout(() => setOk(false), 1800);
          } catch {
            /* اختيار يدوي */
          }
        }}
      >
        {ok ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />}
        {ok ? "تم النسخ" : "نسخ"}
      </Button>
    </div>
  );
}

/* ===== إنشاء / تعديل مستخدم ===== */

const EMPTY_USER = (): User => ({
  id: uuid(),
  username: "",
  password: "",
  fullName: "",
  role: "RECEPTION",
  centers: [],
  projects: [],
  permissions: [],
  active: true,
  createdAt: new Date().toISOString(),
});

export function UserFormDialog({ open, user, onClose }: { open: boolean; user: User | null; onClose: () => void }) {
  const { db, saveUser, user: me } = useStore();
  const toast = useToast();
  const isEdit = Boolean(user);
  const [f, setF] = useState<User>(EMPTY_USER);
  const [newPass, setNewPass] = useState("");
  const [showPass, setShowPass] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(user ? { ...user } : { ...EMPTY_USER(), password: generatePassword() });
    setNewPass("");
    setErrors({});
    setCreated(null);
    setShowPass(true);
  }, [open, user]);

  const set = <K extends keyof User>(k: K, v: User[K]) => {
    setF((x) => {
      const next = { ...x, [k]: v };
      // أول ما يصير الحساب مشرفاً: الصلاحيات الافتراضية
      if (k === "role" && v === "SUPERVISOR" && !x.permissions.length) next.permissions = [...DEFAULT_SUPERVISOR_PERMS];
      return next;
    });
    setErrors((e) => ({ ...e, [k]: "" }));
  };
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const projectOptions = allProjects(db).filter((p) => p.active || f.projects.includes(p.code));
  const editingSelf = isEdit && me?.id === f.id;

  async function submit() {
    if (busy) return;
    const er: Record<string, string> = {};
    if (!f.fullName.trim()) er.fullName = "اكتب اسم الموظف";
    if (!/^[a-z0-9._-]{3,30}$/.test(f.username)) er.username = "3 أحرف على الأقل: حروف إنجليزية صغيرة وأرقام و . _ - فقط";
    if (!isEdit && f.password.length < 6) er.password = "كلمة المرور 6 أحرف على الأقل";
    if (isEdit && newPass && newPass.length < 6) er.password = "كلمة المرور 6 أحرف على الأقل";
    if (isStaff(f.role) && !f.centers.length) er.centers = "اختر مركزاً واحداً على الأقل";
    if (f.role === "POINT" && !f.projects.length) er.projects = "اختر مشروعاً واحداً على الأقل";
    setErrors(er);
    if (Object.keys(er).length) return;
    const final: User = {
      ...f,
      fullName: f.fullName.trim(),
      password: isEdit && newPass ? newPass : f.password,
      centers: isStaff(f.role) ? f.centers : (["GAZA", "KHY"] as CenterCode[]),
      projects: f.role === "POINT" ? f.projects : [],
      permissions: f.role === "SUPERVISOR" ? f.permissions : [],
    };
    setBusy(true);
    const e = await saveUser(final);
    setBusy(false);
    if (e) return setErrors({ form: e });
    if (isEdit) {
      toast("تم حفظ التعديلات");
      onClose();
    } else setCreated(final);
  }

  if (created) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="تم إنشاء المستخدم"
        description={created.fullName}
        footer={<Button size="lg" onClick={onClose}>تم</Button>}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">سلّم هذه البيانات للموظف. كلمة المرور لا تظهر مرة ثانية، ويمكن إعادة تعيينها لاحقاً.</p>
          <div>
            <Label>اسم المستخدم</Label>
            <CopyField value={created.username} />
          </div>
          <div>
            <Label>كلمة المرور</Label>
            <CopyField value={created.password} />
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? "تعديل مستخدم" : "مستخدم جديد"}
      description={isEdit ? f.username : "يُنشأ الحساب ويُسلَّم للموظف"}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>
            إلغاء
          </Button>
          <Button size="lg" className="sm:min-w-[200px]" onClick={submit} loading={busy} loadingText={isEdit ? "جارٍ الحفظ…" : "جارٍ الإنشاء…"}>
            {isEdit ? "حفظ التعديلات" : "إنشاء المستخدم"}
          </Button>
        </>
      }
    >
      <form
        aria-busy={busy || undefined}
        className={cn("space-y-6 transition-opacity", busy && "pointer-events-none opacity-60")}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            نوع الحساب <span className="text-bad">*</span>
          </legend>
          <div className={cn("grid grid-cols-2 gap-2.5", me?.role === "ADMIN" && "lg:grid-cols-4")} role="radiogroup">
            {(Object.keys(ROLE_META) as Role[]).filter((r) => me?.role === "ADMIN" || isStaff(r)).map((r) => {
              const m = ROLE_META[r];
              const on = f.role === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={editingSelf && r !== "ADMIN"}
                  onClick={() => set("role", r)}
                  className={cn(
                    "focus-ring flex flex-col items-start gap-1.5 rounded-xl border-2 p-3.5 text-start transition disabled:opacity-40",
                    on ? "border-brand bg-brand-soft" : "border-line hover:border-muted/40",
                  )}
                >
                  <span className={cn("grid size-9 place-items-center rounded-lg", m.cls)}>
                    <m.icon className="size-5" />
                  </span>
                  <span className={cn("font-bold", on && "text-brand")}>{m.label}</span>
                  <span className="text-xs leading-relaxed text-muted">{m.desc}</span>
                </button>
              );
            })}
          </div>
          {editingSelf && <FieldHint>لا يمكنك تغيير نوع حسابك أنت.</FieldHint>}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="uf-name" required>
              الاسم الكامل
            </Label>
            <Input id="uf-name" value={f.fullName} invalid={Boolean(errors.fullName)} onChange={(e) => set("fullName", e.target.value)} />
            <FieldError>{errors.fullName}</FieldError>
          </div>
          <div>
            <Label htmlFor="uf-user" required>
              اسم المستخدم
            </Label>
            <Input
              id="uf-user"
              dir="ltr"
              autoCapitalize="none"
              className="text-start"
              placeholder="reception.khy2"
              value={f.username}
              invalid={Boolean(errors.username)}
              onChange={(e) => set("username", e.target.value.toLowerCase().replace(/\s/g, ""))}
            />
            <FieldError>{errors.username}</FieldError>
          </div>
        </div>

        <div>
          <Label htmlFor="uf-pass" required={!isEdit}>
            {isEdit ? "كلمة مرور جديدة" : "كلمة المرور"}
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="uf-pass"
                dir="ltr"
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
                className="pl-12 text-start"
                placeholder={isEdit ? "اتركه فارغاً للإبقاء على الحالية" : ""}
                value={isEdit ? newPass : f.password}
                invalid={Boolean(errors.password)}
                onChange={(e) => {
                  isEdit ? setNewPass(e.target.value) : set("password", e.target.value);
                  setErrors((x) => ({ ...x, password: "" }));
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="focus-ring absolute end-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-sunken"
                aria-label={showPass ? "إخفاء" : "إظهار"}
              >
                {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                const p = generatePassword();
                isEdit ? setNewPass(p) : set("password", p);
                setShowPass(true);
              }}
            >
              <RefreshCw className="size-4" />
              توليد
            </Button>
          </div>
          <FieldError>{errors.password}</FieldError>
          <FieldError>{errors.form}</FieldError>
        </div>

        {f.role === "SUPERVISOR" && me?.role === "ADMIN" && (
          <PermissionsPicker value={f.permissions} onChange={(v) => set("permissions", v)} />
        )}

        {isStaff(f.role) && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              المراكز المسموحة <span className="text-bad">*</span>
            </legend>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {db.centers.map((c) => (
                <CheckBox key={c.code} checked={f.centers.includes(c.code)} onChange={() => set("centers", toggle(f.centers, c.code))}>
                  {c.name}
                </CheckBox>
              ))}
            </div>
            <FieldError>{errors.centers}</FieldError>
          </fieldset>
        )}

        {f.role === "POINT" && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              المشاريع المسندة <span className="text-bad">*</span>
              <span className="ms-2 font-normal text-muted">يمكن إسناد أكثر من مشروع</span>
            </legend>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {projectOptions.map((p) => (
                <CheckBox
                  key={p.code}
                  checked={f.projects.includes(p.code)}
                  onChange={() => set("projects", toggle(f.projects, p.code))}
                  sub={!p.active ? "متوقف" : undefined}
                >
                  {p.name}
                </CheckBox>
              ))}
            </div>
            <FieldError>{errors.projects}</FieldError>
          </fieldset>
        )}

        <div className="flex items-center justify-between gap-4 rounded-xl bg-sunken px-4 py-3">
          <div>
            <div className="font-semibold">الحساب مفعّل</div>
            <div className="text-xs text-muted">الحساب الموقوف لا يستطيع تسجيل الدخول، وتبقى إدخالاته محفوظة</div>
          </div>
          <Switch checked={f.active} onChange={(v) => set("active", v)} label="الحساب مفعّل" />
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/* ===== إعادة تعيين كلمة المرور ===== */

export function ResetPasswordDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { saveUser } = useStore();
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const { busy, run } = useBusy<"reset">();
  useEffect(() => {
    if (user) {
      setPass("");
      setErr("");
    }
  }, [user]);

  return (
    <Dialog
      open={Boolean(user)}
      onClose={onClose}
      title="إعادة تعيين كلمة المرور"
      description={user?.fullName}
      footer={
        pass ? (
          <Button size="lg" onClick={onClose}>تم</Button>
        ) : (
          <>
            <Button variant="secondary" size="lg" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              size="lg"
              loading={busy === "reset"}
              loadingText="جارٍ التوليد…"
              onClick={() =>
                run("reset", async () => {
                  const p = generatePassword();
                  const e = await saveUser({ ...user!, password: p });
                  if (e) return setErr(e);
                  setPass(p);
                })
              }
            >
              <KeyRound className="size-4" />
              توليد كلمة مرور جديدة
            </Button>
          </>
        )
      }
    >
      {pass ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">كلمة المرور الجديدة لـ <span className="ltr font-semibold">{user?.username}</span>. سلّمها للموظف، ولن تظهر مرة ثانية.</p>
          <CopyField value={pass} />
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">ستتوقف كلمة المرور الحالية فوراً، ويحتاج الموظف الكلمة الجديدة لتسجيل الدخول.</p>
          <FieldError>{err}</FieldError>
        </>
      )}
    </Dialog>
  );
}

/* ===== حذف ===== */

export function DeleteUserDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { db, deleteUser, saveUser, user: me } = useStore();
  const toast = useToast();
  const [err, setErr] = useState("");
  const { busy, run } = useBusy<"off" | "del">();
  if (!user) return null;
  const count = db.entries.filter((e) => e.userId === user.id).length;
  const isSelf = me?.id === user.id;
  const lastAdmin = user.role === "ADMIN" && db.users.filter((u) => u.role === "ADMIN" && u.active).length <= 1;
  const blocked = isSelf || lastAdmin;

  return (
    <Dialog
      open
      onClose={onClose}
      title="حذف المستخدم"
      description={`${user.fullName} · ${user.username}`}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>
            إلغاء
          </Button>
          {!blocked && count > 0 && user.active && (
            <Button
              variant="secondary"
              size="lg"
              loading={busy === "off"}
              loadingText="جارٍ الإيقاف…"
              disabled={busy === "del"}
              onClick={() =>
                run("off", async () => {
                  const e = await saveUser({ ...user, active: false });
                  if (e) return setErr(e);
                  toast("تم إيقاف الحساب");
                  onClose();
                })
              }
            >
              إيقاف الحساب بدلاً من الحذف
            </Button>
          )}
          {!blocked && count === 0 && (
            <Button
              variant="danger"
              size="lg"
              loading={busy === "del"}
              loadingText="جارٍ الحذف…"
              onClick={() =>
                run("del", async () => {
                  const e = await deleteUser(user.id);
                  if (e) return setErr(e);
                  toast("تم حذف المستخدم", "info");
                  onClose();
                })
              }
            >
              حذف نهائي
            </Button>
          )}
        </>
      }
    >
      {blocked ? (
        <p className="flex gap-2 rounded-xl bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">
          <TriangleAlert className="size-5 shrink-0" />
          {isSelf ? "لا يمكنك حذف حسابك أنت." : "لا يمكن حذف آخر حساب أدمن مفعّل."}
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          {count > 0 ? (
            <p className="flex gap-2 rounded-xl bg-warn-soft px-4 py-3 font-semibold text-warn">
              <TriangleAlert className="size-5 shrink-0" />
              لهذا المستخدم <span className="num">{count.toLocaleString("en-US")}</span> إدخال، فلا يمكن حذفه حتى تبقى السجلات كاملة. أوقف الحساب بدلاً من الحذف.
            </p>
          ) : (
            <p className="text-muted">لا توجد إدخالات لهذا المستخدم.</p>
          )}
          <FieldError>{err}</FieldError>
        </div>
      )}
    </Dialog>
  );
}

/* ===== تفاصيل مستخدم ===== */

export function UserDetailDialog({ user, onClose, onEdit }: { user: User | null; onClose: () => void; onEdit?: (u: User) => void }) {
  const { db } = useStore();
  if (!user) return null;
  const mine = db.entries.filter((e) => e.userId === user.id);
  const today = todayKey();
  const month = today.slice(0, 7);
  const last = lastActivity(db, user.id);
  const recent = mine.slice(-10).reverse();
  const tiles = [
    { label: "اليوم", value: mine.filter((e) => e.date === today).length },
    { label: "هذا الشهر", value: mine.filter((e) => e.date.startsWith(month)).length },
    { label: "الإجمالي", value: mine.length },
    { label: "أيام عمل", value: new Set(mine.map((e) => e.date)).size },
  ];
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={user.fullName}
      description={user.username}
      footer={
        onEdit ? (
          <Button size="lg" onClick={() => onEdit(user)}>
            تعديل المستخدم
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <RoleBadge role={user.role} />
          {user.active ? (
            <span className="rounded-lg bg-ok-soft px-2 py-0.5 text-xs font-bold text-ok">مفعّل</span>
          ) : (
            <span className="rounded-lg bg-sunken px-2 py-0.5 text-xs font-bold text-muted">موقوف</span>
          )}
          {isStaff(user.role) &&
            user.centers.map((c) => (
              <span key={c} className="rounded-lg border border-line px-2 py-0.5 text-xs font-bold">
                {db.centers.find((x) => x.code === c)?.name}
              </span>
            ))}
          {user.projects.map((p) => (
            <span key={p} className="rounded-lg bg-sunken px-2 py-0.5 text-xs font-bold">
              {db.projects.find((x) => x.code === p)?.name ?? p}
            </span>
          ))}
        </div>
        {user.role === "SUPERVISOR" && (
          <div className="rounded-xl border border-line p-3">
            <div className="mb-2 text-xs font-bold text-muted">الصلاحيات</div>
            <PermissionChips value={user.permissions} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-line p-3">
              <div className="num text-2xl font-bold">{t.value.toLocaleString("en-US")}</div>
              <div className="text-xs text-muted">{t.label}</div>
            </div>
          ))}
        </div>
        <div className="text-sm text-muted">
          أُنشئ في <span className="num">{formatDate(user.createdAt)}</span>
          {last && (
            <>
              {" "}
              · آخر نشاط {sinceText(last)} <span className="num">{formatTime(last)}</span>
            </>
          )}
        </div>
        {recent.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-bold">آخر الإدخالات</h3>
            <ul className="-mx-5 divide-y divide-line/60 border-y border-line sm:-mx-6">
              {recent.map((e) => (
                <HistoryRow key={e.id} e={e} db={db} person />
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}
