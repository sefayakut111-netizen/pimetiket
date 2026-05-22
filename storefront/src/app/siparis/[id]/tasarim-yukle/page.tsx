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

interface FailedDesign {
  id: string;
  name: string;
  reason: string;
  uploadedAt: string;
}

interface OrderItem {
  id: string;
  title: string;
  qty: number;
  width: number;
  height: number;
  // Sefa 22 May v68 Faz 2 stretch — redistribute compatibility
  product: string;
  config: string;
  unit: number;
  hasDesign: boolean; // design_files'ta kayit var mi (en az 1)
  // Sefa 22 May v68 — Multi-design destek:
  designsRequired: number; // kac tasarim gerekli (meta.designCount, default 1)
  designsUploaded: number; // su ana kadar kac yuklendi
  designsComplete: boolean; // designsUploaded >= designsRequired
  // Sefa 22 May v68 — Faz 2: AI ön-kontrolde takılan dosyalar
  failedDesigns: FailedDesign[];
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
  // Sefa 22 May v68 Faz 2 stretch — redistribute slot state.
  // Hangi sourceItemId için açıldı, target seçim modal'ı.
  const [redistributeOpen, setRedistributeOpen] = useState<string | null>(null);
  const [redistributing, setRedistributing] = useState(false);

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

  // Sefa 22 May v68 Faz 2 stretch — redistribute handler
  async function handleRedistribute(sourceItemId: string, targetItemId: string) {
    setRedistributing(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/redistribute-slot`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceItemId, targetItemId }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error || `status_${res.status}`);
      }
      toast.success("Slot kapatildi, adet transfer edildi");
      setRedistributeOpen(null);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error(`Transfer basarisiz: ${msg}`);
    } finally {
      setRedistributing(false);
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
            Odemeni aldik, tesekkurler! Simdi her urun icin tasarim dosyani
            yuklemeni bekliyorum. Sifir kayip ise SVG/AI/PDF, raster ise
            PNG/JPG/PSD destekleniyor (max 30 MB).
          </p>
          <p className="mt-2">
            Tum tasarimlar yuklenince <strong>otomatik bicak cikarimi</strong>{" "}
            baslar — 5 dakika icinde onay sayfasinda olacak.
          </p>
        </div>
      </Card>

      {/* Sefa 22 May v68 — Toplam progress bar + yuzde:
          Final sipariş modeli "Adim 5 — tasarim sayisi kontrolu" UI.
          totalUploaded / totalRequired (tum itemler genelinde). */}
      <Card className="mb-4 p-4">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[13px] font-semibold uppercase tracking-[0.04em] text-gri-700">
            Tasarim durumu
          </div>
          <div className="text-[14px] font-bold tabular-nums text-lacivert">
            {totalUploaded} / {totalRequired} yuklendi
          </div>
        </div>
        <div className="relative h-2.5 w-full rounded-full bg-gri-100 overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-300 ease-out rounded-full",
              totalUploaded === totalRequired ? "bg-yesil" : "bg-pim-mercan"
            )}
            style={{
              width: `${
                totalRequired > 0
                  ? Math.round((totalUploaded / totalRequired) * 100)
                  : 0
              }%`,
            }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11.5px] text-gri-700">
          <span>
            {totalRequired > 0
              ? `%${Math.round((totalUploaded / totalRequired) * 100)}`
              : "%0"}
          </span>
          {pendingCount > 0 ? (
            <span className="font-semibold text-pim-mercan">
              {pendingCount} urunde tasarim bekleniyor
            </span>
          ) : (
            <span className="font-semibold text-yesil">
              ✓ Tum tasarimlar tamam
            </span>
          )}
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

                  {/* Sefa 22 May v68 — Faz 2: qc_failed dosyalar için
                      "neden sayılmadı?" banner'ı + replace CTA. */}
                  {item.failedDesigns.length > 0 && (
                    <div className="mt-3 rounded-lg border border-pim-mercan/40 bg-pim-mercan-tint/40 p-3">
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pim-mercan text-white text-[11px] font-bold"
                          aria-hidden
                        >
                          !
                        </span>
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold text-lacivert">
                            {item.failedDesigns.length === 1
                              ? "Son yüklediğin dosya AI kontrolünde takıldı"
                              : `${item.failedDesigns.length} dosya AI kontrolünde takıldı`}
                          </div>
                          <ul className="mt-1.5 space-y-1 text-[12px] text-gri-700">
                            {item.failedDesigns.slice(0, 3).map((f) => (
                              <li key={f.id} className="flex gap-1.5">
                                <span className="text-pim-mercan">•</span>
                                <span>
                                  <strong className="text-lacivert">
                                    {f.name}
                                  </strong>
                                  {" — "}
                                  {f.reason}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 text-[11.5px] text-gri-700">
                            Düzeltilmiş dosyayı yükleyince bu uyarı kaybolur ve
                            slot tamamlanır. Yardım için sağ alttaki Pim'e sor.
                          </p>
                          {/* Sefa 22 May v68 Faz 2 stretch — redistribute */}
                          {(() => {
                            // Compatible target: aynı product/boyut/config/unit,
                            // bu item DEĞİL ve qty > 0
                            const compatible = order.items.filter(
                              (other) =>
                                other.id !== item.id &&
                                other.qty > 0 &&
                                other.product === item.product &&
                                other.width === item.width &&
                                other.height === item.height &&
                                other.config === item.config &&
                                Number(other.unit) === Number(item.unit)
                            );
                            if (compatible.length === 0) return null;
                            const isOpen = redistributeOpen === item.id;
                            return (
                              <div className="mt-3 border-t border-pim-mercan/20 pt-2.5">
                                {!isOpen ? (
                                  <button
                                    type="button"
                                    onClick={() => setRedistributeOpen(item.id)}
                                    className="text-[12px] font-semibold text-pim-mercan hover:underline"
                                  >
                                    Bu tasarımdan vazgeç →{" "}
                                    <span className="font-normal text-gri-700">
                                      ({item.qty} adetini başka tasarımına aktar,
                                      iade yok)
                                    </span>
                                  </button>
                                ) : (
                                  <div className="rounded-lg bg-white p-3 border border-pim-mercan/30">
                                    <div className="text-[12px] font-semibold text-lacivert mb-2">
                                      {item.qty} adet hangi tasarıma aktarılsın?
                                    </div>
                                    <div className="space-y-1.5">
                                      {compatible.map((tgt) => (
                                        <button
                                          key={tgt.id}
                                          type="button"
                                          disabled={redistributing}
                                          onClick={() =>
                                            void handleRedistribute(item.id, tgt.id)
                                          }
                                          className="w-full text-left rounded-md border border-gri-200 bg-white px-3 py-2 text-[12.5px] hover:border-pim-mercan hover:bg-pim-mercan-tint/30 transition-colors disabled:opacity-50"
                                        >
                                          <div className="font-medium text-lacivert">
                                            {tgt.title}
                                          </div>
                                          <div className="text-[11px] text-gri-700">
                                            Mevcut: {tgt.qty} ad → Yeni:{" "}
                                            <strong>{tgt.qty + item.qty}</strong> ad
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                    <div className="mt-2 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => setRedistributeOpen(null)}
                                        disabled={redistributing}
                                        className="text-[11.5px] text-gri-700 hover:text-lacivert"
                                      >
                                        Vazgeç
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
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
