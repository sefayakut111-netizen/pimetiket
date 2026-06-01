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
  useToast,
} from "@/components/ui";
import { DesignThumbnailGroup } from "@/components/cart/DesignThumbnailGroup";
import { filterConfigString } from "@/lib/cart-config-filter";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/context";
import { mapApiError } from "@/lib/api-error-messages";
import { validateTcKimlik, validateVkn } from "@/lib/validation";
import {
  listCustomerCart,
  summarizeCustomerCart,
  clearCustomerCart,
  refreshCustomerCart,
  repriceCustomerCart,
  ensureAuthBindings,
  setCustomerCartShippingSettings,
  type CustomerCartItem,
} from "@/lib/customer-cart";
import {
  addDaysIso,
} from "@/lib/customer-order";
import {
  validateCoupon,
  type CouponValidateResult,
} from "@/lib/customer-coupon";
import {
  listMyAddresses,
  deleteMyAddress,
  type CustomerAddress,
} from "@/lib/customer-profile";
import {
  listMyInvoiceProfiles,
  createMyInvoiceProfile,
  deleteMyInvoiceProfile,
  setDefaultInvoiceProfile,
  type CustomerInvoiceProfile,
} from "@/lib/customer-invoice";
import { TR_IL_LIST, getIlceler } from "@/lib/locations/tr-locations";
import {
  parseTrPhoneToLocal,
  formatTrPhoneForDb,
  dbPhoneToInputValue,
} from "@/lib/validation/phone-tr";

const CHECKOUT_INIT_LOCK_KEY = "pim_checkout_init_lock";

