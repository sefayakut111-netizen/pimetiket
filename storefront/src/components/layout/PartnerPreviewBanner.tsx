"use client";

/**
 * PartnerPreviewBanner — admin/staff partner arayüz denetim modundayken üstte banner.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const VIEW_MODE_COOKIE = "pim_view_mode";

function readViewModeCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${VIEW_MODE_COOKIE}=`));
  return match ? decodeURIComponent(match.split("=")[1] ?? "") : null;
}

export function PartnerPreviewBanner() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (readViewModeCookie() !== "partner") return;

    async function verify() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setShow(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const role = (profile as { role?: string } | null)?.role;
      if (role !== "admin" && role !== "staff") {
        if (!cancelled) setShow(false);
        return;
      }
      if (!cancelled) setShow(true);
    }
    void verify();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const exitPreview = async () => {
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
    <div className="bg-lacivert text-white text-[13px] font-semibold">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8 h-9 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 truncate">
          <span className="inline-flex w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Partner arayüz denetimi aktif — admin oturumun korunuyor
        </span>
        <button
          type="button"
          onClick={exitPreview}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-white text-lacivert text-[12.5px] font-bold hover:bg-white/90 transition-colors disabled:opacity-60"
        >
          {busy ? "…" : "↑ Admin'e dön"}
        </button>
      </div>
    </div>
  );
}
