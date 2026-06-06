/**
 * Pim Etiket — /odeme-sonuc (E.2.3)
 *
 * Ödeme sonrası dönüş sayfası: ?status=success|fail&order=PE-XXX
 */

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import { fetchCustomerOrder, type CustomerOrder } from "@/lib/customer-order";
import { isPreProductionDeliveryStatus } from "@/lib/order";
import {
  ensureAuthBindings,
  clearCustomerCart,
  refreshCustomerCart,
} from "@/lib/customer-cart";
import { track } from "@/lib/analytics/posthog-events";
import { mapApiError } from "@/lib/api-error-messages";
import { ga4Purchase } from "@/lib/analytics/ga4-events";

const EXTRA = {
  tr: {
    failTitle: "Ödeme alınamadı",
    failDesc:
      "Bankadan onay gelmedi veya ödeme tamamlanamadı. Kart bilgilerini kontrol edip tekrar deneyebilirsin.",
    failDescCharged:
      "Ödemen alınmış olabilir ama sipariş oluşturulamadı. Destek ekibimiz bilgilendirildi — kısa sürede dönüş yapacağız veya siparişlerimden kontrol edebilirsin.",
    pspUnavailableTitle: "Ödeme şu an alınamıyor",
    pspUnavailableDesc:
      "PayTR ödeme altyapımızda geçici bir sorun olabilir. Birkaç dakika sonra tekrar dene. Acil siparişin varsa e-posta veya iletişim formundan bize yaz — fiyatı manuel hazırlarız, havale ile başlatırız.",
    pspWhatsApp: "E-posta gönder",
    retry: "Tekrar dene",
    contact: "Bize yaz",
    contactFooter: (
      <>
        Soru olursa{" "}
        <a
          href="/iletisim"
          className="text-pim-mercan font-semibold hover:underline"
        >
          bize yaz
        </a>{" "}
        veya sağ alt köşedeki Pim&rsquo;e sor.
      </>
    ),
    times: "×",
    currency: "₺",
    locale: "tr-TR",
    verifyingTitle: "Ödemen doğrulanıyor",
    verifyingDesc:
      "Bankadan onay alındı, siparişini oluşturuyoruz. Bu birkaç saniye sürebilir.",
    verifyingTimeout:
      "Doğrulama beklenenden uzun sürüyor. Sayfayı yenile veya birkaç dakika sonra siparişlerimden kontrol et.",
    refresh: "Sayfayı yenile",
    deliveryPending: "Tasarım onayından sonra hesaplanır",
  },
  en: {
    failTitle: "Payment failed",
    failDesc:
      "We didn't get bank approval. Please check your card details and try again.",
    failDescCharged:
      "Your payment may have gone through but the order could not be created. Support has been notified — check My Orders shortly or contact us.",
    pspUnavailableTitle: "Payment temporarily unavailable",
    pspUnavailableDesc:
      "There may be a temporary issue with our PayTR payment infrastructure. Try again in a few minutes. For urgent orders, message us via email or the contact form — we'll prepare the quote manually and accept bank transfer.",
    pspWhatsApp: "Send email",
    retry: "Try again",
    contact: "Contact us",
    contactFooter: (
      <>
        Got a question?{" "}
        <a
          href="/iletisim"
          className="text-pim-mercan font-semibold hover:underline"
        >
          Reach out
        </a>{" "}
        or chat with Pim at the bottom-right.
      </>
    ),
    times: "×",
    currency: "TRY",
    locale: "en-US",
    verifyingTitle: "Verifying your payment",
    verifyingDesc:
      "Bank approval received — we're creating your order. This may take a few seconds.",
    verifyingTimeout:
      "Verification is taking longer than expected. Refresh the page or check My Orders in a few minutes.",
    refresh: "Refresh page",
    deliveryPending: "Calculated after design approval",
  },
};

export default function OdemeSonucPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-64px)]" />}>
      <OdemeSonucInner />
    </Suspense>
  );
}

function OdemeSonucInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { t, locale } = useT();
  const x = locale === "en" ? EXTRA.en : EXTRA.tr;
  const fmt = (n: number) => Math.round(n).toLocaleString(x.locale);

  const status = sp.get("status") ?? "success";
  const oid = sp.get("oid");
  const orderParam = sp.get("order");
  const orderIdParam = orderParam ?? "";
  const hasDesignsParam = sp.get("hasDesigns") === "true";
  const isPendingVerification =
    status === "success" && orderIdParam === "pending" && Boolean(oid);
  const hasValidOrderId =
    Boolean(orderIdParam) && orderIdParam !== "pending";

  const [resolvedOrderId, setResolvedOrderId] = useState(orderIdParam);
  const [verifyTimedOut, setVerifyTimedOut] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem("pim_checkout_init_lock");
    } catch {
      /* ignore */
    }
    if (status === "fail") {
      void fetch("/api/payment/abandon", { method: "POST" }).catch(() => {});
    }
  }, [status]);

  useEffect(() => {
    if (!isPendingVerification || !oid) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 45; // 2sn × 45 = ~90sn (PayTR durum sorgu gecikmesi)

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(
          `/api/payment/status?oid=${encodeURIComponent(oid)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          status?: string;
          orderId?: string;
          reason?: string;
          hasDesigns?: boolean;
        };

        if (cancelled) return;

        if (data.status === "consumed" && data.orderId) {
          setResolvedOrderId(data.orderId);
          const hasDesigns =
            data.hasDesigns === true || sp.get("hasDesigns") === "true";
          router.replace(
            `/odeme-sonuc?status=success&order=${encodeURIComponent(data.orderId)}&hasDesigns=${hasDesigns}`
          );
          return;
        }

        if (data.status === "failed") {
          router.replace(
            `/odeme-sonuc?status=fail&reason=${encodeURIComponent(
              data.reason ?? "payment_failed"
            )}`
          );
        }
      } catch {
        // sessiz — sonraki poll dener
      }

      if (attempts >= maxAttempts) {
        setVerifyTimedOut(true);
      }
    };

    void poll();
    const interval = setInterval(() => {
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        return;
      }
      void poll();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isPendingVerification, oid, router]);

  const orderId = resolvedOrderId;

  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [orderLoading, setOrderLoading] = useState(hasValidOrderId);
  const [orderFetchTimedOut, setOrderFetchTimedOut] = useState(false);
  const purchaseTracked = useRef(false);
  const failTracked = useRef(false);
  const cartCleared = useRef(false);

  useEffect(() => {
    if (status !== "fail" || failTracked.current) return;
    failTracked.current = true;
    track("payment_failed", {
      reason: sp.get("reason") ?? "payment_failed",
    });
  }, [status, sp]);

  useEffect(() => {
    if (!order || purchaseTracked.current || status !== "success") return;
    const postPaid =
      order.status === "paid" ||
      order.status === "awaiting_upload" ||
      order.status === "qc_pending" ||
      order.status === "proof_pending" ||
      order.status === "proof_generating" ||
      order.status === "proof_validating" ||
      order.status === "human_review" ||
      order.status === "proof_approved" ||
      order.status === "in_production" ||
      order.status === "ready_to_ship" ||
      order.status === "fason_assigned" ||
      order.status === "shipped" ||
      order.status === "delivered";
    if (!postPaid) return;

    purchaseTracked.current = true;
    track("purchase", {
      order_id: order.id,
      total: order.total,
      subtotal: order.subtotal,
      shipping: order.shipping,
      item_count: order.items.length,
      payment_method: order.payment.method,
      source: "paytr_return",
    });

    ga4Purchase(
      order.id,
      order.total,
      order.items.map((item) => ({
        item_id: item.product,
        item_name: item.title,
        quantity: item.qty,
        price: item.unit,
      }))
    );
  }, [order, status]);

  useEffect(() => {
    if (isPendingVerification) return;
    if (!hasValidOrderId) return;
    ensureAuthBindings();

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (orderId && orderId !== "pending") {
        try {
          await fetch(`/api/orders/${orderId}/upload-status`, {
            cache: "no-store",
          });
        } catch {
          /* promote kurtarma — sessiz */
        }
      }
      const o = await fetchCustomerOrder(orderId);
      if (cancelled) return;
      if (!o) return;
      setOrder(o);
      setOrderLoading(false);
      if (!cartCleared.current) {
        cartCleared.current = true;
        void clearCustomerCart().then(() => refreshCustomerCart());
      }
      const terminal =
        o.status === "proof_pending" ||
        o.status === "proof_generating" ||
        o.status === "proof_validating" ||
        o.status === "human_review" ||
        o.status === "proof_approved";
      if (terminal && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    void poll();
    intervalId = setInterval(() => {
      if (cancelled) return;
      void poll();
    }, 3000);

    const timeout = setTimeout(() => {
      if (intervalId) clearInterval(intervalId);
      if (!cancelled) {
        setOrderFetchTimedOut(true);
        setOrderLoading(false);
      }
    }, 120000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      clearTimeout(timeout);
    };
  }, [orderId, isPendingVerification, hasValidOrderId]);

  const orderReadyForProof =
    order?.status === "proof_pending" ||
    order?.status === "proof_generating" ||
    order?.status === "proof_validating";

  const orderHasDesigns =
    hasDesignsParam ||
    order?.status === "qc_pending" ||
    order?.status === "qc_flagged" ||
    order?.status === "proof_pending" ||
    order?.status === "proof_generating" ||
    order?.status === "proof_validating" ||
    order?.status === "human_review" ||
    order?.status === "human_review_failed" ||
    order?.status === "operator_review" ||
    order?.status === "operator_print_review" ||
    order?.status === "proof_approved" ||
    order?.status === "in_production" ||
    order?.status === "ready_to_ship" ||
    order?.status === "fason_assigned" ||
    order?.status === "shipped" ||
    order?.status === "delivered";

  if (status === "fail") {
    const reason = sp.get("reason");
    const isPspUnavailable = reason === "psp_unavailable";
    const mayBeCharged =
      reason === "amount_mismatch" ||
      (reason?.startsWith("RPC error") ?? false) ||
      reason === "rpc_finalize_failed";
    const failMessage = isPspUnavailable
      ? x.pspUnavailableDesc
      : mayBeCharged
        ? x.failDescCharged
        : mapApiError(reason, locale === "en" ? "en" : "tr", x.failDesc);
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <Pim pose={isPspUnavailable ? "think" : "sad"} size={160} />
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            {isPspUnavailable ? x.pspUnavailableTitle : x.failTitle}
          </h1>
          <p className="mt-3 text-base text-gri-700 leading-relaxed">
            {failMessage}
          </p>
          {/* Sefa 21 May v68 — PayTR debug: müşteri bildirirken kopyalasın */}
          {!isPspUnavailable && reason && (
            <p className="mt-4 text-[12px] text-gri-500 font-mono break-all">
              <span className="font-semibold text-gri-700">teknik kod:</span>{" "}
              {reason}
            </p>
          )}
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            {isPspUnavailable ? (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  href="mailto:info@pimetiket.com?subject=Sipariş%20için%20iletişim"
                >
                  <Icon.ChatBubble size={16} /> {x.pspWhatsApp}
                </Button>
                <Button variant="secondary" size="lg" href="/iletisim">
                  {x.contact}
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" size="lg" href="/odeme">
                  {x.retry}
                </Button>
                <Button variant="secondary" size="lg" href="/iletisim">
                  <Icon.ChatBubble size={16} /> {x.contact}
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (isPendingVerification) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <Pim pose="think" size={160} />
          <div className="mt-4 flex items-center justify-center gap-2">
            <span
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pim-mercan border-t-transparent"
              aria-hidden="true"
            />
            <h1 className="text-[24px] md:text-[32px] font-semibold tracking-tight">
              {x.verifyingTitle}
            </h1>
          </div>
          <p className="mt-4 text-base text-gri-700 leading-relaxed">
            {verifyTimedOut ? x.verifyingTimeout : x.verifyingDesc}
          </p>
          {verifyTimedOut && (
            <div className="mt-6 flex gap-3 justify-center flex-wrap">
              <Button
                variant="primary"
                size="lg"
                onClick={() => window.location.reload()}
              >
                {x.refresh}
              </Button>
              <Button variant="secondary" size="lg" href="/siparislerim">
                {t.orderSuccess.orderDetail}
              </Button>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (!hasValidOrderId) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <Pim pose="think" size={160} />
          <h1 className="mt-4 text-[24px] md:text-[32px] font-semibold tracking-tight">
            {t.orderSuccess.orderNotFoundTitle}
          </h1>
          <p className="mt-4 text-base text-gri-700 leading-relaxed">
            {t.orderSuccess.orderNotFoundDesc}
          </p>
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <Button variant="primary" size="lg" href="/siparislerim">
              {t.orderSuccess.orderDetail}
            </Button>
            <Button variant="secondary" size="lg" href="/sepet">
              {t.orderSuccess.backToCart}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (orderLoading && !order) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <Pim pose="think" size={160} />
          <div className="mt-4 flex items-center justify-center gap-2">
            <span
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-pim-mercan border-t-transparent"
              aria-hidden="true"
            />
            <h1 className="text-[24px] md:text-[32px] font-semibold tracking-tight">
              {t.orderSuccess.orderLoadingTitle}
            </h1>
          </div>
          <p className="mt-4 text-base text-gri-700 leading-relaxed">
            {t.orderSuccess.orderLoadingDesc}
          </p>
          <p className="mt-3 text-[13px] text-gri-500 font-mono">{orderId}</p>
        </div>
      </main>
    );
  }

  if (orderFetchTimedOut && !order) {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <Pim pose="think" size={160} />
          <h1 className="mt-4 text-[24px] md:text-[32px] font-semibold tracking-tight">
            {t.orderSuccess.orderFetchFailTitle}
          </h1>
          <p className="mt-4 text-base text-gri-700 leading-relaxed">
            {t.orderSuccess.orderFetchFailDesc}
          </p>
          <p className="mt-3 text-[13px] text-gri-500 font-mono">{orderId}</p>
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <Button
              variant="primary"
              size="lg"
              onClick={() => window.location.reload()}
            >
              {x.refresh}
            </Button>
            <Button variant="secondary" size="lg" href="/siparislerim">
              {t.orderSuccess.orderDetail}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
      <div className="mx-auto max-w-[680px] px-6 text-center">
        <Pim pose="excited" size={180} />

        <span className="inline-flex items-center gap-1.5 mt-4 h-[26px] px-3 rounded-full bg-yesil-soft text-yesil text-[12.5px] font-semibold">
          <Icon.Check size={12} /> {t.orderSuccess.success}
        </span>

        <h1 className="mt-4 text-[32px] md:text-[44px] font-semibold tracking-tight leading-[1.1]">
          {t.orderSuccess.orderReceived}
        </h1>
        <p className="mt-4 text-lg text-gri-700 leading-relaxed">
          {t.orderSuccess.orderNumber}{" "}
          <strong className="text-lacivert font-mono">{orderId}</strong>
          <br />
          {t.orderSuccess.emailSent}
        </p>

        {order && (
          <Card padding="p-5" className="text-left mt-6">
            <div className="flex justify-between items-baseline mb-3 pb-3 border-b border-gri-200">
              <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-gri-700">
                {t.orderSuccess.summaryLabel}
              </span>
              <span className="text-xl font-bold tabular-nums">
                {fmt(order.total)}{" "}
                <span className="text-[13px] font-semibold text-gri-700">
                  {x.currency}
                </span>
              </span>
            </div>
            <div className="space-y-2.5 text-[13px]">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-lacivert">
                      {item.title}
                    </span>
                    <span className="block truncate text-[12px] text-gri-500">
                      {item.config} · {x.times}
                      {item.qty.toLocaleString(x.locale)}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums shrink-0">
                    {fmt(item.total)} {x.currency}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gri-200 text-[12.5px] text-gri-700 flex justify-between">
              <span>{t.orderSuccess.estimatedDelivery}</span>
              <span className="font-semibold text-lacivert">
                {isPreProductionDeliveryStatus(order.status)
                  ? x.deliveryPending
                  : order.estimatedDelivery
                    ? new Date(order.estimatedDelivery).toLocaleDateString(
                        x.locale,
                        { day: "numeric", month: "long", year: "numeric" }
                      )
                    : x.deliveryPending}
              </span>
            </div>
          </Card>
        )}

        <Card padding="p-7" className="text-left mt-8">
          <h3 className="font-semibold text-lg mb-4 text-center">
            {t.orderSuccess.nextStepsTitle}
          </h3>
          <ol className="space-y-4">
            {/* Sefa 22 May v68 - 4 adimli status-aware step gosterimi:
                1. Tasarim dosyasi yukle
                2. AI on-kontrol + bicak cizimi (otomatik, sistem yapar)
                3. Provayi incele ve onayla
                4. Uretim + kapina teslim

                Status -> aktif step:
                - awaiting_upload -> 1
                - paid/qc_x/operator_review/proof_generating -> 2
                - proof_pending -> 3
                - proof_approved/in_production/ready_to_ship/fason_assigned/
                  shipped -> 4
                - delivered -> tumu done */}
            {(() => {
              const s =
                hasDesignsParam && order.status === "awaiting_upload"
                  ? "qc_pending"
                  : order.status;
              const activeStep =
                s === "awaiting_upload"
                  ? 1
                  : s === "paid" ||
                      s === "qc_pending" ||
                      s === "qc_flagged" ||
                      s === "human_review" ||
                      s === "human_review_failed" ||
                      s === "operator_review" ||
                      s === "proof_generating"
                    ? 2
                    : s === "proof_pending"
                      ? 3
                      : s === "delivered"
                        ? 5 // hepsi done
                        : 4; // proof_approved, in_production, shipped, vs.

              function StepIcon({
                state,
                num,
              }: {
                state: "done" | "active" | "waiting";
                num: number;
              }) {
                if (state === "done") {
                  return (
                    <span className="grid place-items-center w-7 h-7 rounded-full bg-yesil text-white font-bold text-[13px] shrink-0">
                      <Icon.Check size={14} />
                    </span>
                  );
                }
                if (state === "active") {
                  return (
                    <span className="grid place-items-center w-7 h-7 rounded-full bg-pim-mercan text-white font-bold text-[13px] shrink-0">
                      {num}
                    </span>
                  );
                }
                return (
                  <span className="grid place-items-center w-7 h-7 rounded-full bg-gri-200 text-gri-500 font-bold text-[13px] shrink-0">
                    {num}
                  </span>
                );
              }

              function stateFor(num: number): "done" | "active" | "waiting" {
                if (num < activeStep) return "done";
                if (num === activeStep) return "active";
                return "waiting";
              }

              const os = t.orderSuccess;
              const step2Title =
                s === "proof_generating"
                  ? os.stepPrepProofGeneratingTitle
                  : s === "qc_flagged"
                    ? os.stepPrepQcFlaggedTitle
                    : s === "operator_review" || s === "human_review"
                      ? os.stepPrepOperatorTitle
                      : os.stepPrepDefaultTitle;
              const step2Desc =
                s === "proof_generating"
                  ? os.stepPrepProofGeneratingDesc
                  : s === "operator_review" || s === "human_review"
                    ? os.stepPrepOperatorDesc
                    : os.stepPrepDefaultDesc;

              const step4Title =
                s === "delivered"
                  ? os.stepDeliveryDeliveredTitle
                  : s === "shipped"
                    ? os.stepDeliveryShippedTitle
                    : s === "in_production" ||
                        s === "fason_assigned" ||
                        s === "ready_to_ship"
                      ? os.stepDeliveryProductionTitle
                      : s === "proof_approved"
                        ? os.stepDeliveryProofApprovedTitle
                        : os.stepDeliveryDefaultTitle;
              const step4Desc =
                s === "delivered"
                  ? os.stepDeliveryDeliveredDesc
                  : s === "shipped"
                    ? os.stepDeliveryShippedDesc
                    : s === "in_production" ||
                        s === "fason_assigned" ||
                        s === "ready_to_ship"
                      ? os.stepDeliveryProductionDesc
                      : s === "proof_approved"
                        ? os.stepDeliveryProofApprovedDesc
                        : os.stepDeliveryDefaultDesc;

              return (
                <>
                  <li className="flex gap-3.5 items-start">
                    <StepIcon state={stateFor(1)} num={1} />
                    <div>
                      <div className="font-semibold text-base">
                        {stateFor(1) === "done"
                          ? os.step1DoneTitle
                          : t.orderSuccess.step1Title}
                      </div>
                      <p className="text-[13px] text-gri-700 mt-0.5 leading-relaxed">
                        {stateFor(1) === "done"
                          ? os.step1DoneDesc
                          : t.orderSuccess.step1Desc}
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3.5 items-start">
                    <StepIcon state={stateFor(2)} num={2} />
                    <div>
                      <div className="font-semibold text-base">{step2Title}</div>
                      <p className="text-[13px] text-gri-700 mt-0.5 leading-relaxed">
                        {step2Desc}
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3.5 items-start">
                    <StepIcon state={stateFor(3)} num={3} />
                    <div className="flex-1">
                      <div className="font-semibold text-base">
                        {t.orderSuccess.step2Title}
                      </div>
                      <p className="text-[13px] text-gri-700 mt-0.5 leading-relaxed">
                        {t.orderSuccess.step2Desc}
                      </p>
                      {/* Sefa 22 May v68: Step 3 aktif olunca inline buton —
                          müşteri direkt prova sayfasına gitsin. */}
                      {stateFor(3) === "active" && (
                        <div className="mt-2.5">
                          <Button
                            variant="primary"
                            size="md"
                            href={`/onay/${orderId}`}
                          >
                            {os.reviewProof}
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                  <li className="flex gap-3.5 items-start">
                    <StepIcon state={stateFor(4)} num={4} />
                    <div>
                      <div className="font-semibold text-base">{step4Title}</div>
                      <p className="text-[13px] text-gri-700 mt-0.5 leading-relaxed">
                        {step4Desc}
                      </p>
                    </div>
                  </li>
                </>
              );
            })()}
          </ol>
        </Card>

        {/* Status-aware CTA — tasarım var/yok */}
        <div className="mt-8 space-y-3">
          {orderHasDesigns ? (
            <>
              <p className="text-[14px] text-gri-700">
                {orderReadyForProof
                  ? t.orderSuccess.ctaProofReady
                  : t.orderSuccess.ctaDesignUploaded}
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                {orderReadyForProof ? (
                  <Button variant="primary" size="lg" href={`/onay/${orderId}`}>
                    {t.orderSuccess.reviewProof}
                  </Button>
                ) : null}
                <Button
                  variant={orderReadyForProof ? "secondary" : "primary"}
                  size="lg"
                  href={`/siparis/${orderId}`}
                >
                  {t.orderSuccess.ctaViewOrderDetails}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[14px] text-gri-700">
                {t.orderSuccess.ctaOrderCreatedUpload}
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button
                  variant="primary"
                  size="lg"
                  href={`/siparis/${orderId}/tasarim-yukle`}
                >
                  📁 {t.orderSuccess.ctaUploadDesign}
                </Button>
                <Button variant="ghost" size="lg" href={`/siparis/${orderId}`}>
                  {t.orderSuccess.ctaUploadLater}
                </Button>
              </div>
            </>
          )}
        </div>

        <p className="mt-8 text-[13px] text-gri-500 leading-relaxed">
          {x.contactFooter}
        </p>
      </div>
    </main>
  );
}
