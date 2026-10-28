"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Copy, Hourglass, PenLine, Stethoscope } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IdTypeTag } from "@/components/entry/id-fields";
import { useStore } from "@/lib/store";
import { allProjects, type CenterFilter, centerName, projectName, userName } from "@/lib/queries";
import { projectQueue, type QueueItem } from "@/lib/queue";
import { projectColor, projectSoft } from "@/lib/project-colors";
import { cn, dayFull, formatTime, minutesText, normalizeArabicName, normalizeDigits, todayKey } from "@/lib/utils";
import { FilterSelect, ResetFilters, SearchBox, Segmented } from "./bits";

const PAGE = 50;

/** كل الحالات التي حوّلها الاستقبال ولم تسجّلها نقطة المشروع بعد — ليوم ومركز محددين */
export function waitingItems(db: Parameters<typeof projectQueue>[0], date: string, center: CenterFilter, status: "wait" | "left" = "wait"): QueueItem[] {
  const centers = center === "ALL" ? db.centers.map((c) => c.code) : [center];
  return centers.flatMap((c) => allProjects(db).flatMap((p) => projectQueue(db, c, p.code, date).filter((x) => x.status === status)));
}

export type WaitMode = "wait" | "left";

/**
 * نافذة "بانتظار الخدمة": من حوّلهم الاستقبال ولم يُخدموا بعد،
 * مع فلترة حسب المشروع والمركز والبحث، وترتيب حسب مدة الانتظار أو الدور.
 */
