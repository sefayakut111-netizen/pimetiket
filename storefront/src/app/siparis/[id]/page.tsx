/**
 * Pim Etiket — /siparis/[id] (E.2.2)
 *
 * Sipariş detayı dynamic route. Statü timeline + dosya yükleme +
 * prova onay + ürün özeti + adres + ödeme + kargo takip.
 *
 * Mock data — gerçek bağlantı I adımında.
 */

"use client";

import { use, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pim, PimMini } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, Skeleton, StageDot, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { mapApiError } from "@/lib/api-error-messages";
import { buildDesignSlotDisplay } from "@/lib/order-design-previews";
import type { CustomerOrder } from "@/lib/customer-order";
import { fetchCustomerOrder } from "@/lib/customer-order";
import { ensureAuthBindings } from "@/lib/customer-cart";
import { OrderItemDesignPreview } from "@/components/orders/OrderItemDesignPreview";
import { DesignThumb } from "@/components/cart/DesignThumb";
import { buildSummaryItems } from "@/lib/order-summary";
import { track } from "@/lib/analytics/posthog-events";
import { reorderFromOrder } from "@/lib/customer-reorder";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { isLoggedInSync } from "@/lib/supabase/auth-bridge";
import {
  ALLOWED_MIME_TYPES,
  isCustomerOrderUploadable,
  MAX_FILE_SIZE,
  STORAGE_BUCKET,
} from "@/lib/storage/design-files";
import {
  isPreProductionDeliveryStatus,
  type OrderStatus,
} from "@/lib/order";
import { useT } from "@/lib/i18n/context";
import { OrderDesignHistory } from "@/components/design/OrderDesignHistory";
import {
  fetchMyOrderShipment,
  type CustomerShipment,
  fetchMyShipmentTimeline,
  type ShipmentTimelineEvent,
} from "@/lib/shipping/customer-shipment";

const COPY = {
  tr: {
    breadPanel: "Panelim",
    breadOrders: "Siparişlerim",
    notFoundTitle: "Sipariş bulunamadı",
    notFoundDesc: (id: string) => (
      <>
        <strong className="font-mono">{id}</strong> numaralı sipariş bu cihazda
        kayıtlı değil. Başka bir cihazdan bakmış olabilirsin.
      </>
    ),
    backToOrders: "Siparişlerime dön",
    newOrder: "Yeni sipariş",
    eyebrow: "Sipariş",
    orderDate: "Sipariş tarihi",
    estDelivery: "Tahmini teslim",
    reorder: "Tekrar sipariş",
    journeyTitle: "Sipariş yolculuğu",
    nextStepHint: "Sıradaki adım — Pim sana ne yapacağını söylüyor.",
    multiOrder: (n: number) => `${n} ürünlük sipariş`,
    proofActionRequired: "Aksiyon gerekli",
    proofTitle: "Provanı incele ve onayla",
    proofDesc:
      "AI ön kontrolünden geçti, operatörümüz baktı — tasarımının matbaa öncesi nasıl görüneceğini hazırladık. Yakınlaştır, kontrol et, onayla.",
    proofMockChips: "DOĞAL · ORGANİK · 100ml",
    proofPreviewSize: "%100 önizleme",
    proofColorWarn: "Renk uyarısı:",
    proofColorWarnText:
      "Ekrandaki renkler matbaa baskısından küçük ölçüde farklı çıkabilir. CMYK kalibrasyonu üretim ortağımızla aynı.",
    proofApprove: "Provayı onayla",
    proofRequestChange: "Değişiklik iste",
    proofDownloadPdf: "PDF indir",
    proofApprovedTitle: "Prova onayın alındı 🎉",
    proofApprovedDesc:
      "Sipariş üretime gönderildi. Yaklaşık 5 gün içinde kargoya verilir.",
    fasonInfoTitle: "Atölyemize iletildi",
    fasonInfoDesc:
      "Tasarımın ve teslimat bilgilerin Pim Etiket anlaşmalı baskı atölyemize aktarıldı. Sadece bu sipariş için kullanılır, üretim sonrası 30 gün içinde imha edilir.",
    fasonInfoLink: "Üretim ortakları nasıl çalışıyor? →",
    summaryTitle: "Sipariş özeti",
    pcs: "adet",
    subtotal: "Ara toplam",
    shipping: "Kargo",
    free: "Ücretsiz",
    total: "TOPLAM",
    vatIncluded: "KDV dahil",
    deliveryTitle: "Teslimat",
    paymentTitle: "Ödeme",
    invoice: "Fatura",
    // Sefa 17 May Migration 045 — Kargo Takip
    shipmentTitle: "Kargo takibi",
    shipmentCarrier: "Kargo şirketi",
    shipmentTracking: "Takip numarası",
    shipmentShippedAt: "Kargoya verildi",
    shipmentDeliveredAt: "Teslim edildi",
    shipmentTrackBtn: "Kargo şirketinde takip et",
    shipmentNotShipped:
      "Sipariş henüz kargoya verilmedi. Üretim tamamlandığında kargo bilgisi burada görünür.",
    shipmentCopied: "Takip numarası kopyalandı",
    shipmentCopy: "Kopyala",
    pimAskTitle: "Pim'e sor",
    pimAskSub: "Bu sipariş hakkında soru?",
    openChat: "Sohbeti aç →",
    designTitle: "Tasarım dosyası",
    uploadCta: "Dosya yükle",
    uploading: "Yükleniyor...",
    uploadCtaNewVersion: "Yeni versiyon yükle",
    designEmptyTitle: "Henüz tasarım yüklemedin",
    designEmptyDesc:
      "PDF, AI, PSD, PNG, JPG, SVG kabul ederim. Yükledikten sonra Pim AI saniyeler içinde DPI / CMYK / boşluk kontrolü yapar.",
    aiFlagBadge: "AI flag",
    warnBadge: "Uyarı",
    aiPassBadge: "AI geçti",
    remove: "Kaldır",
    confirmRemove: "Bu dosya silinsin mi?",
    mockUploadNote: (
      <>
        Dosya değiştirmek için <strong>Yeni versiyon yükle</strong>&rsquo;ye
        basabilirsin. Önceki dosya geçmişte tutulur (24 ay).
      </>
    ),
    flagDpiOk: "Çözünürlük 320 DPI — baskı için yeterli",
    flagCmykOk: "CMYK renk uzayı tespit edildi",
    flagMarginWarn: "Kenar boşluğu 2mm'in altında — kesim kayması riskli",
    locale: "tr-TR",
    currency: "TL",
    invoiceIndividual: "Bireysel (e-arşiv)",
    invoiceCorporate: "Kurumsal (e-fatura)",
    payCard: "Kredi kartı",
    payTransfer: "Havale / EFT",
    phases: [
      { id: "konfigure", label: "Konfigüre" },
      { id: "odeme", label: "Ödendi" },
      { id: "dosya", label: "Dosya yüklendi" },
      { id: "ai", label: "Yapay zekâ kontrolü" },
      {
        id: "prova_hazir",
        label: "Prova hazırlanıyor",
      },
      { id: "prova_onay", label: "Prova onayın" },
      {
        id: "baski_onay",
        label: "Baskı öncesi onay",
        currHint:
          "Baskı öncesi son kontrolden geçiyor — operatörümüz onaylayınca üretime alınacak.",
      },
      { id: "uretim", label: "Üretimde" },
      { id: "kargo", label: "Kargoda" },
      { id: "teslim", label: "Teslim edildi" },
    ],
  },
  en: {
    breadPanel: "Dashboard",
    breadOrders: "My orders",
    notFoundTitle: "Order not found",
    notFoundDesc: (id: string) => (
      <>
        Order <strong className="font-mono">{id}</strong> isn&rsquo;t saved on
        this device. You may have viewed it from another device.
      </>
    ),
    backToOrders: "Back to orders",
    newOrder: "New order",
    eyebrow: "Order",
    orderDate: "Order date",
    estDelivery: "Estimated delivery",
    reorder: "Reorder",
    journeyTitle: "Order journey",
    nextStepHint: "Next step — Pim tells you what to do.",
    multiOrder: (n: number) => `Order with ${n} items`,
    proofActionRequired: "Action required",
    proofTitle: "Review and approve your proof",
    proofDesc:
      "Passed AI pre-check, our operator reviewed it — we prepared a preview of how your design will look before printing. Zoom in, check, and approve.",
    proofMockChips: "NATURAL · ORGANIC · 100ml",
    proofPreviewSize: "100% preview",
    proofColorWarn: "Color note:",
    proofColorWarnText:
      "On-screen colors may vary slightly from the printed result. CMYK calibration matches our partner.",
    proofApprove: "Approve proof",
    proofRequestChange: "Request changes",
    proofDownloadPdf: "Download PDF",
    proofApprovedTitle: "Proof approved 🎉",
    proofApprovedDesc:
      "Order sent to production. It will be shipped within ~5 days.",
    fasonInfoTitle: "Sent to our workshop",
    fasonInfoDesc:
      "Your design and shipping info have been transferred to our contracted print partner. Used only for this order, destroyed within 30 days after production.",
    fasonInfoLink: "How our production partners work →",
    summaryTitle: "Order summary",
    pcs: "units",
    subtotal: "Subtotal",
    shipping: "Shipping",
    free: "Free",
    total: "TOTAL",
    vatIncluded: "VAT included",
    deliveryTitle: "Delivery",
    paymentTitle: "Payment",
    invoice: "Invoice",
    shipmentTitle: "Shipment tracking",
    shipmentCarrier: "Carrier",
    shipmentTracking: "Tracking number",
    shipmentShippedAt: "Shipped at",
    shipmentDeliveredAt: "Delivered at",
    shipmentTrackBtn: "Track on carrier site",
    shipmentNotShipped:
      "Order has not been shipped yet. Tracking info will appear here once production is complete.",
    shipmentCopied: "Tracking number copied",
    shipmentCopy: "Copy",
    pimAskTitle: "Ask Pim",
    pimAskSub: "Question about this order?",
    openChat: "Open chat →",
    designTitle: "Design file",
    uploadCta: "Upload file",
    uploading: "Uploading...",
    uploadCtaNewVersion: "Upload new version",
    designEmptyTitle: "No design uploaded yet",
    designEmptyDesc:
      "Accepts PDF, AI, PSD, PNG, JPG, SVG. Once uploaded, Pim AI runs DPI / CMYK / margin checks in seconds.",
    aiFlagBadge: "AI flag",
    warnBadge: "Warning",
    aiPassBadge: "AI passed",
    remove: "Remove",
    confirmRemove: "Delete this file?",
    mockUploadNote: (
      <>
        To change the file, click <strong>Upload new version</strong>. The
        previous file is kept in history (24 months).
      </>
    ),
    flagDpiOk: "Resolution 320 DPI — sufficient for print",
    flagCmykOk: "CMYK color space detected",
    flagMarginWarn: "Margin under 2mm — cut shift risk",
    locale: "en-US",
    currency: "TRY",
    invoiceIndividual: "Individual (e-archive)",
    invoiceCorporate: "Corporate (e-invoice)",
    payCard: "Credit card",
    payTransfer: "Bank transfer",
    phases: [
      { id: "konfigure", label: "Configure" },
      { id: "odeme", label: "Paid" },
      { id: "dosya", label: "File uploaded" },
      { id: "ai", label: "AI check" },
      { id: "prova_hazir", label: "Preparing proof" },
      { id: "prova_onay", label: "Your proof approval" },
      {
        id: "baski_onay",
        label: "Pre-print approval",
        currHint:
          "Final pre-print check — will move to production once our operator approves.",
      },
      { id: "uretim", label: "In production" },
      { id: "kargo", label: "In transit" },
      { id: "teslim", label: "Delivered" },
    ],
  },
};

