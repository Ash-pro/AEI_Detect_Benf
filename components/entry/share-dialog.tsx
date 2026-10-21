"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** مشاركة نص الإحصائيات على الواتساب أو نسخه */
export function ShareDialog({ open, onClose, text, title }: { open: boolean; onClose: () => void; text: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.getElementById("share-text") as HTMLTextAreaElement | null;
      el?.select();
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description="راجع النص ثم أرسله على الواتساب"
      footer={
        <>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[#128c4a] px-6 text-base font-semibold text-white hover:bg-[#0f7a40] sm:min-w-[200px]"
          >
            <MessageCircle className="size-5" />
            إرسال على الواتساب
          </a>
          {canShare && (
            <Button variant="secondary" size="lg" onClick={() => navigator.share({ text }).catch(() => {})}>
              <Share2 className="size-5" />
              مشاركة
            </Button>
          )}
          <Button variant="secondary" size="lg" onClick={copy}>
            {copied ? <Check className="size-5 text-ok" /> : <Copy className="size-5" />}
            {copied ? "تم النسخ" : "نسخ النص"}
          </Button>
        </>
      }
    >
      <textarea
        id="share-text"
        readOnly
        value={text}
        rows={Math.min(text.split("\n").length + 1, 18)}
        className="w-full resize-none rounded-2xl rounded-bl-md border border-line bg-[#e7f6ec] p-4 text-[15px] leading-7 text-ink outline-hidden"
      />
    </Dialog>
  );
}