const CHECKOUT_STAY_ON_PAGE_ERRORS = new Set([
  "coupon_invalid",
  "subtotal_mismatch",
  "total_mismatch",
  "shipping_mismatch",
  "pricing_validation_failed",
  "min_order_not_met",
  "max_order_exceeded",
  "invalid_body",
  "amount_too_low",
  "checkout_in_progress",
]);

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
    currency: "₺",
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
    tcPh: "11 haneli",
    tcRequiredNote:
      "E-arşiv fatura için TC kimlik zorunludur (GİB e-fatura yönetmeliği).",
    vknLabel: "VKN",
    companyNameLabel: "Şirket ünvanı",
    taxOfficeLabel: "Vergi dairesi",
    companyAddressLabel: "Fatura adresi",
    companyAddressPh:
      "Şirketinizin yasal adresi (Tic. sicil adresi)",
    invoiceLabelLabel: "Fatura etiketi",
    invoiceLabelPh: "(opsiyonel) Kendi şirketim",
    invoiceProfileSaved: "Bu kurumsal fatura bilgileri kaydedildi.",
    invoiceProfileSwitch: "Başka bir kurumsal fatura kullan",
    invoiceProfileAdd: "Yeni kurumsal fatura ekle",
    invoiceProfileDelete: "Sil",
    invoiceProfileLimit:
      "Maksimum 2 kurumsal fatura kaydedebilirsin. Yeni eklemek için birini silmen lazım.",
    invoiceProfileBack: "← Kayıtlı faturalarıma dön",
    invoiceProfileFormSave: "Bu kurumsal faturayı kaydet",
    invoiceProfileDefaultBadge: "Varsayılan",
    addressLimit:
      "Maksimum 5 adres kaydedebilirsin. Yeni eklemek için bir adresi silmen lazım.",

    // Coupon
    couponTitle: "Kupon kodun var mı?",
    couponRulesHint:
      "Her siparişte yalnızca 1 kupon kullanılabilir; kuponlar birleştirilemez.",
    couponPh: "ÖRN: HOSGELDIN10",
    couponApply: "Uygula",
    couponRemove: "Kaldır",
    couponInvalid: "Bu kupon kodu geçersiz veya süresi dolmuş.",
    couponRpcError:
      "Şu an kupon kontrolü yapamıyoruz. Birkaç saniye sonra tekrar dene.",
    couponAppliedPercent: (pct: number, discount: string) =>
      `✓ Kupon uygulandı — %${pct} indirim (-${discount} ₺)`,
    couponAppliedFixed: (discount: string) =>
      `✓ Kupon uygulandı — ${discount} ₺ indirim`,
    couponAppliedFreeShip: "✓ Kupon uygulandı — Kargo ücretsiz",
    couponMinSubtotal: (n: number) =>
      `Min sepet tutarı ${n} ₺ — bu indirimden faydalanmıyor.`,
    couponUserLimit: "Bu kuponu zaten kullandın.",
    couponTotalLimit: "Bu kuponun kullanım limiti doldu.",
    couponWrongUser: "Bu kupon senin hesabına tanımlı değil.",
    couponDefault: "Kupon uygulanamadı, tekrar dene.",

    // Summary
    subtotal: "Ara toplam (KDV hariç)",
    vatLabel: "KDV (%20)",
    couponLabel: (code: string) => `Kupon: ${code}`,
    shipping: "Kargo",
    free: "Ücretsiz",
    total: "TOPLAM",
    cardLabel: "Karta",
    fullTotal: "Toplam:",
    vatIncluded: "KDV dahil",

    // Sefa 20 May v68 UX paket A:
    estDelivery: "Tahmini teslimat",
    deliveryDays: {
      sticker: "3-5 iş günü",
      etiket: "5-7 iş günü",
    } as Record<"sticker" | "etiket", string>,
    deliveryNote:
      "Tasarımı zamanında yüklersen kargo bu süre içinde elinde.",
    paymentMethodsTitle: "Kabul edilen ödeme araçları",
    paymentMethodsNote:
      "Taksit seçeneklerin PayTR güvenli ödeme ekranında görünür.",

    // Action
    accept: {
      before: "",
      linkText: "Mesafeli Satış Sözleşmesi",
      after: "'ni okudum, kabul ediyorum.",
    },
    acceptCopyright:
      "Yükleyeceğim tasarımın telif sahibi benim veya kullanma yetkim var. Başkasının fikri mülkiyetini ihlal etmediğimi taahhüt ediyorum.",
    // Sefa 20 May v68 #27: "anlaşmalı baskı atölyesi" → "üretim partneri" (Pim Etiket terminolojisi)
    fasonDisclaimer:
      "Pim Etiket, anlaşmalı üretim partneriyle çalışır. Tasarımın ve kargo bilgilerin yalnızca bu sipariş için partnere iletilir, 30 gün sonra imha edilir.",
    fasonDisclaimerLink: "Detay",
    proceed: (amount: string) => `Güvenli ödemeye geç — ${amount} ₺`,
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
    tcPh: "11 digits",
    tcRequiredNote:
      "TC ID is required for e-archive invoice (Turkish Revenue Administration requirement).",
    vknLabel: "Tax number (VKN)",
    companyNameLabel: "Company legal name",
    taxOfficeLabel: "Tax office",
    companyAddressLabel: "Invoice address",
    companyAddressPh: "Company's legal registered address",
    invoiceLabelLabel: "Invoice label",
    invoiceLabelPh: "(optional) My company",
    invoiceProfileSaved: "This corporate invoice has been saved.",
    invoiceProfileSwitch: "Use a different corporate invoice",
    invoiceProfileAdd: "Add new corporate invoice",
    invoiceProfileDelete: "Delete",
    invoiceProfileLimit:
      "Maximum 2 corporate invoices can be saved. Delete one to add new.",
    invoiceProfileBack: "← Back to saved invoices",
    invoiceProfileFormSave: "Save this corporate invoice",
    invoiceProfileDefaultBadge: "Default",
    addressLimit:
      "Maximum 5 addresses can be saved. Delete one to add new.",

    couponTitle: "Got a coupon?",
    couponRulesHint:
      "Only one coupon per order; coupons cannot be combined.",
    couponPh: "EXAMPLE: WELCOME10",
    couponApply: "Apply",
    couponRemove: "Remove",
    couponInvalid: "This coupon is invalid or expired.",
    couponRpcError:
      "Cannot check coupon right now. Try again in a few seconds.",
    couponAppliedPercent: (pct: number, discount: string) =>
      `✓ Coupon applied — ${pct}% off (-${discount} TRY)`,
    couponAppliedFixed: (discount: string) =>
      `✓ Coupon applied — ${discount} TRY off`,
    couponAppliedFreeShip: "✓ Coupon applied — Free shipping",
    couponMinSubtotal: (n: number) =>
      `Min subtotal ${n} TRY — discount doesn't apply.`,
    couponUserLimit: "You've already used this coupon.",
    couponTotalLimit: "Coupon usage limit reached.",
    couponWrongUser: "This coupon is not assigned to your account.",
    couponDefault: "Coupon couldn't be applied, try again.",

    subtotal: "Subtotal (VAT excl.)",
    vatLabel: "VAT (20%)",
    couponLabel: (code: string) => `Coupon: ${code}`,
    shipping: "Shipping",
    free: "Free",
    total: "TOTAL",
    cardLabel: "On card",
    fullTotal: "Total:",
    vatIncluded: "VAT included",

    estDelivery: "Est. delivery",
    deliveryDays: {
      sticker: "3-5 business days",
      etiket: "5-7 business days",
    } as Record<"sticker" | "etiket", string>,
    deliveryNote: "Ships within this window if you upload the design on time.",
    paymentMethodsTitle: "Accepted payment methods",
    paymentMethodsNote:
      "Installment options appear on PayTR's secure payment screen.",

    accept: {
      before: "I've read and accept the ",
      linkText: "Distance Sales Contract",
      after: ".",
    },
    acceptCopyright:
      "I own or will have rights to use the design I'm uploading. I confirm I'm not infringing on anyone else's intellectual property.",
    // Sefa 20 May v68 #27: production partner terminology
    fasonDisclaimer:
      "Pim Etiket works with a contracted production partner. Your design and shipping info are sent to the partner only for this order, destroyed within 30 days.",
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
  const toast = useToast();

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
  // Sefa 17 May: TC ZORUNLU oldu (GİB e-arşiv yönetmeliği) → skip modal kaldırıldı
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>("individual");
  const [tc, setTc] = useState("");

  // Kurumsal fatura — kayıtlı profiller + yeni form
  const [invoiceProfiles, setInvoiceProfiles] = useState<
    CustomerInvoiceProfile[]
  >([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null
  );
  const [showNewInvoiceForm, setShowNewInvoiceForm] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    label: "",
    vkn: "",
    companyName: "",
    taxOffice: "",
    companyAddress: "",
    saveAndDefault: true,
  });
  const [invoiceLimitWarning, setInvoiceLimitWarning] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);

  // Coupon
  // Sefa 20 May v68 UX paket B #12: Kupon collapse — default kapalı,
  // "İndirim kodun var mı?" linkine tıklayınca açılır. Kupon zaten
  // uygulanmışsa otomatik açık tut.
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponValidateResult | null>(
    null
  );
  const [couponChecking, setCouponChecking] = useState(false);

  // Submit
  const [acceptSatis, setAcceptSatis] = useState(false);
  const [acceptCopyright, setAcceptCopyright] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [minOrderTotal, setMinOrderTotal] = useState(0);
  const [maxOrderTotal, setMaxOrderTotal] = useState(0);

  // ============================================================
  // Hydration
  // ============================================================

  useEffect(() => {
    ensureAuthBindings();

    // Cart
    void refreshCustomerCart().then(() => {
      void repriceCustomerCart().then((repriceResult) => {
        const items = repriceResult?.items ?? listCustomerCart();
        setCartItems(items);
        setHydrated(true);
        if (items.length === 0) {
          router.replace("/sepet");
          return;
        }
        void import("@/lib/analytics/posthog-events")
          .then(({ track }) => {
            const cartTotal = items.reduce((s, i) => s + i.total, 0);
            const pendingCoupon =
              typeof window !== "undefined"
                ? window.sessionStorage.getItem("pim_pending_coupon")
                : null;
            track("checkout_started", {
              itemCount: items.length,
              total: cartTotal,
              hasCoupon: Boolean(pendingCoupon),
            });
            track("begin_checkout", {
              item_count: items.length,
              total: cartTotal,
            });
          })
          .catch(() => {
            /* silent */
          });
        void import("@/lib/analytics/ga4-events")
          .then(({ ga4BeginCheckout }) => {
            const cartTotal = items.reduce((s, i) => s + i.total, 0);
            ga4BeginCheckout(cartTotal, items.length);
          })
          .catch(() => {
            /* silent */
          });
      });
    });

    void fetch("/api/public/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.settings) {
          setMinOrderTotal(Number(json.settings.min_order_total_try ?? 0));
          setMaxOrderTotal(Number(json.settings.max_order_total_try ?? 0));
          setCustomerCartShippingSettings(
            Number(json.settings.shipping_fee_try ?? 49),
            Number(json.settings.free_shipping_threshold ?? 500)
          );
        }
      })
      .catch(() => {
        /* silent */
      });

    // Admin kontrolü
    void import("@/lib/supabase/client").then(({ createClient }) => {
      const sb = createClient();
      sb.auth.getUser().then(({ data }) => {
        if (!data.user) return;
        sb.from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single()
          .then(({ data: p }) => {
            const r = (p as { role?: string } | null)?.role;
            if (r === "admin" || r === "staff") setIsAdmin(true);
          });
      });
    });

    // Adresler
    void listMyAddresses().then((list) => {
      setAddresses(list);
      // Smart default: default işaretli olan, yoksa ilk adres
      const def = list.find((a) => a.isDefault) ?? list[0];
      if (def) setSelectedAddressId(def.id);
      else setShowNewAddressForm(true); // 0 adres → inline form
    });

    // Kayıtlı kurumsal fatura profilleri (Migration 044, max 2)
    void listMyInvoiceProfiles().then((list) => {
      setInvoiceProfiles(list);
      if (list.length > 0) {
        // 1+ kayıt varsa kurumsal moduna otomatik geç + default seç
        setInvoiceMode("corporate");
        const def = list.find((p) => p.isDefault) ?? list[0];
        setSelectedInvoiceId(def.id);
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

  // Kurumsal fatura: seçili kayıt veya yeni form?
  const selectedInvoiceProfile = invoiceProfiles.find(
    (p) => p.id === selectedInvoiceId
  );

  // Adres limit kontrolü (max 5 — Migration 044 trigger)
  const addressLimitReached = addresses.length >= 5;

  /** Sefa 17 May: TC ZORUNLU + Kurumsal'a adres ZORUNLU */
  const invoiceComplete = isInvoiceCompleteV2({
    mode: invoiceMode,
    tc,
    selectedInvoiceProfile,
    newInvoice,
    showNewInvoiceForm,
    invoiceProfilesCount: invoiceProfiles.length,
  });

  /** Form complete mi? Submit aktive olur mu? */
  const orderTotalWithinLimits =
    (minOrderTotal <= 0 || subtotal >= minOrderTotal) &&
    (maxOrderTotal <= 0 || subtotal <= maxOrderTotal);

  const canSubmit =
    !loading &&
    cartItems.length > 0 &&
    orderTotalWithinLimits &&
    acceptSatis &&
    acceptCopyright &&
    (selectedAddress !== undefined || isNewAddressFilled(newAddr)) &&
    invoiceComplete;

  /** Sefa 17 May UX K#3: Hangi alan eksik? — submit butonunun
      neden disabled olduğunu kullanıcıya net göster */
  const submitMissing: string[] = [];
  // Sefa 17 May P1-9: "fatura bilgisi" yerine HANGI alan eksik söyle
  if (cartItems.length === 0) submitMissing.push("sepet boş");
  if (minOrderTotal > 0 && subtotal < minOrderTotal) {
    submitMissing.push(`minimum sipariş tutarı (${fmt(minOrderTotal)} ₺)`);
  }
  if (maxOrderTotal > 0 && subtotal > maxOrderTotal) {
    submitMissing.push(`maksimum sipariş tutarı (${fmt(maxOrderTotal)} ₺)`);
  }
  if (selectedAddress === undefined && !isNewAddressFilled(newAddr))
    submitMissing.push("teslimat adresi");
  if (!invoiceComplete) {
    if (invoiceMode === "individual") {
      if (tc.trim().length === 0) {
        submitMissing.push("TC kimlik numarası");
      } else if (!validateTcKimlik(tc).valid) {
        submitMissing.push("TC kimlik (geçersiz numara — kontrol et)");
      }
    } else if (invoiceMode === "corporate" && !selectedInvoiceProfile) {
      const missingFields: string[] = [];
      if (!validateVkn(newInvoice.vkn).valid) missingFields.push("VKN");
      if (newInvoice.companyName.trim().length < 2)
        missingFields.push("şirket ünvanı");
      if (newInvoice.taxOffice.trim().length < 2)
        missingFields.push("vergi dairesi");
      if (newInvoice.companyAddress.trim().length < 5)
        missingFields.push("fatura adresi");
      if (missingFields.length > 0) {
        submitMissing.push(`kurumsal fatura (${missingFields.join(", ")})`);
      } else {
        submitMissing.push("kurumsal fatura");
      }
    } else {
      submitMissing.push("fatura bilgisi");
    }
  }
  if (!acceptSatis) submitMissing.push("Mesafeli Satış Sözleşmesi onayı");
  if (!acceptCopyright) submitMissing.push("Telif hakkı onayı");

  // ============================================================
  // Address delete (Sefa 17 May — 5 limit + UX)
  // ============================================================

  const [deletingAddress, setDeletingAddress] = useState(false);
  const handleDeleteAddress = async (id: string) => {
    if (deletingAddress) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm("Bu adresi silmek istediğine emin misin?")
    ) {
      return;
    }
    setDeletingAddress(true);
    const r = await deleteMyAddress(id);
    if (r.ok) {
      const fresh = await listMyAddresses();
      setAddresses(fresh);
      if (selectedAddressId === id) {
        setSelectedAddressId(fresh[0]?.id ?? null);
        if (fresh.length === 0) {
          setShowNewAddressForm(true);
        }
      }
    }
    setDeletingAddress(false);
  };

  // ============================================================
  // Invoice profile delete
  // ============================================================

  const handleDeleteInvoiceProfile = async (id: string) => {
    if (savingInvoice) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Bu kurumsal fatura kaydını silmek istediğine emin misin?"
      )
    ) {
      return;
    }
    setSavingInvoice(true);
    const r = await deleteMyInvoiceProfile(id);
    if (r.ok) {
      // Listeyi yenile
      const fresh = await listMyInvoiceProfiles();
      setInvoiceProfiles(fresh);
      // Seçili olan silindiyse seçimi temizle
      if (selectedInvoiceId === id) {
        setSelectedInvoiceId(
          fresh.length > 0
            ? (fresh.find((p) => p.isDefault) ?? fresh[0]).id
            : null
        );
        if (fresh.length === 0) {
          setShowNewInvoiceForm(true);
        }
      }
      setInvoiceLimitWarning(false);
    }
    setSavingInvoice(false);
  };

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

    // Sefa 17 May — Submit'te EKSİKSİZ guard
    // (canSubmit disabled olsa bile direkt çağrı olursa burada blokla)
    if (!canSubmit) {
      const firstMissing = submitMissing[0] ?? "form alanları";
      toast.error(`⚠ Eksik: ${firstMissing}`);
      // İlk eksik alana scroll
      if (typeof document !== "undefined") {
        let target: HTMLElement | null = null;
        if (submitMissing.includes("teslimat adresi")) {
          target = document.getElementById("addr-first-name");
        } else if (submitMissing.includes("fatura bilgisi")) {
          if (invoiceMode === "individual") {
            target = document.getElementById("tc-checkout");
          } else {
            target = document.getElementById("inv-vkn");
          }
        }
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.focus();
        }
      }
      return;
    }

    setLoading(true);

    if (
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(CHECKOUT_INIT_LOCK_KEY)
    ) {
      toast.error(mapApiError("checkout_in_progress", locale));
      setLoading(false);
      return;
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(CHECKOUT_INIT_LOCK_KEY, String(Date.now()));
    }

    const repriceResult = await repriceCustomerCart();
    const paymentItems = repriceResult?.items ?? listCustomerCart();
    if (paymentItems.length === 0) {
      toast.error("Sepetiniz boş — ödeme yapılamaz.");
      setLoading(false);
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(CHECKOUT_INIT_LOCK_KEY);
      }
      router.replace("/sepet");
      return;
    }
    setCartItems(paymentItems);
    const paymentSummary = summarizeCustomerCart();
    const paymentSubtotal = paymentSummary.subtotal;
    const paymentShipping = paymentSummary.shipping;
    const paymentCouponDiscount =
      couponResult?.ok && couponResult.kind !== "free_ship"
        ? couponResult.discount
        : 0;
    const paymentCouponFreeShip =
      couponResult?.ok && couponResult.kind === "free_ship";
    const paymentEffectiveShipping = paymentCouponFreeShip ? 0 : paymentShipping;
    const paymentTotal =
      paymentSubtotal - paymentCouponDiscount + paymentEffectiveShipping;

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

    // Fatura snapshot — TC zorunlu (individual) + kurumsal'a adres dahil
    const invoice = buildInvoicePayloadV2({
      mode: invoiceMode,
      tc,
      selectedInvoiceProfile,
      newInvoice,
    });

    // Kurumsal: yeni fatura ise + saveAndDefault ise → DB'ye kaydet
    // (limit aşılırsa hata göster, kullanıcıyı blokla)
    if (
      invoiceMode === "corporate" &&
      !selectedInvoiceProfile &&
      newInvoice.saveAndDefault
    ) {
      const r = await createMyInvoiceProfile({
        label: newInvoice.label.trim() || null,
        vkn: newInvoice.vkn.trim(),
        companyName: newInvoice.companyName.trim(),
        taxOffice: newInvoice.taxOffice.trim(),
        companyAddress: newInvoice.companyAddress.trim(),
        isDefault: true,
      });
      if (!r.ok && r.reason === "limit_reached") {
        setInvoiceLimitWarning(true);
        setLoading(false);
        return;
      }
      // limit harici hata → siparişe devam (DB kayıt critical değil)
    }

    try {
      const res = await fetch("/api/payment/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: paymentItems,
          address: addr,
          invoice,
          subtotal: paymentSubtotal,
          shipping: paymentEffectiveShipping,
          total: paymentTotal,
          couponCode: couponResult?.ok ? couponCode.trim() : undefined,
          // FSEK m.66 telif ispatı — server-side audit log (Sefa 12 May)
          acceptCopyright: acceptCopyright as true,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          reason?: string;
          detail?: string;
          code?: string;
          hint?: string;
        };
        if (res.status === 401) {
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.removeItem(CHECKOUT_INIT_LOCK_KEY);
          }
          router.push(`/auth?next=${encodeURIComponent("/odeme")}`);
          return;
        }
        const errCode = data.error ?? `payment_init_failed_${res.status}`;
        if (
          res.status === 409 ||
          CHECKOUT_STAY_ON_PAGE_ERRORS.has(errCode)
        ) {
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.removeItem(CHECKOUT_INIT_LOCK_KEY);
          }
          toast.error(
            mapApiError(
              errCode,
              locale,
              data.hint ?? data.reason ?? data.detail
            )
          );
          setLoading(false);
          return;
        }
        if (res.status === 503) {
          // PSP yapılandırılmamış. SADECE dev modunda mock fallback —
          // production'da müşterinin para vermeden sipariş açmasını
          // engellemek için "Ödeme yakında" sayfasına yönlendir.
          if (process.env.NODE_ENV !== "production") {
            console.warn("[odeme] PSP not configured, dev mock fallback");
            const mockRes = await fetch("/api/dev/mock-checkout", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                items: paymentItems,
                address: addr,
                invoice,
                subtotal: paymentSubtotal,
                shipping: paymentEffectiveShipping,
                total: paymentTotal,
                estimatedDelivery: addDaysIso(
                  paymentItems.some((i) => i.product === "etiket") ? 10 : 5
                ),
              }),
            });
            if (!mockRes.ok) {
              throw new Error("dev_mock_checkout_failed");
            }
            const mockData = (await mockRes.json()) as { orderId?: string };
            if (!mockData.orderId) throw new Error("missing_order_id");
            await clearCustomerCart();
            router.push(`/odeme-sonuc?status=success&order=${mockData.orderId}`);
            return;
          }
          // Production: ödeme aktif değil
          router.push("/odeme-sonuc?status=fail&reason=psp_unavailable");
          return;
        }
        // PayTR alt-reason + Zod detail + err code da error mesajına eklensin —
        // /odeme-sonuc?reason= üzerinde Sefa debug görsün (21 May v68 fix)
        const baseErr = data.error ?? `payment_init_failed_${res.status}`;
        const parts = [data.reason, data.detail, data.code].filter(Boolean);
        const detail = parts.length ? ` (${parts.join(" | ")})` : "";
        throw new Error(`${baseErr}${detail}`);
      }

      const payload = (await res.json()) as {
        paymentPageUrl?: string;
        checkoutInProgress?: boolean;
      };
      if (payload.checkoutInProgress) {
        toast.info(mapApiError("checkout_in_progress", locale));
      }
      if (!payload.paymentPageUrl) throw new Error("missing_payment_page_url");
      window.location.href = payload.paymentPageUrl;
    } catch (err) {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(CHECKOUT_INIT_LOCK_KEY);
      }
      setLoading(false);
      console.error("[odeme] payment init failed:", err);
      const raw =
        err instanceof Error ? err.message : "unknown";
      const errCode = raw.split(" (")[0]?.split(":")[0] ?? raw;
      if (CHECKOUT_STAY_ON_PAGE_ERRORS.has(errCode)) {
        toast.error(mapApiError(errCode, locale, raw));
        return;
      }
      router.push(
        `/odeme-sonuc?status=fail&reason=${encodeURIComponent(raw)}`
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
            pt-10 md:pt-14 + sayfa header'a margin-top eklendi.
            Sefa 20 May v68 (test): 3-adım stepper kaldırıldı, yerine
            büyükçe "Sepete dön" linki — geri dönüş yolu daha vurgulu. */}
        <div className="mb-5 md:mb-7">
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[24px] md:text-[36px] font-semibold tracking-tight text-lacivert">
            {c.title}
          </h1>

          <Link
            href="/sepet"
            className="mt-4 inline-flex items-center gap-2 text-[15px] md:text-[16px] font-bold text-pim-mercan hover:underline"
          >
            <span aria-hidden="true">←</span>
            {locale === "en" ? "Back to cart" : "Sepete dön"}
          </Link>
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
                        placeholder="Adınız"
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
                        placeholder="Soyadınız"
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
                        value={dbPhoneToInputValue(newAddr.phone)}
                        onChange={(e) => {
                          // Sefa 17 May P0-1: parseTrPhoneToLocal "+90"/"90"/"0"
                          // prefix'lerini güvenli şekilde strip eder. Eski
                          // bug: paste edilen +90... numara 12 hane → ilk
                          // 10 alındığında alan kodu kalıyordu.
                          const local10 = parseTrPhoneToLocal(e.target.value);
                          setNewAddr({
                            ...newAddr,
                            phone: formatTrPhoneForDb(local10),
                          });
                        }}
                        autoComplete="tel-national"
                        required
                        inputMode="tel"
                        maxLength={10}
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
                  {/* Sefa 20 May v68 UX paket B #21: "yurt dışı henüz aktif değil"
                      negatif notu kaldırıldı (gereksiz bilişsel yük). */}
                  <div className="text-[11.5px] text-gri-500 inline-flex items-center gap-1.5">
                    <span>📍 Teslimat ülkesi:</span>
                    <span className="font-semibold text-lacivert">🇹🇷 Türkiye</span>
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

              {/* Slot picker — 1, 2, 3... numaralı chip'ler + yeni ekle.
                  Sefa 19 May v68: dropdown/radio kart yerine üstte sabit
                  slot şeridi. Aktif slot içeriği aşağıda özet kartında. */}
              {!showNewAddressForm && addresses.length > 0 && (
                <div className="space-y-3">
                  {/* Chip şeridi — 5 slot maks + ekle chip'i */}
                  <div className="flex flex-wrap gap-2">
                    {addresses.map((a, idx) => {
                      const isSelected = selectedAddressId === a.id;
                      const slotNum = idx + 1;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setSelectedAddressId(a.id)}
                          aria-pressed={isSelected}
                          title={`${a.label ?? "Adres"} — ${a.name}`}
                          className={cn(
                            "relative flex flex-col items-start gap-1 min-w-[120px] max-w-[180px]",
                            "px-3 py-2.5 rounded-xl ring-[1.5px] transition-all text-left",
                            isSelected
                              ? "ring-pim-mercan bg-pim-mercan-tint/40 shadow-mercan"
                              : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
                          )}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <span
                              className={cn(
                                "grid place-items-center w-6 h-6 rounded-full text-[12px] font-bold shrink-0",
                                isSelected
                                  ? "bg-pim-mercan text-white"
                                  : "bg-gri-100 text-gri-700"
                              )}
                            >
                              {slotNum}
                            </span>
                            <span className="text-[12px] font-semibold text-lacivert truncate flex-1">
                              {a.label ?? "Adres"}
                            </span>
                            {a.isDefault && (
                              <span
                                className="text-[10px] text-pim-mercan"
                                title="Varsayılan"
                              >
                                ★
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gri-700 truncate w-full leading-tight">
                            {a.city}
                          </div>
                          {isSelected && (
                            <span className="absolute -top-1.5 -right-1.5 grid place-items-center w-5 h-5 rounded-full bg-pim-mercan text-white shadow ring-2 ring-white">
                              <Icon.Check size={10} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {/* + Yeni adres — boş slot chip'i */}
                    {!addressLimitReached && (
                      <button
                        type="button"
                        onClick={() => setShowNewAddressForm(true)}
                        title="Yeni adres ekle"
                        className="flex flex-col items-center justify-center gap-0.5 min-w-[120px] px-3 py-2.5 rounded-xl ring-[1.5px] ring-dashed ring-gri-300 text-gri-700 hover:ring-pim-mercan hover:text-pim-mercan transition-all"
                      >
                        <span className="grid place-items-center w-6 h-6 rounded-full bg-gri-100 text-[14px] font-bold">
                          +
                        </span>
                        <span className="text-[11.5px] font-semibold">
                          {addresses.length + 1}. ekle
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Aktif slot içeriği — kompakt özet + sil/düzenle */}
                  {selectedAddress && (
                    <div className="flex items-start justify-between gap-3 px-4 py-3 rounded-lg bg-gri-50 ring-1 ring-gri-200">
                      <div className="text-[13px] leading-relaxed text-gri-700 flex-1 min-w-0">
                        <div className="font-semibold text-lacivert">
                          {selectedAddress.name}
                        </div>
                        <div>{selectedAddress.addr}</div>
                        <div>
                          {selectedAddress.city} · +90 {selectedAddress.phone}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowNewAddressForm(true)}
                          className="text-[12px] font-semibold text-pim-mercan hover:underline whitespace-nowrap"
                        >
                          ✎ Düzenle / Yeni
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteAddress(selectedAddress.id)
                          }
                          className="text-[12px] font-semibold text-kirmizi hover:underline whitespace-nowrap"
                          aria-label="Bu adresi sil"
                        >
                          🗑 Sil
                        </button>
                      </div>
                    </div>
                  )}

                  {addressLimitReached && (
                    <div className="rounded-lg bg-saman/15 ring-1 ring-saman/30 px-3 py-2 text-[12.5px] text-saman-koyu">
                      ℹ {c.addressLimit}
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* ================ INVOICE ================
                Sefa 17 May: TC ZORUNLU + Kurumsal'a adres ZORUNLU.
                Kurumsal fatura için kayıtlı profil sistemi (max 2). */}
            <Card padding="p-5 md:p-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Icon.Box size={18} className="text-pim-mercan" />
                {c.invoiceTitle}
                <span className="text-kirmizi">*</span>
              </h2>

              {/* 2 mod radio */}
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

              {/* ============ BİREYSEL — TC ZORUNLU ============ */}
              {invoiceMode === "individual" && (
                <div className="mt-4 space-y-1.5">
                  <label className="block">
                    <span className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1">
                      {c.tcLabel}
                      <span className="text-kirmizi">*</span>
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
                    ℹ {c.tcRequiredNote}
                  </p>
                </div>
              )}

              {/* ============ KURUMSAL — Smart defaults (0/1/2) ============ */}
              {invoiceMode === "corporate" && (
                <div className="mt-4">
                  {/* 0 kayıt veya yeni form aktif */}
                  {(showNewInvoiceForm || invoiceProfiles.length === 0) && (
                    <div className="space-y-3">
                      <div>
                        <label
                          htmlFor="inv-label"
                          className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                        >
                          {c.invoiceLabelLabel}{" "}
                          <span className="text-gri-500 normal-case font-normal tracking-normal">
                            (opsiyonel)
                          </span>
                        </label>
                        <Input
                          id="inv-label"
                          placeholder={c.invoiceLabelPh}
                          value={newInvoice.label}
                          onChange={(e) =>
                            setNewInvoice({
                              ...newInvoice,
                              label: e.target.value,
                            })
                          }
                          aria-label="Fatura etiketi"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="inv-company"
                          className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                        >
                          {c.companyNameLabel}{" "}
                          <span className="text-kirmizi">*</span>
                        </label>
                        <Input
                          id="inv-company"
                          value={newInvoice.companyName}
                          onChange={(e) =>
                            setNewInvoice({
                              ...newInvoice,
                              companyName: e.target.value,
                            })
                          }
                          autoComplete="organization"
                          required
                          aria-label="Şirket ünvanı"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="inv-vkn"
                            className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                          >
                            {c.vknLabel}{" "}
                            <span className="text-kirmizi">*</span>
                          </label>
                          <ValidatedInput
                            id="inv-vkn"
                            value={newInvoice.vkn}
                            onChange={(v) =>
                              setNewInvoice({ ...newInvoice, vkn: v })
                            }
                            validate={validateVkn}
                            placeholder="10 haneli"
                            maxLength={10}
                            inputMode="numeric"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="inv-tax"
                            className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                          >
                            {c.taxOfficeLabel}{" "}
                            <span className="text-kirmizi">*</span>
                          </label>
                          <Input
                            id="inv-tax"
                            value={newInvoice.taxOffice}
                            onChange={(e) =>
                              setNewInvoice({
                                ...newInvoice,
                                taxOffice: e.target.value,
                              })
                            }
                            required
                            aria-label="Vergi dairesi"
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="inv-addr"
                          className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1"
                        >
                          {c.companyAddressLabel}{" "}
                          <span className="text-kirmizi">*</span>
                        </label>
                        <textarea
                          id="inv-addr"
                          value={newInvoice.companyAddress}
                          onChange={(e) =>
                            setNewInvoice({
                              ...newInvoice,
                              companyAddress: e.target.value,
                            })
                          }
                          placeholder={c.companyAddressPh}
                          required
                          rows={3}
                          aria-label="Fatura adresi"
                          className="w-full px-3 py-2.5 rounded-[12px] bg-white ring-1 ring-gri-200 text-[14px] text-lacivert focus:outline-none focus:ring-pim-mercan resize-none"
                        />
                      </div>
                      <label className="flex items-start gap-2 text-[12.5px] text-gri-700 leading-relaxed cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newInvoice.saveAndDefault}
                          onChange={(e) =>
                            setNewInvoice({
                              ...newInvoice,
                              saveAndDefault: e.target.checked,
                            })
                          }
                          className="mt-0.5 accent-pim-mercan shrink-0"
                        />
                        <span>
                          💾 {c.invoiceProfileFormSave} (
                          {invoiceProfiles.length}/2)
                        </span>
                      </label>
                      {invoiceProfiles.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewInvoiceForm(false);
                            setInvoiceLimitWarning(false);
                          }}
                          className="text-[12.5px] font-semibold text-gri-700 hover:text-pim-mercan"
                        >
                          {c.invoiceProfileBack}
                        </button>
                      )}
                      {invoiceLimitWarning && (
                        <div className="rounded-lg bg-saman/15 ring-1 ring-saman/30 px-3 py-2 text-[12.5px] text-saman-koyu">
                          {c.invoiceProfileLimit}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 1 kayıt → kompakt özet */}
                  {!showNewInvoiceForm &&
                    invoiceProfiles.length === 1 &&
                    selectedInvoiceProfile && (
                      <div className="flex items-start justify-between gap-3 px-4 py-3 rounded-lg bg-gri-50 ring-1 ring-gri-200">
                        <div className="text-[13px] leading-relaxed text-gri-700 flex-1 min-w-0">
                          <div className="font-semibold text-lacivert truncate">
                            {selectedInvoiceProfile.label ??
                              selectedInvoiceProfile.companyName}
                          </div>
                          <div className="font-mono text-[12px]">
                            VKN: {selectedInvoiceProfile.vkn} ·{" "}
                            {selectedInvoiceProfile.taxOffice}
                          </div>
                          <div className="text-[12px] truncate">
                            {selectedInvoiceProfile.companyAddress}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewInvoiceForm(true);
                              setSelectedInvoiceId(null);
                            }}
                            className="text-[12px] font-semibold text-pim-mercan hover:underline whitespace-nowrap"
                          >
                            {c.invoiceProfileSwitch}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteInvoiceProfile(
                                selectedInvoiceProfile.id
                              )
                            }
                            className="text-[12px] font-semibold text-kirmizi hover:underline whitespace-nowrap"
                            aria-label="Bu kurumsal faturayı sil"
                          >
                            🗑 {c.invoiceProfileDelete}
                          </button>
                        </div>
                      </div>
                    )}

                  {/* 2 kayıt → radio kart (limit dolu) */}
                  {!showNewInvoiceForm && invoiceProfiles.length === 2 && (
                    <div className="space-y-2">
                      {invoiceProfiles.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedInvoiceId(p.id)}
                          aria-pressed={selectedInvoiceId === p.id}
                          className={cn(
                            "block w-full text-left p-3.5 rounded-lg ring-[1.5px] transition-all",
                            selectedInvoiceId === p.id
                              ? "ring-pim-mercan bg-pim-mercan-tint/30"
                              : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-[13px] leading-relaxed flex-1 min-w-0">
                              <div className="font-semibold text-lacivert flex items-center gap-2">
                                <span className="truncate">
                                  {p.label ?? p.companyName}
                                </span>
                                {p.isDefault && (
                                  <span className="inline-flex items-center h-[18px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[10.5px] font-semibold shrink-0">
                                    {c.invoiceProfileDefaultBadge}
                                  </span>
                                )}
                              </div>
                              <div className="text-gri-700 mt-0.5 font-mono text-[12px]">
                                VKN: {p.vkn} · {p.taxOffice}
                              </div>
                              <div className="text-gri-700 text-[12px] line-clamp-1">
                                {p.companyAddress}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {selectedInvoiceId === p.id && (
                                <span className="grid place-items-center w-6 h-6 rounded-full bg-pim-mercan text-white">
                                  <Icon.Check size={12} />
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteInvoiceProfile(p.id);
                                }}
                                className="grid place-items-center min-w-11 min-h-11 w-11 h-11 rounded-full text-kirmizi hover:bg-kirmizi/10 transition-colors"
                                aria-label={`${p.label ?? p.companyName} faturasını sil`}
                                title="Sil"
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                        </button>
                      ))}
                      <div className="text-[12px] text-gri-500 italic mt-2">
                        ℹ {c.invoiceProfileLimit}
                      </div>
                    </div>
                  )}
                </div>
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
                {/* Sefa 20 May v68 UX paket A #4: DesignThumb — sepetle aynı
                    3-öncelikli component. PDF/PSD/AI yüklendiyse gerçek
                    preview, yoksa format rozeti, yoksa ürün ikonu. */}
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 items-start">
                    <div className="flex gap-2.5 min-w-0 flex-1">
                      <DesignThumbnailGroup item={item} size="sm" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-lacivert text-[12.5px]">
                          {item.title}
                        </span>
                        {/* Sefa 20 May v68 UX paket A #25: adet tipografi
                            tutardan ayrıştırıldı.
                            Sefa 21 May (test): filterConfigString — fiyata
                            etki etmeyen Sarım/Göbek/rulodaki adet/Özelleştirme
                            yok kaldırıldı (sepetle aynı, kalabalık önlendi). */}
                        <span className="block text-[11.5px] text-gri-500 leading-tight">
                          {filterConfigString(item.config)}
                        </span>
                        <span className="block text-[11px] text-gri-500 mt-0.5 tabular-nums">
                          {item.qty.toLocaleString(c.locale)} adet
                        </span>
                      </div>
                    </div>
                    <span className="font-semibold tabular-nums shrink-0 text-[13px]">
                      {fmt(item.total)} {c.currency}
                    </span>
                  </div>
                ))}

                {/* Sefa 20 May v68 UX paket B #12: Kupon ara toplam'ın altına
                    taşındı + collapse. Eski yer (ürünler ile ara toplam arası)
                    akışı bölüyordu. Şimdi "İndirim kodun var mı?" link altta,
                    tıklanınca açılır. Kupon zaten uygulanmışsa otomatik açık. */}

                {/* Sefa 20 May v68 UX paket A #17: KDV kırılımı (B2B kritik).
                    Birim fiyatlar zaten KDV dahil → ara toplam ondan çıkartılır. */}
                <div className="flex justify-between border-t border-gri-200 pt-3">
                  <span className="text-gri-700">{c.subtotal}</span>
                  <span className="font-semibold tabular-nums">
                    {fmt(subtotal / 1.2)} {c.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gri-700">{c.vatLabel}</span>
                  <span className="font-semibold tabular-nums">
                    {fmt(subtotal - subtotal / 1.2)} {c.currency}
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

                {/* Kupon alani — her zaman gorunur */}
                <div className="pt-2">
                  <div id="coupon-form">
                    <p className="text-[12px] font-semibold text-gri-700 mb-1">
                      {c.couponTitle}
                    </p>
                    <p className="text-[11.5px] text-gri-500 mb-2 leading-relaxed">
                      {c.couponRulesHint}
                    </p>
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
                        <div className="mt-2 rounded-lg bg-kirmizi/10 ring-1 ring-kirmizi/20 px-3 py-2 text-[12.5px] leading-relaxed text-kirmizi-koyu">
                          ⚠{" "}
                          {couponResult.reason === "invalid_or_expired"
                            ? c.couponInvalid
                            : couponResult.reason === "min_subtotal"
                              ? c.couponMinSubtotal(couponResult.minSubtotal ?? 0)
                              : couponResult.reason === "user_limit_reached"
                                ? c.couponUserLimit
                                : couponResult.reason === "total_limit_reached"
                                  ? c.couponTotalLimit
                                  : couponResult.reason === "wrong_user"
                                    ? c.couponWrongUser
                                    : couponResult.reason === "rpc_error" ||
                                      couponResult.reason === "invalid_response"
                                    ? c.couponRpcError
                                    : c.couponDefault}
                        </div>
                      )}
                      {couponResult?.ok && (
                        <div className="mt-2 rounded-lg bg-yesil-soft/60 ring-1 ring-yesil/30 px-3 py-2 text-[12.5px] text-yesil-koyu font-semibold leading-relaxed">
                          {couponResult.kind === "free_ship"
                            ? c.couponAppliedFreeShip
                            : couponResult.kind === "percent"
                              ? c.couponAppliedPercent(
                                  subtotal > 0
                                    ? Math.round(
                                        (couponResult.discount / subtotal) * 100
                                      )
                                    : 0,
                                  fmt(couponResult.discount)
                                )
                              : c.couponAppliedFixed(fmt(couponResult.discount))}
                        </div>
                      )}
                    </div>
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
              <div className="text-[13px] font-medium text-gri-700 text-right">
                {c.vatIncluded}
              </div>

              {/* Sefa 20 May v68 UX paket A #3: Tahmini teslimat — ürün-spesifik.
                  Karışık sepette (sticker + etiket) en uzun süre gösterilir. */}
              {cartItems.length > 0 && (
                <div className="mt-4 flex items-start gap-2 bg-gri-50 rounded-lg p-3">
                  <Icon.Package size={18} className="text-pim-mercan shrink-0 mt-0.5" />
                  <div className="text-[12px] leading-relaxed">
                    <div className="font-semibold text-lacivert">
                      {c.estDelivery}:{" "}
                      <span className="text-pim-mercan">
                        {cartItems.some((i) => i.product === "etiket")
                          ? c.deliveryDays.etiket
                          : c.deliveryDays.sticker}
                      </span>
                    </div>
                    <div className="text-gri-700 text-[11px] mt-0.5">
                      {c.deliveryNote}
                    </div>
                  </div>
                </div>
              )}

              {/* Accept + submit
                  Sefa 17 May P2-28: checkbox tap target 14×14 → 20×20
                  (label ile beraber clickable area zaten geniş, ama
                  checkbox'ın kendisi de görünür ve dokunulabilir olsun) */}
              <label htmlFor="accept-satis-cb" className="flex items-start gap-3 text-[13px] text-gri-700 leading-relaxed cursor-pointer mt-5 min-h-[44px] py-1">
                <input
                  id="accept-satis-cb"
                  type="checkbox"
                  checked={acceptSatis}
                  onChange={(e) => setAcceptSatis(e.target.checked)}
                  className="mt-0.5 accent-pim-mercan shrink-0 w-5 h-5 cursor-pointer"
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

              {/* Sefa 20 May v68 (test): "Pim Etiket anlaşmalı üretim partneri
                  ..." disclaimer kaldırıldı (gereksiz, KVKK bildirimi
                  zaten gizlilik politikasında detayda var). */}
              {false && (
              <div className="mt-3 px-3 py-2.5 rounded-lg bg-gri-50 ring-1 ring-gri-200 text-[12px] text-gri-700 leading-relaxed flex items-start gap-2">
                <span aria-hidden="true">🏭</span>
                <span>
                  {c.fasonDisclaimer}{" "}
                  <Link
                    href="/gizlilik#fason-aktarim"
                    target="_blank"
                    className="font-semibold text-pim-mercan hover:underline"
                    title="Fason atölyeye veri aktarım detayları (Gizlilik Politikası)"
                  >
                    Veri akışı detayı →
                  </Link>
                </span>
              </div>
              )}

              {/* Telif taahhüdü — Sefa 17 May P2-28: aynı tap target */}
              <label htmlFor="accept-copyright-cb" className="flex items-start gap-3 text-[13px] text-gri-700 leading-relaxed cursor-pointer mt-3 min-h-[44px] py-1">
                <input
                  id="accept-copyright-cb"
                  type="checkbox"
                  checked={acceptCopyright}
                  onChange={(e) => setAcceptCopyright(e.target.checked)}
                  className="mt-0.5 accent-pim-mercan shrink-0 w-5 h-5 cursor-pointer"
                />
                <span>{c.acceptCopyright}</span>
              </label>

              {/* Sefa 20 May v68 (test): "Eksik: ..." satırı kaldırıldı —
                  submitMissing submit guard'da kullanılıyor. */}
              {submitMissing.length > 0 && !canSubmit && (
                <p
                  id="checkout-submit-hint"
                  role="alert"
                  className="text-xs text-kirmizi mt-2"
                >
                  Eksik: {submitMissing[0]}
                </p>
              )}

              <Button
                variant="primary"
                size="lg"
                block
                onClick={submit}
                disabled={!canSubmit}
                aria-describedby={
                  submitMissing.length > 0 ? "checkout-submit-hint" : undefined
                }
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

              {isAdmin && (
                <button
                  type="button"
                  onClick={async () => {
                    if (loading || cartItems.length === 0) return;
                    setLoading(true);
                    try {
                      const addr = selectedAddress
                        ? {
                            label: selectedAddress.label ?? undefined,
                            name: selectedAddress.name,
                            addr: selectedAddress.addr,
                            city: selectedAddress.city,
                            phone: selectedAddress.phone,
                          }
                        : {
                            name: `${newAddr.firstName} ${newAddr.lastName}`.trim() || "Admin Test",
                            addr: newAddr.addr || "Test adres",
                            city: newAddr.city || "Istanbul",
                            phone: newAddr.phone || "5551234567",
                          };
                      const invoice = { type: "individual" as const, tc: "00000000000" };
                      const bypassRes = await fetch("/api/admin/orders/bypass-checkout", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          items: cartItems,
                          address: addr,
                          invoice,
                          subtotal,
                          shipping: effectiveShipping,
                          total: effectiveTotal,
                          estimatedDelivery: addDaysIso(
                            cartItems.some((i) => i.product === "etiket") ? 10 : 5
                          ),
                        }),
                      });
                      if (!bypassRes.ok) {
                        throw new Error("admin_bypass_checkout_failed");
                      }
                      const bypassData = (await bypassRes.json()) as {
                        orderId?: string;
                      };
                      if (!bypassData.orderId) {
                        throw new Error("missing_order_id");
                      }
                      const order = { id: bypassData.orderId };
                      await clearCustomerCart();
                      // Tasarım promote + QC tetikle (payment callback'in yaptığını burada da yap)
                      try {
                        await fetch("/api/orders/admin-bypass-promote", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ orderId: order.id }),
                        });
                      } catch { /* sessiz — sipariş zaten oluştu */ }
                      const hasDesigns = cartItems.some(
                        (i) =>
                          !!i.designTempId &&
                          !i.designTempId.startsWith("local-")
                      );
                      console.log("[admin-bypass] hasDesigns:", hasDesigns);
                      router.push(`/odeme-sonuc?status=success&order=${order.id}&hasDesigns=${hasDesigns}`);
                    } catch (err) {
                      setLoading(false);
                      toast.error("Admin bypass hata: " + (err instanceof Error ? err.message : "bilinmeyen"));
                    }
                  }}
                  disabled={loading || cartItems.length === 0}
                  className="mt-2 w-full rounded-lg border border-dashed border-gri-300 bg-gri-50 px-3 py-2 text-xs font-medium text-gri-500 hover:border-pim-mercan hover:text-pim-mercan transition"
                >
                  {loading ? "İşleniyor..." : "Admin devam et (ödeme atla)"}
                </button>
              )}

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

              {/* Sefa 20 May v68 UX paket A #2: Kabul edilen kart markaları +
                  taksit PayTR bilgisi. Taksit Pim Etiket'te yok — PayTR
                  ekranında otomatik geliyor. */}
              <div className="mt-4 pt-4 border-t border-gri-200">
                <div className="text-[11.5px] font-semibold text-gri-700 mb-2 text-center uppercase tracking-wider">
                  {c.paymentMethodsTitle}
                </div>
                <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
                  {/* Visa */}
                  <span className="inline-grid place-items-center h-7 px-2.5 rounded bg-white ring-1 ring-gri-200" aria-label="Visa">
                    <span className="font-bold text-[13px]" style={{ color: "#1A1F71", letterSpacing: "0.05em" }}>VISA</span>
                  </span>
                  {/* MasterCard */}
                  <span className="inline-grid place-items-center h-7 px-2 rounded bg-white ring-1 ring-gri-200" aria-label="Mastercard">
                    <svg width="32" height="20" viewBox="0 0 32 20" aria-hidden="true">
                      <circle cx="12" cy="10" r="8" fill="#EB001B" />
                      <circle cx="20" cy="10" r="8" fill="#F79E1B" />
                      <path d="M16 4.5a8 8 0 0 1 0 11 8 8 0 0 1 0-11z" fill="#FF5F00" />
                    </svg>
                  </span>
                  {/* Troy */}
                  <span className="inline-grid place-items-center h-7 px-2.5 rounded bg-white ring-1 ring-gri-200" aria-label="Troy">
                    <span className="font-bold text-[13px] tracking-tight" style={{ color: "#00ADEF" }}>troy</span>
                  </span>
                  {/* American Express */}
                  <span className="inline-grid place-items-center h-7 px-2.5 rounded bg-white ring-1 ring-gri-200" aria-label="American Express">
                    <span className="font-bold text-[10px] leading-tight text-center" style={{ color: "#2E77BB" }}>AMERICAN<br/>EXPRESS</span>
                  </span>
                </div>
                <p className="text-[11px] text-gri-500 text-center leading-relaxed">
                  💳 {c.paymentMethodsNote}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* TC SKIP MODAL — Sefa 17 May TC ZORUNLU yapıldığı için kaldırıldı */}
    </main>
  );
}

