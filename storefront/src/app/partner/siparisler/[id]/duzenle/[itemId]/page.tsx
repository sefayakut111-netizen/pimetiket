/**
 * Pim Etiket — /partner/siparisler/[id]/duzenle/[itemId]
 * Sefa 23 May v68 (Partner P4)
 *
 * Partner için POC bıçak editörü. /onay/[id]/duzenle/[itemId]'nin
 * partner versiyonu — aynı POC iframe, aynı save-edit endpoint
 * (partner bypass eklenmiş), farklı UI/breadcrumb.
 *
 * Akış:
 *   1. /api/partner/orders/[id] fetch (PII redacted shape)
 *   2. /api/orders/[id]/items/[itemId]/design-url fetch (partner bypass)
 *   3. POC iframe mount (designUrl auto-load)
 *   4. POC pim-cutline-saved → /api/orders/[id]/proof/[itemId]/save-edit
 *      (partner bypass → proof_status='partner_revised')
 *   5. Save sonrası → /partner/siparisler/[id]'ye dön
 */

"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Eyebrow, Skeleton, useToast } from "@/components/ui";
import { PimMini } from "@/components/Pim";

interface PartnerItem {
  id: string;
  title: string;
  width: number;
  height: number;
  qty: number;
  meta: Record<string, unknown> | null;
  proof_status: string;
}

interface PartnerOrderLite {
  order: { id: string; status: string };
  items: PartnerItem[];
}

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
    material_type:
      | "paper"
      | "transparent"
      | "metallic"
      | "holographic"
      | null;
    white_plan_mode: "off" | "full" | "smart" | "ai" | "custom" | null;
    white_plan_path_count: number;
    has_custom_white_plan: boolean;
    tier: "pro" | "standard" | "improve" | null;
    detected_cut_contour_names: string[];
  };
  preview_png_base64: string | null;
}

export default function PartnerEditCutlinePage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id: orderId, itemId } = use(params);
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const designFileId = searchParams.get("design_file_id");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [item, setItem] = useState<PartnerItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [designLoadError, setDesignLoadError] = useState<string | null>(null);

  // 1) Partner order fetch + item bul
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/partner/orders/${orderId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 403 || res.status === 404) setForbidden(true);
          return;
        }
        const data = (await res.json()) as PartnerOrderLite;
        if (cancelled) return;
        const found = data.items.find((i) => i.id === itemId);
        if (!found) {
          setForbidden(true);
          return;
        }
        setItem(found);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
        toast.error("Sipariş yüklenemedi: " + msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, itemId, toast]);

  // 2) design-url fetch → iframe src kur
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
          setDesignLoadError(
            `design-url ${res.status}: ${body.slice(0, 200) || "(no body)"}`
          );
          return;
        }
        const j = (await res.json()) as {
          url: string;
          mimeType: string;
          fileName: string;
        };
        if (cancelled) return;
        if (!j.url) {
          setDesignLoadError("Tasarım URL üretilemedi");
          return;
        }
        const mapMaterial = (m: unknown): string => {
          if (typeof m !== "string") return "paper";
          const k = m.toLowerCase();
          if (k === "transparan" || k === "transparent") return "transparent";
          if (k === "holo" || k === "holographic") return "holographic";
          if (k === "simli" || k === "metallic") return "metallic";
          return "paper";
        };
        const meta = (item as unknown as { meta?: Record<string, unknown> })
          .meta;
        const material = mapMaterial(meta?.material_type ?? meta?.material);
        const ps = new URLSearchParams({
          embed: "1",
          designUrl: j.url,
          designName: j.fileName,
          designMime: j.mimeType,
          material,
          mode: "contour",
          autoSave: "0",
          orderId,
          itemId,
        });
        if (designFileId) ps.set("designFileId", designFileId);
        setIframeSrc(`/poc.html?${ps.toString()}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
        setDesignLoadError("POC açılamadı: " + msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item, orderId, itemId, designFileId]);

  // 3) POC save listener
  useEffect(() => {
    if (!item) return;
    const handler = async (e: MessageEvent) => {
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow)
        return;
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
              design_file_id: designFileId,
              ...data.meta,
            }),
          }
        );
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          toast.error(
            "Revize kaydedilemedi: " + (j.error || `HTTP ${res.status}`)
          );
          setSaving(false);
          return;
        }
        toast.success("Revize kaydedildi — müşteri yeniden inceleyecek");
        router.push(`/partner/siparisler/${orderId}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
        toast.error("Revize hatası: " + msg);
        setSaving(false);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [item, orderId, itemId, designFileId, router, toast, saving]);

  if (loading) {
    return (
      <main className="container py-8">
        <Skeleton className="mb-2 h-6 w-48" />
        <Skeleton className="h-[500px]" />
      </main>
    );
  }

  if (forbidden || !item) {
    return (
      <main className="container py-12">
        <Card className="p-8 text-center">
          <h1 className="mb-2 text-lg font-semibold">Bu sipariş sana ait değil</h1>
          <p className="mb-4 text-sm text-gri-700">
            Sadece sana atanmış siparişlerin tasarımlarını düzenleyebilirsin.
          </p>
          <Button href="/partner" variant="primary" size="md">
            Dashboard'a dön
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="container py-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Eyebrow>SİPARİŞ #{orderId}</Eyebrow>
          <h1 className="mt-1 text-2xl font-bold text-lacivert">
            Bıçağı revize et: {item.title}
          </h1>
          <p className="mt-1 text-sm text-gri-700">
            {item.qty} adet · {item.width}×{item.height}mm
          </p>
        </div>
        <Button
          href={`/partner/siparisler/${orderId}`}
          variant="ghost"
          size="sm"
        >
          ← Sipariş detayına dön
        </Button>
      </div>

      <Card className="mb-4 flex items-start gap-3 bg-pim-mercan-tint/30 p-4">
        <PimMini pose="inspect" size={48} />
        <div className="text-sm leading-relaxed text-lacivert">
          <strong>Partner Revize:</strong> Bıçak çizgisini istediğin gibi
          ayarla. "Kaydet ve dön" deyince müşteri yeniden incelemeye gönderilir,
          item statüsü <em>partner_revised</em> olur.
        </div>
      </Card>

      <div className="overflow-hidden rounded-xl border border-gri-200 bg-white shadow-sm">
        {iframeSrc ? (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title="Partner bıçak düzenleyici"
            className="block h-[calc(100vh-220px)] min-h-[640px] w-full"
            sandbox="allow-scripts allow-same-origin allow-downloads"
          />
        ) : designLoadError ? (
          <div className="grid h-[calc(100vh-220px)] min-h-[640px] place-items-center bg-kirmizi-soft p-6 text-center">
            <div className="max-w-lg">
              <div className="mb-2 text-base font-semibold text-kirmizi">
                Tasarım yüklenemedi
              </div>
              <pre className="overflow-auto rounded bg-white p-3 text-left text-[11px] text-gri-700 whitespace-pre-wrap break-all">
                {designLoadError}
              </pre>
            </div>
          </div>
        ) : (
          <div className="grid h-[calc(100vh-220px)] min-h-[640px] place-items-center bg-gri-100 text-sm text-gri-700">
            Tasarım yükleniyor…
          </div>
        )}
      </div>

      {saving && (
        <div className="mt-4 rounded-lg bg-pim-mercan-tint/30 p-3 text-center text-sm text-lacivert">
          Revize kaydediliyor, lütfen bekle…
        </div>
      )}
    </main>
  );
}
