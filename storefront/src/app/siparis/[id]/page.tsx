/**
 * Pim Etiket — /siparis/[id] (E.2.2)
 *
 * Sipariş detayı dynamic route. Statü timeline + dosya yükleme +
 * prova onay + ürün özeti + adres + ödeme + kargo takip.
 *
 * Mock data — gerçek bağlantı I adımında.
 */

"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pim, PimMini } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, Skeleton, StageDot, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  fetchCustomerOrder,
  type CustomerOrder,
} from "@/lib/customer-order";
import { ensureAuthBindings } from "@/lib/customer-cart";
import { DesignThumb } from "@/components/cart/DesignThumb";
import { buildSummaryItems } from "@/lib/order-summary";
import { reorderFromOrder } from "@/lib/customer-reorder";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { isLoggedInSync } from "@/lib/supabase/auth-bridge";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  STORAGE_BUCKET,
} from "@/lib/storage/design-files";
import type { OrderStatus } from "@/lib/order";
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
    designEmptyTitle: "Henüz tasarım yüklemedin",
    designEmptyDesc:
      "PDF, AI, EPS, PSD, PNG, JPG, SVG kabul ederim. Yükledikten sonra Pim AI saniyeler içinde DPI / CMYK / boşluk kontrolü yapar.",
    aiFlagBadge: "AI flag",
    warnBadge: "Uyarı",
    aiPassBadge: "AI geçti",
    remove: "Kaldır",
    confirmRemove: "Bu dosya silinsin mi?",
    mockUploadNote: (
      <>
        Mock yükleme — gerçek dosya storage Faz 2&rsquo;de Supabase Storage ile
        aktif olacak.
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
      { id: "ai", label: "AI kontrol" },
      { id: "operator", label: "Operatör onayı" },
      { id: "prova", label: "Prova bekleniyor" },
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
    designEmptyTitle: "No design uploaded yet",
    designEmptyDesc:
      "Accepts PDF, AI, EPS, PSD, PNG, JPG, SVG. Once uploaded, Pim AI runs DPI / CMYK / margin checks in seconds.",
    aiFlagBadge: "AI flag",
    warnBadge: "Warning",
    aiPassBadge: "AI passed",
    remove: "Remove",
    confirmRemove: "Delete this file?",
    mockUploadNote: (
      <>
        Mock upload — real file storage will be active in Phase 2 with Supabase
        Storage.
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
      { id: "operator", label: "Operator approval" },
      { id: "prova", label: "Awaiting proof" },
      { id: "uretim", label: "In production" },
      { id: "kargo", label: "In transit" },
      { id: "teslim", label: "Delivered" },
    ],
  },
};

/** OrderStatus → PHASES index map */
function statusToPhaseIndex(status: OrderStatus): number {
  switch (status) {
    case "paid":
      return 1;
    case "qc_pending":
      return 3;
    case "qc_flagged":
    case "operator_review":
      return 4;
    case "proof_pending":
      return 5;
    case "proof_approved":
      return 6;
    case "in_production":
      return 6;
    case "shipped":
      return 7;
    case "delivered":
      return 8;
    default:
      return 1;
  }
}

const fmtUnit = (n: number) => n.toFixed(2).replace(".", ",");

