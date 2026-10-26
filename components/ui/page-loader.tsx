"use client";

import { useEffect, useState } from "react";
import { Spinner } from "./spinner";

/** شاشة تحميل عند فتح التطبيق أو التنقل بين الحسابات.
    تظهر بعد 200ms فقط حتى لا تومض عند التحميل السريع. */
export function PageLoader({ label = "جارٍ التحميل…" }: { label?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShow(true), 200);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-6" aria-busy="true">
      {show && (
        <div role="status" className="flex animate-fade-in flex-col items-center gap-4 text-center">
          <span className="relative grid size-20 place-items-center">
            <Spinner className="absolute inset-0 size-20 text-brand/80 [&_circle]:opacity-10" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/aei-logo-256.png" alt="" className="size-12 object-contain" />
          </span>
          <span className="text-sm font-semibold text-muted">{label}</span>
        </div>
      )}
    </div>
  );
}
