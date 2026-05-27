"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/** Geri sayım — estimated_delivery / sla deadline'a göre */
export function PartnerCountdownTimer({
  deadline,
  className,
}: {
  deadline: string | null | undefined;
  className?: string;
}) {
  const [label, setLabel] = useState("—");

  useEffect(() => {
    if (!deadline) {
      setLabel("—");
      return;
    }

    const tick = () => {
      const ms = new Date(deadline).getTime() - Date.now();
      if (ms <= 0) {
        setLabel("Süre doldu");
        return;
      }
      const h = Math.floor(ms / (1000 * 60 * 60));
      const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      if (h >= 48) {
        setLabel(`${Math.floor(h / 24)}g ${h % 24}s`);
      } else if (h > 0) {
        setLabel(`${h}s ${m}dk`);
      } else {
        setLabel(`${m} dk`);
      }
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [deadline]);

  const overdue =
    deadline && new Date(deadline).getTime() < Date.now();

  return (
    <span
      className={cn(
        "font-mono text-[12px] font-semibold tabular-nums",
        overdue ? "text-kirmizi" : "text-lacivert",
        className
      )}
    >
      {label}
    </span>
  );
}
