/**
 * Pim Etiket — /partner/siparisler/[id] (Sefa 23 May v68 — Partner P3)
 *
 * Partner sipariş detay sayfası:
 *   - Sipariş özet (id, status, kargo şehri — PII redacted)
 *   - Her item için:
 *     - Tasarım preview (lazy signed URL)
 *     - Cutline preview (varsa, küçük resim)
 *     - Onayla / Red / Revize butonları
 *   - Genel kararlar listesi
 *
 * Auth: middleware /partner/* için role='partner' garantili.
 * Bu sayfa client component — fetch + interaktif kararlar.
 *
 * Revize butonu P3'te DISABLED — P4 (editör) ve P5 (upload) ile aktif olur.
 */

"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, Eyebrow, Skeleton, useToast } from "@/components/ui";

interface CutlinePreview {
  preview_png_url: string | null;
  tier: string | null;
  mode: string | null;
  offset_mm: number | null;
}

interface PartnerDesign {
  design_file_id: string;
  file_name: string;
  mime_type: string;
  version: number;
  design_status: string;
  revised_by_partner: boolean;
  cutline: CutlinePreview | null;
}

interface PartnerItem {
  id: string;
  product: string;
  title: string;
  config: string;
  width: number;
  height: number;
  qty: number;
  meta: Record<string, unknown> | null;
  proof_status: string;
  proof_approved_at: string | null;
  partner_decision: { decided_at: string; note: string | null } | null;
  designs: PartnerDesign[];
}

interface PartnerOrderDetail {
  order: {
    id: string;
    status: string;
    created_at: string;
    estimated_delivery: string | null;
    address: { city: string | null; district: string | null };
  };
  assignment: {
    id: string;
    status: string;
    assigned_at: string;
    estimated_delivery: string | null;
    in_production_at: string | null;
    notes: string | null;
  };
  items: PartnerItem[];
  partner_decisions: {
    approved: number;
    rejected: number;
    revised: number;
    pending: number;
  };
}

const PRODUCT_LABEL: Record<string, string> = {
  sticker: "Sticker",
  etiket_rulo: "Etiket Rulo",
  etiket_tabaka: "Etiket Tabaka",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  approved: { label: "Müşteri Onayladı", cls: "bg-gri-100 text-gri-700" },
  partner_review: { label: "İnceleme Bekliyor", cls: "bg-sari-soft text-lacivert" },
  partner_approved: { label: "✓ Onayladın", cls: "bg-yesil-soft text-yesil" },
  partner_rejected: { label: "✗ Reddettin", cls: "bg-kirmizi-soft text-kirmizi" },
  partner_revised: { label: "↻ Revize Ettin", cls: "bg-pim-mercan-tint text-pim-mercan" },
};