export default function SiparisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;

  const [proofApproved, setProofApproved] = useState(false);
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [hydrated, setHydrated] = useState(false);
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
  const [proofResponding, setProofResponding] = useState(false);

  const respondToProof = async (action: "approve" | "request_change") => {
    if (proofResponding) return;
    setProofResponding(true);
    try {
      let note: string | null = null;
      if (action === "request_change") {
        note = prompt(
          "Hangi değişikliği istiyorsun? (Opsiyonel, kısa not):"
        );
        if (note === null) {
          // İptal
          setProofResponding(false);
          return;
        }
      }
      const res = await fetch(`/api/orders/${id}/proof-respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "İşlem başarısız");
        return;
      }
      if (action === "approve") {
        setProofApproved(true);
        toast.success("Provayı onayladın — sipariş üretime gönderildi 🎉");
      } else {
        toast.success("Değişiklik talebin operatöre iletildi");
      }
      // Order'ı yenile
      void fetchCustomerOrder(id).then((o) => o && setOrder(o));
    } catch (e) {
      console.error("[proof-respond]", e);
      toast.error("Bağlantı hatası");
    } finally {
      setProofResponding(false);
    }
  };

  // Sefa 17 May Migration 045: kargo bilgisi
  const [shipment, setShipment] = useState<CustomerShipment | null>(null);
  // Sefa 18 May Migration 052: kargo durum geçmişi (Yurtiçi poll)
  const [shipmentTimeline, setShipmentTimeline] = useState<
    ShipmentTimelineEvent[]
  >([]);

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

    // Design dosyası yüklü mü? Status trigger gecikmiş olsa bile UI
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

  const handleReorder = async () => {
    if (!order) return;
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
  const deliveryDate = order.estimatedDelivery
    ? new Date(order.estimatedDelivery).toLocaleDateString(c.locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";
  // Phase: status'a bakar, ama dosya zaten yüklendiyse "Dosya yüklendi"
  // adımını minimum aktif say (status trigger yansımamış olabilir — race
  // koşulu veya Migration sıralaması — UI gerçekliği yansıtmalı).
  const phaseIdx = Math.max(
    statusToPhaseIndex(order.status),
    hasUploadedDesign ? 2 : 0
  );

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
                <strong className="text-lacivert">{deliveryDate}</strong>
              </span>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={handleReorder}
            disabled={reordering}
          >
            <Icon.Bolt size={14} />{" "}
            {reordering ? "Ekleniyor..." : c.reorder}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
          {/* MAIN */}
          <div className="flex flex-col gap-6">
            {/* Vertical timeline */}
            <Card padding="p-6">
              <h2 className="text-xl font-semibold mb-5">{c.journeyTitle}</h2>
              <ol className="flex flex-col gap-0">
                {c.phases.map((p, i) => {
                  const state =
                    i < phaseIdx ? "done" : i === phaseIdx ? "curr" : "todo";
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
                              i < phaseIdx
                                ? "var(--color-yesil)"
                                : "var(--color-gri-200)",
                          }}
                        />
                      )}
                      <StageDot
                        state={state}
                        label={state === "curr" ? i + 1 : i + 1}
                      />
                      <div className="flex-1 pt-0.5">
                        <div
                          className={cn(
                            "font-semibold text-[15px]",
                            state === "todo" && "text-gri-500"
                          )}
                        >
                          {p.label}
                        </div>
                        {state === "curr" && (
                          <div className="text-[13px] text-gri-700 mt-0.5">
                            {c.nextStepHint}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            {/* Proof canvas — current phase'e göre */}
            {phaseIdx === 5 && !proofApproved && (
              <Card padding="" className="!p-0 overflow-hidden">
                <div className="bg-gradient-to-br from-pim-mercan-tint to-krem-soft p-6 border-b border-gri-200">
                  <div className="flex gap-4 items-start">
                    <PimMini pose="inspect" size={56} />
                    <div className="flex-1">
                      <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-pim-mercan">
                        {c.proofActionRequired}
                      </div>
                      <h3 className="font-semibold text-xl mt-1.5">
                        {c.proofTitle}
                      </h3>
                      <p className="text-[14px] text-gri-700 mt-2 leading-relaxed">
                        {c.proofDesc}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Mock proof canvas */}
                <div className="bg-gri-100 p-4 md:p-8 grid place-items-center min-h-[280px]">
                  <div className="bg-white rounded-lg shadow-2 p-6 max-w-[360px] w-full">
                    <div className="aspect-[4/5] bg-krem rounded-md grid place-items-center mb-3">
                      <div className="text-center">
                        <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-lacivert/60 mb-1">
                          {order.items[0]?.title.split("·")[0].trim() ?? "—"}
                        </div>
                        <div className="text-[22px] font-bold text-lacivert">
                          {order.address.name.split(" ")[0]}
                        </div>
                        <div className="text-[10px] text-gri-700 mt-1">
                          {c.proofMockChips}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between text-[11px] text-gri-500">
                      <span>
                        {order.items[0]?.width}×{order.items[0]?.height}mm
                      </span>
                      <span>{c.proofPreviewSize}</span>
                    </div>
                  </div>
                </div>
                <div className="p-6 border-t border-gri-200 bg-white">
                  <p className="text-[13px] text-gri-700 leading-relaxed mb-4">
                    <strong className="text-lacivert">{c.proofColorWarn}</strong>{" "}
                    {c.proofColorWarnText}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="primary"
                      onClick={() => void respondToProof("approve")}
                      disabled={proofResponding}
                      className="!bg-yesil hover:!bg-yesil-koyu"
                    >
                      <Icon.Check size={14} /> {c.proofApprove}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void respondToProof("request_change")}
                      disabled={proofResponding}
                    >
                      {c.proofRequestChange}
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            {proofApproved && (
              <div className="rounded-2xl p-6 bg-yesil-soft ring-1 ring-yesil/30 flex gap-4 items-center">
                <div className="grid place-items-center w-12 h-12 rounded-full bg-yesil text-white shrink-0">
                  <Icon.Check size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base">
                    {c.proofApprovedTitle}
                  </h3>
                  <p className="text-[13px] text-gri-700 mt-0.5">
                    {c.proofApprovedDesc}
                  </p>
                </div>
              </div>
            )}

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

            {/* File upload card */}
            <DesignUploadCard orderId={order.id} c={c} />

            {/* Tasarım versiyon geçmişi — 2+ versiyon varsa otomatik gösterir */}
            <OrderDesignHistory orderId={order.id} />
          </div>

          {/* SIDE — özet bilgileri */}
          <div className="flex flex-col gap-4">
            {/* Order summary */}
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-4">{c.summaryTitle}</h3>
              <ul className="flex flex-col gap-3 text-[13px]">
                {/* Sefa 21 May v68: Sipariş özetinde DesignThumb (gerçek
                    tasarım önizlemesi) + buildSummaryItems (basamak basamak
                    özet — konfigüratör İşlem Özeti ile aynı format). */}
                {order.items.map((item) => {
                  const summaryItems = buildSummaryItems(
                    item,
                    c.locale === "en-US" ? "en" : "tr"
                  );
                  return (
                    <li
                      key={item.id}
                      className="pb-3 border-b border-gri-100 last:border-0 last:pb-0"
                    >
                      <div className="flex gap-3 items-start">
                        <DesignThumb
                          previewUrl={item.designPreviewUrl}
                          fileName={item.designFileName}
                          mimeType={item.designMimeType}
                          product={item.product}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between gap-3 items-baseline">
                            <span className="font-semibold text-lacivert text-[13.5px] truncate flex-1 min-w-0">
                              {item.title}
                            </span>
                            <span className="font-semibold tabular-nums shrink-0">
                              {fmt(item.total)} {c.currency}
                            </span>
                          </div>
                          {/* Basamak basamak özet — her bir konfigüratör
                              seçimi tek satır */}
                          {summaryItems.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-gri-700">
                              {summaryItems.map((s, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span aria-hidden="true" className="shrink-0">
                                    {s.icon}
                                  </span>
                                  <span>
                                    <span className="text-gri-500">
                                      {s.label}:
                                    </span>{" "}
                                    <span className="font-medium text-lacivert">
                                      {s.value}
                                    </span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="text-[11.5px] text-gri-500 mt-1.5 tabular-nums">
                            {fmtUnit(item.unit)} {c.currency} × {item.qty.toLocaleString(c.locale)} {c.pcs}
                          </div>
                        </div>
                      </div>
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
                {/* Henüz kargoya verilmemiş bilgisi */}
                {!shipment && order.status !== "delivered" && (
                  <div className="mt-3 pt-3 border-t border-gri-200 text-[11.5px] text-gri-500 italic leading-relaxed">
                    ℹ {c.shipmentNotShipped}
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
                <div className="text-[11.5px] text-gri-500 mt-2">
                  {c.invoice}: {INVOICE_LABEL[order.invoice.type]}
                </div>
              </div>
            </Card>

            {/* Pim help */}
            <Card padding="p-5" className="!bg-krem">
              <div className="flex gap-3 items-center">
                <Pim pose="chat" size={64} bob={false} />
                <div>
                  <div className="font-bold text-sm">{c.pimAskTitle}</div>
                  <div className="text-[11.5px] text-gri-700 mt-0.5">
                    {c.pimAskSub}
                  </div>
                  <button className="text-[12.5px] font-semibold text-pim-mercan mt-2 hover:underline">
                    {c.openChat}
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
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
}

const STORAGE_KEY_FILES = "pim_design_files_v1";

function loadFiles(orderId: string): UploadedFile[] {
  if (typeof window === "undefined") return [];
  try {
    const all = JSON.parse(
      localStorage.getItem(STORAGE_KEY_FILES) ?? "{}"
    ) as Record<string, UploadedFile[]>;
    return all[orderId] ?? [];
  } catch {
    return [];
  }
}

function saveFiles(orderId: string, files: UploadedFile[]): void {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(
      localStorage.getItem(STORAGE_KEY_FILES) ?? "{}"
    ) as Record<string, UploadedFile[]>;
    all[orderId] = files;
    localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(all));
  } catch {
    // ignore
  }
}

interface DbFileRow {
  id: string;
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

// ============================================================
// DesignFileThumb — raster tasarımlar için preview thumbnail.
// Sefa 21 May v68 (E sorun fix): /siparis/[id] sayfasında dosya yüklenmiş
// ama önizleme gözükmüyordu — sadece Icon.Box rendered. Bu component
// storagePath ile Supabase Storage'tan signed URL alır, image render eder.
// SVG/PDF/AI/EPS (vector) için fallback Icon.Box kalır.
// ============================================================
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
  c,
}: {
  orderId: string;
  c: typeof COPY.tr | typeof COPY.en;
}) {
  const [files, setFiles] = useState<Array<UploadedFile & { id?: string; status?: string }>>([]);
  const [hydrated, setHydrated] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Auth mode: DB; Guest mode: localStorage
  const refreshDb = async () => {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("design_files")
      .select("*")
      .eq("order_id", orderId)
      .neq("status", "superseded")
      .order("uploaded_at", { ascending: false });
    if (error) {
      console.error("[design] list error:", error);
      return;
    }
    setFiles((data as unknown as DbFileRow[]).map(dbRowToUploaded));
  };

  useEffect(() => {
    if (isLoggedInSync()) {
      void refreshDb().finally(() => setHydrated(true));
      // Polling — AI check tamamlanınca status değişecek
      const interval = setInterval(() => {
        if (files.some((f) => f.status === "analyzing")) {
          void refreshDb();
        }
      }, 3000);
      return () => clearInterval(interval);
    } else {
      setFiles(loadFiles(orderId));
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

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
      const initRes = await fetch("/api/design/upload-init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId,
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
      saveFiles(orderId, next as UploadedFile[]);
      setAnalyzing(false);
    }, 1500);
  };

  const handleRemove = async (file: UploadedFile & { id?: string }) => {
    if (!confirm(c.confirmRemove)) return;
    if (isLoggedInSync() && file.id) {
      const supabase = createSupabaseClient();
      const { error } = await supabase
        .from("design_files")
        .delete()
        .eq("id", file.id);
      if (error) {
        alert(`Silinemedi: ${error.message}`);
        return;
      }
      await refreshDb();
    } else {
      const next = files.filter((f) => f.name !== file.name);
      setFiles(next);
      saveFiles(orderId, next as UploadedFile[]);
    }
  };

  if (!hydrated) return null;

  return (
    <Card padding="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{c.designTitle}</h2>
        <label className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-full bg-pim-mercan text-white text-[13px] font-semibold cursor-pointer hover:bg-pim-mercan-koyu transition-colors">
          <Icon.Plus size={14} />
          {analyzing ? c.uploading : c.uploadCta}
          <input
            type="file"
            className="hidden"
            accept=".pdf,.ai,.eps,.psd,.png,.jpg,.jpeg,.svg"
            onChange={handleRealUpload}
            disabled={analyzing}
          />
        </label>
      </div>

      {files.length === 0 ? (
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
          {files.map((f) => {
            const date = new Date(f.uploadedAt).toLocaleString(c.locale, {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });
            const sizeKb = (f.size / 1024).toFixed(1);
            const hasError = f.flags.some((fl) => fl.kind === "error");
            const hasWarning = f.flags.some((fl) => fl.kind === "warning");
            return (
              <div
                key={f.name}
                className="flex items-start gap-3 p-4 rounded-lg bg-gri-50 ring-1 ring-gri-200"
              >
                <DesignFileThumb
                  storagePath={f.storagePath}
                  mimeType={f.mimeType}
                  fileName={f.name}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[14px] truncate">
                      {f.name}
                    </span>
                    {hasError ? (
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
                  <div className="text-[12px] text-gri-700 mt-0.5">
                    {sizeKb} KB · {date}
                  </div>
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
                <button
                  type="button"
                  onClick={() => handleRemove(f)}
                  className="text-gri-500 hover:text-kirmizi text-[12px] font-semibold shrink-0"
                  aria-label={c.remove}
                >
                  {c.remove}
                </button>
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
