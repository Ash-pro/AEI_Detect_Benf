"use client";

import { useEffect, useState } from "react";
import { Download, EllipsisVertical, Share, SquarePlus, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { storageGet, storageSet } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const HIDE_KEY = "aei.pwa.hiddenUntil";

/** تسجيل Service Worker + زر جانبي لتثبيت التطبيق على الجوال */
export function PwaInstall() {
  const toast = useToast();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [hidden, setHidden] = useState(true);
  const [isIos, setIsIos] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
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
      {!hidden && (
        <div
          className="fixed start-0 z-40 flex animate-fade-in flex-col items-start gap-1 lg:hidden"
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
              افتح قائمة المتصفح <b>⋮</b> في أعلى الشاشة
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
