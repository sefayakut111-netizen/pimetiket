/**
 * Pim Etiket — Ödeme Sonrası Tasarım Yükleme
 * /siparis/[id]/tasarim-yukle
 *
 * Sefa 19 May v68 (Migration 061 — awaiting_upload akışı):
 * Müşteri sepete tasarımsız ürün koyup ödeme yapabilir. Ödeme sonrası
 * orders.status = 'awaiting_upload' olur ve müşteri buraya yönlendirilir.
 * Her order_item için en az 1 tasarım yüklenince DB trigger (Mig 061
 * fn_design_uploaded_advance_status) order.status'ü 'proof_pending'e
 * geçirir; otomatik /onay/[orderId]'ye yönlendiririz.
 *
 * Akış (item başına):
 *   1. POST /api/design/upload-init → signed URL
 *   2. PUT supabase storage signed URL
 *   3. POST /api/design/upload-complete → AI ön-kontrol + design_files
 *      INSERT (trigger awaiting_upload → proof_pending)
 *   4. Tüm itemler için tasarım var → /onay/[id]
 */

"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Eyebrow, Skeleton, useToast } from "@/components/ui";
import { PimMini } from "@/components/Pim";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  STORAGE_BUCKET,
} from "@/lib/storage/design-files";

interface OrderItem {
  id: string;
  title: string;
  qty: number;
  width: number;
  height: number;
  hasDesign: boolean; // design_files'ta kayıt var mı
}

interface OrderInfo {
  id: string;
  status: string;
  items: OrderItem[];
}

