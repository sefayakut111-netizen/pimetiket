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
import { PimMini, Pim } from "@/components/Pim";
import { cn } from "@/lib/cn";
import type { OrderStatus } from "@/lib/order";
import { categorizeFile, needsWhiteLayer } from "@/lib/design-file-types";
import {
  JpgShapeSelector,
  buildGeoCutlineSvg,
  geoShapeToSaveMode,
  type GeoShape,
} from "@/components/proof/JpgShapeSelector";
import { BgRemovalPrompt } from "@/components/proof/BgRemovalPrompt";
import type { BgDetectResult } from "@/lib/proof/background-detect";
import type { ConsistencyIssue } from "@/lib/proof/multi-design-check";
import {
  designHasCutline,
  getExpectedDesignCount,
  itemAllDesignsReady,
} from "@/lib/order-item-meta";

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

// Mig 063 — multi-design proof: her design_file kendi cutline'ı ile
interface ProofDesign {
  design_file_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  version: number;
  design_status: string;
  cutline: ProofCutline | null;
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
  // Mig 063: multi-design — her tasarım kendi cutline'ı ile
  designs: ProofDesign[];
  // Geriye uyumluluk: item-bağlı en güncel cutline (designs[] boşsa kullan)
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
    // Mig 062: 5 dk SLA deadline (proof_generating durumunda set olur)
    sla_proof_deadline?: string | null;
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

function cleanItemConfig(config: string): string {
  return config
    .replace(/\d+×\d+\s*mm/g, "")
    .replace(/\s*·\s*·\s*/g, " · ")
    .replace(/^\s*·\s*/, "")
    .replace(/\s*·\s*$/, "")
    .trim();
}

function isHttpUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const t = url.trim();
  return t.length > 0 && /^https?:\/\/.+/i.test(t);
}

function getItemDesignCount(item: ProofItem): number {
  return getExpectedDesignCount(item.meta, item.designs?.length ?? 0);
}

