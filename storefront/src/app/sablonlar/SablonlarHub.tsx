"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import KesimSablonlari from "@/components/templates/KesimSablonlari";
import TasarimSablonlari from "@/components/templates/TasarimSablonlari";
import { cn } from "@/lib/cn";

type Tab = "kesim" | "tasarim";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "kesim", label: "Kesim Şablonları" },
  { id: "tasarim", label: "Tasarım Şablonları" },
];

export function SablonlarHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab = tabParam === "tasarim" ? "tasarim" : "kesim";

  const setTab = useCallback(
    (next: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "kesim") {
        params.delete("tab");
      } else {
        params.set("tab", next);
      }
      const qs = params.toString();
      router.replace(qs ? `/sablonlar?${qs}` : "/sablonlar", { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <>
      <div
        role="tablist"
        aria-label="Şablon türü"
        className="flex gap-1 p-1 mb-8 rounded-xl bg-gri-100 ring-1 ring-gri-200 max-w-md"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 h-10 rounded-lg text-[13.5px] font-semibold transition-colors",
              tab === t.id
                ? "bg-white text-lacivert shadow-1"
                : "text-gri-700 hover:text-lacivert"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "kesim" ? <KesimSablonlari /> : <TasarimSablonlari />}
      </div>
    </>
  );
}