export default function TasarimYuklePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: orderId } = use(params);
  const router = useRouter();
  const toast = useToast();

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/${orderId}/upload-status`, {
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          setForbidden(true);
        }
        return;
      }
      const data = (await res.json()) as OrderInfo;
      setOrder(data);

      // Status yanlışsa yönlendir
      if (data.status === "proof_pending") {
        router.replace(`/onay/${orderId}`);
        return;
      }
      if (data.status === "proof_approved") {
        router.replace(`/onay/${orderId}/tamamlandi`);
        return;
      }
      if (data.status !== "awaiting_upload" && data.status !== "paid") {
        // ileri state — sipariş detayına dön
        router.replace(`/siparis/${orderId}`);
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error(`Sipariş yüklenemedi: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [orderId, router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Tüm itemler hasDesign=true olduğunda /onay'a yönlendir
  useEffect(() => {
    if (!order) return;
    const allDone = order.items.length > 0 && order.items.every((i) => i.hasDesign);
    if (allDone) {
      // DB trigger 'awaiting_upload → proof_pending' işlemini yaptı — biraz bekle, sonra yönlendir
      toast.success("Tüm tasarımlar yüklendi, onay sayfasına yönlendiriliyor…");
      const t = setTimeout(() => router.push(`/onay/${orderId}`), 1500);
      return () => clearTimeout(t);
    }
  }, [order, orderId, router, toast]);

  async function handleFileSelect(item: OrderItem, file: File) {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Dosya çok büyük (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
      return;
    }
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error(`Bu dosya formatı desteklenmiyor: ${file.type || "bilinmeyen"}`);
      return;
    }

    setUploadingItemId(item.id);
    try {
      // 1) upload-init
      const initRes = await fetch("/api/design/upload-init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          orderItemId: item.id,
          originalName: file.name,
          sizeBytes: file.size,
          mimeType: file.type,
        }),
      });
      if (!initRes.ok) {
        const e = (await initRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error || `init_failed_${initRes.status}`);
      }
      const init = (await initRes.json()) as {
        uploadUrl: string;
        token: string;
        storagePath: string;
        fileId: string;
      };

      // 2) PUT signed URL
      const supabase = createSupabaseClient();
      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .uploadToSignedUrl(init.storagePath, init.token, file);
      if (uploadErr) {
        throw new Error(`upload_failed: ${uploadErr.message}`);
      }

      // 3) upload-complete (design_files finalize + AI ön-kontrol)
      const compRes = await fetch("/api/design/upload-complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileId: init.fileId }),
      });
      if (!compRes.ok) {
        const e = (await compRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error || `complete_failed_${compRes.status}`);
      }

      toast.success(`${item.title}: tasarım yüklendi`);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error(`Yükleme başarısız: ${msg}`);
    } finally {
      setUploadingItemId(null);
    }
  }

  // ---- Render ----
  if (loading) {
    return (
      <main className="container py-8">
        <Skeleton className="mb-2 h-6 w-48" />
        <Skeleton className="h-[400px]" />
      </main>
    );
  }

  if (forbidden || !order) {
    return (
      <main className="container py-12">
        <Card className="p-8 text-center">
          <h1 className="mb-2 text-lg font-semibold">
            Bu siparişe erişim yok
          </h1>
          <p className="mb-4 text-sm text-gri-700">
            Sipariş bulunamadı veya başka bir hesaba ait.
          </p>
          <Button href="/siparislerim" variant="primary" size="md">
            Siparişlerime dön
          </Button>
        </Card>
      </main>
    );
  }

  const pendingCount = order.items.filter((i) => !i.hasDesign).length;

  return (
    <main className="container py-6">
      <div className="mb-6">
        <Eyebrow>SİPARİŞ #{orderId}</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-lacivert">
          Tasarımlarını yükle
        </h1>
        <p className="mt-1 text-sm text-gri-700">
          {order.items.length} ürün · {pendingCount} tasarım bekleniyor
        </p>
      </div>

      <Card className="mb-4 flex items-start gap-3 bg-pim-mercan-tint/30 p-4">
        <PimMini pose="happy" size={48} />
        <div className="text-sm leading-relaxed text-lacivert">
          <p>
            Ödemeni aldık, teşekkürler! Şimdi her ürün için tasarım dosyanı
            yüklemeni bekliyorum. Sıfır kayıp ise SVG/AI/PDF, raster ise
            PNG/JPG/PSD destekleniyor (max 30 MB).
          </p>
          <p className="mt-2">
            Tüm tasarımlar yüklenince <strong>otomatik bıçak çıkarımı</strong>{" "}
            başlar — 5 dakika içinde onay sayfasında olacak.
          </p>
        </div>
      </Card>

      <div className="grid gap-4">
        {order.items.map((item) => (
          <Card key={item.id} className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lacivert">{item.title}</h3>
                <p className="mt-1 text-sm text-gri-700">
                  {item.qty} ad · {item.width}×{item.height} mm
                </p>
                {item.hasDesign && (
                  <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-yesil-soft px-3 py-1 text-xs font-medium text-yesil">
                    ✓ Tasarım yüklendi
                  </p>
                )}
              </div>
              <div className="shrink-0">
                {!item.hasDesign ? (
                  <>
                    <input
                      ref={(el) => {
                        fileInputs.current[item.id] = el;
                      }}
                      type="file"
                      accept={ALLOWED_MIME_TYPES.join(",")}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleFileSelect(item, f);
                      }}
                    />
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => fileInputs.current[item.id]?.click()}
                      disabled={uploadingItemId === item.id}
                    >
                      {uploadingItemId === item.id
                        ? "Yükleniyor…"
                        : "Tasarım yükle"}
                    </Button>
                  </>
                ) : (
                  <input
                    ref={(el) => {
                      fileInputs.current[item.id] = el;
                    }}
                    type="file"
                    accept={ALLOWED_MIME_TYPES.join(",")}
                    className="hidden"
                  />
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-gri-200 bg-gri-100/50 p-4 text-xs text-gri-700">
        <strong>İpucu:</strong> Her ürün için sadece 1 tasarım yeterli. Çoklu
        tasarım gerekiyorsa şimdilik tek dosya yükle, onay sayfasında ekleme
        yapabilirsin.
      </div>
    </main>
  );
}
