import { cn } from "@/lib/cn";

export type DotColor = "kirmizi" | "sari" | "yesil" | "mercan" | "mavi" | "gri";

const DOT: Record<DotColor, string> = {
  kirmizi: "bg-kirmizi",
  sari: "bg-sari-koyu",
  yesil: "bg-yesil",
  mercan: "bg-pim-mercan",
  mavi: "bg-mavi-koyu",
  gri: "bg-gri-400",
};

export function StatusDot({ color, className }: { color: DotColor; className?: string }) {
  return <span className={cn("inline-block w-2 h-2 rounded-full shrink-0", DOT[color], className)} aria-hidden />;
}
