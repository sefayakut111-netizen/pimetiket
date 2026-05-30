"use client";

import { useState } from "react";
import { Button, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

export function ContractDownloadButton({
  partnerId,
  hasContract,
  size = "sm",
  className,
  onClickStopPropagation,
}: {
  partnerId: string;
  hasContract: boolean;
  size?: "sm" | "md";
  className?: string;
  onClickStopPropagation?: boolean;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  if (!hasContract) return null;

  const download = async (e?: React.MouseEvent) => {
    if (onClickStopPropagation) {
      e?.stopPropagation();
      e?.preventDefault();
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/fason/partners/${encodeURIComponent(partnerId)}/contract/download`
      );
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        toast.error(json.error ?? "Sozlesme indirilemedi");
        return;
      }
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Sozlesme indirilemedi (ag hatasi)");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      disabled={loading}
      className={cn(className)}
      onClick={(e) => void download(e)}
    >
      {loading ? "Hazirlaniyor..." : "Sozlesme indir"}
    </Button>
  );
}
