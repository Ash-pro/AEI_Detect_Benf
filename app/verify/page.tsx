"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { FlaskConical, ScanLine } from "lucide-react";
import { AppGate } from "@/components/shell/app-gate";
import { IdSearch } from "@/components/verify/id-search";
import { CounterStrip } from "@/components/verify/counters";
import { ReceptionCard } from "@/components/verify/reception-card";
import { VisitDialog } from "@/components/verify/visit-dialog";
import { NewBeneficiaryForm } from "@/components/verify/new-beneficiary";
import { PointCard } from "@/components/verify/point-card";
import { SuccessPanel } from "@/components/verify/success-panel";
import { useSession } from "@/lib/session";
import { findByNid, pointCounters, pointView, receptionCounters, receptionView } from "@/lib/logic";
import { CENTERS, DEMO_IDS, PROJECTS } from "@/lib/mock-data";
import { formatDate, formatTime, isValidNationalId, normalizeDigits } from "@/lib/utils";
import type { ProjectCode } from "@/lib/types";

type Phase = "idle" | "loading" | "result" | "new" | "success";

interface Success {
  title: string;
  lines: React.ReactNode[];
  chips?: string[];
}

const pName = (p: ProjectCode) => PROJECTS.find((x) => x.code === p)!.name;

/** الشاشة 3 — واجهة التحقق الموحدة */
function VerifyScreen() {
  const s = useSession();
  const center = s.center!;
  const user = s.user!;
  const isPoint = user.role === "PROJECT";
  const project = PROJECTS.find((p) => p.code === s.project);

  const inputRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState("");
  const [nid, setNid] = useState("");
  const [error, setError] = useState<string>();
  const [phase, setPhase] = useState<Phase>("idle");
  const [visitOpen, setVisitOpen] = useState(false);
  const [success, setSuccess] = useState<Success | null>(null);

  const reset = useCallback(() => {
    setRaw("");
    setNid("");
    setError(undefined);
    setPhase("idle");
    setSuccess(null);
    setVisitOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const search = useCallback((id: string) => {
    setNid(id);
    setPhase("loading");
    setTimeout(() => setPhase("result"), 220);
  }, []);

  function onChange(v: string) {
    const d = normalizeDigits(v).slice(0, 9);
    setRaw(d);
    setError(undefined);
    if (phase !== "idle" && phase !== "loading") {
      setPhase("idle");
      setNid("");
    }
    if (d.length === 9) {
      if (!isValidNationalId(d)) setError("رقم الهوية غير صالح — تأكد من الأرقام");
      else search(d);
    }
  }

  function onEnter() {
    if (raw.length < 9) setError("رقم الهوية يجب أن يكون 9 أرقام");
  }

  function open(id: string) {
    setRaw(id);
    setError(undefined);
    setPhase("idle");
    if (!isValidNationalId(id)) return setError("رقم الهوية غير صالح — تأكد من الأرقام");
    search(id);
  }

  const beneficiary = nid ? findByNid(s.db, nid) : undefined;
  const rView = useMemo(
    () => (!isPoint && beneficiary ? receptionView(s.db, beneficiary, center) : null),
    [isPoint, beneficiary, s.db, center],
  );
  const pView = useMemo(
    () => (isPoint && nid && project ? pointView(s.db, nid, center, project.code) : null),
    [isPoint, nid, project, s.db, center],
  );

  const counters = isPoint
    ? pointCounters(s.db, center, project!.code)
    : receptionCounters(s.db, center);
  const centerName = CENTERS.find((c) => c.code === center)!.short;

  const showResult = phase === "result";

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 pb-16 pt-5">
      {isPoint ? (
        <CounterStrip
          title={
            <>
              {project!.name} · {centerName} · اليوم
            </>
          }
          items={[
            { label: "خدمت", value: (counters as ReturnType<typeof pointCounters>).served, tone: "ok" },
            { label: "محوّل ولم يُخدم", value: (counters as ReturnType<typeof pointCounters>).pending, tone: "warn" },
            { label: "استثنائي", value: (counters as ReturnType<typeof pointCounters>).exceptions },
          ]}
        />
      ) : (
        <CounterStrip
          title={<>{centerName} · اليوم</>}
          items={[
            { label: "زيارات", value: (counters as ReturnType<typeof receptionCounters>).visits },
            { label: "حالات جديدة", value: (counters as ReturnType<typeof receptionCounters>).newCases, tone: "info" },
            { label: "تحويلات", value: (counters as ReturnType<typeof receptionCounters>).referrals },
            { label: "خُدمت", value: (counters as ReturnType<typeof receptionCounters>).served, tone: "ok" },
          ]}
        />
      )}

      {phase !== "success" && (
        <IdSearch
          ref={inputRef}
          value={raw}
          onChange={onChange}
          onEnter={onEnter}
          onClear={reset}
          error={error}
          loading={phase === "loading"}
        />
      )}

      {!s.online && (
        <div className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">
          لا يوجد اتصال. البحث والحفظ متوقفان مؤقتاً، والبيانات المدخلة محفوظة في الشاشة.
        </div>
      )}

      {/* استقبال: حالة موجودة */}
      {showResult && !isPoint && rView && (
        <ReceptionCard
          view={rView}
          center={center}
          types={s.db.identityTypes}
          onRegister={() => setVisitOpen(true)}
          onOpenMember={(m) => open(m.nationalId)}
        />
      )}

      {/* استقبال: حالة جديدة */}
      {showResult && !isPoint && !beneficiary && (
        <NewBeneficiaryForm
          key={nid}
          nationalId={nid}
          db={s.db}
          onCancel={reset}
          onSubmit={(v) => {
            const { beneficiary: b } = s.registerBeneficiary({ nationalId: nid, ...v });
            const now = new Date().toISOString();
            setSuccess({
              title: "تم تسجيل الحالة — زيارة #1",
              lines: [b.name, <span key="t" className="num">{formatDate(now)} · {formatTime(now)}</span>],
              chips: v.projects.map(pName),
            });
            setPhase("success");
          }}
        />
      )}

      {/* نقطة المشروع */}
      {showResult && isPoint && pView && project && (
        <PointCard
          view={pView}
          project={project}
          types={s.db.identityTypes}
          onDone={reset}
          onConfirm={() => {
            s.confirmService(pView.beneficiary!.id);
            const now = new Date().toISOString();
            setSuccess({
              title: "تم تأكيد الخدمة",
              lines: [pView.beneficiary!.name, <span key="t">{project.name} · <span className="num">{formatTime(now)}</span></span>],
            });
            setPhase("success");
          }}
          onException={(reason, note) => {
            s.confirmService(pView.beneficiary!.id, { reason, note });
            setSuccess({
              title: "سُجّلت الخدمة الاستثنائية",
              lines: [pView.beneficiary!.name, "أُحيلت للمراجعة لدى الأدمن"],
            });
            setPhase("success");
          }}
        />
      )}

      {phase === "success" && success && (
        <SuccessPanel title={success.title} lines={success.lines} chips={success.chips} onDone={reset} />
      )}

      {phase === "idle" && !raw && <DemoPanel onPick={open} isPoint={isPoint} />}

      {rView && (
        <VisitDialog
          open={visitOpen}
          onClose={() => setVisitOpen(false)}
          view={rView}
          center={center}
          onSave={(projects, newProjects) => {
            const res = s.registerVisit({ beneficiaryId: rView.beneficiary.id, projects, newProjects });
            const now = new Date().toISOString();
            setVisitOpen(false);
            setSuccess({
              title: res.merged ? `أُضيف التحويل على زيارة اليوم #${res.visitSeq}` : `تم تسجيل الزيارة #${res.visitSeq}`,
              lines: [rView.beneficiary.name, <span key="t" className="num">{formatDate(now)} · {formatTime(now)}</span>],
              chips: [...projects.map(pName), ...newProjects.map((n) => `${pName(n.project)} — بانتظار الاعتماد`)],
            });
            setPhase("success");
          }}
        />
      )}
    </main>
  );
}

function DemoPanel({ onPick, isPoint }: { onPick: (id: string) => void; isPoint: boolean }) {
  return (
    <section className="rounded-2xl border border-dashed border-line p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted">
        <FlaskConical className="size-4" />
        سيناريوهات المعاينة — للتصميم فقط {isPoint && "(جرّب تبديل المشروع من الأعلى)"}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {DEMO_IDS.map((d) => (
          <button
            key={d.id}
            onClick={() => onPick(d.id)}
            className="focus-ring flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5 text-start text-sm shadow-card hover:bg-sunken"
          >
            <ScanLine className="size-4 shrink-0 text-muted" />
            <span className="num w-[86px] shrink-0 font-semibold">{d.id}</span>
            <span className="truncate text-muted">{d.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function VerifyPage() {
  return (
    <AppGate>
      <VerifyScreen />
    </AppGate>
  );
}