// ============================================================
// Helpers
// ============================================================

/**
 * Sefa 20 May v68 UX paket B #16: Eksiklik bildirimi tıklanabilir.
 * Her eksik madde için ilgili form alanının id'sini döner.
 */
function getAnchorForMissing(label: string): string | null {
  if (label === "teslimat adresi") return "addr-first-name";
  if (label.startsWith("TC kimlik")) return "tc-checkout";
  if (label.startsWith("kurumsal fatura")) return "inv-vkn";
  if (label === "Mesafeli Satış Sözleşmesi onayı") return "accept-satis-cb";
  if (label === "Telif hakkı onayı") return "accept-copyright-cb";
  if (label === "fatura bilgisi") return "invoice-section";
  return null;
}

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

/**
 * Sefa 17 May: V2 fatura validasyon
 * - Bireysel: TC ZORUNLU (GİB e-arşiv yönetmeliği)
 * - Kurumsal: ya seçili kayıt VAR ya da yeni form COMPLETE (VKN + Şirket +
 *   Vergi Dairesi + Adres — m.5/c)
 */
function isInvoiceCompleteV2(args: {
  mode: "individual" | "corporate" | "none";
  tc: string;
  selectedInvoiceProfile: CustomerInvoiceProfile | undefined;
  newInvoice: {
    vkn: string;
    companyName: string;
    taxOffice: string;
    companyAddress: string;
  };
  showNewInvoiceForm: boolean;
  invoiceProfilesCount: number;
}): boolean {
  if (args.mode === "individual") {
    // TC ZORUNLU — Sefa 17 May (validateTcKimlik boş için true döner, ekstra
    // length kontrolü gerekli)
    return args.tc.trim().length === 11 && validateTcKimlik(args.tc).valid;
  }
  if (args.mode === "corporate") {
    // Seçili kayıt varsa OK
    if (args.selectedInvoiceProfile) return true;
    // Yoksa yeni form complete olmalı: VKN + Şirket + Vergi + Adres
    return (
      validateVkn(args.newInvoice.vkn).valid &&
      args.newInvoice.companyName.trim().length > 1 &&
      args.newInvoice.taxOffice.trim().length > 1 &&
      args.newInvoice.companyAddress.trim().length > 4
    );
  }
  return false;
}

