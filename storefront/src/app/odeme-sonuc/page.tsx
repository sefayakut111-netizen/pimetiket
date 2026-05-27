/**
 * Pim Etiket — /odeme-sonuc (E.2.3)
 *
 * Ödeme sonrası dönüş sayfası: ?status=success|fail&order=PE-XXX
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import { fetchCustomerOrder, type CustomerOrder } from "@/lib/customer-order";
import { ensureAuthBindings } from "@/lib/customer-cart";

const EXTRA = {
  tr: {
    failTitle: "Ödeme alınamadı",
    failDesc:
      "Bankadan onay gelmedi. Kart bilgilerini kontrol edip tekrar denemen gerekiyor. Tutar hesabından çekilmedi.",
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
  },
  en: {
    failTitle: "Payment failed",
    failDesc:
      "We didn't get bank approval. Please check your card details and try again. Your account hasn't been charged.",
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
  useEffect(() => {
    if (isPendingVerification) return;
    if (!hasValidOrderId) return;
    ensureAuthBindings();

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      const o = await fetchCustomerOrder(orderId);
      if (cancelled || !o) return;
      setOrder(o);
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
    (order != null &&
      (order.status === "qc_pending" ||
        order.status === "proof_pending" ||
        order.status === "proof_generating" ||
        order.status === "proof_validating" ||
        order.status === "human_review" ||
        order.status === "proof_approved" ||
        order.status === "in_production" ||
        order.status === "ready_to_ship" ||
        order.status === "fason_assigned" ||
        order.status === "shipped" ||
        order.status === "delivered"));

  if (status === "fail") {
    const reason = sp.get("reason");
    const isPspUnavailable = reason === "psp_unavailable";
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <Pim pose={isPspUnavailable ? "think" : "sad"} size={160} />
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            {isPspUnavailable ? x.pspUnavailableTitle : x.failTitle}
          </h1>
          <p className="mt-3 text-base text-gri-700 leading-relaxed">
            {isPspUnavailable ? x.pspUnavailableDesc : x.failDesc}
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
            {locale === "en" ? "Order not found" : "Sipariş bulunamadı"}
          </h1>
          <p className="mt-4 text-base text-gri-700 leading-relaxed">
            {locale === "en"
              ? "The payment return link is incomplete. Check My Orders for your recent purchase."
              : "Ödeme dönüş bağlantısı eksik. Son siparişini Siparişlerim sayfasından kontrol edebilirsin."}
          </p>
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <Button variant="primary" size="lg" href="/siparislerim">
              {t.orderSuccess.orderDetail}
            </Button>
            <Button variant="secondary" size="lg" href="/sepet">
              {locale === "en" ? "Back to cart" : "Sepete dön"}
            </Button>
          </div>
        </div>
      </main>
    );
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
            {order.estimatedDelivery && (
              <div className="mt-4 pt-3 border-t border-gri-200 text-[12.5px] text-gri-700 flex justify-between">
                <span>{t.orderSuccess.estimatedDelivery}</span>
                <span className="font-semibold text-lacivert">
                  {new Date(order.estimatedDelivery).toLocaleDateString(
                    x.locale,
                    { day: "numeric", month: "long", year: "numeric" }
                  )}
                </span>
              </div>
            )}
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
              const s = order?.status ?? "awaiting_upload";
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

              // Dinamik step 2 başlığı — status'a göre nuance
              const step2Title =
                s === "proof_generating"
                  ? "Bıçak çizimi hazırlanıyor"
                  : s === "qc_flagged"
                    ? "AI ön-kontrol uyarısı"
                    : s === "operator_review" || s === "human_review"
                      ? "Operatör inceliyor"
                      : "Sistem hazırlığı (AI + bıçak)";
              const step2Desc =
                s === "proof_generating"
                  ? "AI ön-kontrol geçti, otomatik bıçak çizimi 5 dakika içinde hazır. Sipariş detayında ilerlemeyi izleyebilirsin."
                  : s === "operator_review" || s === "human_review"
                    ? "Operatörümüz tasarımını manuel kontrol ediyor. 24 saat içinde sonuçlanır."
                    : "AI ön-kontrol + otomatik bıçak çizimi hazırlanır. Genelde 5-30 dakika sürer.";

              // Dinamik step 4 başlığı — Sefa 22 May v68:
              // "Kapına teslim" yerine sipariş aşamasını net yansıt.
              const step4Title =
                s === "delivered"
                  ? "Teslim edildi"
                  : s === "shipped"
                    ? "Kargoda — yolda"
                    : s === "in_production" ||
                        s === "fason_assigned" ||
                        s === "ready_to_ship"
                      ? "İşleminiz üretiliyor"
                      : s === "proof_approved"
                        ? "Üretime alındı"
                        : "Üretim ve kapına teslim";
              const step4Desc =
                s === "delivered"
                  ? "Sipariş teslim edildi. Tekrar siparişin için panelime gel."
                  : s === "shipped"
                    ? "Sipariş kargoya verildi. Detayda kargo takip numarasını görebilirsin."
                    : s === "in_production" ||
                        s === "fason_assigned" ||
                        s === "ready_to_ship"
                      ? "Üretim atölyemizde baskıda. 5 iş günü içinde kargoya verilir."
                      : s === "proof_approved"
                        ? "Onayın alındı, üretim kuyruğuna düştü. Kısa süre içinde baskı başlar."
                        : "Prova onayı sonrası baskı → 5 iş günü kargo → kapına teslim.";

              return (
                <>
                  <li className="flex gap-3.5 items-start">
                    <StepIcon state={stateFor(1)} num={1} />
                    <div>
                      <div className="font-semibold text-base">
                        {stateFor(1) === "done"
                          ? "Tasarım yüklendi"
                          : t.orderSuccess.step1Title}
                      </div>
                      <p className="text-[13px] text-gri-700 mt-0.5 leading-relaxed">
                        {stateFor(1) === "done"
                          ? "Sistem ön-kontrolü için tasarımını teslim aldı."
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
                            Provayı İncele →
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
                  ? locale === "en"
                    ? "Your proof is ready — review and approve your print preview."
                    : "Provan hazır — baskı önizlemesini inceleyip onaylayabilirsin."
                  : locale === "en"
                    ? "Your design is uploaded — AI quality check is starting. This usually takes 30–60 seconds."
                    : "Tasarımın yüklendi — AI kalite kontrolü başlıyor. Genelde 30–60 saniye sürer."}
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                {orderReadyForProof ? (
                  <Button variant="primary" size="lg" href={`/onay/${orderId}`}>
                    {locale === "en" ? "Review proof →" : "Provayı incele →"}
                  </Button>
                ) : null}
                <Button
                  variant={orderReadyForProof ? "secondary" : "primary"}
                  size="lg"
                  href={`/siparis/${orderId}`}
                >
                  {locale === "en" ? "View order details →" : "Sipariş detayını gör →"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[14px] text-gri-700">
                {locale === "en"
                  ? "Order created! Upload your design file now — AI will check it and prepare the print proof."
                  : "Siparişin oluştu! Şimdi tasarım dosyanı yükle — AI kontrol edecek ve baskı provası hazırlanacak."}
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button
                  variant="primary"
                  size="lg"
                  href={`/siparis/${orderId}/tasarim-yukle`}
                >
                  📁{" "}
                  {locale === "en" ? "Upload design →" : "Tasarım yükle →"}
                </Button>
                <Button variant="ghost" size="lg" href={`/siparis/${orderId}`}>
                  {locale === "en"
                    ? "Upload later — order details"
                    : "Sonra yükleyeceğim — sipariş detayı"}
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