async function downloadProductionExport(
  orderId: string,
  itemId: string,
  type: "cutline" | "design" | "composite",
  designFileId?: string
) {
  const qs = new URLSearchParams({ type });
  if (designFileId) qs.set("design_file_id", designFileId);
  const res = await fetch(
    `/api/orders/${orderId}/proof/${itemId}/production-export?${qs.toString()}`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const ext = type === "cutline" ? "svg" : type === "composite" ? "png" : "bin";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `pim-${type}-${orderId.slice(-6)}.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function PartnerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: orderId } = use(params);
  const toast = useToast();
  const [data, setData] = useState<PartnerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function loadData() {
    try {
      const res = await fetch(`/api/partner/orders/${orderId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as PartnerOrderDetail;
      setData(j);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error("Sipariş yüklenemedi: " + msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleDecide(
    itemId: string,
    action: "approve" | "reject",
    note?: string
  ) {
    setActionLoading(`${itemId}-${action}`);
    try {
      const res = await fetch(
        `/api/partner/orders/${orderId}/items/${itemId}/decide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, note }),
        }
      );
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        assignment_transition?: string | null;
      };
      if (!res.ok || !j.ok) {
        toast.error(j.message ?? j.error ?? "İşlem başarısız");
        return;
      }
      toast.success(
        action === "approve" ? "Tasarım onaylandı" : "Tasarım reddedildi"
      );
      if (j.assignment_transition === "in_production") {
        toast.success("Tüm tasarımlar onaylandı — sipariş üretime alındı!");
      } else if (j.assignment_transition === "issue") {
        toast.error("Sipariş admin loop'una düştü (red sonrası)");
      }
      void loadData(); // refresh
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error("Hata: " + msg);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <main className="container py-8">
        <Skeleton className="mb-2 h-8 w-48" />
        <Skeleton className="mb-6 h-4 w-64" />
        <Skeleton className="h-96" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container py-12 text-center">
        <p className="text-sm text-gri-700">Sipariş yüklenemedi.</p>
        <Link
          href="/partner"
          className="mt-4 inline-block text-pim-mercan hover:underline"
        >
          ← Dashboard'a dön
        </Link>
      </main>
    );
  }

  const { order, assignment, items, partner_decisions } = data;
  const allDecided =
    partner_decisions.approved + partner_decisions.rejected ===
    items.length;

  return (
    <main className="container py-8">
      {/* Breadcrumb + header */}
      <Link
        href="/partner"
        className="mb-2 inline-block text-xs text-gri-700 hover:text-lacivert"
      >
        ← Dashboard
      </Link>
      <Eyebrow>SİPARİŞ #{order.id}</Eyebrow>
      <h1 className="mt-2 text-2xl font-bold text-lacivert">
        Tasarım İncelemesi ({items.length} ürün)
      </h1>
      <p className="mt-1 text-sm text-gri-700">
        Kargo: {order.address.city ?? "—"}
        {order.address.district ? ` / ${order.address.district}` : ""}
        {assignment.estimated_delivery && (
          <>
            {" · "}
            Tahmini teslim:{" "}
            {new Date(assignment.estimated_delivery).toLocaleDateString("tr-TR")}
          </>
        )}
      </p>

      {/* Genel karar özeti */}
      <div className="mt-4 rounded-xl border border-gri-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span>
            <strong className="text-yesil">{partner_decisions.approved}</strong>{" "}
            onaylandı
          </span>
          <span>
            <strong className="text-kirmizi">
              {partner_decisions.rejected}
            </strong>{" "}
            reddedildi
          </span>
          <span>
            <strong className="text-gri-700">{partner_decisions.pending}</strong>{" "}
            beklemede
          </span>
        </div>
        {allDecided && partner_decisions.rejected === 0 && (
          <p className="mt-2 text-sm font-semibold text-yesil">
            🎉 Tüm tasarımları onayladın — sipariş üretime alındı.
          </p>
        )}
      </div>

      {/* Item listesi */}
      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            orderId={orderId}
            actionLoading={actionLoading}
            onDecide={handleDecide}
          />
        ))}
      </div>
    </main>
  );
}

interface ItemCardProps {
  item: PartnerItem;
  orderId: string;
  actionLoading: string | null;
  onDecide: (
    itemId: string,
    action: "approve" | "reject",
    note?: string
  ) => void;
}

function ItemCard({ item, orderId, actionLoading, onDecide }: ItemCardProps) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [uploadMode, setUploadMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const badge = STATUS_BADGE[item.proof_status] ?? {
    label: item.proof_status,
    cls: "bg-gri-100 text-gri-700",
  };
  const decided =
    item.proof_status === "partner_approved" ||
    item.proof_status === "partner_rejected" ||
    item.proof_status === "partner_revised";

  // İlk design'ı kullan
  const design = item.designs[0];

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-4 p-5 lg:grid-cols-[280px_1fr]">
        {/* Sol — tasarım preview */}
        <div>
          {design ? (
            <DesignThumb
              orderId={orderId}
              itemId={item.id}
              designFileId={design.design_file_id}
            />
          ) : (
            <div className="grid aspect-square place-items-center rounded-lg bg-gri-100 text-xs text-gri-700">
              Tasarım yok
            </div>
          )}
          {design?.cutline?.preview_png_url && (
            <div className="mt-2 overflow-hidden rounded border border-gri-200">
              <img
                src={design.cutline.preview_png_url}
                alt="Bıçak"
                className="block h-20 w-full object-contain bg-gri-50"
              />
              <p className="bg-gri-50 px-2 py-1 text-[10px] text-gri-700">
                Bıçak · {design.cutline.tier ?? "—"} ·{" "}
                {design.cutline.mode ?? "—"}
              </p>
            </div>
          )}
          {design?.cutline && (
            <div className="mt-2 flex flex-col gap-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gri-700">
                Üretim indir
              </p>
              {(["cutline", "design", "composite"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="rounded border border-gri-200 bg-white px-2 py-1 text-left text-[11px] text-lacivert hover:border-pim-mercan hover:bg-pim-mercan-tint/30"
                  onClick={() => {
                    void downloadProductionExport(
                      orderId,
                      item.id,
                      t,
                      design.design_file_id
                    ).catch(() => {
                      /* toast parent */
                    });
                  }}
                >
                  {t === "cutline"
                    ? "Bıçak SVG"
                    : t === "design"
                      ? "Görsel dosyası"
                      : "Bıçak+Görsel PNG"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sağ — detaylar + butonlar */}
        <div>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-gri-700">
                {PRODUCT_LABEL[item.product] ?? item.product}
              </p>
              <h3 className="mt-0.5 text-lg font-bold text-lacivert">
                {item.title}
              </h3>
              <p className="mt-1 text-sm text-gri-700">
                {item.qty} adet · {item.width}×{item.height} mm
              </p>
              {item.config && (
                <p className="mt-1 text-xs text-gri-700">{item.config}</p>
              )}
            </div>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}
            >
              {badge.label}
            </span>
          </div>

          {item.partner_decision?.note && (
            <div className="mt-3 rounded-lg bg-gri-50 p-3 text-xs text-gri-700">
              <strong>Notun:</strong> {item.partner_decision.note}
            </div>
          )}

          {/* Aksiyon butonları */}
          {decided ? (
            <p className="mt-4 text-xs text-gri-700">
              Karar verildi
              {item.partner_decision?.decided_at && (
                <>
                  {" "}·{" "}
                  {new Date(item.partner_decision.decided_at).toLocaleString(
                    "tr-TR"
                  )}
                </>
              )}
            </p>
          ) : rejectMode ? (
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-semibold text-lacivert">
                Red sebebi (en az 10 karakter)
              </label>
              <textarea
                className="w-full rounded-lg border border-gri-200 px-3 py-2 text-sm"
                rows={3}
                placeholder="Örn: tasarım çözünürlüğü düşük, baskı için yeterli değil..."
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={
                    rejectNote.trim().length < 10 ||
                    actionLoading === `${item.id}-reject`
                  }
                  onClick={() => onDecide(item.id, "reject", rejectNote)}
                >
                  {actionLoading === `${item.id}-reject`
                    ? "Gönderiliyor..."
                    : "Reddi onayla"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRejectMode(false);
                    setRejectNote("");
                  }}
                >
                  Vazgeç
                </Button>
              </div>
            </div>
          ) : uploadMode ? (
            <UploadRevisionForm
              orderId={orderId}
              itemId={item.id}
              uploading={uploading}
              setUploading={setUploading}
              onDone={() => {
                setUploadMode(false);
                // Sayfa refresh için trick — parent setData yenileyecek
                window.location.reload();
              }}
              onCancel={() => setUploadMode(false)}
            />
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="md"
                disabled={actionLoading === `${item.id}-approve`}
                onClick={() => onDecide(item.id, "approve")}
              >
                {actionLoading === `${item.id}-approve`
                  ? "Onaylanıyor..."
                  : "✓ Onayla"}
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setRejectMode(true)}
                className="border border-kirmizi/30 text-kirmizi hover:bg-kirmizi-soft"
              >
                ✗ Red
              </Button>
              <Button
                href={`/partner/siparisler/${orderId}/duzenle/${item.id}`}
                variant="ghost"
                size="md"
                className="border border-pim-mercan/30 text-pim-mercan hover:bg-pim-mercan-tint"
              >
                ✏️ Editörle revize
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setUploadMode(true)}
                className="border border-lacivert/30 text-lacivert hover:bg-gri-100"
              >
                📤 Dosya yükle
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* Partner kendi revize dosyasını yükle — P5 form */
interface UploadFormProps {
  orderId: string;
  itemId: string;
  uploading: boolean;
  setUploading: (v: boolean) => void;
  onDone: () => void;
  onCancel: () => void;
}
function UploadRevisionForm({
  orderId,
  itemId,
  uploading,
  setUploading,
  onDone,
  onCancel,
}: UploadFormProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");

  async function handleUpload() {
    if (!file) {
      toast.error("Önce bir dosya seç");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (note.trim()) fd.append("note", note.trim());
      const res = await fetch(
        `/api/partner/orders/${orderId}/items/${itemId}/upload-revision`,
        { method: "POST", body: fd }
      );
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        toast.error(j.message ?? j.error ?? "Dosya yüklenemedi");
        setUploading(false);
        return;
      }
      toast.success("Revize yüklendi — müşteri yeniden inceleyecek");
      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error("Yükleme hatası: " + msg);
      setUploading(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-pim-mercan/30 bg-pim-mercan-tint/20 p-4">
      <p className="text-xs font-semibold text-lacivert">
        📤 Revize dosyanı yükle (max 50MB · PNG/JPG/SVG/PDF/AI/PSD)
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.svg,.pdf,.ai,.psd,image/png,image/jpeg,image/svg+xml,application/pdf,application/postscript,application/illustrator,application/x-photoshop"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        disabled={uploading}
        className="block w-full text-sm text-gri-700 file:mr-3 file:rounded file:border-0 file:bg-pim-mercan file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
      />
      {file && (
        <p className="text-[11px] text-gri-700">
          Seçilen: <strong>{file.name}</strong> (
          {Math.round(file.size / 1024)}KB · {file.type})
        </p>
      )}
      <textarea
        className="w-full rounded-lg border border-gri-200 px-3 py-2 text-sm"
        rows={2}
        placeholder="Revize notu (opsiyonel) — örn: 'arka plan rengini koyulaştırdım, kontur kalınlaştı'"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={uploading}
      />
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={!file || uploading}
          onClick={handleUpload}
        >
          {uploading ? "Yükleniyor..." : "Yükle ve gönder"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={uploading}
        >
          Vazgeç
        </Button>
      </div>
    </div>
  );
}

/* Tasarım küçük resim — design-url endpoint'inden signed URL al, <img> ile göster */
function DesignThumb({
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
      <div className="grid aspect-square place-items-center rounded-lg bg-kirmizi-soft text-xs text-kirmizi">
        Yüklenemedi
      </div>
    );
  }
  if (!url) {
    return <Skeleton className="aspect-square rounded-lg" />;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-gri-200 bg-gri-50">
      <img
        src={url}
        alt="Tasarım"
        className="block aspect-square w-full object-contain"
      />
    </div>
  );
}
