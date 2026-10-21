"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "ok" | "bad" | "info";
interface Toast {
  id: number;
  tone: Tone;
  text: string;
}

const Ctx = createContext<(text: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Tone = "ok") => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l, { id, tone, text }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => {
          const Icon = t.tone === "ok" ? CheckCircle2 : t.tone === "bad" ? XCircle : Info;
          return (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto flex max-w-md animate-fade-up items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold shadow-pop",
                t.tone === "ok" && "bg-ok text-white",
                t.tone === "bad" && "bg-bad text-white",
                t.tone === "info" && "bg-ink text-white",
              )}
            >
              <Icon className="size-5 shrink-0" />
              {t.text}
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