export function WaitingDialog({
  open,
  onClose,
  date,
  center,
  project,
  mode: initialMode = "wait",
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  center: CenterFilter;
  /** فتح النافذة على مشروع محدد */
  project?: string;
  /** بانتظار الآن، أو حضرت ولم تُخدم */
  mode?: WaitMode;
}) {
  const { db } = useStore();
  const isToday = date === todayKey();
  const [mode, setMode] = useState<WaitMode>(initialMode);
  const showWait = mode === "wait";
  const [q, setQ] = useState("");
  const [proj, setProj] = useState("ALL");
  const [ctr, setCtr] = useState<CenterFilter>("ALL");
  const [sort, setSort] = useState<"wait" | "queue" | "recent">("wait");
  const [limit, setLimit] = useState(PAGE);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  // عند كل فتح: نبدأ من المشروع المطلوب ومن غير بحث
  useEffect(() => {
    if (!open) return;
    setProj(project ?? "ALL");
    setCtr("ALL");
    setQ("");
    setSort("wait");
    setMode(initialMode);
    setNow(Date.now());
  }, [open, project, initialMode]);
  // مدة الانتظار تتحدث كل 30 ثانية
  useEffect(() => {
    if (!open || !isToday) return;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, [open, isToday]);
  useEffect(() => setLimit(PAGE), [q, proj, ctr, sort, mode]);

  const all = useMemo(() => (open ? waitingItems(db, date, center, mode) : []), [open, db, date, center, mode]);
  const counts = useMemo(
    () => (open ? { wait: waitingItems(db, date, center, "wait").length, left: waitingItems(db, date, center, "left").length } : { wait: 0, left: 0 }),
    [open, db, date, center],
  );
  const byProject = useMemo(() => {
    const m = new Map<string, number>();
    all.forEach((x) => m.set(x.project, (m.get(x.project) ?? 0) + 1));
    return allProjects(db)
      .filter((p) => m.has(p.code))
      .map((p) => ({ code: p.code, name: p.name, n: m.get(p.code)! }));
  }, [all, db]);

  const list = useMemo(() => {
    const digits = normalizeDigits(q);
    const term = normalizeArabicName(q);
    const out = all
      .filter((x) => proj === "ALL" || x.project === proj)
      .filter((x) => ctr === "ALL" || x.reception.center === ctr)
      .filter((x) => !q.trim() || (digits ? x.reception.nid.includes(digits) : normalizeArabicName(db.beneficiaries[x.reception.nid]?.name ?? "").includes(term)));
    if (sort === "wait") out.sort((a, b) => a.reception.at.localeCompare(b.reception.at) || a.number - b.number);
    if (sort === "recent") out.sort((a, b) => b.reception.at.localeCompare(a.reception.at));
    if (sort === "queue") out.sort((a, b) => a.project.localeCompare(b.project) || a.number - b.number);
    return out;
  }, [all, proj, ctr, q, sort, db.beneficiaries]);

  const waited = (x: QueueItem) => Math.max(0, Math.round((now - new Date(x.reception.at).getTime()) / 60_000));
  const longest = showWait && all.length ? Math.max(...all.map(waited)) : 0;
  const filtering = Boolean(q.trim()) || proj !== "ALL" || ctr !== "ALL";

  async function copyList() {
    const lines = [
      `${showWait ? "⏳ بانتظار الخدمة" : "🚪 حضرت ولم تُخدم"} — ${center === "ALL" ? "كل المراكز" : centerName(db, center)} — ${dayFull(date)}`,
      proj !== "ALL" ? `المشروع: ${projectName(db, proj)}` : "",
      `العدد: ${list.length}`,
      "",
      ...list.map(
        (x) =>
          `${x.number}. ${db.beneficiaries[x.reception.nid]?.name || "بدون اسم"} — ${x.reception.nid} — ${projectName(db, x.project)}` +
          `${center === "ALL" ? ` — ${centerName(db, x.reception.center, true)}` : ""} — ${formatTime(x.reception.at)}`,
      ),
    ].filter((l, i) => l || i > 2);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* المتصفح منع النسخ */
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={showWait ? "بانتظار الخدمة الآن" : "حضرت ولم تُخدم"}
      description={
        <>
          {showWait ? "حُوّلت للمشروع ولم تُخدم بعد" : "غادرت قبل خدمتها — رُحّلت يدوياً بعد 2:20 أو تلقائياً بعد 4:00"} · <span className="num">{dayFull(date)}</span>
          {center !== "ALL" && ` · ${centerName(db, center)}`}
        </>
      }
    >
      <div className="space-y-4">
        {(counts.wait > 0 || counts.left > 0) && (
          <Segmented
            label="القائمة"
            value={mode}
            onChange={setMode}
            className="flex w-full [&>button]:flex-1"
            options={[
              { value: "wait", label: "بانتظار الآن", count: counts.wait },
              { value: "left", label: "حضرت ولم تُخدم", count: counts.left },
            ]}
          />
        )}
        {/* ملخص */}
        <div className={cn("grid gap-2", showWait ? "grid-cols-3" : "grid-cols-2")}>
          <div className={cn("rounded-xl px-3 py-2", showWait ? "bg-warn-soft text-warn" : "bg-bad-soft text-bad")}>
            <div className="num text-xl font-bold leading-tight sm:text-2xl">{all.length}</div>
            <div className="text-xs font-semibold opacity-90">{showWait ? "بانتظار" : "لم تُخدم"}</div>
          </div>
          <div className="rounded-xl bg-sunken px-3 py-2">
            <div className="num text-xl font-bold leading-tight sm:text-2xl">{new Set(all.map((x) => x.reception.nid)).size}</div>
            <div className="text-xs font-semibold text-muted">هوية مختلفة</div>
          </div>
          {showWait && (
            <div className={cn("rounded-xl px-3 py-2", longest >= 120 ? "bg-bad-soft text-bad" : "bg-sunken")}>
              <div className="text-sm font-bold leading-tight sm:text-base">{all.length ? minutesText(longest) : "—"}</div>
              <div className="text-xs font-semibold opacity-80">أطول انتظار</div>
            </div>
          )}
        </div>

        {/* المشاريع كفلتر سريع */}
        {byProject.length > 1 && (
          <div className="scroll-fade -mx-5 flex gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6 sm:pe-10">
            <ProjChip on={proj === "ALL"} onClick={() => setProj("ALL")} label="كل المشاريع" n={all.length} />
            {byProject.map((p) => (
              <ProjChip key={p.code} on={proj === p.code} onClick={() => setProj(proj === p.code ? "ALL" : p.code)} label={p.name} n={p.n} color={projectColor(db, p.code)} />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={q} onChange={setQ} placeholder="بحث برقم الهوية أو الاسم" />
          {center === "ALL" && (
            <FilterSelect
              label="المركز"
              value={ctr}
              all="ALL"
              onChange={setCtr}
              options={[{ value: "ALL" as CenterFilter, label: "كل المراكز" }, ...db.centers.map((c) => ({ value: c.code as CenterFilter, label: c.name }))]}
            />
          )}
          <FilterSelect
            label="الترتيب"
            value={sort}
            all="wait"
            onChange={setSort}
            options={[
              { value: "wait", label: "الأطول انتظاراً" },
              { value: "recent", label: "الأحدث وصولاً" },
              { value: "queue", label: "حسب المشروع والدور" },
            ]}
          />
          <ResetFilters
            show={filtering}
            onClick={() => {
              setQ("");
              setProj("ALL");
              setCtr("ALL");
            }}
          />
          <Button variant="secondary" onClick={copyList} disabled={!list.length} className="h-10" title="نسخ القائمة لإرسالها على الواتساب">
            {copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />}
            {copied ? "تم النسخ" : "نسخ القائمة"}
          </Button>
        </div>

        {list.length ? (
          <ul className="-mx-5 divide-y divide-line/60 border-y border-line sm:-mx-6">
            {list.slice(0, limit).map((x) => {
              const b = db.beneficiaries[x.reception.nid];
              const c = projectColor(db, x.project);
              const w = waited(x);
              const ref = x.reception.referrals?.[x.project];
              return (
                <li key={x.reception.id + x.project} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                  <span className="num grid size-11 shrink-0 place-items-center rounded-xl text-lg font-bold text-white" style={{ background: c }} title={`رقم الدور في ${projectName(db, x.project)}`}>
                    {x.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-bold">{b?.name || "بدون اسم"}</span>
                      <IdTypeTag type={b?.type} />
                      <span className="rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: projectSoft(c), color: c }}>
                        {projectName(db, x.project)}
                      </span>
                      {ref && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-info-soft px-1.5 py-0.5 text-xs font-bold text-info">
                          <Stethoscope className="size-3" />
                          من نقطة {ref.from ? projectName(db, ref.from) : userName(db, ref.by)}
                        </span>
                      )}
                      {x.movedFrom && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-warn-soft px-1.5 py-0.5 text-xs font-bold text-warn">
                          <PenLine className="size-3" />
                          محوّلة من {x.movedFrom.map((p) => projectName(db, p)).join("، ")}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                      <span className="num font-semibold tracking-wider text-ink/80">{x.reception.nid}</span>
                      <span>
                        الاستقبال <span className="num">{formatTime(x.reception.at)}</span> · {userName(db, x.reception.userId)}
                      </span>
                      {center === "ALL" && <span>{centerName(db, x.reception.center, true)}</span>}
                      {!showWait && (
                        <span className="font-bold text-bad">
                          {x.left?.auto ? "رُحّلت تلقائياً" : `رحّلها ${x.left?.by ? userName(db, x.left.by) : "الموظف"}${x.left?.at ? ` ${formatTime(x.left.at)}` : ""}`}
                        </span>
                      )}
                      {showWait && isToday && (
                        <span className={cn("inline-flex items-center gap-1 font-bold sm:hidden", w >= 120 ? "text-bad" : w >= 30 ? "text-warn" : "")}>
                          <Clock className="size-3.5" />
                          ينتظر {minutesText(w)}
                        </span>
                      )}
                    </span>
                  </span>
                  {showWait && isToday && (
                    <span
                      className={cn(
                        "hidden shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold sm:inline-flex",
                        w >= 120 ? "bg-bad-soft text-bad" : w >= 30 ? "bg-warn-soft text-warn" : "bg-sunken text-muted",
                      )}
                      title="مدة الانتظار منذ الاستقبال"
                    >
                      <Clock className="size-3.5" />
                      {minutesText(w)}
                    </span>
                  )}
                </li>
              );
            })}
            {list.length > limit && (
              <li>
                <button onClick={() => setLimit((n) => n + PAGE)} className="flex min-h-12 w-full items-center justify-center text-sm font-bold text-brand hover:bg-sunken">
                  عرض المزيد <span className="num ms-1 font-semibold text-muted">({list.length - limit})</span>
                </button>
              </li>
            )}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted">
            <Hourglass className="size-8 text-ok" />
            <p className="font-semibold">
              {all.length ? "لا نتائج مطابقة للفلاتر" : showWait ? "لا يوجد أحد بانتظار الخدمة الآن" : "لا توجد حالات حضرت ولم تُخدم"}
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function ProjChip({ on, onClick, label, n, color }: { on: boolean; onClick: () => void; label: string; n: number; color?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn("focus-ring inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-sm font-bold", on ? "" : "border-line bg-surface hover:border-muted/40")}
      style={on ? { borderColor: color ?? "var(--color-brand)", background: color ? projectSoft(color) : "var(--color-brand-soft)", color: color ?? "var(--color-brand)" } : undefined}
    >
      {color && <span className="size-2.5 rounded-full" style={{ background: color }} />}
      {label}
      <span className="num rounded-full bg-warn px-1.5 text-xs leading-5 text-white">{n}</span>
    </button>
  );
}
