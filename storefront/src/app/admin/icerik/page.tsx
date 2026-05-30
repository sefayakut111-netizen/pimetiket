/**
 * /admin/icerik — CMS hub (ürünler, blog, galeri, site görselleri)
 */

"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import { UrunlerTab } from "@/components/admin/icerik/UrunlerTab";
import { BlogTab } from "@/components/admin/icerik/BlogTab";
import { GaleriTab } from "@/components/admin/icerik/GaleriTab";
import { GorsellerTab } from "@/components/admin/icerik/GorsellerTab";

type IcerikTab = "urunler" | "blog" | "galeri" | "gorseller";

const TABS: { id: IcerikTab; label: string }[] = [
  { id: "urunler", label: "Ürünler" },
  { id: "blog", label: "Blog" },
  { id: "galeri", label: "Galeri" },
  { id: "gorseller", label: "Site Görselleri" },
];

function parseTab(v: string | null): IcerikTab {
  if (v === "blog" || v === "galeri" || v === "gorseller") return v;
  return "urunler";
}

export default function AdminIcerikPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-56px)]" />}>
      <AdminIcerikPageInner />
    </Suspense>
  );
}

function AdminIcerikPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const setTab = (next: IcerikTab) => {
    router.replace(`/admin/icerik?tab=${next}`, { scroll: false });
  };

  return (
    <div>
      <div className="mx-auto max-w-[1320px] px-6 pt-6 pb-2">
        <Eyebrow>İçerik</Eyebrow>
        <div className="flex gap-2 border-b border-gri-200 mt-4 mb-0">
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
      </div>

      {tab === "urunler" && <UrunlerTab />}
      {tab === "blog" && <BlogTab />}
      {tab === "galeri" && <GaleriTab />}
      {tab === "gorseller" && <GorsellerTab />}
    </div>
  );
}
