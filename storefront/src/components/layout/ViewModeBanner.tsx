"use client";

/**
 * ViewModeBanner — admin/staff kullanıcı "müşteri görünümü"ndeyken üstte
 * uyarı çubuğu. Tek tıkla admin paneline geri döner.
 *
 * Cookie pim_view_mode=customer ise gösterilir. Cookie httpOnly:false
 * olduğu için client-side document.cookie'den okunur.
 *
 * Sadece login admin'lerin gördüğü çubuk olduğu için stale bir cookie
 * (rol değişti, role artık admin değil) middleware tarafından zaten
 * yok sayılır — banner sadece UX kolaylığı.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const COOKIE_NAME = "pim_view_mode";

function readViewModeCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.split("=")[1] ?? "") : null;
}

export function ViewModeBanner() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setShow(readViewModeCookie() === "customer");
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
