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

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Eyebrow, Skeleton, useToast } from "@/components/ui";
import { PimMini } from "@/components/Pim";

interface ProofItem {
  id: string;
  title: string;
  width: number;
  height: number;
  qty: number;
  proof_status: string;
}

interface ProofSummaryLite {
  order: { id: string; status: string };
  items: ProofItem[];
}

export default function ProofEditPage({
  params,
}: {
  params: Promise<{ orderId: string; itemId: string }>;
}) {
  const { orderId, itemId } = use(params);
  const router = useRouter();
  const toast = useToast();

  const [item, setItem] = useState<ProofItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

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
        if (data.order.status !== "proof_pending") {
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
      </main>
    );
  }

  return (
    <main className="container py-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Eyebrow>SİPARİŞ #{orderId}</Eyebrow>
          <h1 className="mt-1 text-2xl font-bold text-lacivert">
            Bıçağı düzenle: {item.title}
          </h1>
          <p className="mt-1 text-sm text-gri-700">
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

      <Card className="mb-4 flex items-start gap-3 bg-pim-mercan-tint/30 p-4">
        <PimMini pose="inspect" size={48} />
        <p className="text-sm leading-relaxed text-lacivert">
          Bıçak çizgisini istediğin gibi ayarlayabilirsin. "Kaydet" dersen
          taslak olarak kalır, sonra onay sayfasında "Onayla" diyebilirsin.
        </p>
      </Card>

      {/* PLACEHOLDER — Sefa POC entegre edince buraya gelecek */}
      <Card className="mt-6 p-8 text-center">
        <div className="mx-auto max-w-lg">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-pim-mercan-tint">
            <span className="text-2xl">🛠️</span>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-lacivert">
            CutlineDesigner — Sefa POC entegrasyonu
          </h2>
          <p className="mb-4 text-sm text-gri-700">
            POC v2 (pim_etiket_poc.html, 3266 satır) burada mount edilecek.
            <br />
            <strong className="text-lacivert">Özellikler:</strong> PNG/JPG/PDF/AI/PSD
            yükleme, OpenCV.js otomatik kesim (4 mod: kontur/çevresel/dikdörtgen/yuvarlak),
            AI background removal (U²-Net), <strong>malzeme seçici</strong>
            (kağıt/şeffaf/metalize/holografik), <strong>beyaz plan</strong> (5
            mod: full/smart/AI/custom), <strong>tier sınıflandırma</strong>
            (pro/standard/improve), 0mm kayma toleransı (0.3mm erode), SVG
            export (CutContour + White spot color grupları).
          </p>
          <p className="mb-4 text-sm text-gri-700">
            <strong className="text-lacivert">🧠 Pim AI (GPT-4o-mini):</strong>{" "}
            Kural-tabanlı yorum yerine OpenAI'ye bağlandı. Dosya yüklenince
            veya slider değişince <code className="rounded bg-gri-100 px-1 py-0.5">POST /api/pim/cutline-feedback</code>{" "}
            çağrılır; müşteri adıyla, doğal Türkçe, severity ve önerilen
            aksiyon içerir (~$0.0002/çağrı).
          </p>
          <p className="text-xs text-gri-700">
            Backend hazır: <code className="rounded bg-gri-100 px-1 py-0.5">POST /api/orders/{orderId}/proof/{itemId}/save-edit</code>
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              variant="secondary"
              size="md"
              href={`/onay/${orderId}`}
            >
              Düzenlemeden vazgeç
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                toast.info("POC entegre edilince buradan SVG kaydedebilirsin");
              }}
              disabled
            >
              Bıçağı kaydet ve onayla
            </Button>
          </div>
        </div>
      </Card>

      {/* Geliştirici notu */}
      <div className="mt-6 rounded-lg border border-gri-200 bg-gri-100/50 p-4 text-xs text-gri-700">
        <strong>Sözleşme (CutlineDesigner için):</strong>
        <pre className="mt-2 overflow-x-auto rounded bg-white p-3 text-[11px] leading-relaxed">
{`<CutlineDesigner
  orderId="${orderId}"
  itemId="${itemId}"
  itemTitle="${item.title}"
  itemMaterial="paper"  // konfigüratörden gelen, POC sadece görsel
  originalFileUrl={signedUrl}
  onSaveAndApprove={async (cutlineId) => {
    // POC v2 — SVG export sonrası save-edit body'sine
    //   material_type, white_plan_mode, white_plan_path_count,
    //   has_custom_white_plan, tier, detected_cut_contour_names
    // alanlarını da gönder (Mig 060)
    await fetch(\`/api/orders/\${orderId}/proof/\${itemId}/approve\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cutlineId }),
    });
    router.push(\`/onay/\${orderId}\`);
  }}
  onSave={(cutlineId) => router.push(\`/onay/\${orderId}\`)}
  onCancel={() => router.push(\`/onay/\${orderId}\`)}
/>`}
        </pre>
      </div>
    </main>
  );
}
