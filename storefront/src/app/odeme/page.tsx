/**
 * Pim Etiket — /odeme (E.2.3 Checkout)
 *
 * 3-step checkout: Adres → Fatura → Ödeme.
 * Mock — gerçek 3DS akış H adımında (iyzico/ParamPOS).
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Input, Eyebrow, ValidatedInput } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/context";
import {
  validateTcKimlik,
  validateVkn,
  validateCardNumber,
  validateCardExpiry,
  validateCvv,
} from "@/lib/validation";
import {
  listCustomerCart,
  summarizeCustomerCart,
  clearCustomerCart,
  refreshCustomerCart,
  ensureAuthBindings,
  type CustomerCartItem,
} from "@/lib/customer-cart";
import {
  createCustomerOrder,
  addDaysIso,
} from "@/lib/customer-order";
import {
  validateCoupon,
  type CouponValidateResult,
} from "@/lib/customer-coupon";
import {
  listMyWalletTransactions,
  summarizeWallet,
} from "@/lib/customer-wallet";

const SAVED_ADDRESSES = [
  {
    id: "a1",
    label: "Atölye",
    name: "Ahmet Yılmaz",
    addr: "Yıldırım Mh. 15. Cd. No:3 D:2",
    city: "Bursa / Yıldırım",
    phone: "+90 5XX XXX XX XX",
  },
  {
    id: "a2",
    label: "Ev",
    name: "Ahmet Yılmaz",
    addr: "Çekirge Cd. No:42 D:7",
    city: "Bursa / Osmangazi",
    phone: "+90 5XX XXX XX XX",
  },
];

type Step = 1 | 2 | 3;
type InvoiceType = "individual" | "corporate";

const EXTRA = {
  tr: {
    summary: "Özet",
    cartEmptyRedirect: "Sepetin boş — yönlendiriliyor…",
    times: "×",
    currency: "TL",
    locale: "tr-TR",
  },
  en: {
    summary: "Summary",
    cartEmptyRedirect: "Cart is empty — redirecting…",
    times: "×",
    currency: "TRY",
    locale: "en-US",
  },
};

export default function OdemePage() {
  const router = useRouter();
  const { t, locale } = useT();
  const x = locale === "en" ? EXTRA.en : EXTRA.tr;
  const [step, setStep] = useState<Step>(1);
  const [addressId, setAddressId] = useState("a1");
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("individual");
  const [tc, setTc] = useState("");
  const [vkn, setVkn] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  const [card, setCard] = useState({ no: "", name: "", exp: "", cvv: "" });
  const [acceptSatis, setAcceptSatis] = useState(false);
  const [loading, setLoading] = useState(false);

  // Kupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponValidateResult | null>(
    null
  );
  const [couponChecking, setCouponChecking] = useState(false);

  // Cüzdan state
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);

  // Cart snapshot — sayfa mount'ta okunur, hydration'a kadar boş.
  const [cartItems, setCartItems] = useState<CustomerCartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    ensureAuthBindings();
    void refreshCustomerCart().then(() => {
      const items = listCustomerCart();
      setCartItems(items);
      setHydrated(true);
      if (items.length === 0) {
        router.replace("/sepet");
      }
    });
    // Cüzdan bakiyesi
    void listMyWalletTransactions().then((txs) => {
      const s = summarizeWallet(txs);
      setWalletBalance(Math.max(0, s.balance));
    });
  }, [router]);

  const summary = summarizeCustomerCart();
  const subtotal = summary.subtotal;
  const shipping = summary.shipping;
  const total = summary.total;
  const fmt = (n: number) => Math.round(n).toLocaleString(x.locale);

  const goNext = () => setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  const goPrev = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  // Kupon kontrol — input'u butonla validate et
  const onCheckCoupon = async () => {
    const code = couponCode.trim();
    if (!code) return;
    setCouponChecking(true);
    const r = await validateCoupon(code, subtotal);
    setCouponResult(r);
    setCouponChecking(false);
  };

  // İndirim sonrası hesaplanan toplam (UI display için)
  const couponDiscount =
    couponResult?.ok && couponResult.kind !== "free_ship"
      ? couponResult.discount
      : 0;
  const couponFreeShip = couponResult?.ok && couponResult.kind === "free_ship";
  const effectiveShipping = couponFreeShip ? 0 : shipping;
  const effectiveTotal = subtotal - couponDiscount + effectiveShipping;

  // Cüzdan ile ödenecek tutar — bakiye sınırlı, total'ı geçmez,
  // min 1 TL kart kalsın diye total - 1'i geçmez (full wallet için ayrı endpoint)
  const walletApplied = useWallet
    ? Math.min(walletBalance, Math.max(0, effectiveTotal - 1))
    : 0;
  const cardAmount = Math.max(0, effectiveTotal - walletApplied);
  // Cüzdan +%2 indirim — gelecek faz, şimdilik hesapsız
  void cardAmount;

  const submit = async () => {
    if (cartItems.length === 0) return;
    setLoading(true);

    // Seçili adresi çöz
    const addr =
      SAVED_ADDRESSES.find((a) => a.id === addressId) ?? SAVED_ADDRESSES[0];

    try {
      // /api/payment/init → iyzico CheckoutForm Initialize
      const res = await fetch("/api/payment/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: cartItems,
          address: {
            label: addr.label,
            name: addr.name,
            addr: addr.addr,
            city: addr.city,
            phone: addr.phone,
          },
          invoice: {
            type: invoiceType,
            tc: invoiceType === "individual" ? tc : undefined,
            vkn: invoiceType === "corporate" ? vkn : undefined,
            companyName: invoiceType === "corporate" ? companyName : undefined,
            taxOffice: invoiceType === "corporate" ? taxOffice : undefined,
          },
          subtotal,
          shipping: effectiveShipping,
          total: effectiveTotal,
          couponCode: couponResult?.ok ? couponCode.trim() : undefined,
          walletAmount: walletApplied,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          // Auth yok → /auth?next=/odeme
          router.push(
            `/auth?next=${encodeURIComponent("/odeme")}`
          );
          return;
        }
        if (res.status === 503) {
          // PSP yapılandırılmamış → mock akışa düş (dev/demo)
          console.warn(
            "[odeme] iyzico not configured, falling back to mock order"
          );
          const last4 = "0000";
          const masked = `**** **** **** ${last4}`;
          const order = await createCustomerOrder({
            items: cartItems,
            address: {
              label: addr.label,
              name: addr.name,
              addr: addr.addr,
              city: addr.city,
              phone: addr.phone,
            },
            invoice: {
              type: invoiceType,
              tc: invoiceType === "individual" ? tc : undefined,
              vkn: invoiceType === "corporate" ? vkn : undefined,
              companyName:
                invoiceType === "corporate" ? companyName : undefined,
              taxOffice: invoiceType === "corporate" ? taxOffice : undefined,
            },
            payment: { method: "card", masked },
            subtotal,
            shipping,
            total,
            estimatedDelivery: addDaysIso(
              cartItems.some((i) => i.product === "etiket") ? 10 : 5
            ),
          });
          await clearCustomerCart();
          router.push(`/odeme-sonuc?status=success&order=${order.id}`);
          return;
        }
        throw new Error(
          data.error ?? `payment_init_failed_${res.status}`
        );
      }

      const { paymentPageUrl } = await res.json();
      if (!paymentPageUrl) {
        throw new Error("missing_payment_page_url");
      }

      // iyzico hosted form'a yönlendir — 3DS akışı orada tamamlanır,
      // dönüş /api/payment/callback'e POST atılır, sonra
      // /odeme-sonuc'a redirect olur.
      window.location.href = paymentPageUrl;
    } catch (err) {
      setLoading(false);
      console.error("[odeme] payment init failed:", err);
      router.push(
        `/odeme-sonuc?status=fail&reason=${encodeURIComponent(
          err instanceof Error ? err.message : "unknown"
        )}`
      );
    }
  };

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-6 md:py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="mb-5 md:mb-7">
          <Eyebrow>{t.checkout.eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[24px] md:text-[36px] font-semibold tracking-tight">
            {t.checkout.title}
          </h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8 max-w-[600px] mx-auto">
          {[
            { n: 1, label: t.checkout.stepAddress },
            { n: 2, label: t.checkout.stepInvoice },
            { n: 3, label: t.checkout.stepPayment },
          ].map((s, i, arr) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <span
                  className={cn(
                    "grid place-items-center w-9 h-9 rounded-full font-bold text-sm shrink-0",
                    step === s.n
                      ? "bg-pim-mercan text-white shadow-mercan"
                      : step > s.n
                        ? "bg-yesil text-white"
                        : "bg-gri-200 text-gri-500"
                  )}
                >
                  {step > s.n ? <Icon.Check size={14} /> : s.n}
                </span>
                <span
                  className={cn(
                    "text-[12.5px] font-semibold",
                    step === s.n ? "text-lacivert" : "text-gri-500"
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div className="flex-1 h-0.5 -mt-5">
                  <div
                    className={cn(
                      "h-full transition-colors",
                      step > s.n ? "bg-yesil" : "bg-gri-200"
                    )}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
          {/* MAIN CONTENT */}
          <div>
            {step === 1 && (
              <Card padding="p-6">
                <h2 className="text-xl font-semibold mb-1">{t.checkout.deliveryAddress}</h2>
                <p className="text-[13px] text-gri-700 mb-5">&nbsp;</p>
                <div className="flex flex-col gap-3">
                  {SAVED_ADDRESSES.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAddressId(a.id)}
                      aria-pressed={addressId === a.id}
                      className={cn(
                        "text-left p-4 rounded-lg ring-[1.5px] transition-all",
                        addressId === a.id
                          ? "ring-pim-mercan bg-pim-mercan-tint/40"
                          : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
                      )}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <div className="font-semibold text-[15px] mb-1 flex items-center gap-2">
                            {a.label}
                            <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-gri-100 text-gri-700 text-[11px] font-semibold">
                              {t.checkout.saved}
                            </span>
                          </div>
                          <div className="text-[13px] text-gri-700 leading-relaxed">
                            {a.name}
                            <br />
                            {a.addr}
                            <br />
                            {a.city} · {a.phone}
                          </div>
                        </div>
                        {addressId === a.id && (
                          <span className="grid place-items-center w-6 h-6 rounded-full bg-pim-mercan text-white shrink-0">
                            <Icon.Check size={12} />
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="text-[13px] font-semibold text-pim-mercan hover:underline self-start mt-1 inline-flex items-center gap-1"
                  >
                    <Icon.Plus size={14} /> {t.checkout.addNewAddress}
                  </button>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button variant="primary" size="lg" onClick={goNext}>
                    {t.common.next} <Icon.ArrowR />
                  </Button>
                </div>
              </Card>
            )}

            {step === 2 && (
              <Card padding="p-6">
                <h2 className="text-xl font-semibold mb-1">{t.checkout.invoiceInfo}</h2>
                <p className="text-[13px] text-gri-700 mb-5">&nbsp;</p>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  {(["individual", "corporate"] as InvoiceType[]).map((it) => (
                    <button
                      key={it}
                      type="button"
                      onClick={() => setInvoiceType(it)}
                      aria-pressed={invoiceType === it}
                      className={cn(
                        "p-4 rounded-lg ring-[1.5px] text-left transition-all",
                        invoiceType === it
                          ? "ring-pim-mercan bg-pim-mercan-tint/40"
                          : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
                      )}
                    >
                      <div className="font-semibold text-base mb-0.5">
                        {it === "individual" ? t.checkout.individual : t.checkout.corporate}
                      </div>
                      <div className="text-[13px] text-gri-700">
                        {it === "individual"
                          ? t.checkout.individualDesc
                          : t.checkout.corporateDesc}
                      </div>
                    </button>
                  ))}
                </div>

                {invoiceType === "individual" ? (
                  <label className="block">
                    <span className="text-[13px] font-semibold mb-1.5 block">
                      {t.checkout.tcKimlik}
                    </span>
                    <ValidatedInput
                      id="tc"
                      value={tc}
                      onChange={setTc}
                      validate={validateTcKimlik}
                      placeholder="11"
                      maxLength={11}
                      inputMode="numeric"
                    />
                  </label>
                ) : (
                  <div className="space-y-3.5">
                    <label className="block">
                      <span className="text-[13px] font-semibold mb-1.5 block">
                        {t.checkout.companyName}
                      </span>
                      <Input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-[13px] font-semibold mb-1.5 block">
                          {t.checkout.vkn}
                        </span>
                        <ValidatedInput
                          id="vkn"
                          value={vkn}
                          onChange={setVkn}
                          validate={validateVkn}
                          placeholder="10"
                          maxLength={10}
                          inputMode="numeric"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[13px] font-semibold mb-1.5 block">
                          {t.checkout.taxOffice}
                        </span>
                        <Input
                          value={taxOffice}
                          onChange={(e) => setTaxOffice(e.target.value)}
                        />
                      </label>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-between gap-3">
                  <Button variant="ghost" onClick={goPrev}>
                    ← {t.common.back}
                  </Button>
                  <Button variant="primary" size="lg" onClick={goNext}>
                    {t.common.next} <Icon.ArrowR />
                  </Button>
                </div>
              </Card>
            )}

            {step === 3 && (
              <>
              {/* Kupon */}
              <Card padding="p-5" className="mb-4">
                <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Icon.Sparkle size={16} className="text-pim-mercan" />
                  Kupon kodun var mı?
                </h3>
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCouponResult(null);
                    }}
                    placeholder="ÖRN: HOSGELDIN10"
                    className="flex-1 uppercase tracking-wider"
                    disabled={couponChecking || couponResult?.ok === true}
                  />
                  {couponResult?.ok ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setCouponCode("");
                        setCouponResult(null);
                      }}
                    >
                      Kaldır
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={onCheckCoupon}
                      disabled={couponChecking || couponCode.trim().length < 2}
                    >
                      {couponChecking ? "..." : "Uygula"}
                    </Button>
                  )}
                </div>
                {couponResult && (
                  <div className="mt-3 text-[13px] leading-relaxed">
                    {couponResult.ok ? (
                      <span className="text-yesil font-semibold flex items-center gap-1.5">
                        <Icon.Check size={14} />
                        {couponResult.kind === "free_ship"
                          ? "Kargo ücretsiz!"
                          : `İndirim: ${Math.round(
                              couponResult.discount
                            ).toLocaleString("tr-TR")} TL`}
                      </span>
                    ) : (
                      <span className="text-kirmizi">
                        {couponResult.reason === "invalid_or_expired"
                          ? "Bu kupon kodu geçersiz veya süresi dolmuş."
                          : couponResult.reason === "min_subtotal"
                            ? `Min sepet tutarı ${couponResult.minSubtotal} TL — bu indirimden faydalanmıyor.`
                            : couponResult.reason === "user_limit_reached"
                              ? "Bu kuponu zaten kullandın."
                              : couponResult.reason === "total_limit_reached"
                                ? "Bu kuponun kullanım limiti doldu."
                                : "Kupon uygulanamadı, tekrar dene."}
                      </span>
                    )}
                  </div>
                )}
              </Card>

              {/* Cüzdan — bakiye varsa */}
              {walletBalance > 0 && (
                <Card padding="p-5" className="mb-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useWallet}
                      onChange={(e) => setUseWallet(e.target.checked)}
                      className="mt-1 accent-pim-mercan shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="text-base font-semibold flex items-center gap-2">
                          <Icon.Wallet size={16} className="text-yesil" />
                          Cüzdan bakiyesini kullan
                        </h3>
                        <span className="text-[13px] font-semibold text-yesil">
                          Bakiye: {fmt(walletBalance)} {x.currency}
                        </span>
                      </div>
                      {useWallet && walletApplied > 0 && (
                        <p className="text-[13px] text-gri-700 mt-2 leading-relaxed">
                          <strong>{fmt(walletApplied)} {x.currency}</strong>{" "}
                          cüzdandan,{" "}
                          <strong>{fmt(effectiveTotal - walletApplied)} {x.currency}</strong>{" "}
                          karttan tahsil edilir.
                        </p>
                      )}
                      {useWallet && walletApplied === 0 && (
                        <p className="text-[13px] text-gri-500 mt-2">
                          Tutar düşük — cüzdan kullanılamıyor.
                        </p>
                      )}
                    </div>
                  </label>
                </Card>
              )}

              {/* Ödeme bilgilendirme */}
              <Card padding="p-6">
                <h2 className="text-xl font-semibold mb-1">{t.checkout.cardInfo}</h2>
                <p className="text-[13px] text-gri-700 mb-5 flex items-center gap-2">
                  <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-yesil-soft text-yesil text-[11.5px] font-semibold">
                    🔒 3D Secure
                  </span>
                  <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[11.5px] font-semibold">
                    iyzico ile güvenli
                  </span>
                </p>

                <label className="block mb-3.5">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    {t.checkout.cardName}
                  </span>
                  <Input
                    value={card.name}
                    onChange={(e) => setCard({ ...card, name: e.target.value })}
                    placeholder="AHMET YILMAZ"
                    autoComplete="cc-name"
                  />
                </label>
                <label className="block mb-3.5">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    {t.checkout.cardNumber}
                  </span>
                  <ValidatedInput
                    id="card-no"
                    value={card.no}
                    onChange={(v) => setCard({ ...card, no: v })}
                    validate={validateCardNumber}
                    placeholder="0000 0000 0000 0000"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    maxLength={19}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <label className="block">
                    <span className="text-[13px] font-semibold mb-1.5 block">
                      {t.checkout.expiry}
                    </span>
                    <ValidatedInput
                      id="card-exp"
                      value={card.exp}
                      onChange={(v) => setCard({ ...card, exp: v })}
                      validate={validateCardExpiry}
                      placeholder="MM/YY"
                      autoComplete="cc-exp"
                      maxLength={5}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-semibold mb-1.5 block">
                      {t.checkout.cvv}
                    </span>
                    <ValidatedInput
                      id="card-cvv"
                      type="password"
                      value={card.cvv}
                      onChange={(v) => setCard({ ...card, cvv: v })}
                      validate={validateCvv}
                      placeholder="•••"
                      autoComplete="cc-csc"
                      maxLength={4}
                      inputMode="numeric"
                    />
                  </label>
                </div>

                <label className="flex items-start gap-2.5 text-[13px] text-gri-700 leading-relaxed cursor-pointer mb-5">
                  <input
                    type="checkbox"
                    checked={acceptSatis}
                    onChange={(e) => setAcceptSatis(e.target.checked)}
                    className="mt-1 accent-pim-mercan shrink-0"
                  />
                  <span>{t.checkout.accept}</span>
                </label>

                <div className="flex justify-between gap-3">
                  <Button variant="ghost" onClick={goPrev}>
                    ← {t.common.back}
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={submit}
                    disabled={
                      !acceptSatis || loading || cartItems.length === 0
                    }
                  >
                    {loading
                      ? t.checkout.processing
                      : t.checkout.payNow(fmt(effectiveTotal))}{" "}
                    {!loading && <Icon.ArrowR />}
                  </Button>
                </div>
              </Card>
              </>
            )}
          </div>

          {/* SIDE — order summary */}
          <div className="lg:sticky lg:top-20">
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
                <Pim pose="happy" size={32} bob={false} />
                {x.summary}
              </h3>
              <div className="space-y-3 text-[13px]">
                {hydrated && cartItems.length === 0 && (
                  <div className="text-gri-500">{x.cartEmptyRedirect}</div>
                )}
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3">
                    <span className="text-gri-700 leading-tight min-w-0 flex-1">
                      <span className="block truncate font-semibold text-lacivert text-[12.5px]">
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
                <div className="flex justify-between border-t border-gri-200 pt-3">
                  <span className="text-gri-700">{t.cart.subtotal}</span>
                  <span className="font-semibold tabular-nums">
                    {fmt(subtotal)} {x.currency}
                  </span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-yesil">
                    <span className="font-semibold">
                      Kupon: {couponCode}
                    </span>
                    <span className="font-semibold tabular-nums">
                      −{fmt(couponDiscount)} {x.currency}
                    </span>
                  </div>
                )}
                {walletApplied > 0 && (
                  <div className="flex justify-between text-yesil">
                    <span className="font-semibold inline-flex items-center gap-1">
                      <Icon.Wallet size={12} /> Cüzdan
                    </span>
                    <span className="font-semibold tabular-nums">
                      −{fmt(walletApplied)} {x.currency}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gri-700">{t.cart.shipping}</span>
                  <span className="font-semibold tabular-nums">
                    {effectiveShipping === 0 ? (
                      <span className="text-yesil">{t.cart.free}</span>
                    ) : (
                      `${fmt(effectiveShipping)} ${x.currency}`
                    )}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t-2 border-lacivert flex justify-between items-baseline">
                <span className="font-semibold">
                  {walletApplied > 0 ? "Karta" : t.cart.total}
                </span>
                <span className="text-2xl font-bold tabular-nums">
                  {fmt(effectiveTotal - walletApplied)}{" "}
                  <span className="text-base font-semibold text-gri-700">
                    {x.currency}
                  </span>
                </span>
              </div>
              {walletApplied > 0 && (
                <div className="text-[11.5px] text-gri-700 text-right mt-1">
                  Toplam: {fmt(effectiveTotal)} {x.currency}
                </div>
              )}
              <div className="text-[11.5px] text-gri-700 text-right">
                {t.cart.vatIncluded}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
