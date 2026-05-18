"use client";

/**
 * ViewModeBanner — admin/staff kullanıcı "müşteri görünümü"ndeyken üstte
 * uyarı çubuğu. Tek tıkla admin paneline geri döner.
 *
 * Cookie pim_view_mode=customer ise gösterilir.
 *
 * Sefa 18 May v68 (CRO denetim — UX KRİTİK fix):
 * Eski versiyon SADECE cookie'ye bakıyordu — non-admin kullanıcılarda
 * stale cookie sebebiyle banner public olarak rendered oluyordu (ana
 * sayfa, /etiket, /sticker, /galeri, /blog, /sepet — her sayfada).
 * Misafir ziyaretçi "dev sitesi mi?" izlenimi aldı.
 *
 * Şimdi: cookie + Supabase auth check + profiles.role kontrolü.
 * Sadece admin/staff rolündeki kullanıcı bu banner'ı görür.
 * Non-admin'in tarayıcısında cookie kalmışsa otomatik silinir.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const COOKIE_NAME = "pim_view_mode";

function readViewModeCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.split("=")[1] ?? "") : null;
}

function clearViewModeCookie() {
  if (typeof document === "undefined") return;
  // Tüm path/domain kombinasyonlarında temizle
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export function ViewModeBanner() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Önce cookie kontrolü — yoksa hiçbir şey yapma
    if (readViewModeCookie() !== "customer") {
      return;
    }

    // Cookie var → auth + role kontrolü zorunlu
    async function verifyAdminRole() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Auth yok → cookie stale, sil + gösterme
      if (!user) {
        clearViewModeCookie();
        if (!cancelled) setShow(false);
        return;
      }

      // Role check
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const role = (profile as { role?: string } | null)?.role;
      const isAdmin = role === "admin" || role === "staff";

      // Non-admin → cookie stale (eski admin oturumundan kalmış olabilir), sil
      if (!isAdmin) {
        clearViewModeCookie();
        if (!cancelled) setShow(false);
        return;
      }

      // Admin/staff + cookie=customer → banner göster
      if (!cancelled) setShow(true);
    }

    void verifyAdminRole();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const switchToAdmin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/view-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "admin" }),
      });
      if (res.ok) {
        setShow(false);
        router.push("/admin");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-pim-mercan text-white text-[13px] font-semibold">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8 h-9 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 truncate">
          <span className="inline-flex w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Müşteri görünümü aktif — bunu sadece sen görüyorsun
        </span>
        <button
          type="button"
          onClick={switchToAdmin}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-white text-pim-mercan text-[12.5px] font-bold hover:bg-white/90 transition-colors disabled:opacity-60"
        >
          {busy ? "…" : "↑ Admin'e dön"}
        </button>
      </div>
    </div>
  );
}
