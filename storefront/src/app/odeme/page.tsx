/**
 * Pim Etiket — /odeme (E.2.3 Checkout)
 *
 * Tek sayfa checkout (Sticker Mule pattern):
 *   Sol kolon: Adres + Fatura + Kupon + Cüzdan (smart defaults)
 *   Sağ kolon: Sipariş özeti (sticky) + Ödeme butonu
 *
 * Akış:
 *   1. Mount: cart + addresses + wallet + profile invoice info çek
 *   2. Smart defaults:
 *      - 0 adres → inline form
 *      - 1 adres → otomatik seçili
 *      - 2+ adres → default işaretli + diğerleri seçilebilir
 *   3. Fatura: 3 mod (none/individual/corporate)
 *      - Default: "Fatura istemiyorum (fiş)"
 *      - Kurumsal user (profilde VKN varsa) → otomatik corporate seçili
 *   4. "Ödemeye geç" → /api/payment/init → PayTR iframe
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import {
  Button,
  Card,
  Input,
  Eyebrow,
  ValidatedInput,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/context";
import { validateTcKimlik, validateVkn } from "@/lib/validation";
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
  listMyAddresses,
  getMyProfile,
  type CustomerAddress,
} from "@/lib/customer-profile";

// ============================================================
// Types
// ============================================================

/** Fatura türü — none (fiş) / individual (TC) / corporate (VKN) */
type InvoiceMode = "none" | "individual" | "corporate";

// ============================================================
// Locale-aware copy
// ============================================================

