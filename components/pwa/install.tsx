"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, EllipsisVertical, Share, SquarePlus, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, storageGet, storageSet } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const HIDE_KEY = "aei.pwa.hiddenUntil";
const INSTALL_EVENT = "aei:install";

/** يُستدعى من أي زر "تثبيت التطبيق" في القوائم */
export function requestInstall() {
  window.dispatchEvent(new Event(INSTALL_EVENT));
}

/** هل التطبيق مثبت ويعمل كتطبيق مستقل؟ */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** تسجيل Service Worker + زر جانبي لتثبيت التطبيق على الجوال */
export function PwaInstall() {
  const toast = useToast();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [hidden, setHidden] = useState(true);
  const [isIos, setIsIos] = useState(false);
  const [help, setHelp] = useState(false);
  // الزر العائم في شاشتي المركز والدخول فقط، حتى لا يغطي شاشات العمل اليومية
  const path = usePathname();
  const floating = path === "/login" || path === "/setup";

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    setInstalled(isStandalone());
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setHidden(storageGet<number>(HIDE_KEY, 0) > Date.now());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // زر التثبيت من القوائم
  useEffect(() => {
    const onRequest = () => void install();
    window.addEventListener(INSTALL_EVENT, onRequest);
    return () => window.removeEventListener(INSTALL_EVENT, onRequest);
  });

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      if (outcome === "accepted") toast("تم تثبيت التطبيق على الجهاز");
      return;
    }
    setHelp(true);
  }

  function dismiss() {
    storageSet(HIDE_KEY, Date.now() + 3 * 24 * 60 * 60 * 1000);
    setHidden(true);
  }

  if (installed) return null;

  return (
    <>
      {!hidden && floating && (
        <div
          className={cn("fixed start-0 z-40 flex animate-fade-in flex-col items-start gap-1", !deferred && "lg:hidden")}
          style={{ bottom: "calc(112px + env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            onClick={dismiss}
            aria-label="إخفاء زر التثبيت"
            className="focus-ring ms-1 grid size-6 place-items-center rounded-full border border-line bg-surface text-muted shadow-card"
          >
            <X className="size-3" />
          </button>
          <button
            onClick={install}
            className="focus-ring flex w-[54px] flex-col items-center gap-0.5 rounded-e-2xl bg-brand py-2.5 text-[11px] font-bold leading-tight text-brand-ink shadow-pop active:scale-[0.97]"
            aria-label="تثبيت التطبيق على الجهاز"
          >
            <Download className="size-5" />
            تثبيت
          </button>
        </div>
      )}

      <Dialog
        open={help}
        onClose={() => setHelp(false)}
        title="تثبيت التطبيق"
        description="يعمل بعدها من شاشة الجوال الرئيسية مثل أي تطبيق"
        footer={
          <Button size="lg" onClick={() => setHelp(false)}>
            تم
          </Button>
        }
      >
        {isIos ? (
          <ol className="space-y-4">
            <Step n={1} icon={<Share className="size-5" />}>
              افتح الموقع في <b>Safari</b> واضغط زر <b>المشاركة</b> أسفل الشاشة
            </Step>
            <Step n={2} icon={<SquarePlus className="size-5" />}>
              اختر <b>إضافة إلى الشاشة الرئيسية</b>
            </Step>
            <Step n={3} icon={<Download className="size-5" />}>
              اضغط <b>إضافة</b>، وستظهر أيقونة التطبيق على الشاشة
            </Step>
          </ol>
        ) : (
          <ol className="space-y-4">
            <Step n={1} icon={<EllipsisVertical className="size-5" />}>
              افتح قائمة المتصفح <b>⋮</b> في أعلى الشاشة. على الكمبيوتر يمكنك الضغط على أيقونة التثبيت في شريط العنوان مباشرة
            </Step>
            <Step n={2} icon={<Download className="size-5" />}>
              اختر <b>تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>
            </Step>
            <Step n={3} icon={<SquarePlus className="size-5" />}>
              أكّد التثبيت، وستظهر أيقونة التطبيق على الشاشة
            </Step>
          </ol>
        )}
        <p className="mt-5 rounded-xl bg-sunken px-4 py-3 text-xs leading-relaxed text-muted">
          التثبيت يتطلب فتح الموقع من رابطه الآمن (https)، مثل رابط Vercel بعد النشر.
        </p>
      </Dialog>
    </>
  );
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="num grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-brand-ink">{n}</span>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sunken text-ink">{icon}</span>
      <span className="text-[15px]">{children}</span>
    </li>
  );
}
