"use client";

import { useCallback, useRef, useState } from "react";

/** حالة تنفيذ لكل زر: تمنع الضغط المزدوج وتعرف أي عملية جارية الآن.
    const { busy, run } = useBusy();
    <Button loading={busy === "save"} onClick={() => run("save", async () => …)} /> */
export function useBusy<K extends string = string>() {
  const [busy, setBusy] = useState<K | null>(null);
  const ref = useRef<K | null>(null);
  const run = useCallback(async <T,>(key: K, fn: () => Promise<T>): Promise<T | undefined> => {
    if (ref.current) return undefined;
    ref.current = key;
    setBusy(key);
    try {
      return await fn();
    } finally {
      ref.current = null;
      setBusy(null);
    }
  }, []);
  return { busy, run, any: busy !== null };
}
