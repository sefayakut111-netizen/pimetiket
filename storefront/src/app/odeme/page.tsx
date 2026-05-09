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
  }, [router]);

  const summary = summarizeCustomerCart();
  const subtotal = summary.subtotal;
  const shipping = summary.shipping;
  const total = summary.total;
  const fmt = (n: number) => Math.round(n).toLocaleString(x.locale);

  const goNext = () => setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  const goPrev = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  const submit = async () => {
    if (cartItems.length === 0) return;
    setLoading(true);

    // Seçili adresi çöz
    const addr =
      SAVED_ADDRESSES.find((a) => a.id === addressId) ?? SAVED_ADDRESSES[0];

    // Kart son 4 hane mask
    const last4 = card.no.replace(/\D/g, "").slice(-4);
    const masked = last4
      ? `**** **** **** ${last4}`
      : "**** **** **** ****";

    // Mock 3DS gecikme — gerçek PSP P0-3 adımında
    await new Promise((r) => setTimeout(r, 1500));

    try {
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
          companyName: invoiceType === "corporate" ? companyName : undefined,
          taxOffice: invoiceType === "corporate" ? taxOffice : undefined,
        },
        payment: { method: "card", masked },
        subtotal,
        shipping,
        total,
        // Etiket için 10 gün, sticker için 5 gün — karışıksa 10 gün ver
        estimatedDelivery: addDaysIso(
          cartItems.some((i) => i.product === "etiket") ? 10 : 5
        ),
      });

      // Sepeti temizle
      await clearCustomerCart();

      router.push(`/odeme-sonuc?status=success&order=${order.id}`);
    } catch (err) {
      setLoading(false);
      console.error("[odeme] order create failed:", err);
      router.push("/odeme-sonuc?status=fail");
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
              <Card padding="p-6">
                <h2 className="text-xl font-semibold mb-1">{t.checkout.cardInfo}</h2>
                <p className="text-[13px] text-gri-700 mb-5 flex items-center gap-2">
                  <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-yesil-soft text-yesil text-[11.5px] font-semibold">
                    🔒 3D Secure
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
                    {loading ? t.checkout.processing : t.checkout.payNow(fmt(total))}{" "}
                    {!loading && <Icon.ArrowR />}
                  </Button>
                </div>
              </Card>
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
                <div className="flex justify-between">
                  <span className="text-gri-700">{t.cart.shipping}</span>
                  <span className="font-semibold tabular-nums">
                    {shipping === 0 ? (
                      <span className="text-yesil">{t.cart.free}</span>
                    ) : (
                      `${fmt(shipping)} ${x.currency}`
                    )}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t-2 border-lacivert flex justify-between items-baseline">
                <span className="font-semibold">{t.cart.total}</span>
                <span className="text-2xl font-bold tabular-nums">
                  {fmt(total)}{" "}
                  <span className="text-base font-semibold text-gri-700">
                    {x.currency}
                  </span>
                </span>
              </div>
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
