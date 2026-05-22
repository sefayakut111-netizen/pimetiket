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
import { cn } from "@/lib/cn";
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
  hasDesign: boolean; // design_files'ta kayit var mi (en az 1)
  // Sefa 22 May v68 — Multi-design destek:
  designsRequired: number; // kac tasarim gerekli (meta.designCount, default 1)
  designsUploaded: number; // su ana kadar kac yuklendi
  designsComplete: boolean; // designsUploaded >= designsRequired
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

  // Sefa 21 May v68 — Polling: upload sonrası DB trigger
  // (awaiting_upload → proof_pending) yarış durumuna karşı, load() çağrısı
  // hasDesign=true ya da status=proof_pending getirene kadar 2sn aralıkla
  // 5 kez dene. Aksi halde "ekran donuyor" hissi (yönlendirme tetiklenmez).
  const load = useCallback(
    async (opts?: { silent?: boolean }): Promise<OrderInfo | null> => {
      try {
        if (!opts?.silent) setLoading(true);
        const res = await fetch(`/api/orders/${orderId}/upload-status`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 403 || res.status === 404) {
            setForbidden(true);
          }
          return null;
        }
        const data = (await res.json()) as OrderInfo;
        setOrder(data);

        // Status yanlışsa yönlendir
        if (data.status === "proof_pending") {
          router.replace(`/onay/${orderId}`);
          return data;
        }
        if (data.status === "proof_approved") {
          router.replace(`/onay/${orderId}/tamamlandi`);
          return data;
        }
        if (data.status !== "awaiting_upload" && data.status !== "paid") {
          // ileri state — sipariş detayına dön
          router.replace(`/siparis/${orderId}`);
          return data;
        }
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
        toast.error(`Sipariş yüklenemedi: ${msg}`);
        return null;
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [orderId, router, toast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Sefa 22 May v68 — Multi-design: TÜM tasarımlar tamamlandığında
  // (designsUploaded >= designsRequired her item için) /siparis detaya yönlendir.
  // Önceden hasDesign=true yeterliydi (eksik upload'da bile yönlendiriyordu).
  useEffect(() => {
    if (!order) return;
    const allDone =
      order.items.length > 0 &&
      order.items.every((i) => i.designsComplete);
    if (allDone) {
      toast.success(
        "Tum tasarimlar yuklendi, siparis detayina yonlendiriliyor..."
      );
      const t = setTimeout(() => router.push(`/siparis/${orderId}`), 1500);
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

      const slotInfo =
        item.designsRequired > 1
          ? ` (${item.designsUploaded + 1}/${item.designsRequired})`
          : "";
      toast.success(`${item.title}${slotInfo}: tasarim yuklendi`);

      // Sefa 22 May v68 — Optimistic update: designsUploaded++ ve
      // hasDesign/designsComplete derive et.
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) => {
                if (i.id !== item.id) return i;
                const newUploaded = (i.designsUploaded ?? 0) + 1;
                return {
                  ...i,
                  designsUploaded: newUploaded,
                  designsComplete: newUploaded >= i.designsRequired,
                  hasDesign: true,
                };
              }),
            }
          : prev
      );

      // Polling: DB trigger orders.status'i `proof_pending`'e geçirene
      // kadar bekle. Race condition yok; trigger AFTER INSERT (Mig 061)
      // ama Supabase replication veya transaction visibility gecikmesi
      // 1-3 sn olabilir. 2sn aralıkla 5 kez dene (max 10 sn).
      let fresh = await load({ silent: true });
      let attempts = 0;
      while (
        fresh &&
        fresh.status === "awaiting_upload" &&
        attempts < 5
      ) {
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
        fresh = await load({ silent: true });
      }
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

  // Sefa 22 May v68: Bekleyen sayım — designsComplete olmayanları say.
  // Multi-design: 3 tasarım gerekiyor 1 yüklü → hala "1 bekliyor".
  const pendingCount = order.items.filter((i) => !i.designsComplete).length;
  const totalRequired = order.items.reduce(
    (s, i) => s + (i.designsRequired ?? 1),
    0
  );
  const totalUploaded = order.items.reduce(
    (s, i) => s + (i.designsUploaded ?? 0),
    0
  );

  return (
    <main className="container py-6">
      <div className="mb-6">
        <Eyebrow>SİPARİŞ #{orderId}</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-lacivert">
          Tasarımlarını yükle
        </h1>
        <p className="mt-1 text-sm text-gri-700">
          {order.items.length} urun ·{" "}
          <strong className="text-lacivert tabular-nums">
            {totalUploaded}/{totalRequired}
          </strong>{" "}
          tasarim yuklendi
          {pendingCount > 0 && (
            <span className="text-pim-mercan font-semibold">
              {" "}
              · {pendingCount} kalan
            </span>
          )}
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
        {order.items.map((item) => {
          const required = item.designsRequired ?? 1;
          const uploaded = item.designsUploaded ?? 0;
          const remaining = Math.max(0, required - uploaded);
          const isMulti = required > 1;
          const isComplete = item.designsComplete;
          const isUploading = uploadingItemId === item.id;

          // Buton label dinamik:
          // - Multi-design + bazi tasarim var: "Tasarim X/Y yukle"
          // - Tek tasarim: "Tasarim yukle"
          // - Tamamlandi: rozet, buton yok
          const buttonLabel = isUploading
            ? "Yukleniyor..."
            : isMulti
              ? `Tasarim ${uploaded + 1}/${required} yukle`
              : "Tasarim yukle";

          return (
            <Card key={item.id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lacivert">{item.title}</h3>
                  <p className="mt-1 text-sm text-gri-700">
                    {item.qty} ad · {item.width}×{item.height} mm
                    {isMulti && (
                      <>
                        {" "}
                        · <strong>{required} farkli tasarim</strong>
                      </>
                    )}
                  </p>

                  {/* Progress: yuklenmis tasarim sayisi (multi-design) */}
                  {isMulti && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex gap-1">
                        {Array.from({ length: required }).map((_, idx) => (
                          <span
                            key={idx}
                            className={cn(
                              "block w-7 h-2 rounded-full",
                              idx < uploaded ? "bg-yesil" : "bg-gri-200"
                            )}
                            aria-hidden
                          />
                        ))}
                      </div>
                      <span className="text-[12px] font-semibold text-gri-700 tabular-nums">
                        {uploaded} / {required}
                      </span>
                    </div>
                  )}

                  {isComplete && (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-yesil-soft px-3 py-1 text-xs font-medium text-yesil">
                      ✓ {isMulti ? `${required} tasarim yuklendi` : "Tasarim yuklendi"}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {!isComplete ? (
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
                          // Reset input → ayni dosya tekrar secilebilsin
                          e.target.value = "";
                        }}
                      />
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => fileInputs.current[item.id]?.click()}
                        disabled={isUploading}
                      >
                        {buttonLabel}
                      </Button>
                      {isMulti && remaining > 0 && uploaded > 0 && (
                        <p className="mt-1.5 text-[11.5px] text-gri-500 text-right">
                          {remaining} tasarim kaldi
                        </p>
                      )}
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
          );
        })}
      </div>

      <div className="mt-6 rounded-lg border border-gri-200 bg-gri-100/50 p-4 text-xs text-gri-700">
        <strong>İpucu:</strong> Her ürün için sadece 1 tasarım yeterli. Çoklu
        tasarım gerekiyorsa şimdilik tek dosya yükle, onay sayfasında ekleme
        yapabilirsin.
      </div>
    </main>
  );
}