/** V2 — kurumsal'a adres dahil */
function buildInvoicePayloadV2(args: {
  mode: "individual" | "corporate" | "none";
  tc: string;
  selectedInvoiceProfile: CustomerInvoiceProfile | undefined;
  newInvoice: {
    label: string;
    vkn: string;
    companyName: string;
    taxOffice: string;
    companyAddress: string;
  };
}): {
  type: "individual" | "corporate";
  tc?: string;
  vkn?: string;
  companyName?: string;
  taxOffice?: string;
  companyAddress?: string;
  label?: string;
} {
  if (args.mode === "corporate") {
    if (args.selectedInvoiceProfile) {
      return {
        type: "corporate",
        vkn: args.selectedInvoiceProfile.vkn,
        companyName: args.selectedInvoiceProfile.companyName,
        taxOffice: args.selectedInvoiceProfile.taxOffice,
        companyAddress: args.selectedInvoiceProfile.companyAddress,
        label: args.selectedInvoiceProfile.label ?? undefined,
      };
    }
    return {
      type: "corporate",
      vkn: args.newInvoice.vkn.trim(),
      companyName: args.newInvoice.companyName.trim(),
      taxOffice: args.newInvoice.taxOffice.trim(),
      companyAddress: args.newInvoice.companyAddress.trim(),
      label: args.newInvoice.label.trim() || undefined,
    };
  }
  return {
    type: "individual",
    tc: args.tc.trim(),
  };
}