const COPY = {
  tr: {
    eyebrow: "Ödeme",
    title: "Sipariş özeti ve ödeme",
    summary: "Sipariş özeti",
    cartEmptyRedirect: "Sepetin boş — yönlendiriliyor…",
    currency: "TL",
    times: "×",
    locale: "tr-TR",

    // Address
    addressTitle: "Teslimat adresi",
    addressEmpty:
      "Adres defterinde kayıtlı adresin yok. Hızlıca ekle:",
    addressNew: "Yeni adres ekle",
    addressDifferent: "Bu sipariş için farklı adres kullan",
    addressFormName: "Ad Soyad",
    addressFormAddr: "Adres satırı",
    addressFormCity: "İl / İlçe",
    addressFormPhone: "Telefon",
    addressFormLabel: "Etiket (örn: Ev, Atölye)",
    addressFormSave: "Bu adresi kaydet (varsayılan yap)",

    // Invoice
    invoiceTitle: "Fatura tercihi",
    invoiceModeNone: "Fatura istemiyorum",
    invoiceModeNoneDesc: "Yazar kasa fişi ile sipariş, KDV gider yazılamaz",
    invoiceModeIndividual: "Bireysel fatura",
    invoiceModeIndividualDesc: "TC kimlik ile e-arşiv fatura",
    invoiceModeCorporate: "Kurumsal fatura",
    invoiceModeCorporateDesc: "VKN ile e-fatura, KDV gider yazılır",
    invoiceCorporateAuto:
      "Profilinizdeki kurumsal bilgilerle fatura kesilecek.",
    tcLabel: "TC Kimlik No",
    tcPh: "11 hane (boş bırakılabilir)",
    tcOptionalNote:
      "TC vermek zorunda değilsin. Vermezsen fatura kesilir ama gider olarak yazılamaz.",
    tcSkipModalTitle: "TC kimlik vermeden devam edelim mi?",
    tcSkipModalBody:
      "Faturan e-arşiv olarak '11111111111' placeholder ile kesilir. Bu durumda KDV gider yazamazsın, KDV iadesi alamazsın. Yine de devam etmek ister misin?",
    tcSkipConfirm: "Evet, devam et",
    tcSkipCancel: "İptal — TC vereceğim",
    vknLabel: "VKN",
    companyNameLabel: "Şirket ünvanı",
    taxOfficeLabel: "Vergi dairesi",

    // Coupon
    couponTitle: "Kupon kodun var mı?",
    couponPh: "ÖRN: HOSGELDIN10",
    couponApply: "Uygula",
    couponRemove: "Kaldır",
    couponInvalid: "Bu kupon kodu geçersiz veya süresi dolmuş.",
    couponMinSubtotal: (n: number) =>
      `Min sepet tutarı ${n} TL — bu indirimden faydalanmıyor.`,
    couponUserLimit: "Bu kuponu zaten kullandın.",
    couponTotalLimit: "Bu kuponun kullanım limiti doldu.",
    couponDefault: "Kupon uygulanamadı, tekrar dene.",

    // Summary
    subtotal: "Ara toplam",
    couponLabel: (code: string) => `Kupon: ${code}`,
    shipping: "Kargo",
    free: "Ücretsiz",
    total: "TOPLAM",
    cardLabel: "Karta",
    fullTotal: "Toplam:",
    vatIncluded: "KDV dahil",

    // Action
    accept: "Mesafeli Satış Sözleşmesi'ni okudum, kabul ediyorum.",
    acceptCopyright:
      "Yüklediğim tasarımın telif sahibi benim veya kullanma yetkim var. Başkasının fikri mülkiyetini ihlal etmediğimi taahhüt ediyorum.",
    proceed: (amount: string) => `Güvenli ödemeye geç — ${amount} TL`,
    processing: "Yönlendiriliyor...",
    cartItems: "Sepetinde",
  },
  en: {
    eyebrow: "Checkout",
    title: "Review & pay",
    summary: "Order summary",
    cartEmptyRedirect: "Cart is empty — redirecting…",
    currency: "TRY",
    times: "×",
    locale: "en-US",

    addressTitle: "Shipping address",
    addressEmpty: "No saved address yet. Add one quickly:",
    addressNew: "Add new address",
    addressDifferent: "Use a different address for this order",
    addressFormName: "Full name",
    addressFormAddr: "Street address",
    addressFormCity: "City / District",
    addressFormPhone: "Phone",
    addressFormLabel: "Label (e.g. Home, Workshop)",
    addressFormSave: "Save this address (set as default)",

    invoiceTitle: "Invoice preference",
    invoiceModeNone: "No invoice needed",
    invoiceModeNoneDesc: "Receipt only — VAT cannot be deducted",
    invoiceModeIndividual: "Individual invoice",
    invoiceModeIndividualDesc: "E-archive invoice with TC ID",
    invoiceModeCorporate: "Corporate invoice",
    invoiceModeCorporateDesc: "E-invoice with VAT number",
    invoiceCorporateAuto:
      "Will use the corporate info from your profile.",
    tcLabel: "TC ID number",
    tcPh: "11 digits (optional)",
    tcOptionalNote:
      "Providing TC is optional. Without it, an invoice is issued but cannot be used for VAT deduction.",
    tcSkipModalTitle: "Continue without TC ID?",
    tcSkipModalBody:
      "Your e-archive invoice will be issued with placeholder '11111111111'. You won't be able to claim VAT or expense deductions. Still continue?",
    tcSkipConfirm: "Yes, continue",
    tcSkipCancel: "Cancel — I'll enter TC",
    vknLabel: "Tax number (VKN)",
    companyNameLabel: "Company legal name",
    taxOfficeLabel: "Tax office",

    couponTitle: "Got a coupon?",
    couponPh: "EXAMPLE: WELCOME10",
    couponApply: "Apply",
    couponRemove: "Remove",
    couponInvalid: "This coupon is invalid or expired.",
    couponMinSubtotal: (n: number) =>
      `Min subtotal ${n} TRY — discount doesn't apply.`,
    couponUserLimit: "You've already used this coupon.",
    couponTotalLimit: "Coupon usage limit reached.",
    couponDefault: "Coupon couldn't be applied, try again.",

    subtotal: "Subtotal",
    couponLabel: (code: string) => `Coupon: ${code}`,
    shipping: "Shipping",
    free: "Free",
    total: "TOTAL",
    cardLabel: "On card",
    fullTotal: "Total:",
    vatIncluded: "VAT included",

    accept: "I've read and accept the Distance Sales Contract.",
    acceptCopyright:
      "I own or have rights to use the design I'm uploading. I confirm I'm not infringing on anyone else's intellectual property.",
    proceed: (amount: string) => `Pay securely — ${amount} TRY`,
    processing: "Redirecting...",
    cartItems: "In your cart",
  },
};

// ============================================================
// Page
// ============================================================