function itemCutlinePreviewUrl(item: ProofItem): string | null {
  if (isHttpUrl(item.cutline?.preview_png_url)) {
    return item.cutline!.preview_png_url;
  }
  for (const d of item.designs ?? []) {
    if (isHttpUrl(d.cutline?.preview_png_url)) {
      return d.cutline!.preview_png_url;
    }
  }
  return null;
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
// Material helpers (POC + save-edit)
// ============================================================

function mapMaterial(m: unknown): string {
  if (typeof m !== "string") return "paper";
  const k = m.toLowerCase();
  if (k === "transparan" || k === "transparent") return "transparent";
  if (k === "holo" || k === "holographic") return "holographic";
  if (k === "simli" || k === "metallic") return "metallic";
  return "paper";
}

function mapMaterialType(
  m: unknown
): "paper" | "transparent" | "metallic" | "holographic" {
  const mapped = mapMaterial(m);
  if (mapped === "transparent") return "transparent";
  if (mapped === "holographic") return "holographic";
  if (mapped === "metallic") return "metallic";
  return "paper";
}

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpMsg, setHelpMsg] = useState("");
  const [submittingHelp, setSubmittingHelp] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewImgBroken, setPreviewImgBroken] = useState(false);
  const [itemThumbs, setItemThumbs] = useState<Record<string, string>>({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  // Multi-design (C2): item içinde aktif tasarım seçimi
  const [activeDesignFileId, setActiveDesignFileId] = useState<string | null>(null);
  // SLA countdown — proof_generating durumunda her saniye güncellenir
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Background auto-cutline (B1+C1) — cutline'sız design_file'lar için sequential queue
  const [bgGenSrc, setBgGenSrc] = useState<string | null>(null);
  const [bgGenItemId, setBgGenItemId] = useState<string | null>(null);
  const [bgGenDesignFileId, setBgGenDesignFileId] = useState<string | null>(null);
  const [bgGenError, setBgGenError] = useState<string | null>(null);
  const [jpgSaving, setJpgSaving] = useState(false);
  const [proofValidation, setProofValidation] = useState<{
    pimMessage: string | null;
    finalVerdict: string | null;
    cutlineIssues: string[];
    whiteLayerIssues: string[];
    ruleIssues: string[];
  } | null>(null);
  const [helpHistory, setHelpHistory] = useState<
    Record<
      string,
      Array<{
        id: string;
        message: string;
        status: string;
        createdAt: string;
        resolvedAt: string | null;
        resolutionNote: string | null;
      }>
    >
  >({});

  type PreviewLayer = "cutline" | "design" | "cmyk" | "checkerboard";
  const [previewLayer, setPreviewLayer] = useState<PreviewLayer>("cutline");
  const [designUrl, setDesignUrl] = useState<string | null>(null);
  const [cmykPreview, setCmykPreview] = useState<{
    url: string;
    colorShift: string;
    affectedAreas: string;
  } | null>(null);
  const [bgPrompt, setBgPrompt] = useState<{
    show: boolean;
    bgDetect: BgDetectResult | null;
  }>({ show: false, bgDetect: null });
  const [consistencyIssues, setConsistencyIssues] = useState<
    ConsistencyIssue[]
  >([]);
  const [consistencyDismissed, setConsistencyDismissed] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    try {
      if (!silent) {
        setLoading(true);
        setLoadError(null);
      }
      const summary = await fetchProofSummary(orderId);
      setData(summary);

      // Status doğru değilse yönlendir
      if (summary.order.status === "proof_approved") {
        router.replace(`/onay/${orderId}/tamamlandi`);
        return;
      }
      if (
        summary.order.status !== "proof_pending" &&
        summary.order.status !== "proof_generating" &&
        summary.order.status !== "proof_validating"
      ) {
        if (summary.order.status === "awaiting_upload") {
          router.replace(`/siparis/${orderId}/tasarim-yukle`);
        } else {
          router.replace(`/siparis/${orderId}`);
        }
        return;
      }

      // Sefa 22 May v68 Faz 4b — Help history fetch (resolved + dismissed).
      fetch(`/api/orders/${orderId}/help-requests`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((j: { items?: Array<{
          id: string;
          itemId: string;
          message: string;
          status: string;
          createdAt: string;
          resolvedAt: string | null;
          resolutionNote: string | null;
        }> }) => {
          const map: typeof helpHistory = {};
          for (const t of j.items ?? []) {
            if (!map[t.itemId]) map[t.itemId] = [];
            map[t.itemId].push({
              id: t.id,
              message: t.message,
              status: t.status,
              createdAt: t.createdAt,
              resolvedAt: t.resolvedAt,
              resolutionNote: t.resolutionNote,
            });
          }
          setHelpHistory(map);
        })
        .catch(() => {
          /* sessizce geç — kritik değil */
        });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      if (!silent) {
        setLoadError(msg);
        setData(null);
      }
      toast.error(`Sipariş yüklenemedi: ${msg}`);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [orderId, router, toast]);

  // İlk yüklemede ve aktif item yokken pending item seç
  useEffect(() => {
    if (!data || activeItemId || data.items.length === 0) return;
    const firstPending =
      data.items.find((i) => i.proof_status !== "approved") ?? data.items[0];
    setActiveItemId(firstPending.id);
    if (firstPending.proof_status === "pending") {
      void markViewed(orderId, firstPending.id);
    }
  }, [data, activeItemId, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Proof validation sonuçları (AI + kural uyarıları)
  useEffect(() => {
    if (data?.order.status !== "proof_pending") {
      setProofValidation(null);
      return;
    }
    fetch(`/api/orders/${orderId}/proof/validation`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { validation: null }))
      .then((j: { validation?: typeof proofValidation }) => {
        setProofValidation(j.validation ?? null);
      })
      .catch(() => setProofValidation(null));
  }, [data?.order.status, orderId]);

  // proof_validating — 2sn poll, proof_pending'e dönünce sayfa güncellenir
  useEffect(() => {
    if (data?.order.status !== "proof_validating") return;
    const interval = setInterval(() => {
      void fetchProofSummary(orderId)
        .then((summary) => {
          setData(summary);
        })
        .catch(() => {
          /* sessiz — bir sonraki poll dener */
        });
    }, 2000);
    return () => clearInterval(interval);
  }, [data?.order.status, orderId]);

  // proof_pending / proof_generating + eksik cutline — arka planda bıçak üretilirken poll
  const cutlinePollSignature =
    data?.items
      .map((item) => {
        if (item.proof_status === "approved") return "a";
        const expected = getItemDesignCount(item);
        const designs = item.designs ?? [];
        if (designs.length === 0) return item.cutline ? "ok" : "wait";
        if (designs.length < expected) return "wait";
        return designs.every((d) => designHasCutline(d.cutline)) ? "ok" : "wait";
      })
      .join("|") ?? "";

  useEffect(() => {
    if (
      !data ||
      (data.order.status !== "proof_pending" &&
        data.order.status !== "proof_generating")
    ) {
      return;
    }
    if (!cutlinePollSignature.includes("wait")) return;

    const interval = setInterval(() => {
      void fetchProofSummary(orderId)
        .then((summary) => setData(summary))
        .catch(() => {
          /* sessiz */
        });
    }, 5000);
    return () => clearInterval(interval);
  }, [data?.order.status, cutlinePollSignature, orderId]);

  const activeItem = data?.items.find((i) => i.id === activeItemId) ?? null;

  useEffect(() => {
    if (data?.order.status !== "proof_pending") {
      setConsistencyIssues([]);
      return;
    }
    fetch(`/api/orders/${orderId}/proof/consistency`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { consistency: { issues: [] } }))
      .then((j: { consistency?: { issues?: ConsistencyIssue[] } }) => {
        setConsistencyIssues(j.consistency?.issues ?? []);
      })
      .catch(() => setConsistencyIssues([]));
  }, [data?.order.status, orderId]);

  useEffect(() => {
    if (!activeItem || data?.order.status !== "proof_pending") {
      setBgPrompt({ show: false, bgDetect: null });
      return;
    }
    fetch(`/api/orders/${orderId}/proof/${activeItem.id}/background`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : { showPrompt: false }))
      .then(
        (j: { showPrompt?: boolean; bgDetect?: BgDetectResult | null }) => {
          setBgPrompt({
            show: !!j.showPrompt,
            bgDetect: j.bgDetect ?? null,
          });
        }
      )
      .catch(() => setBgPrompt({ show: false, bgDetect: null }));
  }, [activeItem?.id, data?.order.status, orderId]);

  useEffect(() => {
    if (
      !activeItem ||
      (previewLayer !== "design" && previewLayer !== "checkerboard")
    ) {
      setDesignUrl(null);
      return;
    }
    const dfParam = activeDesignFileId
      ? `?design_file_id=${activeDesignFileId}`
      : "";
    fetch(
      `/api/orders/${orderId}/proof/${activeItem.id}/design-url${dfParam}`,
      { cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : { url: null }))
      .then((j: { url?: string | null }) => setDesignUrl(j.url ?? null))
      .catch(() => setDesignUrl(null));
  }, [activeItem, activeDesignFileId, orderId, previewLayer]);

  useEffect(() => {
    if (!activeItem || previewLayer !== "cmyk") {
      setCmykPreview(null);
      return;
    }
    fetch(
      `/api/orders/${orderId}/proof/${activeItem.id}/cmyk-preview${
        activeDesignFileId ? `?design_file_id=${activeDesignFileId}` : ""
      }`,
      { cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (j: {
          simulatedPngUrl?: string;
          colorShift?: string;
          affectedAreas?: string;
        } | null) => {
          if (j?.simulatedPngUrl) {
            setCmykPreview({
              url: j.simulatedPngUrl,
              colorShift: j.colorShift ?? "noticeable",
              affectedAreas: j.affectedAreas ?? "",
            });
          }
        }
      )
      .catch(() => setCmykPreview(null));
  }, [activeItem?.id, activeDesignFileId, orderId, previewLayer]);

  // Multi-design (C2): activeItem değişince ilk design'ı seç
  useEffect(() => {
    if (!activeItem) {
      setActiveDesignFileId(null);
      return;
    }
    if (activeItem.designs && activeItem.designs.length > 0) {
      // Eğer activeDesignFileId bu item'a ait değilse sıfırla
      const stillValid = activeItem.designs.some(
        (d) => d.design_file_id === activeDesignFileId
      );
      if (!stillValid) {
        setActiveDesignFileId(activeItem.designs[0].design_file_id);
      }
    } else {
      setActiveDesignFileId(null);
    }
  }, [activeItem, activeDesignFileId]);

  // Seçilen design + cutline (multi-design → designs[]; legacy → item.cutline)
  const activeDesign =
    activeItem?.designs?.find((d) => d.design_file_id === activeDesignFileId) ??
    null;
  const activeCutline =
    activeDesign?.cutline ??
    (activeItem?.designs && activeItem.designs.length > 0
      ? null
      : (activeItem?.cutline ?? null));

  const activeDesignMeta = activeDesign ?? null;
  const showJpgShapeSelector =
    !!activeItem &&
    !!activeDesignMeta &&
    !activeCutline &&
    data?.order.status === "proof_pending" &&
    categorizeFile(activeDesignMeta.file_name, activeDesignMeta.mime_type) ===
      "qc_only";

  const materialKey = String(
    activeItem?.meta?.material_type ?? activeItem?.meta?.material ?? "paper"
  );

  // activeItem/activeDesign değiştiğinde preview signed URL fetch et
  useEffect(() => {
    if (!activeItem) {
      setPreviewUrl(null);
      setPreviewLoading(false);
      return;
    }
    if (!activeCutline) {
      setPreviewUrl(null);
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewUrl(null);
    setPreviewImgBroken(false);
    setPreviewLoading(true);
    (async () => {
      try {
        const dfParam = activeDesignFileId
          ? `?design_file_id=${activeDesignFileId}`
          : "";
        const res = await fetch(
          `/api/orders/${orderId}/proof/${activeItem.id}/preview-url${dfParam}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const j = (await res.json()) as { url: string | null };
        if (!cancelled) setPreviewUrl(j.url);
      } catch {
        // Sessizce geç — UI placeholder gösterir
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeItem, activeCutline, activeDesignFileId, orderId]);

  // Sol panel: cutline yoksa tasarım thumbnail (thumb=1)
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        data.items.map(async (item) => {
          if (itemCutlinePreviewUrl(item)) return;
          const dfId = item.designs?.[0]?.design_file_id;
          const qs = dfId
            ? `?design_file_id=${dfId}&thumb=1`
            : "?thumb=1";
          try {
            const res = await fetch(
              `/api/orders/${orderId}/items/${item.id}/design-url${qs}`,
              { cache: "no-store" }
            );
            if (!res.ok) return;
            const j = (await res.json()) as { url?: string };
            if (j.url) next[item.id] = j.url;
          } catch {
            /* sessiz */
          }
        })
      );
      if (!cancelled) setItemThumbs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [data, orderId]);

  useEffect(() => {
    setPreviewImgBroken(false);
  }, [previewUrl, designUrl, cmykPreview?.url, previewLayer, activeDesignFileId]);
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  // SLA countdown — proof_generating'de her saniye now'ı güncelle
  useEffect(() => {
    if (data?.order.status !== "proof_generating") return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [data?.order.status]);

  // ============================================================
  // BACKGROUND AUTO-CUTLINE (B1 fallback) — cutline'sız itemları sırayla üret
  // ============================================================
  // Server-side cutline (QC sonrası Puppeteer) çoğu siparişte bıçağı
  // zaten üretmiş olur — candidate yoksa iframe atlanır.
  // Fallback: JPG (qc_only), server hatası veya eski siparişler için hidden
  // iframe POC autoSave=1 → save-edit (auto:true) → cutline_designs INSERT.
  useEffect(() => {
    if (!data) return;
    // Zaten bir iframe aktif → bekle
    if (bgGenItemId) return;

    // Cutline'sız design_file bul (multi-design öncelik). Eski siparişlerde
    // designs[] boş olabilir; o zaman item-bağlı eski cutline'a düşeriz.
    type Candidate = {
      itemId: string;
      designFileId: string | null;
      material: string;
    };
    // Konfigüratör material → POC material mapping.
    // Sticker: vinil/transparan/holo/simli, Etiket: kraft/kuşe/...
    // POC: paper / transparent / metallic / holographic

    let candidate: Candidate | null = null;
    for (const item of data.items) {
      if (item.proof_status === "approved") continue;
      const material = mapMaterial(
        item.meta?.material_type ?? item.meta?.material
      );
      if (item.designs && item.designs.length > 0) {
        const noCutDesign = item.designs.find(
          (d) =>
            !d.cutline &&
            categorizeFile(d.file_name, d.mime_type) !== "qc_only"
        );
        if (noCutDesign) {
          candidate = {
            itemId: item.id,
            designFileId: noCutDesign.design_file_id,
            material,
          };
          break;
        }
      } else if (!item.cutline) {
        // Legacy: designs[] yok, item-bağlı
        candidate = { itemId: item.id, designFileId: null, material };
        break;
      }
    }
    if (!candidate) return;

    let cancelled = false;
    (async () => {
      try {
        const qs = candidate.designFileId
          ? `?design_file_id=${candidate.designFileId}`
          : "";
        const r = await fetch(
          `/api/orders/${orderId}/items/${candidate.itemId}/design-url${qs}`,
          { cache: "no-store" }
        );
        if (!r.ok) {
          setBgGenError("Tasarım bulunamadı");
          return;
        }
        const j = (await r.json()) as {
          url: string;
          mimeType: string;
          fileName: string;
        };
        if (cancelled) return;
        const params = new URLSearchParams({
          embed: "1",
          designUrl: j.url,
          designName: j.fileName,
          designMime: j.mimeType,
          material: candidate.material,
          mode: "contour",
          autoSave: "1",
          orderId,
          itemId: candidate.itemId,
        });
        setBgGenItemId(candidate.itemId);
        setBgGenDesignFileId(candidate.designFileId);
        setBgGenSrc(`/poc.html?${params.toString()}`);
        setBgGenError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
        setBgGenError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, bgGenItemId, orderId]);

  // Hidden POC iframe'inden gelen mesajları yakala (auto cutline akışı)
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as
        | {
            type: string;
            svg?: string;
            meta?: Record<string, unknown>;
            preview_png_base64?: string | null;
            error?: string;
          }
        | undefined;
      if (!d || !bgGenItemId) return;

      if (d.type === "pim-cutline-saved" && d.svg && d.meta) {
        try {
          const res = await fetch(
            `/api/orders/${orderId}/proof/${bgGenItemId}/save-edit`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                svg: d.svg,
                preview_png_base64: d.preview_png_base64,
                auto: true,
                design_file_id: bgGenDesignFileId, // Mig 063 — multi-design proof
                ...d.meta,
              }),
            }
          );
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            setBgGenError(err.error || `HTTP ${res.status}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
          setBgGenError(msg);
        } finally {
          // Iframe'i kapat, kuyruktan sonraki design'a geç + data refresh
          setBgGenItemId(null);
          setBgGenDesignFileId(null);
          setBgGenSrc(null);
          void load({ silent: true });
        }
      } else if (d.type === "pim-cutline-auto-failed") {
        setBgGenError(d.error || "auto_failed");
        setBgGenItemId(null);
        setBgGenDesignFileId(null);
        setBgGenSrc(null);
        void load({ silent: true });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [bgGenItemId, bgGenDesignFileId, orderId, load]);

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
    if (!itemAllDesignsReady(activeItem)) {
      toast.error("Tüm tasarımların bıçak çizgisi hazır olmalı");
      return;
    }
    if (!activeCutline && !showJpgShapeSelector) {
      toast.error("Bıçak çizgisi henüz hazır değil — lütfen birkaç dakika bekle");
      return;
    }
    setApproving(true);
    try {
      const result = await approveItem(
        orderId,
        activeItem.id,
        activeCutline?.id
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
                pending:
                  activeItem.proof_status === "pending"
                    ? Math.max(0, prev.summary.pending - 1)
                    : prev.summary.pending,
                viewed:
                  activeItem.proof_status === "viewed"
                    ? Math.max(0, prev.summary.viewed - 1)
                    : prev.summary.viewed,
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
      void load({ silent: true });
    } finally {
      setSubmittingHelp(false);
    }
  };

  const handleEdit = () => {
    if (!activeItem) return;
    if (!activeCutline) {
      toast.error("Bıçak çizgisi henüz hazır değil");
      return;
    }
    // Mig 063: multi-design — hangi tasarım düzenlenecek? query param ile geçir.
    const dfParam = activeDesignFileId
      ? `?design_file_id=${activeDesignFileId}`
      : "";
    router.push(`/onay/${orderId}/duzenle/${activeItem.id}${dfParam}`);
  };

  const handleJpgShapeSelected = async (shape: GeoShape) => {
    if (!activeItem || !activeDesignMeta || jpgSaving) return;
    setJpgSaving(true);
    try {
      const svg = buildGeoCutlineSvg(
        shape,
        activeItem.width,
        activeItem.height
      );
      const materialType = mapMaterialType(
        activeItem.meta?.material_type ?? activeItem.meta?.material
      );
      const needsWhite = needsWhiteLayer(materialKey);
      const res = await fetch(
        `/api/orders/${orderId}/proof/${activeItem.id}/save-edit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            svg,
            source: "raster",
            mode: geoShapeToSaveMode(shape),
            offset_mm: 1.5,
            width_mm: activeItem.width,
            height_mm: activeItem.height,
            design_file_id: activeDesignMeta.design_file_id,
            material_type: materialType,
            white_plan_mode: needsWhite ? "full" : "off",
            white_plan_path_count: needsWhite ? 1 : 0,
            has_custom_white_plan: false,
            tier: "standard",
            pim_feedback: "JPG için hazır geometrik bıçak seçildi.",
            pim_severity: "ok",
          }),
        }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Bıçak kaydedilemedi");
        return;
      }
      toast.success("Bıçak çizgisi oluşturuldu");
      void load({ silent: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
      toast.error(msg);
    } finally {
      setJpgSaving(false);
    }
  };

  const handleJpgUploadPng = () => {
    router.push(`/siparis/${orderId}/tasarim-yukle`);
  };

  const handleJpgRequestHelp = () => {
    setHelpOpen(true);
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
        <Card className="mx-auto max-w-lg p-8 text-center">
          <h1 className="mb-2 text-lg font-semibold text-lacivert">
            Baskı onay sayfası açılamadı
          </h1>
          <p className="mb-4 text-sm text-gri-700">
            Sipariş özeti yüklenirken bir sorun oluştu.
          </p>
          {loadError && (
            <div className="mb-4 rounded-lg border border-kirmizi/30 bg-kirmizi-soft/30 p-3 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-kirmizi">
                Hata detayı
              </p>
              <p className="mt-1 font-mono text-xs text-kirmizi-koyu">
                {loadError}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="primary"
              size="md"
              onClick={() => void load()}
            >
              Tekrar dene
            </Button>
            <Button
              variant="secondary"
              size="md"
              href={`/siparis/${orderId}`}
            >
              Sipariş detayına git
            </Button>
            <Button
              variant="ghost"
              size="md"
              href="/siparislerim"
            >
              Siparişlerime dön
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  if (data?.order.status === "proof_validating") {
    return (
      <main className="container flex min-h-[60vh] flex-col items-center justify-center py-12 text-center">
        <Pim pose="think" size={140} />
        <div className="mt-6 flex items-center justify-center gap-2">
          <span
            className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pim-mercan border-t-transparent"
            aria-hidden="true"
          />
          <h1 className="text-lg font-semibold text-lacivert">
            Düzenlemenizi kontrol ediyoruz...
          </h1>
        </div>
        <p className="mt-2 text-sm text-gri-700">Birkaç saniye.</p>
      </main>
    );
  }

  const { summary, items, order } = data;
  const progressPct =
    summary.total > 0 ? Math.round((summary.approved / summary.total) * 100) : 0;
  const itemReadyForApproval = activeItem
    ? itemAllDesignsReady(activeItem)
    : false;
  const cutlineNotReady =
    !itemReadyForApproval && !showJpgShapeSelector;
  const multiDesignCount = activeItem ? getItemDesignCount(activeItem) : 0;
  const layerPreviewUrl =
    previewLayer === "cmyk"
      ? (cmykPreview?.url ?? null)
      : previewLayer === "design" || previewLayer === "checkerboard"
        ? designUrl
        : previewUrl;
  const canShowPreviewImage =
    isHttpUrl(layerPreviewUrl) &&
    !previewImgBroken &&
    (previewLayer === "cutline"
      ? !cutlineNotReady && !!activeCutline
      : previewLayer === "checkerboard"
        ? !!designUrl
        : true);

  const renderCutlineEmptyState = () => {
    const deadlineIso = data?.order.sla_proof_deadline;
    const slaExpired = deadlineIso
      ? new Date(deadlineIso).getTime() <= Date.now()
      : false;
    const pendingDesignSlots =
      activeItem && multiDesignCount > (activeItem.designs?.length ?? 0)
        ? multiDesignCount - (activeItem.designs?.length ?? 0)
        : 0;

    return (
      <div className="text-center text-sm text-gri-700">
        <div className="mb-2 flex justify-center opacity-50">
          {slaExpired ? <Icon.Info size={48} /> : <Icon.Doc size={48} />}
        </div>
        {pendingDesignSlots > 0 ? (
          <>
            <p className="font-medium">
              {pendingDesignSlots} tasarım daha bağlanıyor
            </p>
            <p className="mt-1 text-xs">
              Tüm tasarımlar hazır olunca bıçak önizlemeleri görünecek. Birkaç
              dakika sürebilir — sayfayı kapatabilirsin.
            </p>
            <div className="mt-3 flex justify-center">
              <span
                className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pim-mercan border-t-transparent"
                aria-hidden="true"
              />
            </div>
          </>
        ) : slaExpired ? (
          <>
            <p className="font-medium">Operatörümüz bıçağı hazırlıyor</p>
            <p className="mt-1 text-xs">
              Birkaç saat içinde tamamlanacak. Hazır olunca mail atacağız —
              sayfayı kapatabilirsin.
            </p>
            <div className="mt-3">
              <Link
                href={`/siparis/${orderId}`}
                className="inline-flex items-center gap-1 rounded-md border border-gri-200 bg-white px-3 py-1.5 text-xs font-medium text-lacivert hover:border-pim-mercan/40 transition"
              >
                Sipariş detayına git
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="font-medium">Otomatik kesim çizgisi hazırlanıyor</p>
            <p className="mt-1 text-xs">
              Birkaç dakika sürebilir — sayfayı kapatabilirsin, hazır olunca mail
              atacağız.
            </p>
            <div className="mt-3 flex justify-center">
              <span
                className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pim-mercan border-t-transparent"
                aria-hidden="true"
              />
            </div>
          </>
        )}
      </div>
    );
  };

  const renderPreviewBody = () => {
    if (showJpgShapeSelector && activeItem) {
      return (
        <JpgShapeSelector
          orderId={orderId}
          itemId={activeItem.id}
          designWidth={activeItem.width}
          designHeight={activeItem.height}
          material={materialKey}
          saving={jpgSaving}
          onShapeSelected={handleJpgShapeSelected}
          onUploadPng={handleJpgUploadPng}
          onRequestHelp={handleJpgRequestHelp}
        />
      );
    }

    if (
      (previewLayer === "design" || previewLayer === "checkerboard") &&
      !designUrl
    ) {
      return (
        <div className="text-center text-sm text-gri-700">
          <p className="font-medium">
            {previewLayer === "checkerboard"
              ? "Tasarım zemin önizlemesi yükleniyor"
              : "Tasarım önizlemesi yükleniyor"}
          </p>
          <div className="mt-3 flex justify-center">
            <span
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pim-mercan border-t-transparent"
              aria-hidden="true"
            />
          </div>
        </div>
      );
    }

    if (previewLayer === "cmyk" && !cmykPreview) {
      return (
        <div className="text-center text-sm text-gri-700">
          <p className="font-medium">CMYK simülasyonu hazırlanıyor</p>
          <p className="mt-1 text-xs">Baskı renkleri hesaplanıyor…</p>
          <div className="mt-3 flex justify-center">
            <span
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pim-mercan border-t-transparent"
              aria-hidden="true"
            />
          </div>
        </div>
      );
    }

    if (canShowPreviewImage && layerPreviewUrl) {
      return (
        <button
          type="button"
          onClick={() => {
            setLightboxUrl(layerPreviewUrl);
            setLightboxOpen(true);
          }}
          className="group relative max-h-[400px] cursor-zoom-in"
          title="Büyütüp incele"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={layerPreviewUrl}
            alt={`${activeItem?.title ?? "Ürün"} ${
              previewLayer === "design"
                ? "tasarım"
                : previewLayer === "checkerboard"
                  ? "zemin"
                  : previewLayer === "cmyk"
                    ? "CMYK"
                    : "bıçak"
            } önizlemesi`}
            className="max-h-[400px] rounded-md border border-gri-200 shadow-sm transition-transform group-hover:scale-[1.02]"
            onError={() => setPreviewImgBroken(true)}
          />
          <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            🔍 Büyüt
          </span>
        </button>
      );
    }

    if (previewLoading) {
      return (
        <div className="text-center text-sm text-gri-700">
          <div className="flex justify-center">
            <span
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pim-mercan border-t-transparent"
              aria-hidden="true"
            />
          </div>
          <p className="mt-2 font-medium">Önizleme yükleniyor…</p>
        </div>
      );
    }

    if (
      (previewLayer === "cutline" || previewLayer === "checkerboard") &&
      cutlineNotReady
    ) {
      return renderCutlineEmptyState();
    }

    if (activeCutline?.preview_png_url && previewImgBroken) {
      return (
        <div className="text-center text-sm text-gri-700">
          <p className="font-medium">Önizleme şu an açılamıyor</p>
          <p className="mt-1 text-xs">Sayfayı yenilemeyi dene.</p>
        </div>
      );
    }

    if (previewLayer === "cutline" || previewLayer === "checkerboard") {
      return renderCutlineEmptyState();
    }

    return (
      <div className="text-center text-sm text-gri-700">
        <p className="font-medium">Önizleme mevcut değil</p>
      </div>
    );
  };

  return (
    <main className="container py-6 pb-28 lg:pb-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2">
        <Link
          href={`/siparis/${order.id}`}
          className="inline-flex w-fit items-center gap-1 text-xs text-gri-700 hover:text-pim-mercan transition"
        >
          <span>&larr;</span>
          <span>Sipariş detayına dön</span>
        </Link>
        <Eyebrow>SİPARİŞ #{order.id}</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-lacivert">
          Baskı önizlemelerini onayla
        </h1>
        <p className="mt-1 text-sm text-gri-700">
          {summary.total} ürün — {summary.approved} onaylandı, {summary.total - summary.approved} bekliyor
        </p>

        {/* Progress bar */}
        <div
          className="mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-gri-100"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Onay ilerlemesi: ${summary.approved}/${summary.total}`}
        >
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
            : order.status === "proof_generating" ||
                bgGenItemId ||
                cutlineNotReady
              ? "Bıçak çizgin hazırlanıyor. Birkaç dakika sürebilir — sayfayı kapatabilirsin, hazır olunca mail atacağız."
              : summary.approved === 0
                ? "İlk önizlemeye bak, kesim çizgisini incele. Memnunsan 'Onayla' de; bir şey değişsin istiyorsan 'Düzenle'."
                : `${summary.approved}/${summary.total} ürün onaylandı, az kaldı! Kalan ${summary.total - summary.approved} ürünü de gözden geçirelim.`}
        </p>
      </Card>

      {proofValidation?.finalVerdict === "warn" && (
        <Card className="mb-6 border-sari-soft/60 bg-sari-soft/30 p-4">
          <p className="text-sm font-semibold text-sari-koyu">
            Kontrol ettik, küçük uyarılar var — aşağıya bak
          </p>
        </Card>
      )}

      {!consistencyDismissed &&
        consistencyIssues.filter((i) => i.severity === "warning").length >
          0 && (
          <Card className="mb-6 border-mavi-soft/60 bg-mavi-soft/20 p-4">
            <p className="text-sm font-semibold text-lacivert">
              ℹ️ Tasarımlar arasında kalite farkı var
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gri-700">
              {consistencyIssues
                .filter((i) => i.severity === "warning")
                .map((issue) => (
                  <li key={issue.type}>{issue.message_tr}</li>
                ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConsistencyDismissed(true)}
              >
                Bu şekilde devam et
              </Button>
            </div>
          </Card>
        )}

      {(proofValidation?.cutlineIssues.length ||
        proofValidation?.whiteLayerIssues.length ||
        proofValidation?.ruleIssues.length) ? (
        <Card className="mb-6 border-sari-soft/60 bg-sari-soft/20 p-4">
          <p className="mb-2 text-sm font-semibold text-sari-koyu">
            Dikkat edilmesi gereken noktalar
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-lacivert">
            {[
              ...(proofValidation.cutlineIssues ?? []),
              ...(proofValidation.whiteLayerIssues ?? []),
              ...(proofValidation.ruleIssues ?? []),
            ].map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {proofValidation?.pimMessage && (
        <Card className="mb-6 flex items-start gap-3 bg-pim-mercan-tint/30 p-4">
          <PimMini pose="inspect" size={48} />
          <p className="text-sm leading-relaxed text-lacivert">
            {proofValidation.pimMessage}
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* SOL — İtem listesi */}
        <aside className="space-y-2">
          {items.map((item) => {
            const badge = STATUS_BADGE[item.proof_status];
            const isActive = item.id === activeItemId;
            const thumbUrlRaw =
              itemCutlinePreviewUrl(item) ?? itemThumbs[item.id] ?? null;
            const thumbUrl =
              thumbUrlRaw && isHttpUrl(thumbUrlRaw) ? thumbUrlRaw : null;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => handleSelectItem(item.id)}
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition",
                  isActive
                    ? "border-pim-mercan bg-pim-mercan-tint/30 shadow-mercan"
                    : "border-gri-200 bg-white hover:border-pim-mercan/40"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gri-100 text-gri-700">
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbUrl}
                        alt={item.title}
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (
                            e.target as HTMLImageElement
                          ).nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div className={thumbUrl ? "hidden" : ""}>
                      {item.product === "sticker" ? (
                        <Icon.Sticker size={32} />
                      ) : (
                        <Icon.Tag size={32} />
                      )}
                    </div>
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
                        {activeItem.height}mm
                        {activeItem.config &&
                          (() => {
                            const clean = cleanItemConfig(activeItem.config);
                            return clean ? ` · ${clean}` : "";
                          })()}
                      </div>

                      {/* POC v2 — tier + malzeme + white plan rozeti */}
                      {activeCutline && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {/* Tier rozeti */}
                          {activeCutline.tier && (
                            <div
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                                TIER_BADGE[activeCutline.tier].bg,
                                TIER_BADGE[activeCutline.tier].color
                              )}
                              title={TIER_BADGE[activeCutline.tier].desc}
                            >
                              <span>
                                {TIER_BADGE[activeCutline.tier].emoji}
                              </span>
                              <span>
                                {TIER_BADGE[activeCutline.tier].label}
                              </span>
                            </div>
                          )}

                          {/* Malzeme rozeti */}
                          {activeCutline.material_type &&
                            activeCutline.material_type !== "paper" && (
                              <div className="inline-flex items-center gap-1 rounded-full bg-gri-100 px-2 py-0.5 text-xs font-medium text-gri-700">
                                <span>📦</span>
                                <span>
                                  {
                                    MATERIAL_LABEL[
                                      activeCutline.material_type
                                    ]
                                  }
                                </span>
                              </div>
                            )}

                          {/* White plan göstergesi (sadece varsa) */}
                          {activeCutline.white_plan_mode &&
                            activeCutline.white_plan_mode !== "off" && (
                              <div
                                className="inline-flex items-center gap-1 rounded-full bg-gri-100 px-2 py-0.5 text-xs font-medium text-gri-700"
                                title="Şeffaf/metalize altına basılan beyaz mürekkep katmanı"
                              >
                                <span>⚪</span>
                                <span>
                                  Beyaz plan:{" "}
                                  {
                                    WHITE_MODE_LABEL[
                                      activeCutline.white_plan_mode
                                    ]
                                  }
                                </span>
                              </div>
                            )}

                          {/* Gömülü cutline tespit edildiyse */}
                          {activeCutline.detected_cut_contour_names &&
                            activeCutline.detected_cut_contour_names.length >
                              0 && (
                              <div className="inline-flex items-center gap-1 rounded-full bg-yesil-soft/60 px-2 py-0.5 text-xs font-medium text-yesil-koyu">
                                <span>🎯</span>
                                <span>
                                  Gömülü bıçak:{" "}
                                  {activeCutline.detected_cut_contour_names
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

                {/* Multi-design picker (C2) — meta.designCount veya designs[] > 1 */}
                {multiDesignCount > 1 && (
                  <div className="border-b border-gri-200 bg-gri-100/50 px-4 py-2">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gri-700">
                      Bu üründe {multiDesignCount} tasarım var
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: multiDesignCount }, (_, idx) => {
                        const d = activeItem.designs[idx];
                        if (d) {
                          const isSel = d.design_file_id === activeDesignFileId;
                          const ready = designHasCutline(d.cutline);
                          return (
                            <button
                              key={d.design_file_id}
                              type="button"
                              onClick={() =>
                                setActiveDesignFileId(d.design_file_id)
                              }
                              className={cn(
                                "rounded-md border px-2.5 py-1 text-xs transition",
                                isSel
                                  ? "border-pim-mercan bg-pim-mercan text-white"
                                  : "border-gri-200 bg-white text-lacivert hover:border-pim-mercan/40"
                              )}
                              title={d.file_name}
                            >
                              <span className="font-semibold">
                                Tasarım {idx + 1}
                              </span>
                              <span className="ml-1 opacity-75">
                                {ready ? "✓" : "⏳"}
                              </span>
                            </button>
                          );
                        }
                        return (
                          <span
                            key={`pending-design-${idx}`}
                            className="rounded-md border border-dashed border-gri-300 bg-white px-2.5 py-1 text-xs text-gri-500"
                            title="Tasarım henüz bağlanmadı"
                          >
                            <span className="font-semibold">
                              Tasarım {idx + 1}
                            </span>
                            <span className="ml-1">⏳</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {bgPrompt.show && bgPrompt.bgDetect && activeItem && (
                  <div className="border-b border-gri-200 p-4">
                    <BgRemovalPrompt
                      orderId={orderId}
                      itemId={activeItem.id}
                      designFileId={activeDesignFileId}
                      bgDetect={bgPrompt.bgDetect}
                      previewUrl={designUrl ?? previewUrl}
                      onDismiss={() =>
                        setBgPrompt({ show: false, bgDetect: null })
                      }
                      onRemoved={() => {
                        setBgPrompt({ show: false, bgDetect: null });
                        void load({ silent: true });
                      }}
                    />
                  </div>
                )}

                <div className="border-b border-gri-200 px-4 py-2">
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="tablist"
                    aria-label="Önizleme katmanları"
                  >
                    {(
                      [
                        ["cutline", "✂️ Bıçak"],
                        ["design", "🎨 Tasarım"],
                        ["checkerboard", "🏁 Zemin"],
                        ["cmyk", "🖨️ CMYK Önizleme"],
                      ] as const
                    ).map(([layer, label]) => (
                      <button
                        key={layer}
                        type="button"
                        role="tab"
                        aria-selected={previewLayer === layer}
                        onClick={() => setPreviewLayer(layer)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                          previewLayer === layer
                            ? "border-lacivert bg-lacivert text-white"
                            : "border-gri-200 bg-white text-lacivert hover:border-lacivert/40"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {previewLayer === "cmyk" && cmykPreview && (
                    <p className="mt-2 text-xs text-gri-700">
                      Baskıda renkler yaklaşık bu şekilde görünecek.
                      {cmykPreview.colorShift === "significant" && (
                        <span className="mt-1 block font-medium text-sari-koyu">
                          Tasarımındaki canlı renkler baskıda soluk görünebilir.
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Canlı önizleme — cutline_design preview PNG (R2 signed URL) */}
                <div
                  className="relative grid min-h-[320px] place-items-center bg-gri-100 p-6"
                  role="tabpanel"
                  aria-label={
                    previewLayer === "design"
                      ? "Tasarım önizlemesi"
                      : previewLayer === "cmyk"
                        ? "CMYK önizlemesi"
                        : previewLayer === "checkerboard"
                          ? "Zemin önizlemesi"
                          : "Bıçak önizlemesi"
                  }
                  style={
                    showJpgShapeSelector
                      ? undefined
                      : previewLayer === "checkerboard" ||
                          needsWhiteLayer(materialKey)
                        ? {
                            backgroundImage:
                              "linear-gradient(45deg, #f3efe6 25%, transparent 25%), linear-gradient(-45deg, #f3efe6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3efe6 75%), linear-gradient(-45deg, transparent 75%, #f3efe6 75%)",
                            backgroundSize: "20px 20px",
                            backgroundPosition:
                              "0 0, 0 10px, 10px -10px, -10px 0px",
                          }
                        : undefined
                  }
                >
                  {renderPreviewBody()}
                </div>

                {/* Pim yorumu (cutline_designs.pim_feedback) */}
                {activeCutline?.pim_feedback && (
                  <div className="flex items-start gap-3 border-t border-gri-200 bg-krem p-4">
                    <PimMini
                      pose={
                        activeCutline.pim_severity === "err" ||
                        activeCutline.pim_severity === "warn"
                          ? "inspect"
                          : "happy"
                      }
                      size={36}
                    />
                    <p className="text-sm leading-relaxed text-lacivert">
                      {activeCutline.pim_feedback}
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

                {/* Sefa 22 May v68 Faz 4b — Resolved/dismissed history.
                    Müşteri operatörün cevabını burada görür ve karar verir.
                    Sadece resolution_note dolu olanları göster (anlamlı). */}
                {(helpHistory[activeItem.id] ?? [])
                  .filter((t) => t.status === "resolved" && t.resolutionNote)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="border-t border-yesil/30 bg-yesil-soft/40 p-4"
                    >
                      <div className="flex items-center gap-2">
                        <Eyebrow>OPERATÖRÜMÜZÜN CEVABI</Eyebrow>
                        <span className="inline-flex items-center gap-1 rounded-full bg-yesil px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          ✓ Çözüldü
                        </span>
                      </div>
                      <p
                        className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-lacivert"
                      >
                        {t.resolutionNote}
                      </p>
                      <details className="mt-3 text-xs text-gri-700">
                        <summary className="cursor-pointer font-medium hover:text-lacivert">
                          Başta yazdığın soru
                        </summary>
                        <p className="mt-1 whitespace-pre-wrap italic">
                          “{t.message}”
                        </p>
                      </details>
                      <p className="mt-2 text-[11px] text-gri-700">
                        {t.resolvedAt &&
                          new Date(t.resolvedAt).toLocaleString("tr-TR", {
                            day: "numeric",
                            month: "long",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                        · Şimdi karar verebilirsin: onayla, düzenle, ya da
                        yeniden yardım iste.
                      </p>
                    </div>
                  ))}
              </Card>

              {/* Action bar */}
              <div className="sticky bottom-4 z-30 flex flex-col gap-2 rounded-xl border border-gri-200 bg-white p-4 shadow-md sm:flex-row sm:items-center sm:justify-between">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setHelpOpen(true)}
                  disabled={activeItem.proof_status === "help_requested"}
                >
                  Ekibimizden yardım iste
                </Button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleEdit}
                    disabled={!activeCutline}
                  >
                    Bıçağı düzenle
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => void handleApprove()}
                    disabled={
                      approving ||
                      activeItem.proof_status === "approved" ||
                      activeItem.proof_status === "help_requested" ||
                      !itemReadyForApproval
                    }
                  >
                    {approving
                      ? "Onaylanıyor…"
                      : activeItem.proof_status === "approved"
                        ? "Onaylandı ✓"
                        : !itemReadyForApproval
                          ? "Bıçak hazırlanıyor…"
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

      {/* B1 · Hidden auto-cutline iframe — Mig 062. POC headless mode'da
          tasarımı fetch edip otomatik bıçak üretir + save-edit'e POST eder.
          Görünmez ama sandbox attribute ile güvenli. */}
      {bgGenSrc && (
        <iframe
          src={bgGenSrc}
          title="Otomatik bıçak üretimi"
          className="pointer-events-none fixed left-[-9999px] top-0 h-[1px] w-[1px]"
          sandbox="allow-scripts allow-same-origin"
          aria-hidden="true"
        />
      )}

      {/* "Bıçak hazırlanıyor" banner — proof_generating veya queue aktifken.
          SLA: orders.sla_proof_deadline (Mig 062, 5dk). Süre dolduğunda
          fason operatöre düşer, müşteriye "operatör inceliyor" mesajı. */}
      {(data?.order.status === "proof_generating" || bgGenItemId) && (() => {
        const deadlineIso = data?.order.sla_proof_deadline;
        const deadlineMs = deadlineIso ? new Date(deadlineIso).getTime() : null;
        const remainingMs = deadlineMs ? deadlineMs - nowMs : null;
        const remainingSec =
          remainingMs !== null ? Math.max(0, Math.floor(remainingMs / 1000)) : null;
        const mm = remainingSec !== null ? Math.floor(remainingSec / 60) : null;
        const ss = remainingSec !== null ? remainingSec % 60 : null;
        const slaExpired = remainingSec !== null && remainingSec === 0;
        return (
          <div className="fixed bottom-20 right-4 z-40 max-w-sm rounded-lg border border-pim-mercan/40 bg-white p-3 shadow-lg">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 h-2 w-2 animate-pulse rounded-full bg-pim-mercan" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-lacivert">
                  {slaExpired
                    ? "Operatöre düştü"
                    : "Bıçak hazırlanıyor…"}
                </p>
                {!slaExpired && mm !== null && ss !== null && (
                  <p className="mt-0.5 font-mono text-xs text-pim-mercan">
                    {`Kalan süre: ${mm}:${ss.toString().padStart(2, "0")}`}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-gri-700">
                  {slaExpired
                    ? "5 dakikalık otomatik üretim süresi doldu — operatörümüz devraldı. Birkaç saat içinde tamamlanacak."
                    : "Otomasyon bıçağını çıkarıyor. Sayfayı kapatabilirsin, hazır olunca mail atacağız."}
                </p>
                {bgGenError && (
                  <p className="mt-1 text-xs text-kirmizi">
                    Hata: {bgGenError} — manuel düzenleyebilirsin
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lightbox modal — aktif katman önizlemesi */}
      {lightboxOpen &&
        isHttpUrl(lightboxUrl) &&
        activeItem &&
        !previewImgBroken && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6"
          onClick={() => {
            setLightboxOpen(false);
            setLightboxUrl(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`${activeItem.title} önizleme`}
        >
          <div
            className="relative max-w-2xl max-h-[75vh] rounded-xl overflow-hidden shadow-2xl"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            style={{
              backgroundImage:
                "linear-gradient(45deg, #e8e8e8 25%, transparent 25%), linear-gradient(-45deg, #e8e8e8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e8e8e8 75%), linear-gradient(-45deg, transparent 75%, #e8e8e8 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
              backgroundColor: "#f5f5f5",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt={`${activeItem.title} ${
                previewLayer === "design"
                  ? "tasarım"
                  : previewLayer === "cmyk"
                    ? "CMYK"
                    : "bıçak"
              } önizlemesi`}
              className="w-full h-full max-h-[75vh] object-contain"
            />
            <button
              type="button"
              onClick={() => {
                setLightboxOpen(false);
                setLightboxUrl(null);
              }}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 text-sm"
              aria-label="Kapat"
            >
              ✕
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-1.5 text-xs text-white text-center">
              {activeItem.title} · {activeItem.width}×{activeItem.height} mm
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
