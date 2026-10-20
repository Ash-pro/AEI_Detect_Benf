"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** تأكيد قصير ثم رجوع تلقائي لحقل الهوية */
export function SuccessPanel({
  title,
  lines,
  chips,
  onDone,
  seconds = 3,
}: {
  title: string;
  lines: React.ReactNode[];
  chips?: string[];
  onDone: () => void;
  seconds?: number;
}) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    const onKey = (e: KeyboardEvent) => e.key === "Enter" && onDone();
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDone]);
  useEffect(() => {
    if (left <= 0) onDone();
  }, [left, onDone]);

  return (
    <Card className="animate-fade-up overflow-hidden" role="status" aria-live="polite">
      <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-ok-soft text-ok">
          <CheckCircle2 className="size-9" />
        </span>
        <h2 className="mt-4 text-2xl font-bold">{title}</h2>
        <div className="mt-2 space-y-1 text-muted">
          {lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
        {chips && chips.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {chips.map((c) => (
              <span key={c} className="rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand">
                {c}
              </span>
            ))}
          </div>
        )}
        <Button variant="secondary" className="mt-6" onClick={onDone}>
          الحالة التالية <span className="num text-muted">({Math.max(left, 0)})</span>
        </Button>
      </div>
      <div className="h-1 bg-sunken">
        <div
          className="h-full bg-ok transition-[width] duration-1000 ease-linear"
          style={{ width: `${(Math.max(left, 0) / seconds) * 100}%` }}
        />
      </div>
    </Card>
  );
}
