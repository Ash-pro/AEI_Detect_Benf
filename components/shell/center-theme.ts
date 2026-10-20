import type { CenterCode } from "@/lib/types";

export const CENTER_STYLE: Record<CenterCode, { strip: string; dot: string; text: string; soft: string; ring: string }> = {
  GAZA: { strip: "bg-gaza", dot: "bg-gaza", text: "text-gaza", soft: "bg-gaza/10", ring: "ring-gaza" },
  KHY: { strip: "bg-khy", dot: "bg-khy", text: "text-khy", soft: "bg-khy/10", ring: "ring-khy" },
};
