"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { CircleAlert, FlaskConical, Info, Sparkles } from "lucide-react";
import { AppGate } from "@/components/shell/app-gate";
import { StaffHeader } from "@/components/shell/app-header";
import { IdInput } from "@/components/entry/id-input";
import { BeneficiaryCard } from "@/components/entry/beneficiary-card";
import { EditDialog } from "@/components/entry/edit-dialog";
import { ShareDialog } from "@/components/entry/share-dialog";
import { RoutingDialog, RoutingPanel } from "@/components/entry/routing";
import { StatsStrip } from "@/components/entry/stats-strip";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckBox } from "@/components/ui/check";
import { FieldError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import {
  activeProjects,
  lastReception,
  projectName,
  staffShareText,
  staffStats,
  visibleHistory,
} from "@/lib/queries";
import { freshValidId } from "@/lib/mock-data";
import { cn, formatTime, normalizeDigits, todayKey } from "@/lib/utils";

/** الشاشة 3 — شاشة الإدخال (الاستقبال والنقاط) */
function EntryScreen() {
  const store = useStore();
  const { db, center, user } = store;
  const c = center!;
  const u = user!;
  const isPoint = u.role === "POINT";
  const toast = useToast();

  const inputRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState("");
  const [nid, setNid] = useState("");
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [routingOpen, setRoutingOpen] = useState(false);

  const today = todayKey();
  // كل مشاريع المركز (للاستقبال ولتعديل التوجيه من النقطة)
  const allHere = useMemo(() => activeProjects(db, c), [db, c]);
  // مربعات الخدمة عند النقطة: مشاريع الموظف فقط
  const projects = useMemo(() => (isPoint ? allHere.filter((p) => u.projects.includes(p.code)) : allHere), [allHere, isPoint, u.projects]);

  const beneficiary = nid ? db.beneficiaries[nid] : undefined;
  const history = useMemo(() => (nid ? visibleHistory(db, nid, u) : []), [db, nid, u]);
  const receptionToday = useMemo(
    () => (nid ? db.entries.filter((e) => e.nid === nid && e.date === today && e.kind === "RECEPTION") : []),
    [db, nid, today],
  );
  const pointDoneToday = useMemo(() => {
    const m = new Map<string, string>();
    if (nid) db.entries.filter((e) => e.nid === nid && e.date === today && e.kind === "POINT").forEach((e) => e.projects.forEach((p) => m.set(p, e.at)));
    return m;
  }, [db, nid, today]);
  const todayHere = receptionToday.find((e) => e.center === c);
  const routing = todayHere ?? receptionToday[0];
  const todayMine = useMemo(
    () => (nid ? db.entries.filter((e) => e.nid === nid && e.date === today && e.userId === u.id) : []),
    [db, nid, today, u.id],
  );

  const stats = staffStats(db, u, c);

  /** المشاريع المحددة مسبقاً */
  const preselect = useCallback(
    (id: string) => {
      const available = projects.map((p) => p.code);
      if (isPoint) {
        const done = new Set(
          db.entries.filter((e) => e.nid === id && e.date === today && e.kind === "POINT").flatMap((e) => e.projects),
        );
        const own = available.filter((p) => !done.has(p));
        // محوّلة لمشروع آخر: لا شيء محدد مسبقاً حتى لا تُدخل خدمة بالخطأ
        const rt = db.entries.filter((e) => e.nid === id && e.date === today && e.kind === "RECEPTION");
        if (rt.length && !rt.some((e) => e.projects.some((p) => u.projects.includes(p)))) return [];
        const mineLast = [...db.entries].reverse().find((e) => e.userId === u.id && own.includes(e.projects[0]));
        return own.length ? [mineLast?.projects[0] ?? own[0]] : [];
      }
      const todayEntry = db.entries.find((e) => e.nid === id && e.date === today && e.kind === "RECEPTION" && e.center === c);
      const src = todayEntry ?? lastReception(db, id, c);
      return src ? src.projects.filter((p) => available.includes(p)) : [];
    },
    [db, projects, isPoint, today, u.id, u.projects, c],
  );

  const reset = useCallback(() => {
    setRaw("");
    setNid("");
    setError(undefined);
    setSelected([]);
    setFormError("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  function open(id: string) {
    setNid(id);
    setFormError("");
    setSelected(preselect(id));
  }

  function onChange(v: string) {
    const d = normalizeDigits(v).slice(0, 9);
    setRaw(d);
    setError(undefined);
    if (nid) {
      setNid("");
      setSelected([]);
    }
    if (d.length === 9) {
      open(d);
    }
  }

  function submit() {
    if (!nid) return;
    if (!store.online) return setFormError("لا يوجد اتصال بالإنترنت. انتظر عودة الاتصال ثم أعد المحاولة");
    const r = store.addEntry({ nid, projects: selected });
    if (!r.ok) return setFormError(r.error);
    const done = r.mode === "updated" ? r.entry.projects : selected.filter((p) => !r.skipped.includes(p));
    const names = done.map((p) => projectName(db, p)).join("، ");
    toast(r.mode === "updated" ? `تم تحديث إدخال اليوم — ${names}` : `تم الإدخال${r.isNew ? " (حالة جديدة)" : ""} — ${names}`);
    reset();
  }

  const isNew = Boolean(nid) && !beneficiary;
  const hint = isPoint ? db.settings.hintPoint : db.settings.hintReception;

  /* رسالة الحالة تحت البطاقة */
  let status: React.ReactNode = null;
  if (nid && !isPoint && todayHere) {
    status = (
      <StatusLine tone="info" icon={<Info className="size-5" />}>
        أُدخلت اليوم الساعة <span className="num">{formatTime(todayHere.at)}</span>. الضغط على "إدخال" يحدّث مشاريع نفس الإدخال ولا يُحسب حالة جديدة.
      </StatusLine>
    );
  }
  const myPointToday = todayMine.filter((e) => e.kind === "POINT");

  const allDone = isPoint && u.projects.length > 0 && u.projects.every((p) => pointDoneToday.has(p));

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pb-24 pt-5">
      <div className="flex gap-3 rounded-2xl bg-info-soft px-4 py-3 text-[15px] font-semibold text-info">
        <Info className="mt-0.5 size-5 shrink-0" />
        <p>{hint}</p>
      </div>

      <StatsStrip stats={stats} isPoint={isPoint} onShare={() => setShareOpen(true)} />

      <IdInput ref={inputRef} value={raw} onChange={onChange} onEnter={() => (nid ? submit() : raw.length < 9 && setError("رقم الهوية يجب أن يكون 9 أرقام"))} onClear={reset} error={error} />

      {beneficiary && (
        <BeneficiaryCard db={db} beneficiary={beneficiary} history={history} status={status} onEdit={() => setEditOpen(true)} />
      )}

      {nid && (
        <Card className="animate-fade-up space-y-5 p-5">
          {isNew && (
            <>
              <div className="flex items-center gap-2.5 rounded-xl bg-warn-soft px-4 py-3 font-bold text-warn">
                <Sparkles className="size-5" />
                حالة جديدة — أول مرة في النظام
              </div>
              {status}
            </>
          )}

          {isPoint && <RoutingPanel reception={routing} user={u} center={c} onFix={() => setRoutingOpen(true)} />}

          <fieldset>
            <legend className="mb-2.5 text-sm font-bold">
              {isPoint ? "إدخال الخدمة في" : "التحويل إلى"}
              {!isPoint && <span className="ms-2 font-normal text-muted">يمكن اختيار أكثر من مشروع</span>}
            </legend>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {projects.map((p) => {
                const doneAt = isPoint ? pointDoneToday.get(p.code) : undefined;
                return (
                  <CheckBox
                    key={p.code}
                    checked={selected.includes(p.code)}
                    disabled={Boolean(doneAt)}
                    sub={doneAt ? `أُدخلت اليوم ${formatTime(doneAt)}` : undefined}
                    onChange={(v) => {
                      setFormError("");
                      setSelected((s) => (v ? [...s, p.code] : s.filter((x) => x !== p.code)));
                    }}
                  >
                    {p.name}
                  </CheckBox>
                );
              })}
            </div>
          </fieldset>

          {allDone && (
            <div className="flex items-center gap-2 rounded-xl bg-bad-soft px-4 py-3 text-sm font-bold text-bad">
              <CircleAlert className="size-5" />
              هذه الحالة أُدخلت اليوم في مشروعك. لا يمكن إدخالها مرة ثانية في نفس المشروع.
            </div>
          )}

          <FieldError>{formError}</FieldError>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" size="lg" onClick={reset}>
              إلغاء
            </Button>
            <Button size="xl" className="w-full sm:flex-1" disabled={!selected.length} onClick={submit}>
              {!isPoint && todayHere ? "تحديث إدخال اليوم" : isPoint ? "إدخال الخدمة" : "إدخال"}
            </Button>
          </div>
        </Card>
      )}

      {!nid && !raw && <TestPanel onPick={(id) => onChange(id)} />}

      {beneficiary && (
        <EditDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          beneficiary={beneficiary}
          todayMine={todayMine}
          projects={projects}
          onMoved={(id) => {
            setEditOpen(false);
            setRaw(id);
            open(id);
          }}
        />
      )}

      {isPoint && (
        <RoutingDialog
          open={routingOpen}
          onClose={() => setRoutingOpen(false)}
          reception={routing}
          projects={allHere}
          myEntries={myPointToday}
          onDone={(list) => {
            setRoutingOpen(false);
            const n = list.map((p) => projectName(db, p)).join("، ");
            toast(`تم تعديل التوجيه إلى ${n} — وجّه المستفيد إلى نقطة ${n}`);
            // بعد التصحيح: لا خدمة محددة إلا إذا بقيت الحالة محوّلة لمشروعي
            setSelected(list.some((p) => u.projects.includes(p)) ? projects.map((p) => p.code).filter((p) => list.includes(p) && !pointDoneToday.has(p)) : []);
          }}
        />
      )}

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="مشاركة إحصائيات اليوم"
        text={staffShareText(db, u, c, stats)}
      />
    </main>
  );
}

function StatusLine({ tone, icon, children }: { tone: "ok" | "info" | "muted"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex gap-2.5 border-t border-line px-5 py-3 text-sm font-semibold",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "info" && "bg-info-soft text-info",
        tone === "muted" && "bg-sunken text-muted",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  );
}

/** أمثلة للاختبار — تُحذف عند ربط قاعدة البيانات */
function TestPanel({ onPick }: { onPick: (id: string) => void }) {
  const { db, center, user } = useStore();
  const today = todayKey();
  const items = useMemo(() => {
    const here = db.entries.filter((e) => e.center === center);
    const list: { id: string; label: string }[] = [];
    const returning = center === "KHY" ? "401234562" : here.find((e) => e.kind === "RECEPTION" && e.date !== today)?.nid;
    if (returning) list.push({ id: returning, label: "حالة مسجلة لها سجل زيارات" });
    if (user?.role === "POINT") {
      const servedIds = new Set(db.entries.filter((e) => e.kind === "POINT" && e.date === today).map((e) => e.nid));
      const referred = here.find((e) => e.kind === "RECEPTION" && e.date === today && e.projects.some((p) => user.projects.includes(p)) && !servedIds.has(e.nid));
      if (referred) list.push({ id: referred.nid, label: "مرّت على الاستقبال اليوم ولم تُخدم" });
      const served = here.find((e) => e.kind === "POINT" && e.date === today && user.projects.includes(e.projects[0]));
      if (served) list.push({ id: served.nid, label: "أُدخلت اليوم في مشروعك" });
    } else {
      const t = here.find((e) => e.kind === "RECEPTION" && e.date === today);
      if (t) list.push({ id: t.nid, label: "أُدخلت اليوم في الاستقبال" });
    }
    list.push({ id: freshValidId(db), label: "هوية جديدة غير مسجلة" });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center, user]);

  return (
    <section className="rounded-2xl border border-dashed border-line p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted">
        <FlaskConical className="size-4" />
        أمثلة للاختبار — للعرض فقط
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((d) => (
          <button
            key={d.id + d.label}
            onClick={() => onPick(d.id)}
            className="focus-ring flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5 text-start text-sm shadow-card hover:bg-sunken"
          >
            <span className="num w-[86px] shrink-0 font-semibold">{d.id}</span>
            <span className="truncate text-muted">{d.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function EntryPage() {
  return (
    <AppGate area="staff">
      <StaffHeader />
      <EntryScreen />
    </AppGate>
  );
}