export default function OdemePage() {
  const router = useRouter();
  const { t, locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;

  // Cart hydration
  const [cartItems, setCartItems] = useState<CustomerCartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Address state
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null
  );
  /** Inline form için — yeni adres ekleme veya 0-adres senaryosu */
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddr, setNewAddr] = useState({
    label: "",
    name: "",
    addr: "",
    city: "",
    phone: "",
  });

  // Invoice state
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>("none");
  const [tc, setTc] = useState("");
  const [showTcSkipModal, setShowTcSkipModal] = useState(false);
  const [vkn, setVkn] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  /** Profilde VKN varsa kurumsal otomatik */
  const [profileHasCorporate, setProfileHasCorporate] = useState(false);

  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponValidateResult | null>(
    null
  );
  const [couponChecking, setCouponChecking] = useState(false);

  // Submit
  const [acceptSatis, setAcceptSatis] = useState(false);
  const [acceptCopyright, setAcceptCopyright] = useState(false);
  const [loading, setLoading] = useState(false);

  // ============================================================
  // Hydration
  // ============================================================

  useEffect(() => {
    ensureAuthBindings();

    // Cart
    void refreshCustomerCart().then(() => {
      const items = listCustomerCart();
      setCartItems(items);
      setHydrated(true);
      if (items.length === 0) {
        router.replace("/sepet");
      }
    });

    // Adresler
    void listMyAddresses().then((list) => {
      setAddresses(list);
      // Smart default: default işaretli olan, yoksa ilk adres
      const def = list.find((a) => a.isDefault) ?? list[0];
      if (def) setSelectedAddressId(def.id);
      else setShowNewAddressForm(true); // 0 adres → inline form
    });

    // Profil — kurumsal kullanıcıyı otomatik tespit
    void getMyProfile().then((p) => {
      if (!p) return;
      if (p.invoiceType === "corporate" && p.vkn) {
        setProfileHasCorporate(true);
        setInvoiceMode("corporate");
        setVkn(p.vkn);
        setCompanyName(p.companyName ?? "");
        setTaxOffice(p.taxOffice ?? "");
      }
    });

    // Tekrar baskı kuponu — sessionStorage'da pending varsa otomatik field'a koy
    if (typeof window !== "undefined") {
      try {
        const pending = window.sessionStorage.getItem("pim_pending_coupon");
        if (pending) {
          const parsed = JSON.parse(pending) as { code?: string };
          if (parsed.code) {
            setCouponCode(parsed.code);
          }
        }
      } catch {
        /* ignore */
      }
    }
  }, [router]);

  // ============================================================
  // Computed
  // ============================================================

  const summary = summarizeCustomerCart();
  const subtotal = summary.subtotal;
  const shipping = summary.shipping;
  const total = summary.total;
  const fmt = (n: number) => Math.round(n).toLocaleString(c.locale);

  const couponDiscount =
    couponResult?.ok && couponResult.kind !== "free_ship"
      ? couponResult.discount
      : 0;
  const couponFreeShip = couponResult?.ok && couponResult.kind === "free_ship";
  const effectiveShipping = couponFreeShip ? 0 : shipping;
  const effectiveTotal = subtotal - couponDiscount + effectiveShipping;

  const cardAmount = effectiveTotal;

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  /** Form complete mi? Submit aktive olur mu? */
  const canSubmit =
    !loading &&
    cartItems.length > 0 &&
    acceptSatis &&
    acceptCopyright &&
    (selectedAddress !== undefined || isNewAddressFilled(newAddr)) &&
    isInvoiceComplete(invoiceMode, tc, vkn, companyName, taxOffice);

  // ============================================================
  // Coupon check
  // ============================================================

  const onCheckCoupon = async () => {
    const code = couponCode.trim();
    if (!code) return;
    setCouponChecking(true);
    const r = await validateCoupon(code, subtotal);
    setCouponResult(r);
    setCouponChecking(false);
  };

  // ============================================================
  // Submit
  // ============================================================

  const submit = async () => {
    if (cartItems.length === 0) return;

    // TC opsiyonel: bireysel + boş TC + henüz onaylanmadı → modal
    if (
      invoiceMode === "individual" &&
      tc.trim().length === 0 &&
      !showTcSkipModal
    ) {
      setShowTcSkipModal(true);
      return;
    }

    setLoading(true);

    // Adres çöz: seçili kayıtlı veya inline form
    const addr = selectedAddress
      ? {
          label: selectedAddress.label ?? undefined,
          name: selectedAddress.name,
          addr: selectedAddress.addr,
          city: selectedAddress.city,
          phone: selectedAddress.phone,
        }
      : {
          label: newAddr.label || undefined,
          name: newAddr.name,
          addr: newAddr.addr,
          city: newAddr.city,
          phone: newAddr.phone,
        };

    // Fatura snapshot (none modu için tip=individual placeholder)
    const invoice = buildInvoicePayload(
      invoiceMode,
      tc,
      vkn,
      companyName,
      taxOffice
    );

    try {
      const res = await fetch("/api/payment/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: cartItems,
          address: addr,
          invoice,
          subtotal,
          shipping: effectiveShipping,
          total: effectiveTotal,
          couponCode: couponResult?.ok ? couponCode.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          router.push(`/auth?next=${encodeURIComponent("/odeme")}`);
          return;
        }
        if (res.status === 503) {
          // PSP yapılandırılmamış. SADECE dev modunda mock fallback —
          // production'da müşterinin para vermeden sipariş açmasını
          // engellemek için "Ödeme yakında" sayfasına yönlendir.
          if (process.env.NODE_ENV !== "production") {
            console.warn("[odeme] PSP not configured, dev mock fallback");
            const masked = "**** **** **** 0000";
            const order = await createCustomerOrder({
              items: cartItems,
              address: addr,
              invoice,
              payment: { method: "card", masked },
              subtotal,
              shipping: effectiveShipping,
              total: effectiveTotal,
              estimatedDelivery: addDaysIso(
                cartItems.some((i) => i.product === "etiket") ? 10 : 5
              ),
            });
            await clearCustomerCart();
            router.push(`/odeme-sonuc?status=success&order=${order.id}`);
            return;
          }
          // Production: ödeme aktif değil
          router.push("/odeme-sonuc?status=fail&reason=psp_unavailable");
          return;
        }
        throw new Error(data.error ?? `payment_init_failed_${res.status}`);
      }

      const { paymentPageUrl } = await res.json();
      if (!paymentPageUrl) throw new Error("missing_payment_page_url");
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

  // ============================================================
  // Render
  // ============================================================

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-6 md:py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="mb-5 md:mb-7">
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[24px] md:text-[36px] font-semibold tracking-tight">
            {c.title}
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
          {/* SOL — form */}
          <div className="flex flex-col gap-4">
            {/* ================ ADDRESS ================ */}
            <Card padding="p-5 md:p-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Icon.Truck size={18} className="text-pim-mercan" />
                {c.addressTitle}
              </h2>

              {/* 0 adres veya yeni form aktif */}
              {(showNewAddressForm || addresses.length === 0) && (
                <div className="space-y-3">
                  {addresses.length === 0 && (
                    <p className="text-[13px] text-gri-700 leading-relaxed">
                      {c.addressEmpty}
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      placeholder={c.addressFormName}
                      value={newAddr.name}
                      onChange={(e) =>
                        setNewAddr({ ...newAddr, name: e.target.value })
                      }
                      autoComplete="name"
                    />
                    <Input
                      placeholder={c.addressFormPhone}
                      value={newAddr.phone}
                      onChange={(e) =>
                        setNewAddr({ ...newAddr, phone: e.target.value })
                      }
                      autoComplete="tel"
                    />
                  </div>
                  <Input
                    placeholder={c.addressFormAddr}
                    value={newAddr.addr}
                    onChange={(e) =>
                      setNewAddr({ ...newAddr, addr: e.target.value })
                    }
                    autoComplete="street-address"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      placeholder={c.addressFormCity}
                      value={newAddr.city}
                      onChange={(e) =>
                        setNewAddr({ ...newAddr, city: e.target.value })
                      }
                    />
                    <Input
                      placeholder={c.addressFormLabel}
                      value={newAddr.label}
                      onChange={(e) =>
                        setNewAddr({ ...newAddr, label: e.target.value })
                      }
                    />
                  </div>
                  {addresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowNewAddressForm(false)}
                      className="text-[12.5px] font-semibold text-gri-700 hover:text-pim-mercan"
                    >
                      ← Kayıtlı adreslerime dön
                    </button>
                  )}
                </div>
              )}

              {/* 1 adres → kompakt özet */}
              {!showNewAddressForm &&
                addresses.length === 1 &&
                selectedAddress && (
                  <div className="flex items-start justify-between gap-3 px-4 py-3 rounded-lg bg-gri-50 ring-1 ring-gri-200">
                    <div className="text-[13px] leading-relaxed text-gri-700">
                      <div className="font-semibold text-lacivert">
                        {selectedAddress.label ?? "Adres"} — {selectedAddress.name}
                      </div>
                      <div>{selectedAddress.addr}</div>
                      <div>
                        {selectedAddress.city} · {selectedAddress.phone}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNewAddressForm(true)}
                      className="text-[12.5px] font-semibold text-pim-mercan hover:underline shrink-0"
                    >
                      {c.addressDifferent}
                    </button>
                  </div>
                )}

              {/* 2+ adres → radio kart */}
              {!showNewAddressForm && addresses.length > 1 && (
                <div className="space-y-2">
                  {addresses.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelectedAddressId(a.id)}
                      aria-pressed={selectedAddressId === a.id}
                      className={cn(
                        "block w-full text-left p-3.5 rounded-lg ring-[1.5px] transition-all",
                        selectedAddressId === a.id
                          ? "ring-pim-mercan bg-pim-mercan-tint/30"
                          : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[13px] leading-relaxed flex-1 min-w-0">
                          <div className="font-semibold text-lacivert flex items-center gap-2">
                            {a.label ?? "Adres"}
                            {a.isDefault && (
                              <span className="inline-flex items-center h-[18px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[10.5px] font-semibold">
                                Varsayılan
                              </span>
                            )}
                          </div>
                          <div className="text-gri-700 mt-0.5">{a.name}</div>
                          <div className="text-gri-700">{a.addr}</div>
                          <div className="text-gri-700">
                            {a.city} · {a.phone}
                          </div>
                        </div>
                        {selectedAddressId === a.id && (
                          <span className="grid place-items-center w-6 h-6 rounded-full bg-pim-mercan text-white shrink-0">
                            <Icon.Check size={12} />
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowNewAddressForm(true)}
                    className="text-[12.5px] font-semibold text-pim-mercan hover:underline inline-flex items-center gap-1"
                  >
                    <Icon.Plus size={12} /> {c.addressNew}
                  </button>
                </div>
              )}
            </Card>

            {/* ================ INVOICE ================ */}
            <Card padding="p-5 md:p-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Icon.Box size={18} className="text-pim-mercan" />
                {c.invoiceTitle}
              </h2>

              {profileHasCorporate ? (
                <div className="px-4 py-3 rounded-lg bg-pim-mercan-tint/40 ring-1 ring-pim-mercan-soft text-[13px]">
                  <div className="font-semibold text-lacivert mb-1">
                    {companyName}
                  </div>
                  <div className="text-gri-700 leading-relaxed">
                    VKN: {vkn} · {taxOffice ?? ""}
                  </div>
                  <div className="text-[11.5px] text-gri-700 mt-2">
                    {c.invoiceCorporateAuto}
                  </div>
                </div>
              ) : (
                <>
                  {/* 3 mod radio */}
                  <div className="space-y-2">
                    {(
                      [
                        {
                          id: "none",
                          label: c.invoiceModeNone,
                          desc: c.invoiceModeNoneDesc,
                        },
                        {
                          id: "individual",
                          label: c.invoiceModeIndividual,
                          desc: c.invoiceModeIndividualDesc,
                        },
                        {
                          id: "corporate",
                          label: c.invoiceModeCorporate,
                          desc: c.invoiceModeCorporateDesc,
                        },
                      ] as const
                    ).map((opt) => {
                      const active = invoiceMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setInvoiceMode(opt.id)}
                          aria-pressed={active}
                          className={cn(
                            "block w-full text-left p-3 rounded-lg ring-[1.5px] transition-all",
                            active
                              ? "ring-pim-mercan bg-pim-mercan-tint/30"
                              : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
                          )}
                        >
                          <div className="font-semibold text-[14px]">
                            {opt.label}
                          </div>
                          <div className="text-[12px] text-gri-700 mt-0.5">
                            {opt.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* TC alanı (bireysel) */}
                  {invoiceMode === "individual" && (
                    <div className="mt-4 space-y-2">
                      <label className="block">
                        <span className="text-[13px] font-semibold mb-1.5 block">
                          {c.tcLabel}
                        </span>
                        <ValidatedInput
                          id="tc-checkout"
                          value={tc}
                          onChange={setTc}
                          validate={validateTcKimlik}
                          placeholder={c.tcPh}
                          maxLength={11}
                          inputMode="numeric"
                        />
                      </label>
                      <p className="text-[12px] text-gri-700 leading-relaxed">
                        {c.tcOptionalNote}
                      </p>
                    </div>
                  )}

                  {/* Kurumsal alanları */}
                  {invoiceMode === "corporate" && (
                    <div className="mt-4 space-y-3">
                      <label className="block">
                        <span className="text-[13px] font-semibold mb-1.5 block">
                          {c.companyNameLabel}
                        </span>
                        <Input
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                        />
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-[13px] font-semibold mb-1.5 block">
                            {c.vknLabel}
                          </span>
                          <ValidatedInput
                            id="vkn-checkout"
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
                            {c.taxOfficeLabel}
                          </span>
                          <Input
                            value={taxOffice}
                            onChange={(e) => setTaxOffice(e.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>

            {/* ================ COUPON ================ */}
            <Card padding="p-5">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Icon.Sparkle size={16} className="text-pim-mercan" />
                {c.couponTitle}
              </h3>
              <div className="flex gap-2">
                <Input
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    setCouponResult(null);
                  }}
                  placeholder={c.couponPh}
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
                    {c.couponRemove}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onCheckCoupon}
                    disabled={couponChecking || couponCode.trim().length < 2}
                  >
                    {couponChecking ? "..." : c.couponApply}
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
                          ).toLocaleString(c.locale)} ${c.currency}`}
                    </span>
                  ) : (
                    <span className="text-kirmizi">
                      {couponResult.reason === "invalid_or_expired"
                        ? c.couponInvalid
                        : couponResult.reason === "min_subtotal"
                          ? c.couponMinSubtotal(couponResult.minSubtotal ?? 0)
                          : couponResult.reason === "user_limit_reached"
                            ? c.couponUserLimit
                            : couponResult.reason === "total_limit_reached"
                              ? c.couponTotalLimit
                              : c.couponDefault}
                    </span>
                  )}
                </div>
              )}
            </Card>

          </div>

          {/* SAĞ — sticky özet */}
          <div className="lg:sticky lg:top-20">
            <Card padding="p-5 md:p-6">
              <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
                <Pim pose="happy" size={32} bob={false} />
                {c.summary}
              </h3>

              <div className="space-y-3 text-[13px]">
                {hydrated && cartItems.length === 0 && (
                  <div className="text-gri-500">{c.cartEmptyRedirect}</div>
                )}
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3">
                    <div className="flex gap-2.5 min-w-0 flex-1">
                      {item.designPreviewUrl && (
                        <div className="grid place-items-center w-9 h-9 rounded bg-white ring-1 ring-gri-200 shrink-0 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.designPreviewUrl}
                            alt=""
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-lacivert text-[12.5px]">
                          {item.title}
                        </span>
                        <span className="block truncate text-[11.5px] text-gri-500">
                          {item.config} · {c.times}
                          {item.qty.toLocaleString(c.locale)}
                        </span>
                      </div>
                    </div>
                    <span className="font-semibold tabular-nums shrink-0 text-[13px]">
                      {fmt(item.total)} {c.currency}
                    </span>
                  </div>
                ))}

                <div className="flex justify-between border-t border-gri-200 pt-3">
                  <span className="text-gri-700">{c.subtotal}</span>
                  <span className="font-semibold tabular-nums">
                    {fmt(subtotal)} {c.currency}
                  </span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-yesil">
                    <span className="font-semibold">
                      {c.couponLabel(couponCode)}
                    </span>
                    <span className="font-semibold tabular-nums">
                      −{fmt(couponDiscount)} {c.currency}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gri-700">{c.shipping}</span>
                  <span className="font-semibold tabular-nums">
                    {effectiveShipping === 0 ? (
                      <span className="text-yesil">{c.free}</span>
                    ) : (
                      `${fmt(effectiveShipping)} ${c.currency}`
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t-2 border-lacivert flex justify-between items-baseline">
                <span className="font-semibold">{c.total}</span>
                <span className="text-2xl font-bold tabular-nums">
                  {fmt(cardAmount)}{" "}
                  <span className="text-base font-semibold text-gri-700">
                    {c.currency}
                  </span>
                </span>
              </div>
              <div className="text-[11.5px] text-gri-700 text-right">
                {c.vatIncluded}
              </div>

              {/* Accept + submit */}
              <label className="flex items-start gap-2.5 text-[13px] text-gri-700 leading-relaxed cursor-pointer mt-5">
                <input
                  type="checkbox"
                  checked={acceptSatis}
                  onChange={(e) => setAcceptSatis(e.target.checked)}
                  className="mt-1 accent-pim-mercan shrink-0"
                />
                <span>
                  <Link
                    href="/mesafeli-satis"
                    target="_blank"
                    className="text-pim-mercan font-semibold hover:underline"
                  >
                    {c.accept}
                  </Link>
                </span>
              </label>

              {/* Telif taahhüdü */}
              <label className="flex items-start gap-2.5 text-[13px] text-gri-700 leading-relaxed cursor-pointer mt-3">
                <input
                  type="checkbox"
                  checked={acceptCopyright}
                  onChange={(e) => setAcceptCopyright(e.target.checked)}
                  className="mt-1 accent-pim-mercan shrink-0"
                />
                <span>{c.acceptCopyright}</span>
              </label>

              <Button
                variant="primary"
                size="lg"
                block
                onClick={submit}
                disabled={!canSubmit}
                className="mt-4"
              >
                {loading
                  ? c.processing
                  : c.proceed(fmt(cardAmount))}{" "}
                {!loading && <Icon.ArrowR />}
              </Button>

              <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-yesil-soft text-yesil text-[11.5px] font-semibold">
                  🔒 3D Secure
                </span>
                <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[11.5px] font-semibold">
                  PayTR ile güvenli
                </span>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ============ TC SKIP MODAL ============ */}
      {showTcSkipModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <Card padding="p-6" className="max-w-[440px] w-full">
            <h3 className="text-lg font-semibold mb-2">
              {c.tcSkipModalTitle}
            </h3>
            <p className="text-[13px] text-gri-700 leading-relaxed mb-5">
              {c.tcSkipModalBody}
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => setShowTcSkipModal(false)}
              >
                {c.tcSkipCancel}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setShowTcSkipModal(false);
                  // Modal "evet" → submit gerçekten çalışsın
                  void submit();
                }}
              >
                {c.tcSkipConfirm}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}

// ============================================================
// Helpers
// ============================================================

function isNewAddressFilled(a: {
  name: string;
  addr: string;
  city: string;
  phone: string;
}): boolean {
  return (
    a.name.trim().length > 1 &&
    a.addr.trim().length > 4 &&
    a.city.trim().length > 1 &&
    a.phone.trim().length > 9
  );
}

function isInvoiceComplete(
  mode: "none" | "individual" | "corporate",
  tc: string,
  vkn: string,
  companyName: string,
  taxOffice: string
): boolean {
  if (mode === "none") return true;
  if (mode === "individual") {
    // TC opsiyonel — boş bırakılabilir, doluysa Maliye checksum gerekir
    if (tc.trim().length === 0) return true;
    return validateTcKimlik(tc).valid;
  }
  // corporate — VKN zorunlu, şirket adı + vergi dairesi zorunlu
  return (
    validateVkn(vkn).valid &&
    companyName.trim().length > 1 &&
    taxOffice.trim().length > 1
  );
}

/** Invoice mode'u backend payload'una çevir */
function buildInvoicePayload(
  mode: "none" | "individual" | "corporate",
  tc: string,
  vkn: string,
  companyName: string,
  taxOffice: string
): {
  type: "individual" | "corporate";
  tc?: string;
  vkn?: string;
  companyName?: string;
  taxOffice?: string;
} {
  if (mode === "corporate") {
    return {
      type: "corporate",
      vkn: vkn.trim(),
      companyName: companyName.trim(),
      taxOffice: taxOffice.trim(),
    };
  }
  if (mode === "individual") {
    return {
      type: "individual",
      tc: tc.trim() || undefined,
    };
  }
  // none → backend'de "tc verilmedi, fiş kesilecek" işareti olarak
  // type=individual + tc=undefined gönderiyoruz (callback metadata'ya
  // koyabilir, ileride fiş için ayrı flag eklenebilir)
  return { type: "individual" };
}
