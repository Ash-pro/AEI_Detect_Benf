"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { pendingCount, subscribePending } from "@/lib/pending";

/** شريط تقدّم رفيع أعلى الشاشة يظهر أثناء أي عملية مع قاعدة البيانات.
    يظهر فقط إذا تجاوزت العملية 150ms حتى لا يومض في العمليات السريعة. */
export function GlobalProgress() {
  const count = useSyncExternalStore(subscribePending, pendingCount, () => 0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (count > 0) {
      const t = window.setTimeout(() => setShow(true), 150);
      return () => window.clearTimeout(t);
    }
    setShow(false);
  }, [count]);

  useEffect(() => {
    document.documentElement.classList.toggle("is-busy", show);
  }, [show]);

  return (
    <div
      role="progressbar"
      aria-label="جارٍ التنفيذ"
      aria-hidden={!show}
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden transition-opacity duration-200 ${show ? "opacity-100" : "opacity-0"}`}
    >
      <div className="progress-indeterminate h-full w-1/3 rounded-full bg-brand" />
    </div>
  );
}
