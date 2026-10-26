"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { supabase, usernameToEmail } from "./supabase/client";
import { StoreProvider as LiveStoreProvider } from "./store";
import { DemoStoreProvider } from "./demo-store";
import { errorText } from "./data";
import { PageLoader } from "@/components/ui/page-loader";

/* وضع الموقع: حقيقي (Supabase) أو عرض تجريبي (بيانات محلية في المتصفح).
   يُحفظ في قاعدة البيانات ويطبَّق على كل الأجهزة، ويغيّره الأدمن من الإعدادات. */

export type SiteMode = "live" | "demo";

interface ModeCtx {
  mode: SiteMode;
  /** تشغيل العرض التجريبي — من جلسة الأدمن الحقيقية */
  enableDemo: () => Promise<string | null>;
  /** الرجوع للوضع الحقيقي — بجلسة الأدمن الحقيقية إن وُجدت، أو ببيانات دخوله */
  disableDemo: (cred?: { username: string; password: string }) => Promise<string | "NEED_LOGIN" | null>;
}

const Ctx = createContext<ModeCtx>({ mode: "live", enableDemo: async () => null, disableDemo: async () => null });

const FORCED = process.env.NEXT_PUBLIC_DEMO === "1";
const DEMO_USER_KEY = "aei.demo.user";

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<SiteMode | null>(FORCED ? "demo" : null);

  useEffect(() => {
    if (FORCED) return;
    let alive = true;
    supabase()
      .rpc("site_mode")
      .then(({ data, error }) => alive && setMode(!error && data === true ? "demo" : "live"))
      .then(undefined, () => alive && setMode("live"));
    // الأجهزة المفتوحة: عند الرجوع للتطبيق يُعاد فحص الوضع، وإن تغيّر تُحدَّث الصفحة
    const recheck = () => {
      if (document.visibilityState !== "visible") return;
      supabase()
        .rpc("site_mode")
        .then(({ data, error }) => {
          if (error || !alive) return;
          const next: SiteMode = data === true ? "demo" : "live";
          setMode((cur) => {
            if (cur && cur !== next) window.location.reload();
            return cur;
          });
        });
    };
    document.addEventListener("visibilitychange", recheck);
    const t = window.setInterval(recheck, 60_000);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", recheck);
      window.clearInterval(t);
    };
  }, []);

  const enableDemo = useCallback(async () => {
    const { error } = await supabase().rpc("set_demo_mode", { p_on: true });
    if (error) return errorText(error);
    try {
      localStorage.removeItem(DEMO_USER_KEY);
    } catch {
      /* تجاهل */
    }
    window.location.assign("/login");
    return null;
  }, []);

  const disableDemo = useCallback(async (cred?: { username: string; password: string }) => {
    const sb = supabase();
    if (cred) {
      const { error } = await sb.auth.signInWithPassword({ email: usernameToEmail(cred.username), password: cred.password });
      if (error) return "اسم المستخدم أو كلمة المرور غير صحيحة";
    } else {
      const { data } = await sb.auth.getSession();
      if (!data.session) return "NEED_LOGIN";
    }
    const { error } = await sb.rpc("set_demo_mode", { p_on: false });
    if (error) return cred ? "هذا الحساب ليس أدمن في النظام الحقيقي" : "NEED_LOGIN";
    try {
      localStorage.removeItem(DEMO_USER_KEY);
    } catch {
      /* تجاهل */
    }
    window.location.assign("/admin");
    return null;
  }, []);

  if (!mode) return <PageLoader />;
  const Store = mode === "demo" ? DemoStoreProvider : LiveStoreProvider;

  return (
    <Ctx.Provider value={{ mode, enableDemo, disableDemo }}>
      {mode === "demo" && (
        <div role="status" className="flex items-center justify-center gap-2 bg-warn px-4 py-1.5 text-center text-xs font-bold text-white sm:text-sm">
          <FlaskConical className="size-4 shrink-0" />
          وضع العرض التجريبي — البيانات تجريبية ولا تُحفظ في قاعدة البيانات
        </div>
      )}
      <Store>{children}</Store>
    </Ctx.Provider>
  );
}

export function useSiteMode() {
  return useContext(Ctx);
}