/** OrderStatus → PHASES index map (current step) */
function statusToPhaseIndex(status: OrderStatus): number {
  switch (status) {
    case "paid":
      return 1;
    case "awaiting_upload":
      return 2;
    case "qc_pending":
    case "qc_flagged":
    case "human_review":
    case "human_review_failed":
    case "operator_review":
      return 3;
    case "proof_generating":
    case "proof_validating":
      return 4;
    case "proof_pending":
      return 5;
    case "proof_approved":
    case "operator_print_review":
      return 6;
    case "ready_to_ship":
    case "fason_assigned":
    case "in_production":
      return 7;
    case "shipped":
      return 8;
    case "delivered":
      return 9;
    case "cancelled":
      return -1;
    default:
      return 1;
  }
}

const fmtUnit = (n: number) => n.toFixed(2).replace(".", ",");

function SlaCountdown({
  createdAt,
  locale,
}: {
  createdAt: number;
  locale: string;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const elapsedHours = (now - createdAt) / 3_600_000;
  const remainingHours = Math.max(0, 36 - elapsedHours);
  const isEn = locale === "en";

  if (remainingHours <= 0) {
    return (
      <span className="text-[12px] font-bold text-kirmizi animate-pulse">
        ⏰ {isEn ? "SLA expired" : "Süre doldu!"}
      </span>
    );
  }

  if (remainingHours <= 6) {
    return (
      <span className="text-[12px] font-bold text-kirmizi">
        🔴 {Math.floor(remainingHours)}
        {isEn ? "h left" : " saat kaldı"}
      </span>
    );
  }

  if (remainingHours <= 12) {
    return (
      <span className="text-[12px] font-semibold text-sari-koyu">
        ⏰ {Math.floor(remainingHours)}
        {isEn ? "h left" : " saat kaldı"}
      </span>
    );
  }

  return (
    <span className="text-[11px] text-gri-500">
      ⏳ {Math.floor(remainingHours)}
      {isEn ? "h remaining" : " saat kaldı"}
    </span>
  );
}

export default function SiparisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;

  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // Dosya yüklendi mi? — DesignUploadCard içindeki files state ana
  // komponente erişilemiyor; bu yüzden burada ayrıca count çekiyoruz.
  const [hasUploadedDesign, setHasUploadedDesign] = useState(false);

  const fmt = (n: number) => Math.round(n).toLocaleString(c.locale);

  const INVOICE_LABEL: Record<"individual" | "corporate", string> = {
    individual: c.invoiceIndividual,
    corporate: c.invoiceCorporate,
  };

  const PAYMENT_METHOD_LABEL: Record<"card" | "transfer", string> = {
    card: c.payCard,
    transfer: c.payTransfer,
  };

  const router = useRouter();
  const toast = useToast();
  const [reordering, setReordering] = useState(false);

  // Sefa 17 May Migration 045: kargo bilgisi
  const [shipment, setShipment] = useState<CustomerShipment | null>(null);
  // Sefa 18 May Migration 052: kargo durum geçmişi (Yurtiçi poll)
  const [shipmentTimeline, setShipmentTimeline] = useState<
    ShipmentTimelineEvent[]
  >([]);
  const [itemDesignFiles, setItemDesignFiles] = useState<
    Record<
      string,
      Array<{
        id: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        status: string;
        previewUrl?: string;
      }>
    >
  >({});

  useEffect(() => {
    ensureAuthBindings();
    void fetchCustomerOrder(id).then((o) => {
      setOrder(o);
      setHydrated(true);
      // Sefa 17 May P0-4: URL'i canonical ID ile değiştir (kullanıcı
      // farklı case ile gelmişse). Bu sayede breadcrumb / header /
      // linkler tek format gösterilir, paylaşılabilir URL düzgün kalır.
      if (
        o &&
        typeof window !== "undefined" &&
        o.id !== id &&
        o.id.toLowerCase() === id.toLowerCase()
      ) {
        window.history.replaceState(null, "", `/siparis/${o.id}`);
      }
    });
    void fetchMyOrderShipment(id).then(setShipment);
    void fetchMyShipmentTimeline(id).then(setShipmentTimeline);

    void fetch(`/api/orders/${id}/upload-status`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            items?: Array<{
              id: string;
              designFiles?: Array<{
                id: string;
                fileName: string;
                mimeType: string;
                sizeBytes: number;
                status: string;
                previewUrl?: string;
              }>;
            }>;
          } | null
        ) => {
          if (!data?.items) return;
          const map: typeof itemDesignFiles = {};
          for (const it of data.items) {
            map[it.id] = it.designFiles ?? [];
          }
          setItemDesignFiles(map);
        }
      )
      .catch(() => {
        /* sessiz */
      });

    // Design dosyası yüklü mü?
    // "Dosya yüklendi" adımını doğru gösterir.
    void (async () => {
      try {
        const supabase = createSupabaseClient();
        const { count } = await supabase
          .from("design_files")
          .select("id", { count: "exact", head: true })
          .eq("order_id", id)
          .neq("status", "superseded");
        if (typeof count === "number") setHasUploadedDesign(count > 0);
      } catch {
        // sessiz fallback — UI alt komponentten yine refresh edebilir
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!order) return;
    if (order.status !== "paid" && order.status !== "awaiting_upload") return;
    if (hasUploadedDesign) return;

    let cancelled = false;
    const pollDesignCount = async () => {
      try {
        const supabase = createSupabaseClient();
        const { count } = await supabase
          .from("design_files")
          .select("id", { count: "exact", head: true })
          .eq("order_id", id)
          .neq("status", "superseded");
        if (!cancelled && typeof count === "number" && count > 0) {
          setHasUploadedDesign(true);
        }
      } catch {
        // sessiz fallback
      }
    };

    void pollDesignCount();
    const interval = setInterval(() => void pollDesignCount(), 3000);
    const timeout = setTimeout(() => clearInterval(interval), 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [order, id, hasUploadedDesign]);

  // proof_validating — düzenleme sonrası AI doğrulama, 2sn poll
  useEffect(() => {
    if (order?.status !== "proof_validating") return;
    const interval = setInterval(() => {
      void fetchCustomerOrder(id).then((o) => {
        if (o) setOrder(o);
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [order?.status, id]);

  useEffect(() => {
    const waitingStatuses = [
      "qc_pending",
      "proof_generating",
      "proof_validating",
      "human_review",
    ];
    if (!order || !waitingStatuses.includes(order.status)) return;

    const interval = setInterval(() => {
      void fetchCustomerOrder(id).then((o) => {
        if (o) setOrder(o);
      });
    }, 5000);

    const timeout = setTimeout(() => clearInterval(interval), 300000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [order?.status, id]);

  // Sefa 22 May v68 — Tekrar sipariş duplicate guard:
  // Önce her tıklama sepete tekrar ürün ekliyordu (sınırsız), ilk tıklamada
  // yönlendirme yoktu, sonraki tıklamalarda /sepet'e gidiyordu (tutarsız).
  // Şimdi: confirm dialog + her başarılı eklemede /sepet'e zorunlu redirect.
  const handleReorder = async () => {
    if (!order) return;
    if (reordering) return; // double-click guard
    const confirmed = window.confirm(
      `Bu siparişin ürünlerini sepete eklemek istiyor musun?\n\n` +
        `${order.items.length} ürün eklenecek. Sepette varsa üzerine ekleme yapılır.`
    );
    if (!confirmed) return;
    setReordering(true);
    try {
      const r = await reorderFromOrder(order);
      if (r.ok) {
        if (r.skipped > 0) {
          toast.info(
            `${r.added} ürün sepete eklendi · ${r.skipped} atlandı`
          );
        } else {
          toast.success(`${r.added} ürün sepete eklendi`);
        }
        router.push("/sepet");
      } else {
        toast.error(r.reason ?? "Sepete eklenemedi");
      }
    } catch (err) {
      console.error("[reorder] failed:", err);
      toast.error("Tekrar sipariş açılamadı — sayfayı yenileyip tekrar dene.");
    } finally {
      setReordering(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order || cancelling) return;
    const isEn = locale === "en";
    const confirmed = window.confirm(
      isEn
        ? "Are you sure you want to cancel this order? A refund will be processed."
        : "Bu siparişi iptal etmek istediğine emin misin? İade işlemi başlatılacak."
    );
    if (!confirmed) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, {
        method: "POST",
      });
      if (res.ok) {
        track("order_cancelled", {
          orderId: order.id,
          total: order.total,
        });
        toast.success(
          isEn
            ? "Order cancelled — refund initiated"
            : "Sipariş iptal edildi — iade başlatıldı"
        );
        void fetchCustomerOrder(id).then((o) => o && setOrder(o));
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(
          mapApiError(
            j.error,
            isEn ? "en" : "tr",
            isEn ? "Cancellation failed" : "İptal başarısız"
          )
        );
      }
    } catch {
      toast.error(isEn ? "Cancellation failed" : "İptal başarısız");
    } finally {
      setCancelling(false);
    }
  };

  // Hydration guard — skeleton loading
  if (!hydrated) {
    return (
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-6 md:py-8 pb-20">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="mb-6 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
            <div className="flex flex-col gap-6">
              <Skeleton.Card />
              <Skeleton.Card />
            </div>
            <div className="flex flex-col gap-4">
              <Skeleton.Card />
              <Skeleton.Card />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Order not found
  if (!order) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[560px] px-6 text-center">
          <Pim pose="think" size={140} />
          <h1 className="mt-3 text-[26px] md:text-[32px] font-semibold tracking-tight">
            {c.notFoundTitle}
          </h1>
          <p className="mt-3 text-base text-gri-700 leading-relaxed">
            {c.notFoundDesc(id)}
          </p>
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <Button variant="primary" size="lg" href="/siparislerim">
              {c.backToOrders}
            </Button>
            <Button variant="secondary" size="lg" href="/etiket">
              {c.newOrder}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Header için title üret — tek item ise onun başlığı, çoksa özet
  const title =
    order.items.length === 1
      ? order.items[0].title
      : c.multiOrder(order.items.length);

  const orderDate = new Date(order.createdAtIso).toLocaleDateString(c.locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  // Sefa 22 May v68 — Tahmini teslim mantığı düzeltildi:
  // Önce dosya yüklenmeden + AI/operatör/prova geçmeden kesin tarih
  // göstermek yanlış (sepetteki "tasarım onayı baz alınır" mesajıyla
  // çelişiyordu). Sadece proof_approved + sonraki state'lerde gerçek
  // tarih, öncesinde "Tasarım onayından sonra" mesajı.
  const isPreProductionStatus = isPreProductionDeliveryStatus(order.status);

  const deliveryDate = order.estimatedDelivery
    ? new Date(order.estimatedDelivery).toLocaleDateString(c.locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";
  const deliveryDisplay = isPreProductionStatus
    ? "Tasarım onayından sonra hesaplanır"
    : deliveryDate;
  // Phase: status'a bakar, ama dosya zaten yüklendiyse "Dosya yüklendi"
  // adımını minimum aktif say (status trigger yansımamış olabilir — race
  // koşulu veya Migration sıralaması — UI gerçekliği yansıtmalı).
  const phaseIdx = Math.max(
    statusToPhaseIndex(order.status),
    hasUploadedDesign ? 2 : 0
  );
  const isCancelled = order.status === "cancelled";

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[14px] mb-5">
          <Link
            href="/panelim"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert"
          >
            {c.breadPanel}
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <Link
            href="/siparislerim"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert"
          >
            {c.breadOrders}
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          {/* Sefa 17 May P0-4: canonical ID kullan (order yüklendikten sonra) */}
          <span className="font-semibold font-mono uppercase">
            {order?.id ?? id}
          </span>
        </div>

        {/* Header */}
        <div className="flex items-end justify-between gap-6 mb-7 flex-wrap">
          <div>
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight leading-tight">
              {title}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-[13px] text-gri-700 flex-wrap">
              <span className="font-semibold uppercase tracking-[0.04em] font-mono">
                {order.id}
              </span>
              <span>·</span>
              <span>
                {c.orderDate}: {orderDate}
              </span>
              <span>·</span>
              <span>
                {c.estDelivery}:{" "}
                <strong className="text-lacivert">{deliveryDisplay}</strong>
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap shrink-0">
            {(order.status === "paid" ||
              order.status === "awaiting_upload") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleCancelOrder()}
                disabled={cancelling}
                className="!text-kirmizi"
              >
                {cancelling
                  ? locale === "en"
                    ? "Cancelling..."
                    : "İptal ediliyor..."
                  : locale === "en"
                    ? "Cancel order"
                    : "Siparişi iptal et"}
              </Button>
            )}
            {order.status === "delivered" && (
              <Button
                variant="secondary"
                onClick={handleReorder}
                disabled={reordering}
              >
                <Icon.Bolt size={14} />{" "}
                {reordering ? "Ekleniyor..." : c.reorder}
              </Button>
            )}
          </div>
        </div>

        {order.status === "proof_validating" && (
          <Card className="mb-6 flex flex-col items-center gap-3 bg-pim-mercan-tint/30 p-6 text-center sm:flex-row sm:text-left">
            <Pim pose="think" size={80} bob={false} />
            <div className="flex-1">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-pim-mercan border-t-transparent"
                  aria-hidden="true"
                />
                <p className="font-semibold text-lacivert">
                  Düzenlemenizi kontrol ediyoruz...
                </p>
              </div>
              <p className="mt-1 text-sm text-gri-700">Birkaç saniye.</p>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
          {/* MAIN */}
          <div className="flex flex-col gap-6">
            {/* Vertical timeline */}
            <Card padding="p-6">
              <h2 className="text-xl font-semibold mb-5">{c.journeyTitle}</h2>
              <ol className="flex flex-col gap-0">
                {c.phases.map((p, i) => {
                  const state = isCancelled
                    ? "todo"
                    : i < phaseIdx
                      ? "done"
                      : i === phaseIdx
                        ? "curr"
                        : "todo";
                  return (
                    <li
                      key={p.id}
                      className="flex gap-4 relative pb-5 last:pb-0"
                    >
                      {/* Vertical line */}
                      {i < c.phases.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute left-[13px] top-8 bottom-0 w-0.5"
                          style={{
                            background:
                              !isCancelled && i < phaseIdx
                                ? "var(--color-yesil)"
                                : "var(--color-gri-200)",
                          }}
                        />
                      )}
                      <StageDot
                        state={isCancelled ? "todo" : state}
                        label={
                          isCancelled
                            ? "✕"
                            : state === "curr"
                              ? i + 1
                              : i + 1
                        }
                      />
                      <div className="flex-1 pt-0.5">
                        <div
                          className={cn(
                            "font-semibold text-[15px]",
                            state === "todo" && "text-gri-500",
                            state === "done" && !isCancelled && "text-yesil",
                            state === "curr" && !isCancelled && "text-lacivert"
                          )}
                        >
                          {p.label}
                          {state === "curr" && !isCancelled && (
                            <span className="text-[11px] text-pim-mercan ml-2 font-semibold">
                              ← {locale === "en" ? "you are here" : "şu an burada"}
                            </span>
                          )}
                        </div>
                        {state === "curr" && !isCancelled && (
                          <div className="text-[13px] text-gri-700 mt-0.5">
                            {"currHint" in p && p.currHint
                              ? p.currHint
                              : c.nextStepHint}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {order.status === "qc_pending" && (
                <div className="mt-4 rounded-xl bg-mavi-soft/20 ring-1 ring-mavi/30 p-4">
                  <div className="font-semibold text-[14px] text-mavi-koyu mb-1">
                    🤖{" "}
                    {locale === "en"
                      ? "AI quality check in progress"
                      : "AI kalite kontrolü yapılıyor"}
                  </div>
                  <p className="text-[13px] text-gri-700">
                    {locale === "en"
                      ? "Your design is being checked by AI. This usually takes a few minutes."
                      : "Tasarımın AI tarafından kontrol ediliyor. Genellikle birkaç dakika sürer."}
                  </p>
                </div>
              )}

              {order.status === "proof_generating" && (
                <div className="mt-4 rounded-xl bg-pim-mercan-tint/20 ring-1 ring-pim-mercan/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-pim-mercan animate-pulse" />
                    <div className="font-semibold text-[14px] text-pim-mercan">
                      {locale === "en"
                        ? "Preparing your proof"
                        : "Provan hazırlanıyor"}
                    </div>
                  </div>
                  <p className="text-[13px] text-gri-700 mb-3">
                    {locale === "en"
                      ? "Cut line is being generated on our servers. You can watch progress on the approval page."
                      : "Bıçak çizimi sunucuda üretiliyor. İlerlemeyi onay sayfasından takip edebilirsin."}
                  </p>
                  <Button variant="primary" size="sm" href={`/onay/${order.id}`}>
                    {locale === "en"
                      ? "View proof preparation →"
                      : "Prova hazırlığını gör →"}
                  </Button>
                </div>
              )}
            </Card>

            {/* Sefa 22 May v68 — Üst CTA: paid/awaiting_upload durumunda
                "Tasarımını yükle" büyük buton. Eskiden bu kart yoktu —
                küçük "+ Dosya yükle" butonu sağda kayboluyordu, kullanıcı
                ne yapacağını bilmiyordu. */}
            {(order.status === "paid" ||
              order.status === "awaiting_upload") &&
              !hasUploadedDesign && (
              <Card padding="p-6" className="border-2 border-pim-mercan/40 bg-pim-mercan-tint/20">
                <div className="flex gap-4 items-start">
                  <PimMini pose="inspect" size={56} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-pim-mercan">
                      Sıradaki adım
                    </div>
                    <h3 className="font-semibold text-[18px] mt-1 text-lacivert">
                      Tasarım dosyanı yükle
                    </h3>
                    <p className="text-[14px] text-gri-700 mt-2 leading-relaxed">
                      Ödemen alındı. Tasarım dosyanı yüklediğinde AI ön-kontrol
                      saniyeler içinde yapılır, operatörümüz inceler, bıçak
                      çizimi otomatik hazırlanır. 3 gün içinde yüklemen
                      gerekiyor (aksi halde sipariş iptal edilir).
                    </p>
                    <div className="mt-4">
                      <Button
                        variant="primary"
                        size="lg"
                        href={`/siparis/${order.id}/tasarim-yukle${
                          order.items.length === 1
                            ? `?item=${order.items[0].id}`
                            : ""
                        }`}
                      >
                        <Icon.Plus size={16} /> Tasarımını yükle →
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {hasUploadedDesign &&
              (order.status === "paid" ||
                order.status === "awaiting_upload") && (
              <Card padding="p-5" className="text-center">
                <p className="text-sm text-gri-700">
                  Tasarımın yüklendi. Sistem ön-kontrolü başlatılıyor...
                </p>
                <div className="mt-2 flex justify-center">
                  <span
                    className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pim-mercan border-t-transparent"
                    aria-hidden="true"
                  />
                </div>
              </Card>
            )}

            {/* Prova onay — /onay sayfasında; burada tekrar göstermiyoruz. */}

            {/* Üretim ortağı bilgilendirmesi — in_production / shipped / delivered */}
            {(order.status === "in_production" ||
              order.status === "shipped" ||
              order.status === "delivered") && (
              <div className="rounded-2xl p-5 bg-pim-mercan-tint/40 ring-1 ring-pim-mercan/20 flex gap-3 items-start">
                <span
                  className="grid place-items-center w-10 h-10 rounded-xl bg-white text-xl shrink-0"
                  aria-hidden="true"
                >
                  🏭
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[14.5px] text-lacivert">
                    {c.fasonInfoTitle}
                  </h3>
                  <p className="text-[12.5px] text-gri-700 mt-1 leading-relaxed">
                    {c.fasonInfoDesc}
                  </p>
                  <Link
                    href="/gizlilik#4-uretim-ortaklarimiz"
                    className="inline-block mt-2 text-[12px] font-semibold text-pim-mercan hover:underline"
                  >
                    {c.fasonInfoLink}
                  </Link>
                </div>
              </div>
            )}

            {/* File upload card — yalnız API'nin kabul ettiği durumlarda */}
            {isCustomerOrderUploadable(order.status) &&
              order.items.map((item) => (
                <DesignUploadCard
                  key={item.id}
                  orderId={order.id}
                  orderItem={item}
                  orderItemId={item.id}
                  itemDesignFiles={itemDesignFiles}
                  c={c}
                />
              ))}

            {/* Tasarım versiyon geçmişi — 2+ versiyon varsa otomatik gösterir */}
            <OrderDesignHistory orderId={order.id} />
          </div>

          {/* SIDE — özet bilgileri */}
          <div className="flex flex-col gap-4">
            {/* Order summary */}
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-4">{c.summaryTitle}</h3>
              <ul className="flex flex-col gap-2.5 text-[13px] mb-4">
                {order.items.map((item) => {
                  const summaryItems = buildSummaryItems(
                    item,
                    c.locale === "en-US" ? "en" : "tr",
                    { pageMode: item.meta?.pageMode === true }
                  );
                  const designFiles = itemDesignFiles[item.id] ?? [];
                  const designRows =
                    designFiles.length > 1
                      ? designFiles.map((df, idx) => ({
                          key: df.id,
                          previewUrl: df.previewUrl,
                          fileName: df.fileName,
                          mimeType: df.mimeType,
                          label:
                            idx === 0
                              ? item.title
                              : locale === "en"
                                ? `Design ${idx + 1}`
                                : `Tasarım ${idx + 1}`,
                          showPrice: idx === 0,
                        }))
                      : [
                          {
                            key: item.id,
                            previewUrl: undefined as string | undefined,
                            fileName: undefined as string | undefined,
                            mimeType: undefined as string | undefined,
                            label: item.title,
                            showPrice: true,
                          },
                        ];

                  return (
                    <li
                      key={item.id}
                      className="pb-3 border-b border-gri-100 last:border-0 last:pb-0"
                    >
                      <div className="space-y-2">
                        {designRows.map((row) => (
                          <div
                            key={row.key}
                            className="flex gap-3 items-center min-w-0"
                          >
                            {designFiles.length > 1 ? (
                              <DesignThumb
                                previewUrl={row.previewUrl}
                                fileName={row.fileName}
                                mimeType={row.mimeType}
                                product={item.product}
                                size="sm"
                              />
                            ) : (
                              <OrderItemDesignPreview
                                orderId={order.id}
                                item={item}
                                designFiles={designFiles}
                                onPreview={setLightboxSrc}
                              />
                            )}
                            <div className="flex-1 min-w-0 flex justify-between gap-3 items-baseline">
                              <span className="font-semibold text-lacivert text-[14px] leading-snug">
                                {row.label}
                              </span>
                              {row.showPrice && (
                                <span className="font-semibold tabular-nums shrink-0 text-[14px]">
                                  {fmt(item.total)} {c.currency}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {summaryItems.length > 0 && (
                        <ul className="mt-2 ml-[3.25rem] space-y-1 text-[12.5px] text-gri-700 leading-relaxed">
                          {summaryItems.map((s, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span aria-hidden="true" className="shrink-0">
                                {s.icon}
                              </span>
                              <span>
                                <span className="text-gri-500">{s.label}:</span>{" "}
                                <span className="font-medium text-lacivert">
                                  {s.value}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="text-[12px] text-gri-500 mt-2 ml-[3.25rem] tabular-nums">
                        {fmtUnit(item.unit)} {c.currency} ×{" "}
                        {item.qty.toLocaleString(c.locale)} {c.pcs}
                      </div>
                      {(order.status === "paid" ||
                        order.status === "awaiting_upload") && (
                        <Link
                          href={`/siparis/${order.id}/tasarim-yukle?item=${item.id}`}
                          className="inline-block mt-2 ml-[3.25rem] text-[12px] font-semibold text-pim-mercan hover:underline"
                        >
                          {locale === "en"
                            ? "Upload / change design →"
                            : "Tasarım yükle / değiştir →"}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 pt-3 border-t border-gri-200 space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-gri-700">{c.subtotal}</span>
                  <span className="font-semibold tabular-nums">
                    {fmt(order.subtotal)} {c.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gri-700">{c.shipping}</span>
                  <span className="font-semibold tabular-nums">
                    {order.shipping === 0 ? (
                      <span className="text-yesil">{c.free}</span>
                    ) : (
                      `${fmt(order.shipping)} ${c.currency}`
                    )}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t-2 border-lacivert flex justify-between items-baseline">
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
                  {c.total}
                </span>
                <span className="text-2xl font-bold tabular-nums">
                  {fmt(order.total)}{" "}
                  <span className="text-base text-gri-700">{c.currency}</span>
                </span>
              </div>
              <div className="text-[11.5px] text-gri-700 text-right mt-1">
                {c.vatIncluded}
              </div>
            </Card>

            {/* Kargo Takip — Sefa 17 May Migration 045 */}
            {shipment && shipment.hasShipment && (
              <Card
                padding="p-6"
                className="!bg-yesil-soft/40 ring-1 !ring-yesil/30"
              >
                <h3 className="font-semibold text-base mb-3 flex items-center gap-2 text-yesil-koyu">
                  <Icon.Truck size={16} /> {c.shipmentTitle}
                  {shipment.status === "delivered" && (
                    <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-yesil text-white text-[11px] font-semibold">
                      ✓ {c.shipmentDeliveredAt}
                    </span>
                  )}
                </h3>
                <div className="text-[13px] space-y-2.5 leading-relaxed">
                  <div className="flex justify-between gap-3">
                    <span className="text-gri-700">{c.shipmentCarrier}</span>
                    <span className="font-semibold text-lacivert text-right">
                      {shipment.carrierLabel}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 items-baseline">
                    <span className="text-gri-700">{c.shipmentTracking}</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-[12.5px] text-lacivert font-semibold">
                        {shipment.trackingNumber}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof navigator !== "undefined") {
                            void navigator.clipboard
                              .writeText(shipment.trackingNumber)
                              .then(() => toast.success(c.shipmentCopied));
                          }
                        }}
                        className="text-[11px] font-semibold text-pim-mercan hover:underline"
                        aria-label={c.shipmentCopy}
                      >
                        {c.shipmentCopy}
                      </button>
                    </div>
                  </div>
                  {shipment.shippedAt && (
                    <div className="flex justify-between gap-3">
                      <span className="text-gri-700">
                        {c.shipmentShippedAt}
                      </span>
                      <span className="text-lacivert">
                        {new Date(shipment.shippedAt).toLocaleDateString(
                          c.locale,
                          { day: "numeric", month: "long", year: "numeric" }
                        )}
                      </span>
                    </div>
                  )}
                </div>
                {shipment.trackingUrl && (
                  <div className="mt-4">
                    <Button
                      variant="primary"
                      size="md"
                      block
                      href={shipment.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon.Truck size={14} /> {c.shipmentTrackBtn} →
                    </Button>
                  </div>
                )}

                {/* Sefa 18 May Migration 052: Yurtiçi'den gelen durum timeline'ı */}
                {shipmentTimeline.length > 0 && (
                  <div className="mt-5 border-t border-yesil/20 pt-4">
                    <h4 className="mb-3 text-[12px] font-semibold uppercase text-gri-700">
                      Durum geçmişi
                    </h4>
                    <ol className="space-y-2">
                      {shipmentTimeline.map((ev, i) => {
                        const meta = (
                          {
                            created: { tr: "İşleme alındı", emoji: "📝" },
                            picked_up: { tr: "Kargo alındı", emoji: "📦" },
                            in_transit: { tr: "Yolda", emoji: "🚚" },
                            out_for_delivery: {
                              tr: "Dağıtımda",
                              emoji: "🛵",
                            },
                            delivered: { tr: "Teslim edildi", emoji: "✅" },
                            failed: {
                              tr: "Teslim edilemedi",
                              emoji: "⚠️",
                            },
                            returned: { tr: "İade edildi", emoji: "↩️" },
                            cancelled: { tr: "İptal", emoji: "❌" },
                          } as const
                        )[ev.status];
                        return (
                          <li
                            key={`${ev.status}-${ev.eventTime}-${i}`}
                            className="flex gap-2.5 rounded-lg bg-white/70 p-2.5 text-[12.5px]"
                          >
                            <span className="text-base leading-none">
                              {meta?.emoji ?? "📍"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-lacivert">
                                {meta?.tr ?? ev.status}
                              </div>
                              {(ev.description || ev.location) && (
                                <div className="text-[11.5px] text-gri-700 mt-0.5">
                                  {ev.description}
                                  {ev.location && (
                                    <span className="text-gri-500">
                                      {" "}· {ev.location}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="text-[11px] text-gri-500 mt-0.5">
                                {new Date(ev.eventTime).toLocaleString(
                                  c.locale,
                                  {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </Card>
            )}

            {/* Shipping (teslimat adresi) */}
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                <Icon.Truck size={16} /> {c.deliveryTitle}
              </h3>
              <div className="text-[13px] text-gri-700 space-y-1.5 leading-relaxed">
                {order.address.label && (
                  <div className="inline-flex items-center h-[20px] px-2 rounded-full bg-gri-100 text-gri-700 text-[11px] font-semibold mb-1">
                    {order.address.label}
                  </div>
                )}
                <div className="font-semibold text-lacivert">
                  {order.address.name}
                </div>
                <div>{order.address.addr}</div>
                <div>{order.address.city}</div>
                <div>{order.address.phone}</div>
                {/* Henüz kargoya verilmemiş bilgisi — Sefa 22 May v68:
                    "ℹ" gri-italik soluk gözüküyordu, gözden kaçabiliyordu.
                    Pim-mercan tint + kontrastlı text + ikon vurgusu. */}
                {!shipment && order.status !== "delivered" && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-pim-mercan-tint/40 px-3 py-2.5 text-[12.5px] text-lacivert leading-relaxed">
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-pim-mercan text-white text-[10px] font-bold shrink-0 mt-0.5"
                      aria-hidden
                    >
                      i
                    </span>
                    <span>{c.shipmentNotShipped}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Payment */}
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                <Icon.Check size={16} /> {c.paymentTitle}
              </h3>
              <div className="text-[13px] text-gri-700 space-y-1.5 leading-relaxed">
                <div>{PAYMENT_METHOD_LABEL[order.payment.method]}</div>
                {order.payment.masked && (
                  <div className="font-mono">{order.payment.masked}</div>
                )}
                <div className="text-[11.5px] text-gri-500 mt-2 flex items-center justify-between gap-2">
                  <span>
                    {c.invoice}: {INVOICE_LABEL[order.invoice.type]}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      window.open(`/api/orders/${id}/invoice-pdf`, "_blank")
                    }
                    className="text-[11px] font-semibold text-pim-mercan hover:underline shrink-0"
                  >
                    📄{" "}
                    {locale === "en" ? "Download invoice" : "Fatura indir"}
                  </button>
                </div>
              </div>
            </Card>

            {/* İade talebi — teslim edilmiş siparişler */}
            {order.status === "delivered" && (
              <Card padding="p-4" className="!bg-gri-50">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold text-[13px]">
                      {locale === "en" ? "Need to return?" : "İade mi istiyorsun?"}
                    </div>
                    <div className="text-[12px] text-gri-700 mt-0.5">
                      {locale === "en"
                        ? "Submit a return request within 14 days"
                        : "14 gün içinde iade talebi oluşturabilirsin"}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" href="/iade-talep">
                    {locale === "en" ? "Return request" : "İade talebi →"}
                  </Button>
                </div>
              </Card>
            )}

            {/* Pim help */}
            <Card padding="p-5" className="!bg-krem">
              <div className="flex gap-3 items-center">
                <Pim pose="chat" size={64} bob={false} />
                <div>
                  <div className="font-bold text-sm">{c.pimAskTitle}</div>
                  <div className="text-[11.5px] text-gri-700 mt-0.5">
                    {c.pimAskSub}
                  </div>
                  <button
                    type="button"
                    className="text-[12.5px] font-semibold text-pim-mercan mt-2 hover:underline"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("pim-chat-open", {
                          detail: { context: `siparis_${order.id}` },
                        })
                      );
                    }}
                  >
                    {c.openChat}
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setLightboxSrc(null)}
          role="dialog"
          aria-label={locale === "en" ? "Design preview" : "Tasarım önizleme"}
        >
          <div className="relative max-w-lg max-h-[70vh] rounded-xl overflow-hidden bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxSrc}
              alt={locale === "en" ? "Design preview" : "Tasarım önizleme"}
              className="w-full h-full max-h-[70vh] object-contain"
            />
            <button
              type="button"
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 text-sm"
              onClick={() => setLightboxSrc(null)}
              aria-label={locale === "en" ? "Close" : "Kapat"}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {(order.status === "awaiting_upload" || order.status === "paid") &&
        !hasUploadedDesign && (
        <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-sm border-t border-gri-200 shadow-lg px-4 py-3 safe-area-bottom">
          <Button
            variant="primary"
            size="md"
            href={`/siparis/${order.id}/tasarim-yukle`}
            className="w-full"
          >
            📁 {locale === "en" ? "Upload design" : "Tasarım yükle"}
          </Button>
        </div>
      )}
      {(order.status === "awaiting_upload" || order.status === "paid") && (
        <div className="h-16 md:hidden" aria-hidden />
      )}
    </main>
  );
}

// ============================================================
// DesignUploadCard — sipariş detayında tasarım upload UI
// ============================================================

interface UploadedFile {
  name: string;
  size: number;
  uploadedAt: number;
  /** AI flagleri — mock */
  flags: Array<{ kind: "ok" | "warning" | "error"; message: string }>;
  /**
   * Sefa 21 May v68 — Önizleme için: storage_path + mime_type ile
   * signed URL üretip image render edilebilir (raster mime'lar için).
   */
  storagePath?: string;
  mimeType?: string;
  previewUrl?: string;
}

interface DbFileRow {
  id: string;
  order_item_id: string | null;
  storage_path: string;
  original_name: string;
  size_bytes: number;
  mime_type: string;
  status: string;
  ai_check: { flags?: Array<{ kind: string; message: string }> } | null;
  uploaded_at: string;
}

function dbRowToUploaded(r: DbFileRow): UploadedFile & { id: string; status: string } {
  const flagsRaw = r.ai_check?.flags ?? [];
  const flags = flagsRaw.map((f) => ({
    kind: (f.kind === "warning" ? "warning" : f.kind === "error" ? "error" : "ok") as
      | "ok"
      | "warning"
      | "error",
    message: f.message,
  }));
  return {
    id: r.id,
    name: r.original_name,
    size: r.size_bytes,
    uploadedAt: new Date(r.uploaded_at).getTime(),
    flags,
    status: r.status,
    storagePath: r.storage_path,
    mimeType: r.mime_type,
  };
}

function DesignFileThumb({
  storagePath,
  mimeType,
  fileName,
}: {
  storagePath?: string;
  mimeType?: string;
  fileName: string;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);
  const isRaster =
    mimeType?.startsWith("image/") &&
    !mimeType?.includes("svg"); // SVG raster değil

  useEffect(() => {
    if (!isRaster || !storagePath) return;
    let active = true;
    const supabase = createSupabaseClient();
    void supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 600) // 10 dk
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data?.signedUrl) {
          setErrored(true);
          return;
        }
        setSignedUrl(data.signedUrl);
      })
      .catch(() => {
        if (active) setErrored(true);
      });
    return () => {
      active = false;
    };
  }, [storagePath, isRaster]);

  if (!isRaster || errored || !signedUrl) {
    return (
      <div className="grid place-items-center w-11 h-11 rounded-lg bg-pim-mercan-tint text-pim-mercan shrink-0">
        <Icon.Box size={20} />
      </div>
    );
  }

  return (
    <img
      src={signedUrl}
      alt={`${fileName} önizleme`}
      loading="lazy"
      className="w-11 h-11 rounded-lg object-cover ring-1 ring-gri-200 shrink-0 bg-white"
    />
  );
}

function DesignUploadCard({
  orderId,
  orderItem,
  orderItemId,
  itemDesignFiles,
  c,
}: {
  orderId: string;
  orderItem?: CustomerOrder["items"][number];
  orderItemId?: string;
  itemDesignFiles?: Record<
    string,
    Array<{ id: string; previewUrl?: string; fileName: string }>
  >;
  c: typeof COPY.tr | typeof COPY.en;
}) {
  const [files, setFiles] = useState<Array<UploadedFile & { id?: string; status?: string }>>([]);
  const [hydrated, setHydrated] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadStatusFiles, setUploadStatusFiles] = useState<
    Array<{ id: string; fileName: string; previewUrl?: string }>
  >([]);

  const refreshUploadStatus = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/upload-status`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        items?: Array<{
          id: string;
          designFiles?: Array<{
            id: string;
            fileName: string;
            previewUrl?: string;
          }>;
        }>;
      };
      const item = data.items?.find((i) => i.id === orderItemId);
      setUploadStatusFiles(item?.designFiles ?? []);
    } catch {
      /* sessiz */
    }
  };

  // Auth mode: DB; Guest mode: in-memory mock (localStorage kaldırıldı)
  const refreshDb = async () => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("design_files")
      .select("*")
      .eq("order_id", orderId)
      .neq("status", "superseded")
      .order("uploaded_at", { ascending: true });
    if (error) {
      console.error("[design] list error:", error);
      return;
    }
    const previewById = new Map<string, string>();
    if (itemDesignFiles) {
      for (const dfs of Object.values(itemDesignFiles)) {
        for (const df of dfs) {
          if (df.previewUrl) previewById.set(df.id, df.previewUrl);
        }
      }
    }
    setFiles(
      (data as unknown as DbFileRow[])
        .filter(
          (r) =>
            !orderItemId ||
            r.order_item_id === orderItemId ||
            r.order_item_id == null
        )
        .map((r) => ({
          ...dbRowToUploaded(r),
          previewUrl: previewById.get(r.id),
        }))
    );
  };

  const apiDesignFiles =
    uploadStatusFiles.length > 0
      ? uploadStatusFiles
      : orderItemId && itemDesignFiles?.[orderItemId]
        ? itemDesignFiles[orderItemId]
        : [];

  const mergedDbFiles = (() => {
    const byId = new Map(
      files.map((f) => [
        f.id ?? f.name,
        {
          id: f.id ?? f.name,
          name: f.name,
          size: f.size,
          uploadedAt: f.uploadedAt,
          status: f.status,
          previewUrl: f.previewUrl,
          mimeType: f.mimeType,
          storagePath: f.storagePath,
          flags: f.flags,
        },
      ])
    );
    for (const af of apiDesignFiles) {
      const existing = byId.get(af.id);
      if (existing) {
        if (!existing.previewUrl && af.previewUrl) {
          existing.previewUrl = af.previewUrl;
        }
      } else {
        byId.set(af.id, {
          id: af.id,
          name: af.fileName,
          size: 0,
          uploadedAt: 0,
          status: undefined,
          previewUrl: af.previewUrl,
          mimeType: undefined,
          storagePath: undefined,
          flags: [],
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.uploadedAt - b.uploadedAt);
  })();

  const displayFiles = buildDesignSlotDisplay(orderItem, mergedDbFiles);

  useEffect(() => {
    if (isLoggedInSync()) {
      void refreshUploadStatus();
      void refreshDb().finally(() => setHydrated(true));
      // Polling — AI check tamamlanınca status değişecek
      const interval = setInterval(() => {
        if (files.some((f) => f.status === "analyzing")) {
          void refreshDb();
        }
      }, 3000);
      return () => clearInterval(interval);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, itemDesignFiles]);

  useEffect(() => {
    if (isLoggedInSync() && Object.keys(itemDesignFiles ?? {}).length > 0) {
      void refreshDb();
    }
  }, [itemDesignFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasPendingSlots = displayFiles.some((f) => f.pendingLink);
  useEffect(() => {
    if (!hasPendingSlots) return;
    const interval = setInterval(() => {
      void refreshUploadStatus();
      void refreshDb();
    }, 4000);
    return () => clearInterval(interval);
  }, [hasPendingSlots]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRealUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!isLoggedInSync()) {
      // Guest mode → mock akışına düş (geriye uyumlu)
      handleMockUpload(file);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert(`Dosya çok büyük (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
      return;
    }
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      alert(`Bu dosya formatı desteklenmiyor: ${file.type || "bilinmiyor"}`);
      return;
    }

    setAnalyzing(true);
    try {
      // 1) /api/design/upload-init
      // Sefa 22 May v68 fix: orderItemId GEÇİRİLİYOR. Önceden eksikti →
      // design_files.order_item_id NULL kayıt → sipariş özeti thumbnail
      // bulamıyordu (Sefa test sipariş #210520262967 keşif).
      const initRes = await fetch("/api/design/upload-init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
          orderItemId,
          originalName: file.name,
          sizeBytes: file.size,
          mimeType: file.type,
        }),
      });
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        throw new Error(err.error ?? `init_failed_${initRes.status}`);
      }
      const init = (await initRes.json()) as {
        uploadUrl: string;
        token: string;
        storagePath: string;
        fileId: string;
      };

      // 2) PUT signed URL'e (Supabase Storage)
      const supabase = createSupabaseClient();
      const { error: uploadErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .uploadToSignedUrl(init.storagePath, init.token, file);
      if (uploadErr) {
        throw new Error(`upload_failed: ${uploadErr.message}`);
      }

      // 3) /api/design/upload-complete (AI ön-kontrol tetikle)
      const compRes = await fetch("/api/design/upload-complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileId: init.fileId }),
      });
      if (!compRes.ok) {
        const err = await compRes.json().catch(() => ({}));
        throw new Error(err.error ?? `complete_failed_${compRes.status}`);
      }

      await refreshDb();
    } catch (err) {
      console.error("[design] upload error:", err);
      alert(err instanceof Error ? err.message : "Yükleme başarısız");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleMockUpload = (file: File) => {
    setAnalyzing(true);
    setTimeout(() => {
      const flagSet: UploadedFile["flags"] = [
        { kind: "ok", message: c.flagDpiOk },
        { kind: "ok", message: c.flagCmykOk },
      ];
      if (Math.random() < 0.3) {
        flagSet.push({
          kind: "warning",
          message: c.flagMarginWarn,
        });
      }
      const fresh: UploadedFile = {
        name: file.name,
        size: file.size,
        uploadedAt: Date.now(),
        flags: flagSet,
      };
      const next = [fresh, ...files];
      setFiles(next);
      setAnalyzing(false);
    }, 1500);
  };

  // Sefa 22 May v68: handleRemove kaldırıldı — müşteri tasarım silemez,
  // sadece "Yeni versiyon yükle" ile değiştirebilir (versiyon geçmişi
  // OrderDesignHistory accordion'da kalır).

  if (!hydrated) return null;

  return (
    <Card padding="p-6">
      <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
        <h2 className="text-xl font-semibold">{c.designTitle}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {orderItemId && (
            <Link
              href={`/siparis/${orderId}/tasarim-yukle?item=${orderItemId}`}
              className="text-[12px] font-semibold text-pim-mercan hover:underline"
            >
              {c.locale === "en-US"
                ? "Manage all uploads →"
                : "Tüm yüklemeleri yönet →"}
            </Link>
          )}
        {/* Sefa 22 May v68: htmlFor + id eklendi (a11y — ekran okuyucu).
            Önceden label içinde gömülü input vardı, htmlFor bağlama yoktu. */}
        <label
          htmlFor={`design-upload-${orderId}`}
          className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-full bg-pim-mercan text-white text-[13px] font-semibold cursor-pointer hover:bg-pim-mercan-koyu transition-colors"
        >
          <Icon.Plus size={14} />
          {analyzing
            ? c.uploading
            : files.length > 0
              ? c.uploadCtaNewVersion
              : c.uploadCta}
          <input
            id={`design-upload-${orderId}`}
            type="file"
            className="hidden"
            accept=".pdf,.ai,.psd,.png,.jpg,.jpeg,.svg"
            onChange={handleRealUpload}
            disabled={analyzing}
            aria-label={c.uploadCta}
          />
        </label>
        </div>
      </div>

      {displayFiles.length === 0 ? (
        <div className="rounded-lg bg-gri-50 ring-1 ring-dashed ring-gri-200 p-8 text-center">
          <Icon.Box size={36} className="text-gri-500 mx-auto mb-3" />
          <h3 className="font-semibold text-lacivert mb-1">
            {c.designEmptyTitle}
          </h3>
          <p className="text-[13px] text-gri-700 max-w-[400px] mx-auto leading-relaxed">
            {c.designEmptyDesc}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayFiles.map((f) => {
            const date =
              f.uploadedAt > 0
                ? new Date(f.uploadedAt).toLocaleString(c.locale, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null;
            const sizeMb =
              f.size > 0 ? (f.size / 1024 / 1024).toFixed(1) : null;
            const hasError = f.flags.some((fl) => fl.kind === "error");
            const hasWarning = f.flags.some((fl) => fl.kind === "warning");
            const statusIcon = f.pendingLink
              ? "⏳"
              : f.status === "qc_passed" || f.status === "approved"
                ? "✅"
                : f.status === "analyzing"
                  ? "⏳"
                  : f.status === "qc_failed"
                    ? "❌"
                    : "📁";
            return (
              <div
                key={f.id ?? `${f.name}-${f.slotIndex}`}
                className="flex items-start gap-3 p-4 rounded-lg bg-gri-50 ring-1 ring-gri-200"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gri-100 shrink-0 ring-1 ring-gri-200">
                  {f.previewUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={f.previewUrl}
                      alt={f.name}
                      className="w-full h-full object-contain bg-white"
                      loading="lazy"
                    />
                  ) : (
                    <DesignFileThumb
                      storagePath={f.storagePath}
                      mimeType={f.mimeType}
                      fileName={f.name}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[14px] truncate">
                      {f.name}
                    </span>
                    <span className="text-[10px] font-semibold text-gri-500 uppercase tracking-wide">
                      Tasarım {f.slotIndex + 1}
                    </span>
                    {f.pendingLink ? (
                      <span className="inline-flex items-center h-[20px] px-1.5 rounded-full bg-mavi-soft text-mavi-koyu text-[11px] font-bold">
                        Bağlanıyor
                      </span>
                    ) : hasError ? (
                      <span className="inline-flex items-center h-[20px] px-1.5 rounded-full bg-kirmizi/10 text-kirmizi text-[11px] font-bold">
                        {c.aiFlagBadge}
                      </span>
                    ) : hasWarning ? (
                      <span className="inline-flex items-center h-[20px] px-1.5 rounded-full bg-sari-soft text-sari-koyu text-[11px] font-bold">
                        {c.warnBadge}
                      </span>
                    ) : (
                      <span className="inline-flex items-center h-[20px] px-1.5 rounded-full bg-yesil-soft text-yesil text-[11px] font-bold">
                        {c.aiPassBadge}
                      </span>
                    )}
                  </div>
                  {(sizeMb || date) && (
                    <div className="text-[12px] text-gri-700 mt-0.5">
                      {sizeMb ? `${sizeMb} MB` : null}
                      {sizeMb && date ? " · " : null}
                      {date}
                      {(sizeMb || date) && ` · ${statusIcon}`}
                    </div>
                  )}
                  {f.pendingLink && (
                    <p className="text-[12px] text-gri-600 mt-1 leading-relaxed">
                      Dosya siparişe bağlanıyor — birkaç saniye içinde hazır
                      olur.
                    </p>
                  )}
                  <div className="mt-2 space-y-1">
                    {f.flags.map((fl, i) => (
                      <div
                        key={i}
                        className="text-[12px] flex items-start gap-1.5"
                      >
                        <span
                          className={cn(
                            fl.kind === "ok" && "text-yesil",
                            fl.kind === "warning" && "text-sari-koyu",
                            fl.kind === "error" && "text-kirmizi"
                          )}
                        >
                          {fl.kind === "ok"
                            ? "✓"
                            : fl.kind === "warning"
                              ? "⚠"
                              : "✗"}
                        </span>
                        <span className="text-gri-700 leading-relaxed">
                          {fl.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Sefa 22 May v68: "Kaldır" butonu kaldırıldı. Müşteri
                    tasarımı silemez (kazara silinme + üretim akışı koruması);
                    değiştirmek isterse üstteki "Yeni versiyon yükle" butonu
                    yeni versiyon olarak kayıt yapar, eskisi geçmişte tutulur
                    (Mig 003 superseded mantığı + OrderDesignHistory accordion).
                */}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-[11.5px] text-gri-500">
        <Icon.Info size={12} />
        <span>{c.mockUploadNote}</span>
      </div>
    </Card>
  );
}
