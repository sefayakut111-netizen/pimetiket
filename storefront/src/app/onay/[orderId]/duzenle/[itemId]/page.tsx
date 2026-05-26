/**
 * Pim Etiket — Bıçak Düzenleme Sayfası
 * /onay/[orderId]/duzenle/[itemId]
 *
 * Sefa 19 May v68 (Migration 059):
 * Bu sayfa Sefa'nın geliştirdiği POC'un (pim_etiket_poc.html) Next.js
 * mount noktasıdır. CutlineDesigner component'i React'e port edilince
 * `<CutlineDesigner />` ile bu placeholder'ın yerine geçecek.
 *
 * Sözleşme (CutlineDesigner için — POC v2 ile uyumlu):
 *   props: {
 *     orderId: string
 *     itemId: string
 *     itemTitle: string
 *     // Konfigüratör adımında belirlenen malzeme (POC sadece görsel olarak gösterir):
 *     itemMaterial?: 'paper' | 'transparent' | 'metallic' | 'holographic'
 *     originalFileUrl: string | null  // signed URL'den okunan orijinal tasarım
 *     onSaveAndApprove: (cutlineId: string) => void
 *     onSave: (cutlineId: string) => void
 *     onCancel: () => void
 *   }
 *
 *   Save akışı: POC SVG export → POST /api/orders/[id]/proof/[itemId]/save-edit
 *   Body (POC v2 — Mig 060):
 *     {
 *       svg, preview_png_base64, source, mode,
 *       offset_mm, smoothness, dpi, width_mm, height_mm,
 *       pim_feedback, pim_severity,
 *       material_type, white_plan_mode, white_plan_path_count,
 *       has_custom_white_plan, tier, detected_cut_contour_names
 *     }
 *   Response: { ok, cutlineId, svgKey, previewKey, tier, materialType, whitePlanMode }
 *
 *   Approve akışı: yukarıdaki sonra POST .../approve { cutlineId }
 *
 *   PIM AI YORUMU (gerçek GPT-4o-mini — POC'un kural-tabanlı yorumu yerine):
 *     POC v2'de generatePimComment() çağrısı yerine, dosya yüklendiğinde +
 *     her slider değiştiğinde (debounce edilmiş ~600ms) şu endpoint çağrılır:
 *
 *     POST /api/pim/cutline-feedback
 *     Body: {
 *       orderId, itemId,
 *       source, tier, material_type, white_plan_mode,
 *       mode, offset_mm, dpi, part_count, coverage,
 *       detected_cut_contour_names, issue_hints, white_plan_path_count
 *     }
 *     Response: {
 *       ok: true,
 *       feedback: "Mehmet, vektörel dosya yüklemişsin — temiz bir bıçak çıkardım.",
 *       severity: "ok" | "warn" | "err",
 *       suggested_action: "approve" | "bg_remove" | "increase_dpi" | "edit_cutline" | "request_help" | "none"
 *     }
 *
 *     Bu yanıt POC'taki pimText ve pimComment alanlarına yazılır.
 *     suggested_action'a göre Pim aksiyon butonu gösterilir
 *     (örn. bg_remove → "Evet, arka planı kaldır" butonu).
 *     Backend rate limit: dakikada 20.
 *
 * Şu an PLACEHOLDER — Sefa POC'u entegre edince doğrudan
 * <CutlineDesigner /> mount edilecek.
 */

"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Eyebrow, Skeleton, useToast } from "@/components/ui";
import { PimMini } from "@/components/Pim";
import { useVisionFallback } from "@/lib/hooks/useVisionFallback";
import {
  buildPocIframeSrc,
  mapConfiguratorMaterial,
} from "@/lib/proof/build-poc-iframe-src";

interface ProofItem {
  id: string;
  title: string;
  width: number;
  height: number;
  qty: number;
  proof_status: string;
  meta?: Record<string, unknown> | null;
}

interface ProofSummaryLite {
  order: { id: string; status: string };
  items: ProofItem[];
  // Sefa 23 May v68: admin proxy yanitinda viewer_role doluyor.
  // Musteri akisinda undefined kalir — status check normal calisir.
  viewer_role?: string | null;
}

