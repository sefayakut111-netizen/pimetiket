/**
 * AdminShell "Partner arayüz denetimi" butonu.
 * Partner seçimi yok — ortak arayüz tek tıkla açılır (müşteri görünümü gibi).
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PartnerImpersonatePicker({
  variant,
}: {
  variant: "topbar" | "sidebar";
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  async function switchToPartnerPreview() {
    if (switching) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/view-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "partner" }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        alert(
          "Partner arayüz denetimi hatası: " +
            (j.error ?? `HTTP ${res.status}`)
        );
        return;
      }
      router.push("/partner");
      router.refresh();
    } catch (err) {
      alert("Hata: " + (err instanceof Error ? err.message : "Bilinmeyen"));
    } finally {
      setSwitching(false);
    }
  }

  const triggerCls =
    variant === "topbar"
      ? "hidden md:inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-lacivert/10 text-lacivert text-[12.5px] font-semibold hover:bg-lacivert/15 transition-colors disabled:opacity-50"
      : "w-full flex items-center gap-2 h-9 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12.5px] font-semibold transition-colors disabled:opacity-50";

  return (
    <button
      type="button"
      onClick={switchToPartnerPreview}
      disabled={switching}
      className={triggerCls}
      title="Partner arayüzünü denetle (ortak panel)"
    >
      <span aria-hidden>📦</span>
      {switching ? "…" : "Partner arayüzü"}
      {variant === "sidebar" && !switching && (
        <span className="ml-auto opacity-70" aria-hidden>
          →
        </span>
      )}
    </button>
  );
}
