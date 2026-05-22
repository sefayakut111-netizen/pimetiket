/**
 * Pim Etiket — /odeme-sonuc (E.2.3)
 *
 * Ödeme sonrası dönüş sayfası: ?status=success|fail&order=PE-XXX
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const { t, locale } = useT();
  const x = locale === "en" ? EXTRA.en : EXTRA.tr;
  const fmt = (n: number) => Math.round(n).toLocaleString(x.locale);

  const status = sp.get("status") ?? "success";
  const orderId = sp.get("order") ?? "000000000000";

  const [order, setOrder] = useState<CustomerOrder | null>(null);
  useEffect(() => {
    ensureAuthBindings();
    void fetchCustomerOrder(orderId).then(setOrder);
  }, [orderId]);

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
            {/* Sefa 22 May v68 — Status-aware step gösterimi:
                - awaiting_upload → 1. adım aktif (kırmızı), 2-3 bekliyor
                - paid/qc_*/operator_review → 1. ✓, 2. aktif (Pim çalışıyor)
                - proof_generating/proof_pending → 1. ✓, 2. aktif (onayında)
                - proof_approved+/in_production+ → 1. ✓, 2. ✓, 3. aktif */}
            {(() => {
              const s = order?.status ?? "awaiting_upload";
              const designDone = s !== "awaiting_upload";
              const proofDone =
                s === "proof_approved" ||
                s === "in_production" ||
                s === "ready_to_ship" ||
                s === "fason_assigned" ||
                s === "shipped" ||
                s === "delivered";
              const proofActive =
                designDone && !proofDone;
              const shipActive = proofDone;

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

              const step1State = designDone ? "done" : "active";
              const step2State = proofDone
                ? "done"
                : proofActive
                  ? "active"
                  : "waiting";
              const step3State = shipActive ? "active" : "waiting";

              // Step 2 label dinamik: proof_generating → "Bıçak hazırlanıyor"
              const step2DynamicTitle =
                s === "proof_generating"
                  ? "Bıçak çizimi hazırlanıyor"
                  : s === "proof_pending"
                    ? "Provanı incele ve onayla"
                    : s === "qc_flagged"
                      ? "AI ön-kontrol uyarısı"
                      : t.orderSuccess.step2Title;
              const step2DynamicDesc =
                s === "proof_generating"
                  ? "AI ön-kontrol geçti, otomatik bıçak çizimi 5 dakika içinde hazır. Sipariş detayında ilerlemeyi izleyebilirsin."
                  : s === "proof_pending"
                    ? "Bıçak çizimi hazır. Sipariş detayında inceleyip onaylayabilirsin."
                    : t.orderSuccess.step2Desc;

              return (
                <>
                  <li className="flex gap-3.5 items-start">
                    <StepIcon state={step1State} num={1} />
                    <div>
                      <div className="font-semibold text-base">
                        {designDone ? "Tasarım yüklendi" : t.orderSuccess.step1Title}
                      </div>
                      <p className="text-[13px] text-gri-700 mt-0.5 leading-relaxed">
                        {designDone
                          ? "AI ön-kontrolden geçti, sistem işliyor."
                          : t.orderSuccess.step1Desc}
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3.5 items-start">
                    <StepIcon state={step2State} num={2} />
                    <div>
                      <div className="font-semibold text-base">
                        {step2DynamicTitle}
                      </div>
                      <p className="text-[13px] text-gri-700 mt-0.5 leading-relaxed">
                        {step2DynamicDesc}
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3.5 items-start">
                    <StepIcon state={step3State} num={3} />
                    <div>
                      <div className="font-semibold text-base">
                        {t.orderSuccess.step3Title}
                      </div>
                      <p className="text-[13px] text-gri-700 mt-0.5 leading-relaxed">
                        {t.orderSuccess.step3Desc}
                      </p>
                    </div>
                  </li>
                </>
              );
            })()}
          </ol>
        </Card>

        {/* Sefa 22 May v68 — CTA tam status-aware:
            - awaiting_upload → /siparis/[id]/tasarim-yukle (tasarım yükle)
            - proof_generating/proof_pending → /siparis/[id] (prova izle/onayla)
            - diğer → sipariş detayı */}
        <div className="mt-8 flex gap-3 justify-center flex-wrap">
          {order?.status === "awaiting_upload" ? (
            <Button
              variant="primary"
              size="lg"
              href={`/siparis/${orderId}/tasarim-yukle`}
            >
              Tasarımını yükle →
            </Button>
          ) : order?.status === "proof_generating" ||
            order?.status === "proof_pending" ? (
            <Button
              variant="primary"
              size="lg"
              href={`/siparis/${orderId}`}
            >
              {order.status === "proof_generating"
                ? "Bıçak çizimini izle →"
                : "Provayı incele ve onayla →"}
            </Button>
          ) : (
            <Button variant="primary" size="lg" href={`/siparis/${orderId}`}>
              <Icon.Box size={16} /> Sipariş detayı →
            </Button>
          )}
          {/* Sekunder: primer CTA sipariş detayına gitmiyorsa, ek olarak göster */}
          {order?.status === "awaiting_upload" && (
            <Button variant="secondary" size="lg" href={`/siparis/${orderId}`}>
              <Icon.Box size={16} /> {t.orderSuccess.orderDetail}
            </Button>
          )}
        </div>

        <p className="mt-8 text-[13px] text-gri-500 leading-relaxed">
          {x.contactFooter}
        </p>
      </div>
    </main>
  );
}