// POC iframe'inden gelen message payload shape (pim_etiket_poc.html ile uyumlu)
interface CutlineSavedPayload {
  type: "pim-cutline-saved";
  svg: string;
  meta: {
    source: "raster" | "vector" | "vector-with-cutline" | "psd";
    mode: "contour" | "hull" | "rect" | "circle";
    offset_mm: number | null;
    smoothness: number | null;
    dpi: number | null;
    width_mm: number | null;
    height_mm: number | null;
    pim_feedback: string | null;
    pim_severity: "ok" | "warn" | "err" | null;
    material_type: "paper" | "transparent" | "metallic" | "holographic" | null;
    white_plan_mode: "off" | "full" | "smart" | "ai" | "custom" | null;
    white_plan_path_count: number;
    has_custom_white_plan: boolean;
    tier: "pro" | "standard" | "improve" | null;
    detected_cut_contour_names: string[];
  };
  preview_png_base64: string | null;
}

async function submitHelpRequest(
  orderId: string,
  itemId: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/orders/${orderId}/proof/${itemId}/help`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  return { ok: res.ok && data.ok === true, error: data.error };
}

export default function ProofEditPage({
  params,
}: {
  params: Promise<{ orderId: string; itemId: string }>;
}) {
  const { orderId, itemId } = use(params);
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const designFileId = searchParams.get("design_file_id"); // Mig 063
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sefa 22 May v68 Faz 3 — Vision fallback ortak hook (sayfa içi banner).
  const { visionFallback, dismiss: dismissVisionFallback } = useVisionFallback({
    orderId,
    itemId,
    iframeRef,
  });

  const [item, setItem] = useState<ProofItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [designLoaded, setDesignLoaded] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpMsg, setHelpMsg] = useState("");
  const [submittingHelp, setSubmittingHelp] = useState(false);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [iframeHeight, setIframeHeight] = useState(900);
  // Sefa 23 May v68: design-url hata mesajini iframe alaninda goster
  // (toast kaybolup gidiyor, "Bir gorsel yukle" bos ekranda neden anlasilmiyor).
  const [designLoadError, setDesignLoadError] = useState<string | null>(null);
  // POC iframe icindeki olaylari banner'da goster (pim-poc-ready, -loaded, -error).
  // Sefa C senaryosu: POC'da hata var ama parent gormuyordu — postMessage bridge.
  const [pocStatus, setPocStatus] = useState<{
    state: "loading" | "ready" | "loaded" | "error" | "timeout";
    message: string;
  } | null>(null);
  const pendingDesignRef = useRef<{
    url: string;
    fileName: string;
    mimeType: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/proof`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 403 || res.status === 404) {
            setForbidden(true);
          }
          return;
        }
        const data = (await res.json()) as ProofSummaryLite;
        if (cancelled) return;
        // Sefa 23 May v68: admin/staff status'ten bagimsiz edit edebilmeli
        // (operator proof_pending sonrasi da bicagi duzeltebilir).
        const isAdminViewer =
          data.viewer_role === "admin" || data.viewer_role === "staff";
        if (!isAdminViewer && data.order.status !== "proof_pending") {
          router.replace(`/siparis/${orderId}`);
          return;
        }
        const found = data.items.find((i) => i.id === itemId);
        if (!found) {
          setForbidden(true);
          return;
        }
        setItem(found);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
        toast.error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, itemId, router, toast]);

  // Item yüklendikten sonra design-url fetch et + iframe src state'ini kur.
  // POC tarafı autoSave=0 ile — müşteri elle "Kaydet ve dön" basacak.
  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    (async () => {
      try {
        const qs = designFileId ? `?design_file_id=${designFileId}` : "";
        const res = await fetch(
          `/api/orders/${orderId}/items/${itemId}/design-url${qs}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          const errMsg = `design-url ${res.status}: ${body.slice(0, 200) || "(no body)"}`;
          setDesignLoadError(errMsg);
          toast.error("Tasarım yüklenemedi — manuel düzenleme yapamayız");
          return;
        }
        const j = (await res.json()) as {
          url: string;
          mimeType: string;
          fileName: string;
        };
        if (cancelled) return;
        if (!j.url) {
          setDesignLoadError(
            "design-url response.url bos — tasarım dosyasına erişilemedi"
          );
          toast.error("Tasarım URL üretilemedi");
          return;
        }

        const material = mapConfiguratorMaterial(
          item.meta?.material_type ?? item.meta?.material
        );
        const origin = window.location.origin;
        const proxyDesignUrl = `${origin}/api/orders/${orderId}/items/${itemId}/design-file${qs}`;

        pendingDesignRef.current = {
          url: proxyDesignUrl,
          fileName: j.fileName,
          mimeType: j.mimeType,
        };

        setIframeSrc(
          buildPocIframeSrc({
            orderId,
            itemId,
            fileName: j.fileName,
            mimeType: j.mimeType,
            material,
            designFileId,
            autoSave: false,
            editorMode: true,
            orderWidthMm: item.width,
            orderHeightMm: item.height,
            origin,
          })
        );
        setDesignLoaded(false);
        setPocStatus({ state: "loading", message: "POC iframe yükleniyor…" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
        toast.error(`POC açılamadı: ${msg}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item, orderId, itemId, designFileId, toast]);

  // Sefa 23 May v68 C senaryosu: POC iframe status mesajlarini banner'a yansit.
  // POC pim-poc-ready/-loaded/-error mesajlari yolluyordu ama parent dinlemiyordu.
  // 12sn icinde pim-poc-loaded gelmezse timeout uyarisi goster.
  useEffect(() => {
    if (!iframeSrc) return;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let loaded = false;
    const handler = (e: MessageEvent) => {
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;
      const data = e.data as { type?: string; error?: string; source?: string } | undefined;
      if (!data || typeof data.type !== "string") return;
      if (data.type === "pim-poc-ready") {
        setPocStatus({ state: "ready", message: "POC hazır, tasarım çekiliyor…" });
        const pending = pendingDesignRef.current;
        if (pending && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            {
              type: "pim-load-design",
              url: pending.url,
              fileName: pending.fileName,
              mimeType: pending.mimeType,
            },
            "*"
          );
        }
      } else if (data.type === "pim-poc-loaded") {
        loaded = true;
        setDesignLoaded(true);
        setPocStatus({
          state: "loaded",
          message: `Tasarım yüklendi (source=${data.source ?? "?"})`,
        });
        setTimeout(() => setPocStatus(null), 3000);
      } else if (data.type === "pim-poc-error") {
        setPocStatus({
          state: "error",
          message: `POC hatası: ${data.error ?? "(boş)"}`,
        });
      } else if (
        data.type === "pim-poc-resize" &&
        typeof (data as { height?: number }).height === "number"
      ) {
        const h = (data as { height: number }).height;
        setIframeHeight((prev) => {
          const next = Math.max(720, Math.min(h + 8, 4800));
          return Math.abs(prev - next) < 8 ? prev : next;
        });
      }
    };
    window.addEventListener("message", handler);
    timeoutHandle = setTimeout(() => {
      if (!loaded) {
        setPocStatus((prev) =>
          prev?.state === "loaded"
            ? prev
            : {
                state: "timeout",
                message:
                  "12 saniyedir POC tasarım yüklemedi. Sayfayı yenilemeyi dene veya tasarım dosyasının erişilebilir olduğundan emin ol.",
              }
        );
      }
    }, 12000);
    return () => {
      window.removeEventListener("message", handler);
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
  }, [iframeSrc]);

  // POC iframe'den 'pim-cutline-saved' mesajını yakala → save-edit POST → /onay'a dön
  useEffect(() => {
    if (!item) return;

    const handler = async (e: MessageEvent) => {
      // Yalnız kendi iframe'imizden gelen mesajı kabul et
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;
      const data = e.data as CutlineSavedPayload | undefined;
      if (!data || data.type !== "pim-cutline-saved") return;
      if (saving) return;
      setSaving(true);

      try {
        const res = await fetch(
          `/api/orders/${orderId}/proof/${itemId}/save-edit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              svg: data.svg,
              preview_png_base64: data.preview_png_base64,
              design_file_id: designFileId, // Mig 063 — multi-design proof
              ...data.meta,
            }),
          }
        );
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          const err = j.error || `HTTP ${res.status}`;
          iframeRef.current?.contentWindow?.postMessage(
            { type: "pim-cutline-save-failed", error: err },
            "*"
          );
          toast.error("Bıçak kaydedilemedi: " + err);
          setSaving(false);
          return;
        }
        toast.success("Bıçak kaydedildi");
        router.push(`/onay/${orderId}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
        iframeRef.current?.contentWindow?.postMessage(
          { type: "pim-cutline-save-failed", error: msg },
          "*"
        );
        toast.error("Bıçak kaydedilemedi: " + msg);
        setSaving(false);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [item, orderId, itemId, router, toast, saving, designFileId]);

  const handleSave = () => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "pim-request-export" },
      "*"
    );
  };

  const handleSubmitHelp = async () => {
    const trimmed = helpMsg.trim();
    if (trimmed.length < 5) {
      toast.error("Lütfen sorunu en az 5 karakter açıkla");
      return;
    }
    setSubmittingHelp(true);
    try {
      const result = await submitHelpRequest(orderId, itemId, trimmed);
      if (!result.ok) {
        toast.error(result.error ?? "Talep gönderilemedi");
        return;
      }
      toast.success("Talebin alındı, operatörümüz 1 iş günü içinde dönecek");
      setHelpOpen(false);
      setHelpMsg("");
      router.push(`/onay/${orderId}`);
    } finally {
      setSubmittingHelp(false);
    }
  };

  if (loading) {
    return (
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-4 pb-8">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <Skeleton className="mb-2 h-6 w-48" />
          <Skeleton className="h-[720px]" />
        </div>
      </main>
    );
  }

  if (forbidden || !item) {
    return (
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-8 pb-12">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <Card className="p-8 text-center">
            <h1 className="mb-2 text-lg font-semibold">
              Bu ürün düzenleme aşamasında değil
            </h1>
            <p className="mb-4 text-sm text-gri-700">
              Sipariş zaten onaylanmış veya bu ürün sana ait değil olabilir.
            </p>
            <Button href={`/onay/${orderId}`} variant="primary" size="md">
              Onay sayfasına dön
            </Button>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-4 pb-8">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
      {/* Header — kompakt */}
      <div className="mb-3 flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Eyebrow>SİPARİŞ #{orderId}</Eyebrow>
          <h1 className="text-xl font-bold text-lacivert">
            Bıçağı düzenle: {item.title}
          </h1>
          <p className="text-xs text-gri-700">
            {item.qty} ad · {item.width}×{item.height}mm
          </p>
        </div>
        <Button
          href={`/onay/${orderId}`}
          variant="ghost"
          size="sm"
        >
          ← Onay sayfasına dön
        </Button>
      </div>

      <Card className="mb-3 flex items-start gap-2 border-gri-200 bg-white p-3">
        <PimMini pose="inspect" size={36} />
        <p className="text-xs leading-relaxed text-lacivert sm:text-sm [&_strong]:text-lacivert">
          Kesim mesafesi ve yumuşatmayı ayarla, alttan{" "}
          <strong className="font-semibold text-lacivert">Kaydet ve dön</strong> de.
          Onayı sonra onay sayfasında verirsin.
        </p>
      </Card>

      {/* Sefa 22 May v68 Faz 3 — Vision fallback banner (POC partCount=0 vb).
          iframe'in üstünde sticky görünür, X ile kapatılabilir. */}
      {visionFallback && (
        <div
          className={
            "mb-2 shrink-0 rounded-xl border px-3 py-2 text-[12px] " +
            (visionFallback.severity === "err"
              ? "border-kirmizi/40 bg-kirmizi-soft text-kirmizi"
              : "border-pim-mercan/40 bg-pim-mercan-tint text-lacivert")
          }
        >
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pim-mercan text-white text-[12px] font-bold"
              aria-hidden
            >
              {visionFallback.loading ? "…" : "AI"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">
                {visionFallback.loading
                  ? "Pim Vision tanı koyuyor"
                  : visionFallback.fallback
                    ? "Pim önerisi"
                    : "Pim Vision tanısı"}
              </div>
              <p className="mt-1 leading-relaxed">
                {visionFallback.pim_message}
              </p>
              {!visionFallback.loading && visionFallback.diagnosis && (
                <details className="mt-1.5 text-[12px]">
                  <summary className="cursor-pointer text-gri-700 hover:text-lacivert">
                    Teknik tanı
                  </summary>
                  <p className="mt-1 text-gri-700">
                    {visionFallback.diagnosis}
                  </p>
                </details>
              )}
            </div>
            <button
              type="button"
              onClick={dismissVisionFallback}
              className="text-gri-700 hover:text-lacivert text-[18px] leading-none"
              aria-label="Kapat"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Sefa 23 May v68 — POC iframe status banner (postMessage'den).
          Loading -> sari, ready -> mavi, loaded -> yesil (3sn sonra kaybolur),
          error/timeout -> kirmizi (sticky). */}
      {pocStatus && (
        <div
          className={
            "mb-2 shrink-0 rounded-xl border px-3 py-1.5 text-[12px] " +
            (pocStatus.state === "error" || pocStatus.state === "timeout"
              ? "border-kirmizi/40 bg-kirmizi-soft text-kirmizi"
              : pocStatus.state === "loaded"
                ? "border-yesil/40 bg-yesil-soft text-yesil"
                : pocStatus.state === "ready"
                  ? "border-pim-mercan/40 bg-pim-mercan-tint text-lacivert"
                  : "border-sari/40 bg-sari-soft text-lacivert")
          }
        >
          <span className="font-semibold capitalize">{pocStatus.state}:</span>{" "}
          {pocStatus.message}
        </div>
      )}

      {/* POC iframe — yükseklik POC'tan gelir, sayfa ile tek scroll */}
      <div className="overflow-hidden rounded-xl border border-gri-200 bg-white shadow-sm">
        {iframeSrc ? (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title="Bıçak düzenleyici"
            className="block w-full border-0"
            style={{ height: iframeHeight }}
            scrolling="no"
            sandbox="allow-scripts allow-same-origin allow-downloads"
          />
        ) : designLoadError ? (
          <div className="grid min-h-[480px] place-items-center bg-kirmizi-soft p-6 text-center">
            <div className="max-w-lg">
              <div className="mb-2 text-base font-semibold text-kirmizi">
                Tasarım yüklenemedi
              </div>
              <p className="text-sm text-lacivert mb-3">
                POC editöre tasarımı geçiremedik. Lütfen aşağıdaki hata mesajını
                Sefa&apos;ya iletin.
              </p>
              <pre className="overflow-auto rounded bg-white p-3 text-left text-[11px] text-gri-700 whitespace-pre-wrap break-all">
                {designLoadError}
              </pre>
              <p className="mt-3 text-[11px] text-gri-700">
                orderId: {orderId} · itemId: {itemId}
                {designFileId ? ` · designFileId: ${designFileId}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid min-h-[480px] place-items-center bg-gri-100 text-sm text-gri-700">
            Tasarım yükleniyor…
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-20 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gri-200 bg-gri-50/95 py-3 backdrop-blur-sm">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setHelpOpen(true)}
          disabled={item.proof_status === "help_requested"}
        >
          Ekibimizden yardım iste
        </Button>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="ghost" size="md" href={`/onay/${orderId}`}>
            İptal — onay sayfasına dön
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={saving || !designLoaded || !!designLoadError}
          >
            {saving ? "Kaydediliyor…" : "Kaydet ve dön"}
          </Button>
        </div>
      </div>

      {helpOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => !submittingHelp && setHelpOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-modal-title"
        >
          <Card
            className="w-full max-w-md p-6"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <h3
              id="help-modal-title"
              className="text-lg font-semibold text-lacivert"
            >
              Operatörden yardım iste
            </h3>
            <p className="mt-2 text-sm text-gri-700">
              <strong>{item.title}</strong> için bıçak/kesim ayarını
              operatörümüzün yapmasını istiyorsan kısaca anlat.
            </p>
            <textarea
              className="mt-3 w-full rounded-lg border border-gri-200 p-3 text-sm focus:border-pim-mercan focus:outline-none"
              rows={5}
              placeholder="Örnek: Logo etrafındaki bıçak çok dar kalıyor, 3-4 mm istiyorum…"
              value={helpMsg}
              onChange={(e) => setHelpMsg(e.target.value)}
              disabled={submittingHelp}
              aria-label="Yardım talebi mesajı"
            />
            <p className="mt-1 text-xs text-gri-700">
              {helpMsg.length}/1000 karakter
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHelpOpen(false)}
                disabled={submittingHelp}
              >
                İptal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleSubmitHelp()}
                disabled={submittingHelp || helpMsg.trim().length < 5}
              >
                {submittingHelp ? "Gönderiliyor…" : "Talep gönder"}
              </Button>
            </div>
          </Card>
        </div>
      )}
      </div>
    </main>
  );
}
