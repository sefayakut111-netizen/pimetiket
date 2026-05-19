/**
 * Pim Etiket — Baskı Onay Sayfası (/onay/[orderId])
 *
 * Sefa 19 May v68 (Migration 059):
 * Ödeme sonrası DB trigger orders.status='proof_pending' yapar; müşteri
 * bu sayfaya yönlendirilir. Her order_item için:
 *   - Sol panelde liste (thumbnail + onay rozeti)
 *   - Sağda canlı önizleme (tasarım + cutline overlay)
 *   - Alt action bar: Yardım iste / Düzenle / Onayla
 *
 * "Düzenle" → /onay/[orderId]/duzenle/[itemId] (Sefa'nın POC'u açılır)
 * "Onayla" → /api/orders/[id]/proof/[itemId]/approve
 * Tümü onaylandığında → /api/orders/[id]/proof/finalize + /tamamlandi
 *
 * NOT: Şu an cutline önizlemesi STATİK PNG/JPG'dir. CutlineDesigner
 * (POC) /duzenle alt route'unda çalışır. Burada müşteri sadece
 * orijinal tasarım dosyasını ve var ise mevcut cutline SVG'sini görür.
 */

"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Eyebrow, Skeleton, useToast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { PimMini } from "@/components/Pim";
import { cn } from "@/lib/cn";
import type { OrderStatus } from "@/lib/order";

// ============================================================
// Types — fn_proof_summary RPC çıktısı
// ============================================================

interface ProofCutline {
  id: string;
  svg_url: string | null;
  preview_png_url: string | null;
  source: string;
  mode: string;
  offset_mm: number | null;
  dpi: number | null;
  width_mm: number | null;
  height_mm: number | null;
  pim_feedback: string | null;
  pim_severity: "ok" | "warn" | "err" | null;
  status: "draft" | "approved" | "operator_override" | "superseded";
  // POC v2 (Mig 060)
  material_type: "paper" | "transparent" | "metallic" | "holographic" | null;
  white_plan_mode: "off" | "full" | "smart" | "ai" | "custom" | null;
  white_plan_path_count: number | null;
  has_custom_white_plan: boolean | null;
  tier: "pro" | "standard" | "improve" | null;
  detected_cut_contour_names: string[] | null;
}

// POC v2 — yardımcı sabitler
const MATERIAL_LABEL: Record<NonNullable<ProofCutline["material_type"]>, string> = {
  paper: "Normal kağıt",
  transparent: "Şeffaf folyo",
  metallic: "Metalize",
  holographic: "Holografik",
};

const WHITE_MODE_LABEL: Record<NonNullable<ProofCutline["white_plan_mode"]>, string> = {
  off: "Kapalı",
  full: "Tam kaplama",
  smart: "Akıllı",
  ai: "AI ile",
  custom: "Tasarımcı kendi yapmış",
};

const TIER_BADGE: Record<
  NonNullable<ProofCutline["tier"]>,
  { label: string; bg: string; color: string; emoji: string; desc: string }
> = {
  pro: {
    label: "Profesyonel",
    bg: "bg-yesil-soft",
    color: "text-yesil-koyu",
    emoji: "⭐",
    desc: "Tasarımcı bıçağı koruyoruz — direkt onaylayabilirsin",
  },
  standard: {
    label: "Standart",
    bg: "bg-mavi-soft",
    color: "text-mavi-koyu",
    emoji: "✓",
    desc: "Bıçak otomatik üretildi, baskıya hazır",
  },
  improve: {
    label: "İyileştirme önerilir",
    bg: "bg-sari-soft",
    color: "text-sari-koyu",
    emoji: "⚠️",
    desc: "Sonuç fena değil ama daha iyisi mümkün",
  },
};

interface ProofHelpRequest {
  id: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "dismissed";
  created_at: string;
  resolution_note: string | null;
}

interface ProofItem {
  id: string;
  product: "sticker" | "etiket";
  title: string;
  config: string;
  width: number;
  height: number;
  qty: number;
  unit: number;
  total: number;
  meta: Record<string, unknown> | null;
  proof_status:
    | "pending"
    | "viewed"
    | "approved"
    | "editing"
    | "edited"
    | "help_requested";
  proof_viewed_at: string | null;
  proof_approved_at: string | null;
  cutline: ProofCutline | null;
  help_request: ProofHelpRequest | null;
}

