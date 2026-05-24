/**
 * Pim Etiket — /admin/prova/[orderId]
 *
 * Sefa 23 May v68 (admin akisi netlestirme):
 * Operator "Tam ekran incele" tikladıginda admin panel icinde kalir —
 * once /siparis/[id] (musteri sayfasi) acilirdi, Sefa "admin panelindeki
 * personelin admin panelinde kalmasi lazim" dedi.
 *
 * Bu sayfa:
 *   - Sipariş özeti (id, müşteri, total, status)
 *   - Her item için: tasarım preview (signed URL) + cutline preview (varsa)
 *     + design metadata
 *   - "Üretime al" / "İptal et" butonları (callStatusApi)
 *   - "Bıçağı düzenle" → /onay/[orderId]/duzenle/[itemId] yeni tab (POC editor)
 *   - "Geri" → /admin/prova
 */

"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, Skeleton, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

interface DesignFile {
  design_file_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  version: number;
  design_status: string;
  cutline: {
    preview_png_url: string | null;
    tier: string | null;
    mode: string | null;
    offset_mm: number | null;
    pim_feedback: string | null;
    pim_severity: string | null;
  } | null;
}

interface ProofItem {
  id: string;
  product: string;
  title: string;
  config: string;
  width: number;
  height: number;
  qty: number;
  unit: number;
  total: number;
  proof_status: string | null;
  designs: DesignFile[];
  cutline: DesignFile["cutline"];
}

interface ProofSummary {
  order: {
    id: string;
    status: string;
    total: number;
    address: { name?: string; phone?: string } | null;
    created_at: string;
    customer_email: string | null;
  };
  items: ProofItem[];
}

const fmt = (n: number) => Math.round(n).toLocaleString("tr-TR");

