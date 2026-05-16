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
import { TR_IL_LIST, getIlceler } from "@/lib/locations/tr-locations";

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
      "Yeni teslimat adresi — bilgileri doldur, kaydedilecek ve bir sonraki siparişinde otomatik gelir.",
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
    tcPh: "11 haneli — opsiyonel",
    tcOptionalNote: "Vermek zorunda değilsin (fatura kesilir, KDV gider yazılamaz)",
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
    accept: {
      before: "",
      linkText: "Mesafeli Satış Sözleşmesi",
      after: "'ni okudum, kabul ediyorum.",
    },
    acceptCopyright:
      "Yüklediğim tasarımın telif sahibi benim veya kullanma yetkim var. Başkasının fikri mülkiyetini ihlal etmediğimi taahhüt ediyorum.",
    fasonDisclaimer:
      "Pim Etiket anlaşmalı baskı atölyemizle çalışır. Tasarımın ve kargo bilgilerin yalnızca bu sipariş için atölyeye iletilir, 30 gün sonra imha edilir.",
    fasonDisclaimerLink: "Detay",
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
    addressEmpty: "New delivery address — fill in details, we'll save it for next time.",
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
    tcPh: "11 digits — optional",
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

    accept: {
      before: "I've read and accept the ",
      linkText: "Distance Sales Contract",
      after: ".",
    },
    acceptCopyright:
      "I own or have rights to use the design I'm uploading. I confirm I'm not infringing on anyone else's intellectual property.",
    fasonDisclaimer:
      "Pim Etiket works with a contracted print workshop. Your design and shipping info are sent to the workshop only for this order, destroyed within 30 days.",
    fasonDisclaimerLink: "Details",
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
    firstName: "",
    lastName: "",
    name: "", // computed: firstName + " " + lastName
    addr: "",
    city: "",
    district: "",
    country: "Türkiye",
    phone: "",
  });

  // Invoice state
  // Sefa 16 May: "none" mod kaldırıldı — bireysel fatura default
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>("individual");
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
      } else {
        // PostHog: begin_checkout event
        void import("@/lib/analytics/posthog-events")
          .then(({ track }) => {
            track("begin_checkout", {
              item_count: items.length,
              total: items.reduce((s, i) => s + i.total, 0),
            });
          })
          .catch(() => {
            /* silent */
          });
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

  /** Sefa 17 May UX K#3: Hangi alan eksik? — submit butonunun
      neden disabled olduğunu kullanıcıya net göster */
  const submitMissing: string[] = [];
  if (cartItems.length === 0) submitMissing.push("sepet boş");
  if (selectedAddress === undefined && !isNewAddressFilled(newAddr))
    submitMissing.push("teslimat adresi");
  if (!isInvoiceComplete(invoiceMode, tc, vkn, companyName, taxOffice))
    submitMissing.push("fatura bilgisi");
  if (!acceptSatis) submitMissing.push("Mesafeli Satış Sözleşmesi onayı");
  if (!acceptCopyright) submitMissing.push("Telif hakkı onayı");

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
          // Sefa 16 May: firstName + lastName otomatik birleştiriliyor name'e
          name: `${newAddr.firstName} ${newAddr.lastName}`.trim(),
          // Adres = "addr · ilçe · şehir · ülke" formatı (geriye uyumlu single field)
          addr: [newAddr.addr, newAddr.district, newAddr.city, newAddr.country]
            .filter((s) => s && s.trim().length > 0)
            .join(", "),
          city: newAddr.city, // şehir ayrı tutulur (zaten ayrı kolon)
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
          // FSEK m.66 telif ispatı — server-side audit log (Sefa 12 May)
          acceptCopyright: acceptCopyright as true,
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

  // Sefa 16 May UX denetim P0-5: /odeme direct erişimde sepet
  // boşken sayfanın geri kalanını HİÇ render etme — temiz "Sepete
  // yönlendiriliyor" durumu göster. Aksi halde adres formu vs.
  // boş alanlarla yarı render olup kullanıcı şaşırıyor.
  if (hydrated && cartItems.length === 0) {
    return (
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] grid place-items-center px-4 py-12">
        <div className="text-center max-w-[420px]">
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[22px] md:text-[28px] font-semibold tracking-tight">
            {c.cartEmptyRedirect}
          </h1>
          <p className="mt-3 text-[14px] text-gri-700 leading-relaxed">
            Ödemeye geçmeden önce sepetinde en az bir ürün olmalı.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] pt-10 md:pt-14 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Sefa 17 May UX denetim K#1: sticky topbar başlığı kesiyordu,
            pt-10 md:pt-14 + sayfa header'a margin-top eklendi. */}
        <div className="mb-5 md:mb-7">
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[24px] md:text-[36px] font-semibold tracking-tight text-lacivert">
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
                  {/* Sefa 16 May denetim #21: aria-label eklendi
                      (placeholder ekran okuyucuya tek başına yetmez,
                      WCAG 1.3.1 + 3.3.2). */}
                  {/* Sefa 17 May UX denetim K#4: tüm field'lara label */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="addr-first-name"
                        className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                      >
                        Ad <span className="text-kirmizi">*</span>
                      </label>
                      <Input
                        id="addr-first-name"
                        placeholder="Sefa"
                        aria-label="Ad"
                        value={newAddr.firstName}
                        onChange={(e) => {
                          const firstName = e.target.value;
                          setNewAddr({
                            ...newAddr,
                            firstName,
                            name: `${firstName} ${newAddr.lastName}`.trim(),
                          });
                        }}
                        autoComplete="given-name"
                        required
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="addr-last-name"
                        className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                      >
                        Soyad <span className="text-kirmizi">*</span>
                      </label>
                      <Input
                        id="addr-last-name"
                        placeholder="Yakut"
                        aria-label="Soyad"
                        value={newAddr.lastName}
                        onChange={(e) => {
                          const lastName = e.target.value;
                          setNewAddr({
                            ...newAddr,
                            lastName,
                            name: `${newAddr.firstName} ${lastName}`.trim(),
                          });
                        }}
                        autoComplete="family-name"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="addr-phone"
                      className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                    >
                      Telefon <span className="text-kirmizi">*</span>
                    </label>
                    {/* Sefa 17 May Dalga 2 #11: +90 prefix */}
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1.5 px-3 h-12 rounded-[12px] bg-gri-50 ring-1 ring-gri-200 text-[14px] font-semibold text-lacivert shrink-0">
                        🇹🇷 <span>+90</span>
                      </div>
                      <Input
                        id="addr-phone"
                        placeholder="5XX XXX XX XX"
                        aria-label="Telefon numarası"
                        value={newAddr.phone.replace(/^\+?90\s*/, "")}
                        onChange={(e) => {
                          // Sadece rakam ve boşluk
                          const cleaned = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 10);
                          // +90 prefix DB'ye gider
                          setNewAddr({
                            ...newAddr,
                            phone: cleaned ? `+90${cleaned}` : "",
                          });
                        }}
                        autoComplete="tel-national"
                        required
                        inputMode="tel"
                        maxLength={13}
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="addr-addr"
                      className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                    >
                      Adres (mahalle + sokak + no){" "}
                      <span className="text-kirmizi">*</span>
                    </label>
                    <Input
                      id="addr-addr"
                      placeholder="Beştepeler Mah. Nergis Sok. No:7/2"
                      aria-label="Açık adres"
                      value={newAddr.addr}
                      onChange={(e) =>
                        setNewAddr({ ...newAddr, addr: e.target.value })
                      }
                      autoComplete="street-address"
                      required
                    />
                  </div>
                  {/* Sefa 16 May: Şehir + İlçe — dropdown
                      (81 il + ~973 ilçe — src/lib/locations/tr-locations.ts)
                      Sefa 17 May Dalga 3 #14: Ülke dropdown kaldırıldı, sadece
                      Türkiye desteklendiği için statik rozet gösteriliyor. */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1">
                        Şehir <span className="text-kirmizi">*</span>
                      </label>
                      {/* Sefa 17 May Dalga 3 #13: custom chevron icon */}
                      <div className="relative">
                        <select
                          value={newAddr.city}
                          onChange={(e) =>
                            setNewAddr({
                              ...newAddr,
                              city: e.target.value,
                              district: "", // şehir değişince ilçeyi sıfırla
                            })
                          }
                          autoComplete="address-level1"
                          required
                          className="w-full h-11 pl-3 pr-9 rounded-lg bg-white ring-1 ring-gri-200 text-[13.5px] text-lacivert focus:outline-none focus:ring-pim-mercan appearance-none cursor-pointer"
                        >
                          <option value="">Seç...</option>
                          {TR_IL_LIST.map((il) => (
                            <option key={il} value={il}>
                              {il}
                            </option>
                          ))}
                        </select>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gri-500 pointer-events-none"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1">
                        İlçe <span className="text-kirmizi">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={newAddr.district}
                          onChange={(e) =>
                            setNewAddr({ ...newAddr, district: e.target.value })
                          }
                          autoComplete="address-level2"
                          required
                          disabled={!newAddr.city}
                          className="w-full h-11 pl-3 pr-9 rounded-lg bg-white ring-1 ring-gri-200 text-[13.5px] text-lacivert focus:outline-none focus:ring-pim-mercan disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer disabled:cursor-not-allowed"
                        >
                          <option value="">
                            {newAddr.city ? "Seç..." : "Önce şehir seç"}
                          </option>
                          {getIlceler(newAddr.city).map((ilce) => (
                            <option key={ilce} value={ilce}>
                              {ilce}
                            </option>
                          ))}
                        </select>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gri-500 pointer-events-none"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  {/* Statik ülke gösterimi */}
                  <div className="text-[11.5px] text-gri-500 inline-flex items-center gap-1.5">
                    <span>📍 Teslimat ülkesi:</span>
                    <span className="font-semibold text-lacivert">🇹🇷 Türkiye</span>
                    <span className="text-gri-500">(yurt dışına gönderim henüz aktif değil)</span>
                  </div>
                  <div>
                    <label
                      htmlFor="addr-label"
                      className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                    >
                      Adres etiketi <span className="text-gri-500 normal-case font-normal tracking-normal">(opsiyonel)</span>
                    </label>
                    <Input
                      id="addr-label"
                      placeholder="Ev / Ofis / Atölye"
                      aria-label="Adres etiketi"
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
                  {/* 2 mod radio — Sefa 16 May: "Fatura istemiyorum"
                      seçeneği kaldırıldı (yasal yükümlülük: KDV gideri
                      yazılması zorunlu) */}
                  <div className="space-y-2">
                    {(
                      [
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
                            "relative block w-full text-left p-3 pr-10 rounded-lg ring-[1.5px] transition-all",
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
                          {/* Sefa 17 May Dalga 2 #6: check ikonu */}
                          {active && (
                            <span
                              aria-hidden
                              className="absolute top-3 right-3 grid place-items-center w-5 h-5 rounded-full bg-pim-mercan text-white text-[12px]"
                            >
                              <Icon.Check size={12} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* TC alanı (bireysel) — Sefa 17 May Dalga 2 #7 */}
                  {invoiceMode === "individual" && (
                    <div className="mt-4 space-y-1.5">
                      <label className="block">
                        <span className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1">
                          {c.tcLabel}
                          <span className="text-gri-500 normal-case font-normal tracking-normal">
                            (opsiyonel)
                          </span>
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
                      <p className="text-[11.5px] text-gri-500 italic leading-relaxed">
                        ℹ {c.tcOptionalNote}
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

            {/* COUPON Sefa 17 May Dalga 2 #9: sağ sipariş özet kartına taşındı,
                sol kolondaki ayrı card kaldırıldı. */}

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

                {/* Sefa 17 May Dalga 2 #9: kupon inline (eski ayrı card kaldırıldı) */}
                <div className="border-t border-gri-200 pt-3">
                  <div className="flex gap-2">
                    <Input
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setCouponResult(null);
                      }}
                      placeholder={c.couponPh}
                      aria-label={c.couponTitle}
                      className="flex-1 uppercase tracking-wider !text-[12.5px] !h-10"
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
                  {couponResult && !couponResult.ok && (
                    <div className="mt-2 text-[12px] leading-relaxed text-kirmizi">
                      {couponResult.reason === "invalid_or_expired"
                        ? c.couponInvalid
                        : couponResult.reason === "min_subtotal"
                          ? c.couponMinSubtotal(couponResult.minSubtotal ?? 0)
                          : couponResult.reason === "user_limit_reached"
                            ? c.couponUserLimit
                            : couponResult.reason === "total_limit_reached"
                              ? c.couponTotalLimit
                              : c.couponDefault}
                    </div>
                  )}
                  {couponResult?.ok && couponResult.kind === "free_ship" && (
                    <div className="mt-2 text-[12px] text-yesil font-semibold flex items-center gap-1.5">
                      <Icon.Check size={12} /> Kargo ücretsiz!
                    </div>
                  )}
                </div>

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
              {/* Sefa 17 May Dalga 3 #16: KDV dahil notu büyütüldü
                  11.5px → 13px + font-medium ile okunabilirlik arttı */}
              <div className="text-[13px] font-medium text-gri-700 text-right">
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
                  {c.accept.before}
                  <Link
                    href="/mesafeli-satis"
                    target="_blank"
                    className="text-pim-mercan font-semibold hover:underline"
                  >
                    {c.accept.linkText}
                  </Link>
                  {c.accept.after}
                </span>
              </label>

              {/* Fason üretim disclaimer (KVKK m.5/2-c bilgilendirme) */}
              <div className="mt-3 px-3 py-2.5 rounded-lg bg-gri-50 ring-1 ring-gri-200 text-[12px] text-gri-700 leading-relaxed flex items-start gap-2">
                <span aria-hidden="true">🏭</span>
                <span>
                  {c.fasonDisclaimer}{" "}
                  <Link
                    href="/gizlilik"
                    target="_blank"
                    className="font-semibold text-pim-mercan hover:underline"
                  >
                    {c.fasonDisclaimerLink} →
                  </Link>
                </span>
              </div>

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

              {/* Sefa 17 May UX K#3: butonun neden disabled olduğunu göster */}
              {!canSubmit && submitMissing.length > 0 && (
                <div className="mt-3 rounded-lg bg-saman/15 ring-1 ring-saman/30 px-3 py-2 text-[12.5px] text-saman-koyu">
                  <strong>Eksik:</strong> {submitMissing.join(" · ")}
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                block
                onClick={submit}
                disabled={!canSubmit}
                className={cn(
                  "mt-3 font-bold !text-white",
                  !canSubmit && "!bg-gri-300 !text-gri-500 cursor-not-allowed",
                  canSubmit && "!bg-pim-mercan hover:!bg-pim-mercan-koyu shadow-mercan"
                )}
              >
                {loading
                  ? c.processing
                  : c.proceed(fmt(cardAmount))}{" "}
                {!loading && <Icon.ArrowR />}
              </Button>

              {/* Sefa 17 May Dalga 3 #18: trust rozetleri büyütüldü
                  22px → 28px height, font 11.5 → 13, ikon görünürlüğü +
                  SSL rozet de eklendi (footer'daki gibi) */}
              <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-yesil-soft text-yesil text-[12.5px] font-semibold">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  3D Secure
                </span>
                <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-yesil-soft text-yesil text-[12.5px] font-semibold">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  SSL
                </span>
                <span
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-gri-100 ring-1 ring-gri-200"
                  aria-label="PayTR ile güvenli ödeme"
                  title="PayTR ile güvenli ödeme"
                >
                  <span className="text-[11px] font-semibold text-gri-700 uppercase tracking-[0.04em]">
                    Ödeme altyapısı
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logos/paytr/paytr-color.svg"
                    alt="PayTR"
                    width="52"
                    height="14"
                    style={{ height: "14px", width: "auto" }}
                  />
                </span>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ============ TC SKIP MODAL ============ */}
      {showTcSkipModal && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/40 backdrop-blur-sm p-4"
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
  firstName?: string;
  lastName?: string;
  name: string;
  addr: string;
  city: string;
  district?: string;
  phone: string;
}): boolean {
  // firstName + lastName birlikte sağlanması yeterli (name otomatik üretiliyor)
  const nameOk =
    (a.firstName?.trim().length ?? 0) > 1 &&
    (a.lastName?.trim().length ?? 0) > 1;
  return (
    nameOk &&
    a.addr.trim().length > 4 &&
    a.city.trim().length > 1 &&
    (a.district?.trim().length ?? 0) > 1 &&
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