interface ProofSummary {
  order: {
    id: string;
    status: OrderStatus;
    subtotal: number;
    shipping: number;
    total: number;
    address: { name?: string } | null;
    created_at: string;
  };
  items: ProofItem[];
  summary: {
    total: number;
    pending: number;
    viewed: number;
    approved: number;
    edited: number;
    help_requested: number;
  };
}

const STATUS_BADGE: Record<
  ProofItem["proof_status"],
  { label: string; bg: string; color: string; emoji: string }
> = {
  pending: {
    label: "Onay bekleniyor",
    bg: "bg-gri-100",
    color: "text-gri-700",
    emoji: "⚪",
  },
  viewed: {
    label: "İnceleniyor",
    bg: "bg-mavi-soft",
    color: "text-mavi-koyu",
    emoji: "🔵",
  },
  approved: {
    label: "Onaylandı",
    bg: "bg-yesil-soft",
    color: "text-yesil",
    emoji: "🟢",
  },
  editing: {
    label: "Düzenleniyor",
    bg: "bg-sari-soft",
    color: "text-sari-koyu",
    emoji: "🟠",
  },
  edited: {
    label: "Tekrar onayla",
    bg: "bg-sari-soft",
    color: "text-sari-koyu",
    emoji: "🟡",
  },
  help_requested: {
    label: "Yardım talebi açık",
    bg: "bg-pim-mercan-tint",
    color: "text-pim-mercan",
    emoji: "🆘",
  },
};

// ============================================================
// API helpers
// ============================================================

