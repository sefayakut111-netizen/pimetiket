"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DestekPanel } from "@/components/admin/destek/DestekPanel";
import { YardimPanel } from "@/components/admin/destek/YardimPanel";

type DestekTab = "genel" | "yardim";

const TABS: { id: DestekTab; label: string }[] = [
  { id: "genel", label: "Genel Destek" },
  { id: "yardim", label: "Prova Yardımı" },
];

function parseTab(v: string | null): DestekTab {
  return v === "yardim" ? "yardim" : "genel";
}

export default function AdminDestekPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-56px)]" />}>
      <AdminDestekPageInner />
    </Suspense>
  );
}

function AdminDestekPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const setTab = (next: DestekTab) => {
    router.replace(
      next === "genel" ? "/admin/destek" : "/admin/destek?tab=yardim",
      { scroll: false }
    );
  };

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <Eyebrow>Müşteri</Eyebrow>
        <h1 className="mt-3 text-[28px] font-semibold">Destek</h1>
        <p className="text-sm text-gri-600 mt-2 mb-6">
          Genel destek talepleri ve prova/onay ekranından gelen yardım
          istekleri tek yerde.
        </p>

        <div className="flex gap-2 border-b border-gri-200 mb-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-2 text-[13.5px] font-medium transition-colors -mb-px",
                tab === t.id
                  ? "border-b-2 border-pim-mercan font-semibold text-lacivert"
                  : "text-gri-700 hover:text-lacivert"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "genel" ? <DestekPanel /> : <YardimPanel />}
      </div>
    </main>
  );
}