function DesignPreview({
  orderId,
  itemId,
  designFileId,
}: {
  orderId: string;
  itemId: string;
  designFileId: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void fetch(
      `/api/orders/${orderId}/items/${itemId}/design-url?design_file_id=${designFileId}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.url) setUrl(d.url);
        else setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, itemId, designFileId]);

  if (error) {
    return (
      <div className="aspect-[4/3] bg-gri-100 rounded-lg grid place-items-center text-xs text-gri-700">
        Önizleme yüklenemedi
      </div>
    );
  }
  if (!url) {
    return <div className="aspect-[4/3] bg-gri-100 rounded-lg animate-pulse" />;
  }
  return (
    <div className="relative aspect-[4/3] bg-gri-50 rounded-lg overflow-hidden border border-gri-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Tasarım önizleme"
        className="absolute inset-0 w-full h-full object-contain p-3"
        onError={() => setError(true)}
      />
    </div>
  );
}

export default function AdminProvaDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<ProofSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/proof`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `status_${res.status}`);
      }
      setData((await res.json()) as ProofSummary);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function callStatusApi(status: string, note: string): Promise<boolean> {
    setActing(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(`Güncelleme başarısız: ${j.error ?? res.status}`);
        return false;
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "bilinmeyen hata";
      toast.error(`Ağ hatası: ${msg}`);
      return false;
    } finally {
      setActing(false);
    }
  }

  async function handleApprove() {
    const ok = await callStatusApi(
      "in_production",
      "Prova kuyruğundan üretime al (admin)"
    );
    if (ok) {
      toast.success(`${orderId} → Üretime alındı`);
      router.push("/admin/prova");
    }
  }

  async function handleCancel() {
    if (!confirm(`${orderId} siparişini iptal etmek istiyor musun?`)) return;
    const ok = await callStatusApi(
      "cancelled",
      "Prova kuyruğundan iptal (admin)"
    );
    if (ok) {
      toast.info(`${orderId} iptal edildi`);
      router.push("/admin/prova");
    }
  }

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Üst bar: geri + title */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link
              href="/admin/prova"
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-gri-700 hover:text-lacivert mb-2"
            >
              ← Prova kuyruğuna dön
            </Link>
            <Link
              href={`/admin/siparisler/${orderId}`}
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-pim-mercan hover:underline mb-2 ml-4"
            >
              Admin sipariş detayı →
            </Link>
            <Eyebrow>PROVA İNCELEME</Eyebrow>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold text-lacivert tabular-nums">
              #{orderId}
            </h1>
            {data && (
              <p className="mt-1 text-sm text-gri-700">
                <strong className="text-lacivert">
                  {data.order.address?.name ?? "Müşteri"}
                </strong>
                {data.order.customer_email && (
                  <>
                    {" · "}
                    <span className="text-gri-700">
                      {data.order.customer_email}
                    </span>
                  </>
                )}
                {" · "}
                <span className="tabular-nums">{fmt(data.order.total)} ₺</span>
              </p>
            )}
          </div>

          {data && (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="primary"
                size="md"
                onClick={handleApprove}
                disabled={acting}
              >
                <Icon.Check size={14} /> Üretime al
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={handleCancel}
                disabled={acting}
              >
                İptal et
              </Button>
            </div>
          )}
        </div>

        {loading && (
          <div className="grid gap-4">
            <Skeleton className="h-[300px]" />
            <Skeleton className="h-[300px]" />
          </div>
        )}

        {error && (
          <Card className="p-6 text-center">
            <div className="text-pim-mercan font-semibold mb-2">
              ⚠ Yükleme hatası
            </div>
            <p className="text-sm text-gri-700">{error}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => void load()}
            >
              Tekrar dene
            </Button>
          </Card>
        )}

        {data && data.items.length === 0 && (
          <Card padding="p-10" className="text-center">
            <Pim pose="happy" size={80} />
            <p className="mt-3 text-sm text-gri-700">
              Bu siparişte item yok.
            </p>
          </Card>
        )}

        {/* Item kartları */}
        {data && data.items.length > 0 && (
          <div className="grid gap-5">
            {data.items.map((item) => {
              const designs = item.designs ?? [];
              const designsCount = designs.length;
              return (
                <Card key={item.id} className="p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                    <div>
                      <h3 className="font-bold text-lacivert text-lg">
                        {item.title}
                      </h3>
                      <p className="text-[13px] text-gri-700 mt-0.5">
                        {item.qty} ad · {item.width}×{item.height} mm ·{" "}
                        {item.config}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center h-[22px] px-2.5 rounded-full text-[11.5px] font-semibold",
                        item.proof_status === "approved"
                          ? "bg-yesil-soft text-yesil"
                          : item.proof_status === "help_requested"
                            ? "bg-sari-soft text-sari-koyu"
                            : "bg-gri-100 text-gri-700"
                      )}
                    >
                      {item.proof_status === "approved"
                        ? "Onaylandı"
                        : item.proof_status === "help_requested"
                          ? "Yardım istendi"
                          : item.proof_status === "viewed"
                            ? "İncelendi"
                            : "Bekliyor"}
                    </span>
                  </div>

                  {designsCount === 0 ? (
                    <div className="p-6 bg-gri-100 rounded-lg text-center text-sm text-gri-700">
                      Bu item için tasarım dosyası henüz yüklenmedi.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {designs.map((df, idx) => (
                        <div
                          key={df.design_file_id}
                          className="border border-gri-200 rounded-lg p-3"
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="text-[12px] font-semibold text-lacivert">
                              {designsCount > 1
                                ? `Tasarım ${idx + 1}/${designsCount}`
                                : "Tasarım"}
                              <span className="text-gri-500 font-normal ml-1.5">
                                · {df.file_name}
                              </span>
                            </div>
                            {df.cutline?.tier && (
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                  df.cutline.tier === "pro"
                                    ? "bg-yesil-soft text-yesil"
                                    : df.cutline.tier === "improve"
                                      ? "bg-sari-soft text-sari-koyu"
                                      : "bg-gri-100 text-gri-700"
                                )}
                              >
                                {df.cutline.tier}
                              </span>
                            )}
                          </div>

                          <DesignPreview
                            orderId={orderId}
                            itemId={item.id}
                            designFileId={df.design_file_id}
                          />

                          {df.cutline?.pim_feedback && (
                            <div className="mt-2 text-[11.5px] text-gri-700 italic">
                              💡 {df.cutline.pim_feedback}
                            </div>
                          )}

                          <div className="mt-3 flex gap-2 flex-wrap">
                            <Link
                              href={`/onay/${orderId}/duzenle/${item.id}?design_file_id=${df.design_file_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-pim-mercan/10 hover:bg-pim-mercan/20 text-[12px] font-semibold text-pim-mercan"
                            >
                              <Icon.Edit size={12} /> Bıçağı düzenle
                            </Link>
                            {df.cutline?.preview_png_url && (
                              <a
                                href={df.cutline.preview_png_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-gri-100 hover:bg-gri-200 text-[12px] font-semibold text-gri-700"
                              >
                                Bıçak preview
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