async function fetchProofSummary(orderId: string): Promise<ProofSummary> {
  const res = await fetch(`/api/orders/${orderId}/proof`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as ProofSummary;
}

async function markViewed(orderId: string, itemId: string): Promise<void> {
  await fetch(`/api/orders/${orderId}/proof/${itemId}/view`, {
    method: "POST",
  }).catch(() => null);
}

async function approveItem(
  orderId: string,
  itemId: string,
  cutlineId?: string
): Promise<{ ok: boolean; allApproved: boolean; error?: string }> {
  const res = await fetch(`/api/orders/${orderId}/proof/${itemId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: cutlineId ? JSON.stringify({ cutlineId }) : "{}",
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    allApproved?: boolean;
    error?: string;
  };
  return {
    ok: res.ok && data.ok === true,
    allApproved: data.allApproved === true,
    error: data.error,
  };
}

async function submitHelp(
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

async function finalizeProof(
  orderId: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/orders/${orderId}/proof/finalize`, {
    method: "POST",
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  return { ok: res.ok && data.ok === true, error: data.error };
}

// ============================================================
// Component
// ============================================================

export default function ProofApprovalPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const router = useRouter();
  const toast = useToast();

  const [data, setData] = useState<ProofSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpMsg, setHelpMsg] = useState("");
  const [submittingHelp, setSubmittingHelp] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const summary = await fetchProofSummary(orderId);
      setData(summary);

      // Status doğru değilse yönlendir
      if (summary.order.status === "proof_approved") {
        router.replace(`/onay/${orderId}/tamamlandi`);
        return;
      }
      if (summary.order.status !== "proof_pending") {
        router.replace(`/siparis/${orderId}`);
        return;
      }

      // İlk pending item'a otomatik scroll
      if (!activeItemId && summary.items.length > 0) {
        const firstPending =
          summary.items.find((i) => i.proof_status !== "approved") ??
          summary.items[0];
        setActiveItemId(firstPending.id);
        // İlk gösterimde "viewed" işareti at
        if (firstPending.proof_status === "pending") {
          void markViewed(orderId, firstPending.id);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error(`Sipariş yüklenemedi: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [orderId, router, toast, activeItemId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeItem = data?.items.find((i) => i.id === activeItemId) ?? null;

  // ============================================================
  // Actions
  // ============================================================

  const handleSelectItem = (itemId: string) => {
    setActiveItemId(itemId);
    const item = data?.items.find((i) => i.id === itemId);
    if (item && item.proof_status === "pending") {
      void markViewed(orderId, itemId);
      // Local state'i de güncelle (yumuşak UI)
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) =>
                i.id === itemId
                  ? { ...i, proof_status: "viewed" as const }
                  : i
              ),
            }
          : prev
      );
    }
  };

  const handleApprove = async () => {
    if (!activeItem) return;
    setApproving(true);
    try {
      const result = await approveItem(
        orderId,
        activeItem.id,
        activeItem.cutline?.id
      );
      if (!result.ok) {
        toast.error(result.error ?? "Onay başarısız");
        return;
      }

      // Local state güncelle
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) =>
                i.id === activeItem.id
                  ? {
                      ...i,
                      proof_status: "approved" as const,
                      proof_approved_at: new Date().toISOString(),
                    }
                  : i
              ),
              summary: {
                ...prev.summary,
                approved: prev.summary.approved + 1,
                viewed: Math.max(0, prev.summary.viewed - 1),
              },
            }
          : prev
      );

      toast.success(`${activeItem.title} onaylandı`);

      if (result.allApproved) {
        // Hepsi onaylandı → finalize çağır
        const fin = await finalizeProof(orderId);
        if (fin.ok) {
          router.push(`/onay/${orderId}/tamamlandi`);
          return;
        }
        toast.error(fin.error ?? "Sonlandırma başarısız");
        return;
      }

      // Sıradaki onaysız item'a geç
      const next = data?.items.find(
        (i) => i.id !== activeItem.id && i.proof_status !== "approved"
      );
      if (next) {
        handleSelectItem(next.id);
      }
    } finally {
      setApproving(false);
    }
  };

  const handleSubmitHelp = async () => {
    if (!activeItem) return;
    const trimmed = helpMsg.trim();
    if (trimmed.length < 5) {
      toast.error("Lütfen sorunu en az 5 karakter açıkla");
      return;
    }
    setSubmittingHelp(true);
    try {
      const result = await submitHelp(orderId, activeItem.id, trimmed);
      if (!result.ok) {
        toast.error(result.error ?? "Talep gönderilemedi");
        return;
      }
      toast.success("Talebin alındı, operatörümüz 1 iş günü içinde dönecek");
      setHelpOpen(false);
      setHelpMsg("");
      // Reload
      void load();
    } finally {
      setSubmittingHelp(false);
    }
  };

  const handleEdit = () => {
    if (!activeItem) return;
    router.push(`/onay/${orderId}/duzenle/${activeItem.id}`);
  };

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <main className="container py-8">
        <Skeleton className="mb-4 h-8 w-64" />
        <Skeleton className="mb-2 h-4 w-96" />
        <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container py-12">
        <Card className="p-8 text-center">
          <h1 className="mb-2 text-lg font-semibold">
            Sipariş yüklenemedi
          </h1>
          <p className="text-sm text-gri-700">
            Tarayıcıyı yenilemeyi dene veya{" "}
            <Link href="/siparislerim" className="text-pim-mercan underline">
              siparişlerime dön
            </Link>
            .
          </p>
        </Card>
      </main>
    );
  }

  const { summary, items, order } = data;
  const progressPct =
    summary.total > 0 ? Math.round((summary.approved / summary.total) * 100) : 0;

  return (
    <main className="container py-6">
      {/* Header */}
      <div className="mb-6">
        <Eyebrow>SİPARİŞ #{order.id}</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-lacivert">
          Baskı önizlemelerini onayla
        </h1>
        <p className="mt-1 text-sm text-gri-700">
          {summary.total} ürün — {summary.approved} onaylandı, {summary.total - summary.approved} bekliyor
        </p>

        {/* Progress bar */}
        <div className="mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-gri-100">
          <div
            className="h-full bg-yesil transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Pim tip */}
      <Card className="mb-6 flex items-start gap-3 bg-pim-mercan-tint/30 p-4">
        <PimMini pose="inspect" size={48} />
        <p className="text-sm leading-relaxed text-lacivert">
          {summary.help_requested > 0
            ? `Bir ürün için yardım talebin açık — operatörümüz çözümleyince sıraya gelir. ${summary.help_requested === summary.total - summary.approved ? "Diğer ürünler de seni bekliyor değil mi?" : ""}`
            : summary.approved === 0
              ? "İlk önizlemeye bak, kesim çizgisini incele. Memnunsan 'Onayla' de; bir şey değişsin istiyorsan 'Düzenle'."
              : `${summary.approved}/${summary.total} ürün onaylandı, az kaldı! Kalan ${summary.total - summary.approved} ürünü de gözden geçirelim.`}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* SOL — İtem listesi */}
        <aside className="space-y-2">
          {items.map((item) => {
            const badge = STATUS_BADGE[item.proof_status];
            const isActive = item.id === activeItemId;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectItem(item.id)}
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition",
                  isActive
                    ? "border-pim-mercan bg-pim-mercan-tint/30 shadow-mercan"
                    : "border-gri-200 bg-white hover:border-pim-mercan/40"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Thumbnail placeholder — gerçek preview Faz 2'de */}
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gri-100 text-gri-700">
                    {item.product === "sticker" ? (
                      <Icon.Sticker size={32} />
                    ) : (
                      <Icon.Tag size={32} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium text-lacivert">
                      {item.title}
                    </div>
                    <div className="mt-0.5 text-xs text-gri-700">
                      {item.qty} ad · {item.width}×{item.height}mm
                      {item.cutline?.material_type &&
                        item.cutline.material_type !== "paper" && (
                          <span>
                            {" · "}
                            {MATERIAL_LABEL[item.cutline.material_type]}
                          </span>
                        )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <div
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          badge.bg,
                          badge.color
                        )}
                      >
                        <span>{badge.emoji}</span>
                        <span>{badge.label}</span>
                      </div>
                      {/* Tier mini rozet (sadece pro veya improve için) */}
                      {item.cutline?.tier &&
                        item.cutline.tier !== "standard" && (
                          <div
                            className={cn(
                              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              TIER_BADGE[item.cutline.tier].bg,
                              TIER_BADGE[item.cutline.tier].color
                            )}
                          >
                            {TIER_BADGE[item.cutline.tier].emoji}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </aside>

        {/* SAĞ — Önizleme + Action bar */}
        <section className="space-y-4">
          {activeItem ? (
            <>
              {/* Önizleme alanı */}
              <Card className="overflow-hidden p-0">
                <div className="border-b border-gri-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-lacivert">
                        {activeItem.title}
                      </div>
                      <div className="mt-0.5 text-xs text-gri-700">
                        {activeItem.qty} ad · {activeItem.width}×
                        {activeItem.height}mm · {activeItem.config}
                      </div>

                      {/* POC v2 — tier + malzeme + white plan rozeti */}
                      {activeItem.cutline && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {/* Tier rozeti */}
                          {activeItem.cutline.tier && (
                            <div
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                                TIER_BADGE[activeItem.cutline.tier].bg,
                                TIER_BADGE[activeItem.cutline.tier].color
                              )}
                              title={TIER_BADGE[activeItem.cutline.tier].desc}
                            >
                              <span>
                                {TIER_BADGE[activeItem.cutline.tier].emoji}
                              </span>
                              <span>
                                {TIER_BADGE[activeItem.cutline.tier].label}
                              </span>
                            </div>
                          )}

                          {/* Malzeme rozeti */}
                          {activeItem.cutline.material_type &&
                            activeItem.cutline.material_type !== "paper" && (
                              <div className="inline-flex items-center gap-1 rounded-full bg-gri-100 px-2 py-0.5 text-xs font-medium text-gri-700">
                                <span>📦</span>
                                <span>
                                  {
                                    MATERIAL_LABEL[
                                      activeItem.cutline.material_type
                                    ]
                                  }
                                </span>
                              </div>
                            )}

                          {/* White plan göstergesi (sadece varsa) */}
                          {activeItem.cutline.white_plan_mode &&
                            activeItem.cutline.white_plan_mode !== "off" && (
                              <div
                                className="inline-flex items-center gap-1 rounded-full bg-gri-100 px-2 py-0.5 text-xs font-medium text-gri-700"
                                title="Şeffaf/metalize altına basılan beyaz mürekkep katmanı"
                              >
                                <span>⚪</span>
                                <span>
                                  Beyaz plan:{" "}
                                  {
                                    WHITE_MODE_LABEL[
                                      activeItem.cutline.white_plan_mode
                                    ]
                                  }
                                </span>
                              </div>
                            )}

                          {/* Gömülü cutline tespit edildiyse */}
                          {activeItem.cutline
                            .detected_cut_contour_names &&
                            activeItem.cutline.detected_cut_contour_names
                              .length > 0 && (
                              <div className="inline-flex items-center gap-1 rounded-full bg-yesil-soft/60 px-2 py-0.5 text-xs font-medium text-yesil-koyu">
                                <span>🎯</span>
                                <span>
                                  Gömülü bıçak:{" "}
                                  {activeItem.cutline.detected_cut_contour_names
                                    .slice(0, 2)
                                    .join(", ")}
                                </span>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                    <div
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
                        STATUS_BADGE[activeItem.proof_status].bg,
                        STATUS_BADGE[activeItem.proof_status].color
                      )}
                    >
                      {STATUS_BADGE[activeItem.proof_status].label}
                    </div>
                  </div>
                </div>

                {/* Canvas placeholder — burada cutline_design preview gösterilir */}
                <div
                  className="grid min-h-[320px] place-items-center bg-gri-100 p-6"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg, #f3efe6 25%, transparent 25%), linear-gradient(-45deg, #f3efe6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3efe6 75%), linear-gradient(-45deg, transparent 75%, #f3efe6 75%)",
                    backgroundSize: "20px 20px",
                    backgroundPosition:
                      "0 0, 0 10px, 10px -10px, -10px 0px",
                  }}
                >
                  {activeItem.cutline?.preview_png_url ? (
                    // TODO: signed URL endpoint ile çek
                    <div className="text-sm text-gri-700">
                      Önizleme yükleniyor…
                    </div>
                  ) : (
                    <div className="text-center text-sm text-gri-700">
                      <div className="mb-2 flex justify-center opacity-50">
                        <Icon.Doc size={48} />
                      </div>
                      <p className="font-medium">
                        Otomatik kesim çizgisi hazırlanıyor
                      </p>
                      <p className="mt-1 text-xs">
                        "Düzenle" diyerek bıçağı kendin de ayarlayabilirsin.
                      </p>
                    </div>
                  )}
                </div>

                {/* Pim yorumu (cutline_designs.pim_feedback) */}
                {activeItem.cutline?.pim_feedback && (
                  <div className="flex items-start gap-3 border-t border-gri-200 bg-krem p-4">
                    <PimMini
                      pose={
                        activeItem.cutline.pim_severity === "err" ||
                        activeItem.cutline.pim_severity === "warn"
                          ? "inspect"
                          : "happy"
                      }
                      size={36}
                    />
                    <p className="text-sm leading-relaxed text-lacivert">
                      {activeItem.cutline.pim_feedback}
                    </p>
                  </div>
                )}

                {/* Yardım talebi gösterimi */}
                {activeItem.help_request && (
                  <div className="border-t border-sari-soft/40 bg-sari-soft/30 p-4">
                    <Eyebrow>YARDIM TALEBİN AÇIK</Eyebrow>
                    <p className="mt-1 text-sm text-sari-koyu">
                      {activeItem.help_request.message}
                    </p>
                    <p className="mt-2 text-xs text-gri-700">
                      Operatörümüz çözümleyince sana mail atacak. Bu üründe
                      onay sayacı durdu.
                    </p>
                  </div>
                )}
              </Card>

              {/* Action bar */}
              <div className="sticky bottom-4 flex flex-col gap-2 rounded-xl border border-gri-200 bg-white p-4 shadow-md sm:flex-row sm:items-center sm:justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setHelpOpen(true)}
                  disabled={activeItem.proof_status === "help_requested"}
                >
                  Ekibimizden yardım iste
                </Button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="secondary" size="md" onClick={handleEdit}>
                    Bıçağı düzenle
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => void handleApprove()}
                    disabled={
                      approving ||
                      activeItem.proof_status === "approved" ||
                      activeItem.proof_status === "help_requested"
                    }
                  >
                    {approving
                      ? "Onaylanıyor…"
                      : activeItem.proof_status === "approved"
                        ? "Onaylandı ✓"
                        : "Bu ürünü onayla"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <Card className="p-8 text-center text-sm text-gri-700">
              Soldan bir ürün seç
            </Card>
          )}
        </section>
      </div>

      {/* Yardım modal */}
      {helpOpen && activeItem && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => !submittingHelp && setHelpOpen(false)}
        >
          <Card
            className="w-full max-w-md p-6"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-lacivert">
              Operatörden yardım iste
            </h3>
            <p className="mt-2 text-sm text-gri-700">
              Tasarımın <strong>{activeItem.title}</strong> için bıçak/kesim
              ayarını operatörümüzün yapmasını istiyorsan, sorunu kısaca
              anlat. 1 iş günü içinde dönüş yaparız.
            </p>
            <textarea
              className="mt-3 w-full rounded-lg border border-gri-200 p-3 text-sm focus:border-pim-mercan focus:outline-none"
              rows={5}
              placeholder="Örnek: Logo etrafındaki bıçak çok dar kalıyor, 3-4 mm istiyorum…"
              value={helpMsg}
              onChange={(e) => setHelpMsg(e.target.value)}
              disabled={submittingHelp}
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
    </main>
  );
}
