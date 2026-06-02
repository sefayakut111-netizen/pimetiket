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
import { mapApiError } from "@/lib/api-error-messages";
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
  cutlineIsApproved,
  designHasCutline,
  getExpectedDesignCount,
  itemAllDesignsApproved,
  itemAllDesignsReady,
  orderAllDesignsApproved,
} from "@/lib/order-item-meta";
import { buildPocIframeSrc } from "@/lib/proof/build-poc-iframe-src";
import { track } from "@/lib/analytics/posthog-events";

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
  cutline_source:
    | "file_embedded"
    | "auto_generated"
    | "prior"
    | "geo_shape"
    | "operator"
    | null;
  detection_method: string | null;
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

/** Same-origin API proxy veya http(s) URL — img src için güvenli. */
function isPreviewSrc(url: string | null | undefined): url is string {
  if (!url) return false;
  const t = url.trim();
  if (t.startsWith("/api/")) return true;
  return isHttpUrl(t);
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

function itemHasCutlinePreview(item: ProofItem): boolean {
  if (designHasCutline(item.cutline)) return true;
  return (item.designs ?? []).some((d) => designHasCutline(d.cutline));
}

/** Sidebar + liste için same-origin bıçak önizlemesi (admin müşteri görünümü dahil). */
function itemCutlinePreviewSrc(
  orderId: string,
  item: ProofItem,
  designFileId?: string | null
): string | null {
  if (designFileId) {
    const design = item.designs?.find(
      (d) => d.design_file_id === designFileId
    );
    if (design && designHasCutline(design.cutline)) {
      return buildPreviewPngPath(
        orderId,
        item.id,
        designFileId,
        design.cutline!.id
      );
    }
    return null;
  }

  if (designHasCutline(item.cutline)) {
    return buildPreviewPngPath(
      orderId,
      item.id,
      item.designs?.[0]?.design_file_id,
      item.cutline!.id
    );
  }
  const firstWithCutline = item.designs?.find((d) =>
    designHasCutline(d.cutline)
  );
  if (firstWithCutline) {
    return buildPreviewPngPath(
      orderId,
      item.id,
      firstWithCutline.design_file_id,
      firstWithCutline.cutline!.id
    );
  }
  return null;
}

/** Henüz promote edilmemiş slot için meta'daki geçici önizleme URL'si. */
function slotMetaPreviewUrl(
  item: ProofItem,
  slotIdx: number
): string | null {
  if (slotIdx === 0) {
    const url = item.meta?.designPreviewUrl;
    return typeof url === "string" && isHttpUrl(url) ? url : null;
  }
  const additional = item.meta?.additionalDesigns;
  if (!Array.isArray(additional)) return null;
  const entry = additional[slotIdx - 1];
  if (
    entry &&
    typeof entry === "object" &&
    "previewUrl" in entry &&
    typeof (entry as { previewUrl?: string }).previewUrl === "string"
  ) {
    const url = (entry as { previewUrl: string }).previewUrl;
    return isHttpUrl(url) ? url : null;
  }
  return null;
}

/** Henüz promote edilmemiş slot için meta'daki dosya adı. */
function slotMetaFileName(item: ProofItem, slotIdx: number): string | null {
  if (slotIdx === 0) {
    const name = item.meta?.designFileName;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  }
  const additional = item.meta?.additionalDesigns;
  if (!Array.isArray(additional)) return null;
  const entry = additional[slotIdx - 1];
  if (
    entry &&
    typeof entry === "object" &&
    "fileName" in entry &&
    typeof (entry as { fileName?: string }).fileName === "string"
  ) {
    const name = (entry as { fileName: string }).fileName.trim();
    return name || null;
  }
  return null;
}

function normalizeConfigText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[+·\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Boyut satırı — title'da zaten geçen config tekrarını gösterme. */
function formatItemSubtitle(item: ProofItem): string {
  const dims = `${item.qty} ad · ${item.width}×${item.height}mm`;
  const clean = cleanItemConfig(item.config);
  if (!clean) return dims;
  const titleNorm = normalizeConfigText(item.title);
  const configNorm = normalizeConfigText(clean);
  if (titleNorm.includes(configNorm)) return dims;
  const configWords = configNorm.split(" ").filter((w) => w.length > 2);
  if (
    configWords.length > 0 &&
    configWords.every((w) => titleNorm.includes(w))
  ) {
    return dims;
  }
  return `${dims} · ${clean}`;
}

function buildPreviewPngQuery(
  designFileId: string | null | undefined,
  cutlineId: string | null | undefined
): string {
  const params = new URLSearchParams();
  if (designFileId) params.set("design_file_id", designFileId);
  if (cutlineId) params.set("v", cutlineId.slice(0, 8));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function buildPreviewPngPath(
  orderId: string,
  itemId: string,
  designFileId?: string | null,
  cutlineId?: string | null
): string {
  return `/api/orders/${orderId}/proof/${itemId}/preview-png${buildPreviewPngQuery(
    designFileId,
    cutlineId
  )}`;
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

const DESIGN_WAITING_BADGE = {
  label: "Bıçak sırada",
  bg: "bg-gri-100",
  color: "text-gri-700",
  emoji: "⏳",
} as const;

const DESIGN_GENERATING_BADGE = {
  label: "Bıçak üretiliyor",
  bg: "bg-mavi-soft",
  color: "text-mavi-koyu",
  emoji: "⚙️",
} as const;

const DESIGN_SLOT_PENDING_BADGE = {
  label: "Tasarım bekleniyor",
  bg: "bg-gri-100",
  color: "text-gri-700",
  emoji: "📄",
} as const;

function getDesignStatusBadge(
  design: ProofDesign | null,
  item: ProofItem,
  opts?: { isGenerating?: boolean }
): (typeof STATUS_BADGE)[ProofItem["proof_status"]] {
  if (design && cutlineIsApproved(design.cutline)) {
    return STATUS_BADGE.approved;
  }
  if (item.proof_status === "help_requested") {
    return STATUS_BADGE.help_requested;
  }
  if (!design) {
    return DESIGN_SLOT_PENDING_BADGE;
  }
  if (!designHasCutline(design.cutline)) {
    return opts?.isGenerating ? DESIGN_GENERATING_BADGE : DESIGN_WAITING_BADGE;
  }
  if (item.proof_status === "viewed" || item.proof_status === "edited") {
    return STATUS_BADGE.viewed;
  }
  return STATUS_BADGE.pending;
}

function countOrderDesignProgress(items: ProofItem[]): {
  total: number;
  approved: number;
} {
  let total = 0;
  let approved = 0;
  for (const item of items) {
    const expected = getItemDesignCount(item);
    total += expected;
    if ((item.designs?.length ?? 0) > 0) {
      for (const d of item.designs) {
        if (cutlineIsApproved(d.cutline)) approved++;
      }
    } else if (itemAllDesignsApproved(item)) {
      approved += expected;
    }
  }
  return { total, approved };
}

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

  // Deploy sonrası açık sekmede eski JS bundle kalmasın (SPA soft-nav).
  useEffect(() => {
    const build = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
    if (!build) return;
    const storageKey = "pim-onay-bundle";
    const seen = sessionStorage.getItem(storageKey);
    sessionStorage.setItem(storageKey, build);
    if (seen && seen !== build) {
      window.location.reload();
    }
  }, []);

  const [data, setData] = useState<ProofSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpMsg, setHelpMsg] = useState("");
  const [submittingHelp, setSubmittingHelp] = useState(false);
  const [previewImgBroken, setPreviewImgBroken] = useState(false);
  const [itemThumbs, setItemThumbs] = useState<Record<string, string>>({});
  const [designThumbs, setDesignThumbs] = useState<Record<string, string>>({});
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
      const msg = err instanceof Error ? err.message : "unknown";
      if (!silent) {
        setLoadError(mapApiError(msg.split(" (")[0], "tr", msg));
        setData(null);
      }
      toast.error(`Sipariş yüklenemedi: ${mapApiError(msg.split(" (")[0], "tr", msg)}`);
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

  // Multi-design (C2): activeItem değişince geçerli design seç (slot tıklamasını ezme)
  useEffect(() => {
    if (!activeItem) {
      setActiveDesignFileId(null);
      return;
    }
    const designs = activeItem.designs ?? [];
    if (designs.length > 0) {
      setActiveDesignFileId((prev) => {
        if (prev && designs.some((d) => d.design_file_id === prev)) {
          return prev;
        }
        return designs[0].design_file_id;
      });
    } else {
      setActiveDesignFileId(null);
    }
  }, [activeItem?.id]);

  // Seçilen design + cutline (multi-design → designs[]; legacy → item.cutline)
  const activeDesign =
    activeItem?.designs?.find((d) => d.design_file_id === activeDesignFileId) ??
    (!activeDesignFileId ? (activeItem?.designs?.[0] ?? null) : null);
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

  const cutlinePreviewSrc =
    activeItem && activeCutline
      ? buildPreviewPngPath(
          orderId,
          activeItem.id,
          activeDesignFileId,
          activeCutline.id
        )
      : null;

  useEffect(() => {
    setPreviewImgBroken(false);
  }, [cutlinePreviewSrc, designUrl, cmykPreview?.url, previewLayer, activeDesignFileId]);
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    (async () => {
      const nextItems: Record<string, string> = {};
      const nextDesigns: Record<string, string> = {};
      await Promise.all(
        data.items.flatMap((item) => {
          const tasks: Promise<void>[] = [];
          const designCount = getItemDesignCount(item);
          if (designCount > 1) {
            for (const d of item.designs ?? []) {
              const key = `${item.id}:${d.design_file_id}`;
              if (itemCutlinePreviewSrc(orderId, item, d.design_file_id)) {
                continue;
              }
              tasks.push(
                fetch(
                  `/api/orders/${orderId}/items/${item.id}/design-url?design_file_id=${d.design_file_id}&thumb=1`,
                  { cache: "no-store" }
                )
                  .then((res) => (res.ok ? res.json() : null))
                  .then((j: { url?: string } | null) => {
                    if (j?.url) nextDesigns[key] = j.url;
                  })
                  .catch(() => {
                    /* sessiz */
                  })
              );
            }
          } else if (
            !itemHasCutlinePreview(item) &&
            !itemCutlinePreviewUrl(item)
          ) {
            const dfId = item.designs?.[0]?.design_file_id;
            const qs = dfId
              ? `?design_file_id=${dfId}&thumb=1`
              : "?thumb=1";
            tasks.push(
              fetch(
                `/api/orders/${orderId}/items/${item.id}/design-url${qs}`,
                { cache: "no-store" }
              )
                .then((res) => (res.ok ? res.json() : null))
                .then((j: { url?: string } | null) => {
                  if (j?.url) nextItems[item.id] = j.url;
                })
                .catch(() => {
                  /* sessiz */
                })
            );
          }
          return tasks;
        })
      );
      if (!cancelled) {
        if (Object.keys(nextItems).length > 0) {
          setItemThumbs((prev) => ({ ...prev, ...nextItems }));
        }
        if (Object.keys(nextDesigns).length > 0) {
          setDesignThumbs((prev) => ({ ...prev, ...nextDesigns }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, orderId]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  // SLA countdown — proof_generating veya arka plan bıçak üretiminde
  useEffect(() => {
    if (
      data?.order.status !== "proof_generating" &&
      !bgGenItemId
    ) {
      return;
    }
    if (!data?.order.sla_proof_deadline) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [data?.order.status, data?.order.sla_proof_deadline, bgGenItemId]);

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
      orderWidthMm: number;
      orderHeightMm: number;
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
            !designHasCutline(d.cutline) &&
            categorizeFile(d.file_name, d.mime_type) !== "qc_only"
        );
        if (noCutDesign) {
          candidate = {
            itemId: item.id,
            designFileId: noCutDesign.design_file_id,
            material,
            orderWidthMm: item.width,
            orderHeightMm: item.height,
          };
          break;
        }
      } else if (!item.cutline) {
        // Legacy: designs[] yok, item-bağlı
        candidate = {
          itemId: item.id,
          designFileId: null,
          material,
          orderWidthMm: item.width,
          orderHeightMm: item.height,
        };
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
        setBgGenItemId(candidate.itemId);
        setBgGenDesignFileId(candidate.designFileId);
        setBgGenSrc(
          buildPocIframeSrc({
            orderId,
            itemId: candidate.itemId,
            fileName: j.fileName,
            mimeType: j.mimeType,
            material: candidate.material,
            designFileId: candidate.designFileId,
            autoSave: true,
            editorMode: true,
            orderWidthMm: candidate.orderWidthMm,
            orderHeightMm: candidate.orderHeightMm,
            origin: window.location.origin,
          })
        );
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
    if (item?.designs?.[0]) {
      setActiveDesignFileId(item.designs[0].design_file_id);
    }
    if (item && item.proof_status === "pending") {
      void markViewed(orderId, itemId);
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

  const handleSelectDesign = (
    itemId: string,
    designFileId: string | null
  ) => {
    setActiveItemId(itemId);
    setActiveDesignFileId(designFileId);
    const item = data?.items.find((i) => i.id === itemId);
    if (item && item.proof_status === "pending") {
      void markViewed(orderId, itemId);
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
    if (!activeCutline && !showJpgShapeSelector) {
      toast.error("Bıçak çizgisi henüz hazır değil — lütfen birkaç dakika bekle");
      return;
    }
    if (activeCutline && cutlineIsApproved(activeCutline)) {
      toast.error("Bu tasarım zaten onaylandı");
      return;
    }
    const multiDesign = getItemDesignCount(activeItem) > 1;
    if (!multiDesign && !itemAllDesignsReady(activeItem)) {
      toast.error("Tüm tasarımların bıçak çizgisi hazır olmalı");
      return;
    }
    if (multiDesign && !designHasCutline(activeCutline)) {
      toast.error("Bu tasarımın bıçak çizgisi henüz hazır değil");
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

      track("proof_approved", {
        orderId,
        itemCount: data?.summary.total ?? 0,
      });

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((i) => {
            if (i.id !== activeItem.id) return i;
            const updatedDesigns = (i.designs ?? []).map((d) => {
              if (
                d.design_file_id !== activeDesignFileId ||
                !d.cutline ||
                !activeCutline
              ) {
                return d;
              }
              return {
                ...d,
                cutline: { ...d.cutline, status: "approved" as const },
              };
            });
            const patched = { ...i, designs: updatedDesigns };
            const fullyApproved = itemAllDesignsApproved(patched);
            return {
              ...patched,
              proof_status: fullyApproved
                ? ("approved" as const)
                : i.proof_status === "pending"
                  ? ("viewed" as const)
                  : i.proof_status,
              proof_approved_at: fullyApproved
                ? new Date().toISOString()
                : i.proof_approved_at,
            };
          }),
          summary: {
            ...prev.summary,
            approved: prev.items.filter((it) => {
              if (it.id !== activeItem.id) {
                return itemAllDesignsApproved(it);
              }
              const updatedDesigns = (it.designs ?? []).map((d) => {
                if (
                  d.design_file_id !== activeDesignFileId ||
                  !d.cutline ||
                  !activeCutline
                ) {
                  return d;
                }
                return {
                  ...d,
                  cutline: { ...d.cutline, status: "approved" as const },
                };
              });
              return itemAllDesignsApproved({
                ...it,
                designs: updatedDesigns,
              });
            }).length,
          },
        };
      });

      toast.success(
        multiDesign
          ? `Tasarım ${(activeItem.designs?.findIndex(
              (d) => d.design_file_id === activeDesignFileId
            ) ?? 0) + 1} onaylandı`
          : `${activeItem.title} onaylandı`
      );

      // Sıradaki onaysız tasarıma geç
      const nextDesign = (() => {
        for (const item of data?.items ?? []) {
          const count = getItemDesignCount(item);
          for (let idx = 0; idx < count; idx++) {
            const d = item.designs[idx];
            if (!d || cutlineIsApproved(d.cutline)) continue;
            if (!designHasCutline(d.cutline)) continue;
            return {
              itemId: item.id,
              designFileId: d.design_file_id,
            };
          }
        }
        return null;
      })();
      if (nextDesign) {
        handleSelectDesign(nextDesign.itemId, nextDesign.designFileId);
      }
    } finally {
      setApproving(false);
    }
  };

  const handleFinalizeAll = async () => {
    if (!data || !orderAllDesignsApproved(data.items)) return;
    setFinalizing(true);
    try {
      const fin = await finalizeProof(orderId);
      if (fin.ok) {
        router.push(`/onay/${orderId}/tamamlandi`);
        return;
      }
      toast.error(mapApiError(fin.error, "tr", "Sonlandırma başarısız"));
    } finally {
      setFinalizing(false);
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
      track("proof_rejected", {
        orderId,
        reason: "help_requested",
      });
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
    track("proof_rejected", {
      orderId,
      reason: "edit_requested",
    });
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
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-8">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <Skeleton className="mb-4 h-8 w-64" />
          <Skeleton className="mb-2 h-4 w-96" />
          <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
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
                {mapApiError(loadError.split(" (")[0], "tr", loadError)}
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
        </div>
      </main>
    );
  }

  if (data?.order.status === "proof_validating") {
    return (
      <main className="bg-gri-50 flex min-h-[calc(100vh-64px)] flex-col items-center justify-center py-12 text-center">
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
  const designProgress = countOrderDesignProgress(items);
  const progressPct =
    designProgress.total > 0
      ? Math.round((designProgress.approved / designProgress.total) * 100)
      : summary.total > 0
        ? Math.round((summary.approved / summary.total) * 100)
        : 0;
  const allDesignsApproved = orderAllDesignsApproved(items);
  const activeDesignApproved = activeCutline
    ? cutlineIsApproved(activeCutline)
    : false;
  const itemReadyForApproval = activeItem
    ? designHasCutline(activeCutline) || showJpgShapeSelector
    : false;
  const cutlineNotReady =
    !itemReadyForApproval && !showJpgShapeSelector;
  const multiDesignCount = activeItem ? getItemDesignCount(activeItem) : 0;
  const activeDesignGenerating =
    bgGenDesignFileId !== null &&
    activeDesign?.design_file_id === bgGenDesignFileId;
  const activeDesignBadge =
    activeDesign && activeItem
      ? getDesignStatusBadge(activeDesign, activeItem, {
          isGenerating: activeDesignGenerating,
        })
      : null;
  const previewFrameStyle: React.CSSProperties | undefined =
    activeItem && activeItem.width > 0 && activeItem.height > 0
      ? {
          aspectRatio: `${activeItem.width} / ${activeItem.height}`,
          maxHeight: "min(520px, 65vh)",
          width: "100%",
        }
      : { maxHeight: "min(520px, 65vh)", width: "100%" };
  const layerPreviewUrl =
    previewLayer === "cmyk"
      ? (cmykPreview?.url ?? null)
      : previewLayer === "design" || previewLayer === "checkerboard"
        ? designUrl
        : cutlinePreviewSrc;
  const canShowPreviewImage =
    isPreviewSrc(layerPreviewUrl) &&
    !previewImgBroken &&
    (previewLayer === "cutline"
      ? !!activeCutline
      : previewLayer === "checkerboard"
        ? !!designUrl
        : true);

  const renderCutlineEmptyState = () => {
    const deadlineIso = data?.order.sla_proof_deadline;
    const slaExpired = deadlineIso
      ? new Date(deadlineIso).getTime() <= Date.now()
      : false;
    const activeSlotIdx =
      activeItem && multiDesignCount > 1
        ? activeDesignFileId
          ? Math.max(
              0,
              activeItem.designs?.findIndex(
                (d) => d.design_file_id === activeDesignFileId
              ) ?? 0
            )
          : 0
        : 0;
    const metaPreview =
      activeItem && isPreviewSrc(slotMetaPreviewUrl(activeItem, activeSlotIdx))
        ? slotMetaPreviewUrl(activeItem, activeSlotIdx)
        : null;
    const slotFileName =
      activeDesign?.file_name ??
      (activeItem ? slotMetaFileName(activeItem, activeSlotIdx) : null);
    const designFilePending = !activeDesign && multiDesignCount > 1;
    const cutlinePending =
      !!activeDesign && !designHasCutline(activeDesign.cutline);

    if (metaPreview && (designFilePending || cutlinePending)) {
      return (
        <div className="flex flex-col items-center justify-center text-center text-sm text-gri-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={metaPreview}
            alt={slotFileName ?? `Tasarım ${activeSlotIdx + 1}`}
            className="mb-3 max-h-[min(420px,55vh)] max-w-full rounded-md border border-gri-200 object-contain shadow-sm"
          />
          <p className="font-medium">
            {designFilePending
              ? "Tasarım dosyası bağlanıyor"
              : "Bıçak hazırlanıyor"}
          </p>
          {slotFileName && (
            <p className="mt-0.5 text-xs text-gri-500">{slotFileName}</p>
          )}
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
        </div>
      );
    }

    const pendingDesignSlots =
      activeItem && multiDesignCount > (activeItem.designs?.length ?? 0)
        ? multiDesignCount - (activeItem.designs?.length ?? 0)
        : 0;

    return (
      <div className="text-center text-sm text-gri-700">
        <div className="mb-2 flex justify-center opacity-50">
          {slaExpired ? <Icon.Info size={48} /> : <Icon.Doc size={48} />}
        </div>
        {pendingDesignSlots > 0 && designFilePending ? (
          <>
            <p className="font-medium">
              {pendingDesignSlots} tasarım daha bağlanıyor
            </p>
            <p className="mt-1 text-xs">
              Dosyalar sırayla sisteme ekleniyor. Birkaç dakika sürebilir —
              sayfayı kapatabilirsin.
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
          className="group relative h-full w-full cursor-zoom-in"
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
            className="h-full w-full object-contain rounded-md border border-gri-200 shadow-sm transition-transform group-hover:scale-[1.01]"
            onError={() => setPreviewImgBroken(true)}
          />
          <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            🔍 Büyüt
          </span>
        </button>
      );
    }

    if (previewLayer === "cutline" && cutlineNotReady) {
      return renderCutlineEmptyState();
    }

    if (activeCutline && previewImgBroken) {
      return (
        <div className="text-center text-sm text-gri-700">
          <p className="font-medium">Önizleme şu an açılamıyor</p>
          <p className="mt-1 text-xs">Sayfayı yenilemeyi dene.</p>
        </div>
      );
    }

    if (previewLayer === "cutline") {
      return renderCutlineEmptyState();
    }

    return (
      <div className="text-center text-sm text-gri-700">
        <p className="font-medium">Önizleme mevcut değil</p>
      </div>
    );
  };

  const showFinalizeBar = order.status === "proof_pending";
  const showBladeGeneratingBanner =
    order.status === "proof_generating" || !!bgGenItemId;
  const bladeDeadlineMs = order.sla_proof_deadline
    ? new Date(order.sla_proof_deadline).getTime()
    : null;
  const bladeRemainingSec =
    bladeDeadlineMs !== null
      ? Math.max(0, Math.floor((bladeDeadlineMs - nowMs) / 1000))
      : null;
  const bladeSlaMm =
    bladeRemainingSec !== null ? Math.floor(bladeRemainingSec / 60) : null;
  const bladeSlaSs =
    bladeRemainingSec !== null ? bladeRemainingSec % 60 : null;
  const bladeSlaExpired =
    bladeRemainingSec !== null && bladeRemainingSec === 0;

  return (
    <main
      className={cn(
        "bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8",
        showFinalizeBar ? "pb-52" : "pb-28 lg:pb-8"
      )}
    >
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
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
        {/* Progress bar */}
        <div
          className="mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-gri-100"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Onay ilerlemesi: ${designProgress.approved}/${designProgress.total}`}
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
              : designProgress.approved === 0
                ? "İlk önizlemeye bak, kesim çizgisini incele. Memnunsan 'Onayla' de; bir şey değişsin istiyorsan 'Düzenle'."
                : `${designProgress.approved}/${designProgress.total} tasarım onaylandı, az kaldı! Kalan ${designProgress.total - designProgress.approved} tasarımı da gözden geçirelim.`}
        </p>
      </Card>

      {showBladeGeneratingBanner && (
        <Card className="mb-6 border border-pim-mercan/40 bg-white p-3 shadow-sm">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-pim-mercan" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-lacivert">
                {bladeSlaExpired ? "Operatöre düştü" : "Bıçak hazırlanıyor…"}
              </p>
              {!bladeSlaExpired &&
                bladeSlaMm !== null &&
                bladeSlaSs !== null && (
                  <p className="mt-0.5 font-mono text-xs text-pim-mercan">
                    {`Kalan süre: ${bladeSlaMm}:${bladeSlaSs.toString().padStart(2, "0")}`}
                  </p>
                )}
              <p className="mt-0.5 text-xs text-gri-700">
                {bladeSlaExpired
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
        </Card>
      )}

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

      {((proofValidation?.cutlineIssues?.length ?? 0) > 0 ||
        (proofValidation?.whiteLayerIssues?.length ?? 0) > 0 ||
        (proofValidation?.ruleIssues?.length ?? 0) > 0) ? (
        <Card className="mb-6 border-sari-soft/60 bg-sari-soft/20 p-4">
          <p className="mb-2 text-sm font-semibold text-sari-koyu">
            Dikkat edilmesi gereken noktalar
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-lacivert">
            {[
              ...(proofValidation?.cutlineIssues ?? []),
              ...(proofValidation?.whiteLayerIssues ?? []),
              ...(proofValidation?.ruleIssues ?? []),
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
        {/* SOL — Ürün / tasarım kartları */}
        <aside className="space-y-2">
          {items.flatMap((item) => {
            const designCount = getItemDesignCount(item);

            if (designCount <= 1) {
              const badge = STATUS_BADGE[item.proof_status];
              const isActive = item.id === activeItemId;
              const singleDesign = item.designs?.[0] ?? null;
              const thumbUrl =
                itemCutlinePreviewSrc(
                  orderId,
                  item,
                  singleDesign?.design_file_id
                ) ??
                (isPreviewSrc(itemThumbs[item.id])
                  ? itemThumbs[item.id]
                  : null) ??
                (isHttpUrl(itemCutlinePreviewUrl(item))
                  ? itemCutlinePreviewUrl(item)
                  : null);
              const isApproved = itemAllDesignsApproved(item);

              return [
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => handleSelectItem(item.id)}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition",
                    isActive
                      ? "border-gri-200 border-l-[3px] border-l-pim-mercan bg-pim-mercan-tint/20 shadow-sm"
                      : "border-gri-200 bg-white hover:border-pim-mercan/40",
                    isApproved && "opacity-70"
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
                            (e.target as HTMLImageElement).style.display =
                              "none";
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
                      {isApproved && (
                        <span
                          className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-yesil text-[10px] text-white"
                          aria-hidden
                        >
                          ✓
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-lacivert">
                        {item.title}
                      </div>
                      <div className="mt-0.5 text-xs text-gri-700">
                        {formatItemSubtitle(item)}
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
                      </div>
                    </div>
                  </div>
                </button>,
              ];
            }

            return Array.from({ length: designCount }, (_, idx) => {
              const d = item.designs[idx] ?? null;
              const isSelected =
                item.id === activeItemId &&
                (d
                  ? d.design_file_id === activeDesignFileId
                  : idx === 0 && !activeDesignFileId);
              const isGeneratingThis =
                bgGenDesignFileId !== null &&
                d?.design_file_id === bgGenDesignFileId;
              const badge = getDesignStatusBadge(d, item, {
                isGenerating: isGeneratingThis,
              });
              const isDesignApproved = d ? cutlineIsApproved(d.cutline) : false;
              const thumbUrl = d
                ? itemCutlinePreviewSrc(orderId, item, d.design_file_id) ??
                  (isPreviewSrc(designThumbs[`${item.id}:${d.design_file_id}`])
                    ? designThumbs[`${item.id}:${d.design_file_id}`]
                    : null)
                : slotMetaPreviewUrl(item, idx);

              return (
                <button
                  key={`${item.id}-${d?.design_file_id ?? `slot-${idx}`}`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() =>
                    handleSelectDesign(item.id, d?.design_file_id ?? null)
                  }
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition",
                    isSelected
                      ? "border-gri-200 border-l-[3px] border-l-pim-mercan bg-pim-mercan-tint/20 shadow-sm"
                      : "border-gri-200 bg-white hover:border-pim-mercan/40",
                    isDesignApproved && "opacity-70"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gri-100 text-gri-700">
                      {thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbUrl}
                          alt={d?.file_name ?? `Tasarım ${idx + 1}`}
                          className="h-full w-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
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
                      {isDesignApproved && (
                        <span
                          className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-yesil text-[10px] text-white"
                          aria-hidden
                        >
                          ✓
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-gri-500">
                        {item.title}
                      </div>
                      <div className="truncate font-medium text-lacivert">
                        Tasarım {idx + 1}
                      </div>
                      {(d?.file_name ?? slotMetaFileName(item, idx)) && (
                        <div className="mt-0.5 truncate text-[11px] text-gri-700">
                          {d?.file_name ?? slotMetaFileName(item, idx)}
                        </div>
                      )}
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
                      </div>
                    </div>
                  </div>
                </button>
              );
            });
          })}
        </aside>

        {/* SAĞ — Önizleme + Action bar */}
        <section className="space-y-4">
          {activeItem ? (
            <>
              {/* Önizleme alanı */}
              <Card className="p-0">
                <div className="border-b border-gri-200 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-lacivert">
                        {activeItem.title}
                        {multiDesignCount > 1 && activeDesign && (
                          <span className="font-normal text-gri-700">
                            {" "}
                            · Tasarım{" "}
                            {(activeItem.designs?.findIndex(
                              (d) =>
                                d.design_file_id === activeDesignFileId
                            ) ?? 0) + 1}
                          </span>
                        )}
                      </div>
                      <div
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          multiDesignCount > 1 && activeDesignBadge
                            ? activeDesignBadge.bg
                            : STATUS_BADGE[activeItem.proof_status].bg,
                          multiDesignCount > 1 && activeDesignBadge
                            ? activeDesignBadge.color
                            : STATUS_BADGE[activeItem.proof_status].color
                        )}
                      >
                        <span>
                          {multiDesignCount > 1 && activeDesignBadge
                            ? activeDesignBadge.emoji
                            : STATUS_BADGE[activeItem.proof_status].emoji}
                        </span>
                        <span>
                          {multiDesignCount > 1 && activeDesignBadge
                            ? activeDesignBadge.label
                            : STATUS_BADGE[activeItem.proof_status].label}
                        </span>
                      </div>
                    </div>
                    <div className="mt-0.5 text-xs text-gri-700">
                      {formatItemSubtitle(activeItem)}
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
                </div>

                {/* Multi-design picker sol sidebar'a taşındı */}

                {bgPrompt.show && bgPrompt.bgDetect && activeItem && (
                  <div className="border-b border-gri-200 p-4">
                    <BgRemovalPrompt
                      orderId={orderId}
                      itemId={activeItem.id}
                      designFileId={activeDesignFileId}
                      bgDetect={bgPrompt.bgDetect}
                      previewUrl={designUrl ?? cutlinePreviewSrc}
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
                  className="relative flex w-full items-center justify-center bg-gri-100 p-4 sm:p-6"
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
                  <div
                    className="mx-auto flex max-w-md items-center justify-center sm:max-w-xl"
                    style={previewFrameStyle}
                  >
                    {renderPreviewBody()}
                  </div>
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

                {activeCutline?.cutline_source === "file_embedded" && (
                  <div className="border-t border-gri-200 bg-white px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yesil-soft/30 text-yesil-koyu text-[11px] font-medium">
                      <Icon.Check size={12} className="shrink-0" />
                      Tasarımındaki bıçak çizgisi kullanıldı
                    </span>
                    {!activeCutline.pim_feedback && (
                      <p className="mt-2 text-[12px] text-gri-700">
                        Tasarımının içindeki bıçak çizgisini olduğu gibi
                        kullandım. İncele ve onayla.
                      </p>
                    )}
                  </div>
                )}

                {activeCutline?.cutline_source === "auto_generated" && (
                  <div className="border-t border-gri-200 bg-white px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-mavi-soft/30 text-mavi-koyu text-[11px] font-medium">
                      <Icon.Info size={12} className="shrink-0" />
                      Bıçak çizgisi otomatik üretildi
                    </span>
                    {!activeCutline.pim_feedback && (
                      <p className="mt-2 text-[12px] text-gri-700">
                        Tasarımının dış sınırına otomatik bıçak çizgisi koydum.
                        İstersen düzenleyebilirsin.
                      </p>
                    )}
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

              {!showFinalizeBar && (
                <div className="sticky bottom-4 z-30 mt-1 flex flex-col gap-2 rounded-xl border border-gri-200 bg-white p-4 shadow-md sm:flex-row sm:items-center sm:justify-between">
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
                        activeDesignApproved ||
                        activeItem.proof_status === "help_requested" ||
                        !itemReadyForApproval
                      }
                    >
                      {approving
                        ? "Onaylanıyor…"
                        : activeDesignApproved
                          ? "Onaylandı ✓"
                          : !itemReadyForApproval
                            ? activeDesignGenerating
                              ? "Bıçak üretiliyor…"
                              : "Bıçak sırada"
                            : "Bu tasarımı onayla"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <Card className="p-8 text-center text-sm text-gri-700">
              Soldan bir ürün seç
            </Card>
          )}
        </section>
      </div>

      {/* Sabit alt panel — eski kart görünümü, viewport altında */}
      {showFinalizeBar && (
        <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 pt-2">
          <div className="mx-auto max-w-[1280px] md:px-8">
            <div className="rounded-xl border border-gri-200 bg-white p-4 shadow-lg">
              {activeItem && (
                <div className="mb-3 flex flex-col gap-2 border-b border-gri-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
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
                        activeDesignApproved ||
                        activeItem.proof_status === "help_requested" ||
                        !itemReadyForApproval
                      }
                    >
                      {approving
                        ? "Onaylanıyor…"
                        : activeDesignApproved
                          ? "Onaylandı ✓"
                          : !itemReadyForApproval
                            ? activeDesignGenerating
                              ? "Bıçak üretiliyor…"
                              : "Bıçak sırada"
                            : "Bu tasarımı onayla"}
                    </Button>
                  </div>
                </div>
              )}
              <Button
                variant="primary"
                size="lg"
                className={cn(
                  "w-full justify-center text-base font-semibold",
                  allDesignsApproved
                    ? "!bg-yesil hover:!bg-yesil-koyu"
                    : "!bg-gri-300 !text-gri-700 cursor-not-allowed"
                )}
                onClick={() => void handleFinalizeAll()}
                disabled={!allDesignsApproved || finalizing}
              >
                {finalizing
                  ? "Gönderiliyor…"
                  : "✅ Tüm Tasarımları Onayla ve Üretime Gönder"}
              </Button>
              {!allDesignsApproved && (
                <p className="mt-2 text-center text-xs text-gri-700">
                  Önce tüm tasarımları tek tek onayla (
                  {designProgress.approved}/{designProgress.total})
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* Lightbox modal — aktif katman önizlemesi */}
      {lightboxOpen &&
        isPreviewSrc(lightboxUrl) &&
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
      </div>
    </main>
  );
}
