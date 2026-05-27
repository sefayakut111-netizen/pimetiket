/**
 * /tasarımlarım — kullanıcının tasarım kütüphanesi.
 *
 * Müşteri eski upload'larını bir bakışta görür: thumbnail, dosya adı,
 * sipariş bağlantısı, AI status. "Yeniden bastır" tıklanınca konfigüratöre
 * gider, design pre-fill edilir (sessionStorage üzerinden).
 *
 * Hibrit:
 *   - Auth varsa: DB'den listMyDesigns
 *   - Auth yoksa: empty state + login CTA
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, Skeleton, useToast } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import {
  listMyDesigns,
  type CustomerDesign,
} from "@/lib/customer-designs";
import { ensureAuthBindings } from "@/lib/customer-cart";
import { isLoggedInSync } from "@/lib/supabase/auth-bridge";

const COPY = {
  tr: {
    eyebrow: "Hesabım",
    title: "Tasarım kütüphanem",
    subtitle: (n: number) =>
      n === 0
        ? "Henüz hiç tasarım yüklemedin."
        : `${n} tasarım yüklendi — yeniden bastırmak için tek tıkla.`,
    loading: "Yükleniyor…",
    emptyTitle: "Henüz tasarım yok",
    emptyDesc:
      "İlk siparişinde tasarım yükleyince bu kütüphane otomatik dolar. Sonra her bastırmak istediğinde buradan tek tıkla seçersin.",
    emptyCtaPrimary: "Sticker bastır",
    emptyCtaSecondary: "Etiket bastır",
    loginRequired: "Tasarımlarını görmek için giriş yap",
    loginCta: "Giriş yap",
    statusPassed: "AI geçti",
    statusWarned: "Uyarı",
    statusFailed: "Hata",
    statusPending: "İnceleniyor",
    statusApproved: "Onaylı",
    downloadCta: "İndir",
    reprintCta: "Yeniden bastır",
    viewOrder: "Sipariş",
    fileSize: "KB",
    locale: "tr-TR",
  },
  en: {
    eyebrow: "My account",
    title: "My design library",
    subtitle: (n: number) =>
      n === 0
        ? "No designs uploaded yet."
        : `${n} design${n === 1 ? "" : "s"} — one click to reprint.`,
    loading: "Loading…",
    emptyTitle: "No designs yet",
    emptyDesc:
      "Once you upload a design with your first order, this library fills automatically. Pick from here next time you reprint.",
    emptyCtaPrimary: "Print stickers",
    emptyCtaSecondary: "Print labels",
    loginRequired: "Sign in to view your designs",
    loginCta: "Sign in",
    statusPassed: "AI passed",
    statusWarned: "Warning",
    statusFailed: "Failed",
    statusPending: "Reviewing",
    statusApproved: "Approved",
    downloadCta: "Download",
    reprintCta: "Reprint",
    viewOrder: "Order",
    fileSize: "KB",
    locale: "en-US",
  },
};

function buildDesignDownloadUrl(d: CustomerDesign): string | null {
  if (!d.orderItemId) return null;
  const qs = new URLSearchParams({
    design_file_id: d.id,
    download: "1",
  });
  return `/api/orders/${d.orderId}/items/${d.orderItemId}/design-file?${qs}`;
}

function statusLabel(
  status: CustomerDesign["status"],
  c: typeof COPY.tr
): { label: string; color: string; bg: string } {
  switch (status) {
    case "approved":
      return {
        label: c.statusApproved,
        color: "text-yesil",
        bg: "bg-yesil-soft",
      };
    case "qc_passed":
      return {
        label: c.statusPassed,
        color: "text-yesil",
        bg: "bg-yesil-soft",
      };
    case "qc_warned":
      return {
        label: c.statusWarned,
        color: "text-sari-koyu",
        bg: "bg-sari-soft",
      };
    case "qc_failed":
      return {
        label: c.statusFailed,
        color: "text-kirmizi",
        bg: "bg-kirmizi/10",
      };
    case "uploaded":
    case "analyzing":
      return {
        label: c.statusPending,
        color: "text-pim-mercan",
        bg: "bg-pim-mercan-tint",
      };
    default:
      return {
        label: status,
        color: "text-gri-700",
        bg: "bg-gri-100",
      };
  }
}

export default function TasarimlarimPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;
  const router = useRouter();
  const toast = useToast();

  const [designs, setDesigns] = useState<CustomerDesign[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [reprintingId, setReprintingId] = useState<string | null>(null);

  useEffect(() => {
    ensureAuthBindings();
    setAuthed(isLoggedInSync());

    void listMyDesigns().then((list) => {
      setDesigns(list);
      setHydrated(true);
    });

    const handler = () => {
      setAuthed(isLoggedInSync());
      void listMyDesigns().then(setDesigns);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("pim_auth_signed_in", handler);
      window.addEventListener("pim_auth_signed_out", handler);
      return () => {
        window.removeEventListener("pim_auth_signed_in", handler);
        window.removeEventListener("pim_auth_signed_out", handler);
      };
    }
  }, []);

  const handleReprint = async (d: CustomerDesign) => {
    if (reprintingId) return;
    setReprintingId(d.id);
    try {
      const res = await fetch("/api/design/reprint-from-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designFileId: d.id }),
      });
      const json = (await res.json()) as {
        tempId?: string;
        previewUrl?: string | null;
        fileName?: string;
        sizeBytes?: number;
        mimeType?: string;
        error?: string;
      };
      if (!res.ok || !json.tempId || !json.previewUrl) {
        toast.error(
          locale === "en"
            ? "Could not prepare design for reprint."
            : "Tasarım yeniden bastırma için hazırlanamadı."
        );
        return;
      }
      sessionStorage.setItem(
        "pim_reprint_design",
        JSON.stringify({
          tempId: json.tempId,
          previewUrl: json.previewUrl,
          fileName: json.fileName ?? d.originalName,
          sizeBytes: json.sizeBytes ?? d.sizeBytes,
          mimeType: json.mimeType ?? d.mimeType,
        })
      );
      const target = d.product === "etiket" ? "/etiket/yapilandir" : "/sticker/yapilandir";
      router.push(`${target}?reprint=1`);
    } catch {
      toast.error(
        locale === "en"
          ? "Reprint failed. Try again."
          : "Yeniden bastırma başarısız. Tekrar dene."
      );
    } finally {
      setReprintingId(null);
    }
  };

  // Loading skeleton
  if (!hydrated) {
    return (
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[1080px] px-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-2xl" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Auth yok → login CTA
  if (!authed) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[520px] px-6 text-center">
          <Pim pose="think" size={140} />
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[26px] md:text-[32px] font-semibold tracking-tight">
            {c.title}
          </h1>
          <p className="mt-3 text-base text-gri-700 leading-relaxed">
            {c.loginRequired}
          </p>
          <div className="mt-6">
            <Button
              variant="primary"
              size="lg"
              href={`/auth?next=${encodeURIComponent("/tasarimlarim")}`}
            >
              {c.loginCta}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1080px] px-6">
        {/* Header */}
        <div className="flex items-end justify-between gap-4 mb-7 flex-wrap">
          <div>
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              {c.title}
            </h1>
            <p className="mt-2 text-base text-gri-700">
              {c.subtitle(designs.length)}
            </p>
          </div>
          {designs.length > 0 && (
            <div className="hidden md:block">
              <Pim pose="happy" size={80} bob={false} />
            </div>
          )}
        </div>

        {designs.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="think" size={140} />
            <h3 className="mt-4 text-xl font-semibold mb-2">
              {c.emptyTitle}
            </h3>
            <p className="text-base text-gri-700 mb-5 max-w-[480px] mx-auto leading-relaxed">
              {c.emptyDesc}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button variant="primary" size="lg" href="/sticker">
                <Icon.Sticker size={16} /> {c.emptyCtaPrimary}
              </Button>
              <Button variant="secondary" size="lg" href="/etiket">
                <Icon.Roll size={16} /> {c.emptyCtaSecondary}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {designs.map((d) => {
              const status = statusLabel(d.status, c);
              const downloadUrl = buildDesignDownloadUrl(d);
              const sizeKb = (d.sizeBytes / 1024).toFixed(1);
              const date = new Date(d.uploadedAt).toLocaleDateString(c.locale, {
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              return (
                <Card
                  key={d.id}
                  padding=""
                  className="!p-0 overflow-hidden hover:shadow-2 transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[4/3] bg-gri-100 grid place-items-center overflow-hidden">
                    {d.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.previewUrl}
                        alt={d.originalName}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Icon.Box size={48} className="text-gri-500" />
                    )}
                    {/* Status badge */}
                    <span
                      className={`absolute top-2 right-2 inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-bold ${status.bg} ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    <div className="font-semibold text-[14px] text-lacivert truncate">
                      {d.originalName}
                    </div>
                    <div className="text-[11.5px] text-gri-500 mt-0.5">
                      {sizeKb} {c.fileSize} · {date}
                    </div>

                    {d.productTitle && (
                      <div className="mt-2 text-[12px] text-gri-700 truncate">
                        {d.productTitle}
                      </div>
                    )}
                    {d.productConfig && (
                      <div className="text-[11px] text-gri-500 truncate">
                        {d.productConfig}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-3 flex flex-col gap-2 sm:grid sm:grid-cols-3">
                      {downloadUrl ? (
                        <a
                          href={downloadUrl}
                          download={d.originalName}
                          className="inline-flex items-center justify-center gap-1 min-h-11 h-11 px-2 rounded-full border border-gri-200 bg-white text-[11px] font-semibold text-gri-700 hover:border-pim-mercan hover:text-pim-mercan transition-colors"
                        >
                          <Icon.Doc size={12} /> {c.downloadCta}
                        </a>
                      ) : (
                        <span
                          className="inline-flex items-center justify-center min-h-11 h-11 px-2 rounded-full border border-gri-100 bg-gri-50 text-[11px] font-semibold text-gri-400 cursor-not-allowed"
                          aria-disabled
                        >
                          {c.downloadCta}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleReprint(d)}
                        className="inline-flex items-center justify-center gap-1 min-h-11 h-11 px-2 rounded-full bg-pim-mercan text-white text-[11px] font-semibold hover:bg-pim-mercan-koyu transition-colors"
                      >
                        <Icon.Bolt size={12} /> {c.reprintCta}
                      </button>
                      <Link
                        href={`/siparis/${d.orderId}`}
                        className="inline-flex items-center justify-center gap-0.5 min-h-11 h-11 px-2 rounded-full border border-gri-200 bg-white text-[11px] font-semibold text-gri-700 hover:border-pim-mercan hover:text-pim-mercan transition-colors"
                      >
                        {c.viewOrder} →
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
