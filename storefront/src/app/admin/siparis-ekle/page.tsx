/**
 * /admin/siparis-ekle — Manuel sipariş giriş formu.
 *
 * Telefonla / WhatsApp'la / showroom'dan gelen siparişi DB'ye kaydeder
 * (/api/admin/orders/manual → fn_create_manual_order RPC).
 */

"use client";

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Card, Button, Input, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { validateTcKimlik } from "@/lib/validation";
import { addDaysIso } from "@/lib/customer-order";
import {
  quoteCustomerSticker,
  type StickerMaterial,
  type StickerFinish,
} from "@/lib/sticker-customer-pricing";
import {
  quoteCustomerEtiket,
  type EtiketMaterialId,
  type EtiketCoatingId,
  type EtiketCustomId,
} from "@/lib/etiket-customer-pricing";
import { getLivePricingConfig } from "@/lib/pricing-config-client";
import {
  quoteStickerFromConfig,
  quoteEtiketFromConfig,
} from "@/lib/customer-pricing-from-config";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from "@/lib/storage/design-files";
import { categorizeFile, BLOCKED_FILE_MESSAGE } from "@/lib/design-file-types";
import {
  validateCoupon,
  type CouponValidateOk,
} from "@/lib/customer-coupon";

type ProductType = "etiket" | "sticker";
type InvoiceType = "individual" | "corporate";
type PaymentMethod = "transfer" | "cash" | "card_in_person";
type DiscountType = "none" | "percent" | "fixed";
type SubmitAction = "redirect" | "new";

interface OrderItem {
  id: string;
  product: ProductType;
  title: string;
  titleManual: boolean;
  width: string;
  height: string;
  qty: string;
  unit: string;
  material: string;
  coating: string;
  shape: string;
  customization: string;
  skipDesign: boolean;
  designFile: File | null;
  designPreviewUrl?: string;
}

interface CustomerSearchRow {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  email: string;
  invoice_type: "individual" | "corporate" | null;
  last_order_id: string | null;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  transfer: "Havale / EFT",
  cash: "Nakit",
  card_in_person: "Kart (elden)",
};

const STICKER_MATERIALS = [
  { id: "vinil", label: "Vinil" },
  { id: "transparan", label: "Transparan" },
  { id: "holo", label: "Holografik" },
  { id: "simli", label: "Simli" },
] as const;

const ETIKET_MATERIALS = [
  { id: "kuse", label: "Kuşe" },
  { id: "kraft", label: "Kraft" },
  { id: "beyaz", label: "Opak PP" },
  { id: "seffaf", label: "Şeffaf" },
  { id: "metalik", label: "Metalize" },
] as const;

const COATINGS = [
  { id: "yok", label: "Kaplama yok" },
  { id: "mat", label: "Mat selefon" },
  { id: "parlak", label: "Parlak selefon" },
  { id: "soft_touch", label: "Soft touch" },
] as const;

const SHAPES = [
  { id: "diecut", label: "Diecut" },
  { id: "square", label: "Kare" },
  { id: "circle", label: "Yuvarlak" },
  { id: "oval", label: "Oval" },
] as const;

const CUSTOMIZATIONS = [
  { id: "yok", label: "Yok" },
  { id: "emboss", label: "Emboss" },
  { id: "yaldiz", label: "Yaldız" },
  { id: "spotuv", label: "Spot UV" },
] as const;

const VAT_RATE = 0.2;
const DRAFT_KEY = "pim_manual_order_draft_v1";

function newItem(product: ProductType = "etiket"): OrderItem {
  const isSticker = product === "sticker";
  return {
    id: crypto.randomUUID(),
    product,
    title: "",
    titleManual: false,
    width: isSticker ? "70" : "60",
    height: isSticker ? "70" : "40",
    qty: isSticker ? "100" : "1000",
    unit: "",
    material: isSticker ? "vinil" : "kuse",
    coating: "mat",
    shape: "diecut",
    customization: "yok",
    skipDesign: false,
    designFile: null,
  };
}

function materialLabel(item: OrderItem): string {
  const list =
    item.product === "sticker" ? STICKER_MATERIALS : ETIKET_MATERIALS;
  return list.find((m) => m.id === item.material)?.label ?? item.material;
}

function coatingLabel(item: OrderItem): string {
  return COATINGS.find((c) => c.id === item.coating)?.label ?? item.coating;
}

function autoTitleForItem(item: OrderItem): string {
  const kind = item.product === "etiket" ? "Etiket" : "Sticker";
  return `${kind} — ${materialLabel(item)} ${coatingLabel(item)}`.trim();
}

function mapStickerFinish(coating: string): StickerFinish {
  if (coating === "parlak") return "parlak";
  if (coating === "yok") return "yok";
  return "mat";
}

function mapEtiketCoating(coating: string): EtiketCoatingId {
  if (coating === "parlak") return "parlak";
  if (coating === "soft_touch") return "soft";
  if (coating === "yok") return "yok";
  return "mat";
}

function mapEtiketMaterial(material: string): EtiketMaterialId {
  const allowed: EtiketMaterialId[] = [
    "kraft",
    "beyaz",
    "kuse",
    "seffaf",
    "ultra",
    "metalik",
  ];
  if (allowed.includes(material as EtiketMaterialId)) {
    return material as EtiketMaterialId;
  }
  return "kuse";
}

function mapCustomization(value: string): EtiketCustomId {
  const allowed: EtiketCustomId[] = ["yok", "emboss", "yaldiz", "spotuv"];
  if (allowed.includes(value as EtiketCustomId)) {
    return value as EtiketCustomId;
  }
  return "yok";
}

function resolveFileMime(file: File): string {
  if (file.type && (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return file.type;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "ai":
      return "application/illustrator";
    case "psd":
      return "image/vnd.adobe.photoshop";
    case "svg":
      return "image/svg+xml";
    default:
      return file.type || "";
  }
}

export default function AdminCreateOrderPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [submitAction, setSubmitAction] = useState<SubmitAction>("redirect");
  const [hasDraft, setHasDraft] = useState(false);
  const draftLoadedRef = useRef(false);

  // Müşteri
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerSearchRow[]>(
    []
  );
  const [linkedCustomerUserId, setLinkedCustomerUserId] = useState<
    string | null
  >(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Fatura
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("individual");
  const [tc, setTc] = useState("");
  const [vkn, setVkn] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [taxOffice, setTaxOffice] = useState("");

  // Ürünler
  const [items, setItems] = useState<OrderItem[]>(() => [newItem("etiket")]);

  // Ödeme
  const [payment, setPayment] = useState<PaymentMethod>("transfer");
  const [notes, setNotes] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("none");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidateOk | null>(
    null
  );
  const [couponLoading, setCouponLoading] = useState(false);
  const [deliveryDays, setDeliveryDays] = useState(12);
  const [calcLoadingId, setCalcLoadingId] = useState<string | null>(null);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, newItem("etiket")]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      const removed = prev.find((i) => i.id === id);
      if (removed?.designPreviewUrl) {
        URL.revokeObjectURL(removed.designPreviewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<OrderItem>) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i))
    );
  }, []);

  const resetForm = useCallback(() => {
    setName("");
    setPhone("");
    setEmail("");
    setCity("");
    setAddress("");
    setCustomerSearch("");
    setCustomerResults([]);
    setLinkedCustomerUserId(null);
    setInvoiceType("individual");
    setTc("");
    setVkn("");
    setCompanyName("");
    setTaxOffice("");
    setItems((prev) => {
      prev.forEach((i) => {
        if (i.designPreviewUrl) URL.revokeObjectURL(i.designPreviewUrl);
      });
      return [newItem("etiket")];
    });
    setPayment("transfer");
    setNotes("");
    setDiscountType("none");
    setDiscountValue("");
    setDiscountReason("");
    setCouponCode("");
    setAppliedCoupon(null);
    setDeliveryDays(12);
    setHasDraft(false);
  }, []);

  const itemTotals = useMemo(
    () =>
      items.map((i) => {
        const q = Number(i.qty) || 0;
        const u = i.unit.trim() === "" ? 0 : Number(i.unit) || 0;
        return q * u;
      }),
    [items]
  );

  const hasValidPricing = useMemo(
    () =>
      items.every((i) => {
        const q = Number(i.qty) || 0;
        const u = i.unit.trim() === "" ? 0 : Number(i.unit) || 0;
        return q > 0 && u > 0;
      }),
    [items]
  );

  const tcValidation = useMemo(() => validateTcKimlik(tc), [tc]);
  const tcInvalid =
    invoiceType === "individual" && tc.trim().length > 0 && !tcValidation.valid;

  const subtotal = itemTotals.reduce((s, t) => s + t, 0);

  const manualDiscountAmount = useMemo(() => {
    const val = Number(discountValue) || 0;
    if (discountType === "percent") return Math.round((subtotal * val) / 100);
    if (discountType === "fixed") return Math.min(val, subtotal);
    return 0;
  }, [discountType, discountValue, subtotal]);

  const couponDiscountAmount = appliedCoupon?.discount ?? 0;

  const discountAmount = manualDiscountAmount + couponDiscountAmount;

  const vatBase = Math.max(0, subtotal - discountAmount);
  const vat = Math.round(vatBase * VAT_RATE);
  const shipping = vatBase >= 1000 || vatBase === 0 ? 0 : 49;
  const total = vatBase + vat + shipping;

  const canCreate = total > 0 && items.length > 0 && hasValidPricing;

  const primaryProduct = items[0]?.product ?? "etiket";

  useEffect(() => {
    setDeliveryDays(primaryProduct === "sticker" ? 7 : 12);
  }, [primaryProduct]);

  // Müşteri arama
  useEffect(() => {
    if (customerSearch.length < 2) {
      setCustomerResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/admin/customers?search=${encodeURIComponent(customerSearch)}&limit=5`
        );
        if (res.ok) {
          const data = (await res.json()) as { customers?: CustomerSearchRow[] };
          setCustomerResults(data.customers ?? []);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const applyCouponCode = useCallback(async () => {
    const code = couponCode.trim();
    if (!code) {
      toast.error("Kupon kodu girin");
      return;
    }
    setCouponLoading(true);
    try {
      const result = await validateCoupon(code, subtotal);
      if (!result.ok) {
        setAppliedCoupon(null);
        toast.error(
          result.reason === "min_subtotal" && result.minSubtotal
            ? `Minimum tutar ${result.minSubtotal.toLocaleString("tr-TR")} ₺`
            : "Kupon geçersiz veya süresi dolmuş"
        );
        return;
      }
      setAppliedCoupon(result);
      toast.success(
        `Kupon uygulandı: −${result.discount.toLocaleString("tr-TR")} ₺`
      );
    } finally {
      setCouponLoading(false);
    }
  }, [couponCode, subtotal, toast]);

  const selectCustomer = useCallback(
    async (c: CustomerSearchRow) => {
      setLinkedCustomerUserId(c.user_id);
      setName(c.display_name ?? "");
      setPhone(c.phone ?? "");
      setEmail(c.email ?? "");
      if (c.invoice_type === "corporate") {
        setInvoiceType("corporate");
      } else {
        setInvoiceType("individual");
      }

      if (c.last_order_id) {
        try {
          const res = await fetch(`/api/admin/orders/${c.last_order_id}`);
          if (res.ok) {
            const data = (await res.json()) as {
              order?: {
                address?: { city?: string; addr?: string };
                invoice?: {
                  tc?: string;
                  vkn?: string;
                  companyName?: string;
                  taxOffice?: string;
                  type?: InvoiceType;
                };
              };
            };
            const addr = data.order?.address;
            if (addr?.city) setCity(addr.city);
            if (addr?.addr) setAddress(addr.addr);
            const inv = data.order?.invoice;
            if (inv?.type === "corporate") {
              setInvoiceType("corporate");
              if (inv.vkn) setVkn(inv.vkn);
              if (inv.companyName) setCompanyName(inv.companyName);
              if (inv.taxOffice) setTaxOffice(inv.taxOffice);
            } else if (inv?.tc) {
              setTc(inv.tc);
            }
          }
        } catch {
          /* adres opsiyonel */
        }
      }

      setCustomerSearch("");
      setCustomerResults([]);
    },
    []
  );

  const calcPrice = useCallback(
    async (item: OrderItem) => {
      if (!item.material) {
        toast.error("Önce malzeme seç");
        return;
      }
      const w = Number(item.width) || 0;
      const h = Number(item.height) || 0;
      const q = Number(item.qty) || 0;
      if (w <= 0 || h <= 0 || q <= 0) {
        toast.error("Boyut ve adet gir");
        return;
      }

      setCalcLoadingId(item.id);
      try {
        if (item.product === "sticker") {
          const config = await getLivePricingConfig("sticker");
          const result =
            quoteStickerFromConfig(config, {
              width: w,
              height: h,
              qty: q,
              material: item.material as StickerMaterial,
              finish: mapStickerFinish(item.coating),
              cut: "diecut",
            }) ??
            quoteCustomerSticker({
              width: w,
              height: h,
              qty: q,
              material: item.material as StickerMaterial,
              finish: mapStickerFinish(item.coating),
              cut: "diecut",
            });
          if (!result.ok) {
            toast.error(result.reason);
            return;
          }
          const unitExVat = result.unitPrice / (1 + VAT_RATE);
          updateItem(item.id, { unit: unitExVat.toFixed(4) });
          toast.success(`Birim fiyat: ${unitExVat.toFixed(2)} ₺ (KDV hariç)`);
        } else {
          const config = await getLivePricingConfig("etiket_rulo");
          const result =
            quoteEtiketFromConfig(
              config,
              {
                width: w,
                height: h,
                qty: q,
                material: mapEtiketMaterial(item.material),
                coating: mapEtiketCoating(item.coating),
                customization: mapCustomization(item.customization),
              },
              { formFactor: "rulo" }
            ) ??
            quoteCustomerEtiket({
              width: w,
              height: h,
              qty: q,
              material: mapEtiketMaterial(item.material),
              coating: mapEtiketCoating(item.coating),
              customization: mapCustomization(item.customization),
            });
          if (!result.ok) {
            toast.error(result.reason);
            return;
          }
          const unitExVat = result.unitPrice / (1 + VAT_RATE);
          updateItem(item.id, { unit: unitExVat.toFixed(4) });
          toast.success(`Birim fiyat: ${unitExVat.toFixed(2)} ₺ (KDV hariç)`);
        }
      } catch {
        toast.error("Fiyat hesaplanamadı");
      } finally {
        setCalcLoadingId(null);
      }
    },
    [toast, updateItem]
  );

  const validate = (): string | null => {
    if (!name.trim()) return "Müşteri adı zorunlu";
    if (!phone.trim()) return "Telefon zorunlu";
    if (!city.trim()) return "Şehir zorunlu";
    if (!address.trim()) return "Adres zorunlu";
    if (email.trim() && !email.includes("@")) return "Geçerli bir e-posta gir";
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const title = item.titleManual
        ? item.title
        : autoTitleForItem(item) || item.title;
      if (!title.trim()) return `Ürün ${i + 1}: başlık zorunlu`;
      const q = Number(item.qty) || 0;
      const u = Number(item.unit) || 0;
      if (q <= 0) return `Ürün ${i + 1}: adet 0'dan büyük olmalı`;
      if (u <= 0) return `Ürün ${i + 1}: birim fiyat 0'dan büyük olmalı`;
    }
    if (invoiceType === "individual" && !tc.trim())
      return "TC kimlik no zorunlu";
    if (invoiceType === "individual" && !validateTcKimlik(tc).valid)
      return validateTcKimlik(tc).message ?? "TC kimlik numarası geçersiz";
    if (invoiceType === "corporate") {
      if (!vkn.trim()) return "VKN zorunlu";
      if (!companyName.trim()) return "Şirket ünvanı zorunlu";
    }
    return null;
  };

  const uploadDesigns = async (orderId: string, orderItemIds: string[]) => {
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (item.skipDesign || !item.designFile) continue;
      const orderItemId = orderItemIds[idx];
      if (!orderItemId) continue;

      const form = new FormData();
      form.append("file", item.designFile);
      form.append("orderItemId", orderItemId);

      const res = await fetch(`/api/admin/orders/${orderId}/upload-design`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Ürün ${idx + 1} dosyası yüklenemedi`);
      }
    }
  };

  const handleSubmit = async (action: SubmitAction = submitAction) => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setLoading(true);
    try {
      const itemPayloads = items.map((item, idx) => {
        const q = Number(item.qty) || 0;
        const u = Number(item.unit) || 0;
        const lineTotal = itemTotals[idx] ?? q * u;
        const title = (
          item.titleManual ? item.title : autoTitleForItem(item)
        ).trim();
        return {
          product: item.product,
          title,
          config: `${item.width}×${item.height}mm · ${q.toLocaleString("tr-TR")} adet · ${materialLabel(item)}`,
          width: Number(item.width) || 0,
          height: Number(item.height) || 0,
          qty: q,
          unit: u,
          total: lineTotal,
          meta: {
            material: item.material,
            coating: item.coating,
            shape: item.shape,
            customization: item.customization,
            notes: notes.trim() || undefined,
          },
        };
      });

      const res = await fetch("/api/admin/orders/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtotal: vatBase,
          shipping,
          total,
          address: {
            name: name.trim(),
            phone: phone.trim(),
            addr: address.trim(),
            city: city.trim(),
            label: "Manuel giriş",
            email: email.trim() || undefined,
          },
          invoice: {
            type: invoiceType,
            tc: invoiceType === "individual" ? tc.trim() : undefined,
            vkn: invoiceType === "corporate" ? vkn.trim() : undefined,
            companyName:
              invoiceType === "corporate" ? companyName.trim() : undefined,
            taxOffice:
              invoiceType === "corporate" ? taxOffice.trim() : undefined,
          },
          payment: {
            method: payment === "transfer" ? "transfer" : "card",
            masked:
              payment === "cash"
                ? "Nakit"
                : payment === "card_in_person"
                  ? "Kart (elden)"
                  : undefined,
          },
          estimatedDelivery: addDaysIso(deliveryDays),
          items: itemPayloads,
          discount:
            manualDiscountAmount > 0
              ? {
                  type: discountType,
                  value: Number(discountValue) || 0,
                  amount: manualDiscountAmount,
                  reason: discountReason.trim(),
                }
              : undefined,
          coupon:
            appliedCoupon && couponCode.trim()
              ? {
                  code: couponCode.trim().toUpperCase(),
                  discount: appliedCoupon.discount,
                  kind: appliedCoupon.kind,
                }
              : undefined,
          customerUserId: linkedCustomerUserId ?? undefined,
        }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Sipariş kaydedilemedi");
        return;
      }
      const json = (await res.json()) as { orderId: string };

      const detailRes = await fetch(`/api/admin/orders/${json.orderId}`);
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as {
          items?: Array<{ id: string }>;
        };
        const orderItemIds = (detail.items ?? []).map((it) => it.id);
        try {
          await uploadDesigns(json.orderId, orderItemIds);
        } catch (uploadErr) {
          toast.error(
            uploadErr instanceof Error
              ? uploadErr.message
              : "Dosya yüklenemedi"
          );
        }
      }

      localStorage.removeItem(DRAFT_KEY);
      setHasDraft(false);
      toast.success(
        `Sipariş oluşturuldu — ${json.orderId} · ${total.toLocaleString("tr-TR")} ₺`
      );

      if (action === "new") {
        resetForm();
      } else {
        router.push(`/admin/siparisler/${json.orderId}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sipariş kaydedilemedi");
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (p: ProductType) => {
    const tpl = newItem(p);
    if (p === "etiket") {
      tpl.title = "Rulodan etiket — özel baskı";
      tpl.titleManual = true;
    } else {
      tpl.title = "Sticker — die-cut özel";
      tpl.titleManual = true;
    }
    setItems([tpl]);
  };

  const handleDesignFile = (itemId: string, file: File | null) => {
    if (!file) {
      updateItem(itemId, { designFile: null, designPreviewUrl: undefined });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Dosya çok büyük (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
      return;
    }
    const mime = resolveFileMime(file);
    if (categorizeFile(file.name, mime) === "blocked") {
      toast.error(BLOCKED_FILE_MESSAGE);
      return;
    }
    const previewUrl = file.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : undefined;
    updateItem(itemId, { designFile: file, designPreviewUrl: previewUrl });
  };

  // Taslak — mount
  useEffect(() => {
    if (draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return;
    try {
      const draft = JSON.parse(saved) as {
        name?: string;
        phone?: string;
        email?: string;
        city?: string;
        address?: string;
        invoiceType?: InvoiceType;
        tc?: string;
        vkn?: string;
        companyName?: string;
        taxOffice?: string;
        items?: Array<Omit<OrderItem, "designFile">>;
        payment?: PaymentMethod;
        notes?: string;
        discountType?: DiscountType;
        discountValue?: string;
        discountReason?: string;
        deliveryDays?: number;
      };
      if (draft.name || draft.phone || draft.items?.[0]?.title) {
        if (
          confirm(
            "Önceki oturumdan kaydedilmemiş taslak var. Devam etmek ister misin?"
          )
        ) {
          setName(draft.name ?? "");
          setPhone(draft.phone ?? "");
          setEmail(draft.email ?? "");
          setCity(draft.city ?? "");
          setAddress(draft.address ?? "");
          setInvoiceType(draft.invoiceType ?? "individual");
          setTc(draft.tc ?? "");
          setVkn(draft.vkn ?? "");
          setCompanyName(draft.companyName ?? "");
          setTaxOffice(draft.taxOffice ?? "");
          if (draft.items?.length) {
            setItems(
              draft.items.map((it) => ({
                ...newItem(it.product ?? "etiket"),
                ...it,
                designFile: null,
                titleManual: it.titleManual ?? Boolean(it.title),
              }))
            );
          }
          setPayment(draft.payment ?? "transfer");
          setNotes(draft.notes ?? "");
          setDiscountType(draft.discountType ?? "none");
          setDiscountValue(draft.discountValue ?? "");
          setDiscountReason(draft.discountReason ?? "");
          if (draft.deliveryDays) setDeliveryDays(draft.deliveryDays);
          setHasDraft(true);
        } else {
          localStorage.removeItem(DRAFT_KEY);
        }
      }
    } catch {
      /* corrupted */
    }
  }, []);

  // Taslak — auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      const draft = {
        name,
        phone,
        email,
        city,
        address,
        invoiceType,
        tc,
        vkn,
        companyName,
        taxOffice,
        items: items.map(({ designFile: _f, designPreviewUrl: _p, ...rest }) => rest),
        payment,
        notes,
        discountType,
        discountValue,
        discountReason,
        deliveryDays,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, 10_000);
    return () => clearTimeout(timer);
  }, [
    name,
    phone,
    email,
    city,
    address,
    invoiceType,
    tc,
    vkn,
    companyName,
    taxOffice,
    items,
    payment,
    notes,
    discountType,
    discountValue,
    discountReason,
    deliveryDays,
  ]);

  const canCalc = (item: OrderItem) => {
    const w = Number(item.width) || 0;
    const h = Number(item.height) || 0;
    const q = Number(item.qty) || 0;
    return Boolean(item.material) && w > 0 && h > 0 && q > 0;
  };

  return (
    <main className="py-8 pb-20 bg-gri-50 min-h-[calc(100vh-56px)]">
      <div className="mx-auto max-w-[920px] px-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <Link
              href="/admin"
              className="text-[12px] text-gri-700 hover:text-lacivert flex items-center gap-1 mb-2"
            >
              <Icon.ChevR size={12} className="rotate-180" /> Dashboard&apos;a dön
            </Link>
            <Eyebrow>Manuel giriş</Eyebrow>
            <h1 className="mt-2 text-[28px] font-semibold tracking-tight">
              Yeni sipariş ekle
            </h1>
            <p className="mt-1 text-[14px] text-gri-700">
              Telefondan / WhatsApp&apos;tan / showroom&apos;dan gelen siparişi kayda al.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => applyTemplate("etiket")}
              className="text-[12px] font-semibold px-3 h-8 rounded-full bg-white ring-1 ring-gri-200 hover:ring-pim-mercan"
            >
              + Etiket şablon
            </button>
            <button
              type="button"
              onClick={() => applyTemplate("sticker")}
              className="text-[12px] font-semibold px-3 h-8 rounded-full bg-white ring-1 ring-gri-200 hover:ring-pim-mercan"
            >
              + Sticker şablon
            </button>
          </div>
        </div>

        {hasDraft && (
          <div className="mb-3 text-[12px] text-sari-koyu bg-sari-soft/30 rounded px-3 py-2">
             Önceki oturumdan taslak yüklendi.
            <button
              type="button"
              onClick={() => {
                resetForm();
                localStorage.removeItem(DRAFT_KEY);
              }}
              className="underline ml-2"
            >
              Temizle
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitAction("redirect");
            void handleSubmit("redirect");
          }}
          className="space-y-5"
        >
          {/* Müşteri */}
          <Card padding="p-5">
            <h2 className="text-[15px] font-semibold mb-4">Müşteri bilgileri</h2>
            <div className="mb-4 relative">
              <Field label="Mevcut müşteri ara">
                <Input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Ad, telefon veya e-posta..."
                  disabled={loading}
                />
              </Field>
              {searchLoading && (
                <p className="text-[11px] text-gri-500 mt-1">Aranıyor…</p>
              )}
              {customerResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg ring-1 ring-gri-200 bg-white shadow-lg overflow-hidden">
                  {customerResults.map((c) => (
                    <button
                      key={c.user_id}
                      type="button"
                      onClick={() => void selectCustomer(c)}
                      className="w-full text-left px-3 py-2.5 text-[13px] hover:bg-gri-50 border-b border-gri-100 last:border-0"
                    >
                      <span className="font-semibold text-lacivert">
                        {c.display_name ?? c.email}
                      </span>
                      {c.phone && (
                        <span className="text-gri-600"> · {c.phone}</span>
                      )}
                      <span className="text-gri-500 block text-[11px] truncate">
                        {c.email}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[11px] text-gri-500 mb-3">veya yeni müşteri bilgisi gir:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Ad Soyad / Marka" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ali Yılmaz"
                  disabled={loading}
                />
              </Field>
              <Field label="Telefon" required>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0532 123 45 67"
                  disabled={loading}
                />
              </Field>
              <Field label="E-posta">
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ali@ornek.com"
                  disabled={loading}
                  type="email"
                />
              </Field>
              <Field label="Şehir" required>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="İstanbul"
                  disabled={loading}
                />
              </Field>
              <Field label="Açık adres" required className="md:col-span-2">
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Mahalle, sokak, no, daire"
                  disabled={loading}
                />
              </Field>
            </div>
          </Card>

          {/* Fatura */}
          <Card padding="p-5">
            <h2 className="text-[15px] font-semibold mb-4">Fatura</h2>
            <div className="flex gap-2 mb-4">
              {(["individual", "corporate"] as InvoiceType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setInvoiceType(t)}
                  className={cn(
                    "flex-1 h-10 rounded-lg ring-1 text-[13px] font-semibold transition-colors",
                    invoiceType === t
                      ? "ring-pim-mercan bg-pim-mercan-tint text-pim-mercan"
                      : "ring-gri-200 bg-white text-gri-700 hover:bg-gri-50"
                  )}
                >
                  {t === "individual" ? "Bireysel (TC)" : "Kurumsal (VKN)"}
                </button>
              ))}
            </div>
            {invoiceType === "individual" ? (
              <Field label="TC Kimlik No" required>
                <Input
                  value={tc}
                  onChange={(e) =>
                    setTc(e.target.value.replace(/\D/g, "").slice(0, 11))
                  }
                  placeholder="11 hane"
                  disabled={loading}
                  inputMode="numeric"
                  className={cn(tcInvalid && "ring-kirmizi/50 ring-2")}
                />
                {tcInvalid && (
                  <p className="mt-1.5 text-[12px] font-semibold text-kirmizi">
                    {tcValidation.message ?? "TC kimlik numarası geçersiz"}
                  </p>
                )}
              </Field>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="VKN" required>
                  <Input
                    value={vkn}
                    onChange={(e) =>
                      setVkn(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    placeholder="10 hane"
                    disabled={loading}
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Şirket ünvanı" required>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Örnek A.Ş."
                    disabled={loading}
                  />
                </Field>
                <Field label="Vergi dairesi">
                  <Input
                    value={taxOffice}
                    onChange={(e) => setTaxOffice(e.target.value)}
                    placeholder="Beşiktaş"
                    disabled={loading}
                  />
                </Field>
              </div>
            )}
          </Card>

          {/* Ürünler */}
          <div className="space-y-4">
            {items.map((item, index) => {
              const lineTotal = itemTotals[index] ?? 0;
              const materials =
                item.product === "sticker"
                  ? STICKER_MATERIALS
                  : ETIKET_MATERIALS;
              const displayTitle = item.titleManual
                ? item.title
                : autoTitleForItem(item);

              return (
                <Card key={item.id} padding="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[15px] font-semibold">
                      Ürün {index + 1}
                    </h2>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-[12px] font-semibold text-kirmizi hover:underline"
                      >
                         Kaldır
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2 mb-4">
                    {(["etiket", "sticker"] as ProductType[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          const patch = newItem(p);
                          updateItem(item.id, {
                            product: p,
                            width: patch.width,
                            height: patch.height,
                            qty: patch.qty,
                            unit: patch.unit,
                            material: patch.material,
                            titleManual: false,
                            title: "",
                          });
                        }}
                        className={cn(
                          "flex-1 h-10 rounded-lg ring-1 text-[13px] font-semibold transition-colors",
                          item.product === p
                            ? "ring-pim-mercan bg-pim-mercan-tint text-pim-mercan"
                            : "ring-gri-200 bg-white text-gri-700 hover:bg-gri-50"
                        )}
                      >
                        {p === "etiket" ? "Etiket" : "Sticker"}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <SelectField
                      label="Malzeme"
                      value={item.material}
                      onChange={(v) =>
                        updateItem(item.id, { material: v, titleManual: false })
                      }
                      options={materials.map((m) => ({
                        id: m.id,
                        label: m.label,
                      }))}
                    />
                    <SelectField
                      label="Kaplama"
                      value={item.coating}
                      onChange={(v) =>
                        updateItem(item.id, { coating: v, titleManual: false })
                      }
                      options={COATINGS.map((c) => ({
                        id: c.id,
                        label: c.label,
                      }))}
                    />
                    <SelectField
                      label="Şekil"
                      value={item.shape}
                      onChange={(v) => updateItem(item.id, { shape: v })}
                      options={SHAPES.map((s) => ({
                        id: s.id,
                        label: s.label,
                      }))}
                    />
                    {item.product === "etiket" && (
                      <SelectField
                        label="Özelleştirme"
                        value={item.customization}
                        onChange={(v) =>
                          updateItem(item.id, { customization: v })
                        }
                        options={CUSTOMIZATIONS.map((c) => ({
                          id: c.id,
                          label: c.label,
                        }))}
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    <Field label="Ürün başlığı" required>
                      <Input
                        value={item.titleManual ? item.title : displayTitle}
                        onChange={(e) =>
                          updateItem(item.id, {
                            title: e.target.value,
                            titleManual: true,
                          })
                        }
                        placeholder="Örn. Rulodan etiket — vinil parlak"
                        disabled={loading}
                      />
                    </Field>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Field label="Genişlik (mm)">
                        <Input
                          value={item.width}
                          onChange={(e) =>
                            updateItem(item.id, {
                              width: e.target.value.replace(/[^\d.]/g, ""),
                            })
                          }
                          inputMode="decimal"
                          disabled={loading}
                        />
                      </Field>
                      <Field label="Yükseklik (mm)">
                        <Input
                          value={item.height}
                          onChange={(e) =>
                            updateItem(item.id, {
                              height: e.target.value.replace(/[^\d.]/g, ""),
                            })
                          }
                          inputMode="decimal"
                          disabled={loading}
                        />
                      </Field>
                      <Field label="Adet" required>
                        <Input
                          value={item.qty}
                          onChange={(e) =>
                            updateItem(item.id, {
                              qty: e.target.value.replace(/[^\d]/g, ""),
                            })
                          }
                          inputMode="numeric"
                          disabled={loading}
                        />
                      </Field>
                      <Field label="Birim fiyat (₺, KDV hariç)" required>
                        <div className="flex gap-2">
                          <Input
                            value={item.unit}
                            onChange={(e) =>
                              updateItem(item.id, {
                                unit: e.target.value
                                  .replace(/[^\d.,]/g, "")
                                  .replace(",", "."),
                              })
                            }
                            inputMode="decimal"
                            disabled={loading}
                            className="flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => void calcPrice(item)}
                            disabled={
                              loading ||
                              !canCalc(item) ||
                              calcLoadingId === item.id
                            }
                            className="shrink-0 h-10 px-3 rounded-lg ring-1 ring-gri-200 text-[12px] font-semibold hover:ring-pim-mercan disabled:opacity-40"
                            title="Malzeme + boyut + adet'e göre hesapla"
                          >
                            {calcLoadingId === item.id ? "…" : ""}
                          </button>
                        </div>
                      </Field>
                    </div>
                    <p className="text-[12px] text-gri-600">
                      Ara toplam:{" "}
                      <span className="font-semibold text-lacivert tabular-nums">
                        {lineTotal.toLocaleString("tr-TR")} ₺
                      </span>
                    </p>
                  </div>

                  {/* Tasarım dosyası */}
                  <div className="mt-5 pt-4 border-t border-gri-100">
                    <h3 className="text-[13px] font-semibold mb-3">
                      Tasarım dosyası (opsiyonel)
                    </h3>
                    <label className="flex items-center gap-2 mb-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.skipDesign}
                        onChange={(e) =>
                          updateItem(item.id, {
                            skipDesign: e.target.checked,
                            designFile: e.target.checked ? null : item.designFile,
                          })
                        }
                        className="accent-pim-mercan"
                      />
                      <span className="text-[13px]">Dosya sonra yüklenecek</span>
                    </label>
                    {!item.skipDesign && (
                      <>
                        {item.designFile ? (
                          <div className="flex items-center justify-between rounded-lg bg-gri-50 px-3 py-2">
                            <span className="text-[13px] truncate">
                              {item.designFile.name} —{" "}
                              {(item.designFile.size / 1024 / 1024).toFixed(1)} MB 
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDesignFile(item.id, null)}
                              className="text-[12px] text-kirmizi font-semibold ml-2"
                            >
                               Kaldır
                            </button>
                          </div>
                        ) : (
                          <label className="block cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept=".png,.jpg,.jpeg,.pdf,.ai,.psd,.svg"
                              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                const f = e.target.files?.[0] ?? null;
                                if (f) handleDesignFile(item.id, f);
                                e.target.value = "";
                              }}
                            />
                            <div className="rounded-lg border-2 border-dashed border-gri-200 px-4 py-6 text-center hover:border-pim-mercan transition-colors">
                              <p className="text-[13px] font-semibold text-gri-700">
                                Dosya seç veya sürükle
                              </p>
                              <p className="text-[11px] text-gri-500 mt-1">
                                PNG, AI, PSD, PDF, SVG, JPG · max 30MB
                              </p>
                            </div>
                          </label>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              );
            })}

            <button
              type="button"
              onClick={addItem}
              className="w-full h-11 rounded-lg ring-1 ring-dashed ring-gri-300 text-[13px] font-semibold text-gri-700 hover:ring-pim-mercan hover:text-pim-mercan"
            >
              + Ürün ekle
            </button>
          </div>

          {/* Ödeme */}
          <Card padding="p-5">
            <h2 className="text-[15px] font-semibold mb-4">Ödeme</h2>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPayment(p)}
                  className={cn(
                    "h-10 rounded-lg ring-1 text-[13px] font-semibold transition-colors",
                    payment === p
                      ? "ring-pim-mercan bg-pim-mercan-tint text-pim-mercan"
                      : "ring-gri-200 bg-white text-gri-700 hover:bg-gri-50"
                  )}
                >
                  {PAYMENT_LABELS[p]}
                </button>
              ))}
            </div>
            <Field label="Notlar (opsiyonel)" className="mt-4">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Üretim notu, özel istek, dosya durumu..."
                rows={2}
                disabled={loading}
                className="w-full px-3 py-2.5 rounded-lg ring-1 ring-gri-200 text-[14px] focus:ring-2 focus:ring-pim-mercan/40 focus:outline-none resize-none"
              />
            </Field>

            <div className="mt-5 pt-4 border-t border-gri-100">
              <h3 className="text-[13px] font-semibold mb-3">
                İndirim (opsiyonel)
              </h3>
              <div className="flex flex-wrap gap-3 mb-3">
                {(
                  [
                    ["none", "Yok"],
                    ["percent", "Yüzde (%)"],
                    ["fixed", "Sabit tutar (₺)"],
                  ] as const
                ).map(([id, label]) => (
                  <label
                    key={id}
                    className="flex items-center gap-1.5 cursor-pointer text-[13px]"
                  >
                    <input
                      type="radio"
                      name="discountType"
                      checked={discountType === id}
                      onChange={() => setDiscountType(id)}
                      className="accent-pim-mercan"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {discountType !== "none" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Değer">
                    <Input
                      value={discountValue}
                      onChange={(e) =>
                        setDiscountValue(
                          e.target.value.replace(/[^\d.,]/g, "").replace(",", ".")
                        )
                      }
                      placeholder={discountType === "percent" ? "10" : "85"}
                      disabled={loading}
                    />
                  </Field>
                  <Field label="Sebep">
                    <Input
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="Telefonda anlaşıldı"
                      disabled={loading}
                    />
                  </Field>
                </div>
              )}
              {manualDiscountAmount > 0 && (
                <p className="text-[12px] text-pim-mercan mt-2 font-semibold">
                  → {manualDiscountAmount.toLocaleString("tr-TR")} ₺ manuel indirim
                </p>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-gri-100">
              <h3 className="text-[13px] font-semibold mb-3">Kupon kodu</h3>
              <div className="flex flex-wrap gap-2 items-end">
                <Field label="Kod" className="flex-1 min-w-[160px]">
                  <Input
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setAppliedCoupon(null);
                    }}
                    placeholder="YAZ2026"
                    disabled={loading || couponLoading}
                  />
                </Field>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading || couponLoading || !couponCode.trim()}
                  onClick={() => void applyCouponCode()}
                >
                  {couponLoading ? "Kontrol…" : "Uygula"}
                </Button>
                {appliedCoupon && (
                  <button
                    type="button"
                    className="text-[12px] text-gri-600 underline"
                    onClick={() => {
                      setAppliedCoupon(null);
                      setCouponCode("");
                    }}
                  >
                    Kaldır
                  </button>
                )}
              </div>
              {appliedCoupon && (
                <p className="text-[12px] text-yesil mt-2 font-semibold">
                  ✓ Kupon: −{appliedCoupon.discount.toLocaleString("tr-TR")} ₺
                  {appliedCoupon.kind === "free_ship" && " (ücretsiz kargo)"}
                </p>
              )}
              {!linkedCustomerUserId && appliedCoupon && (
                <p className="text-[11px] text-sari-koyu mt-1">
                  Kayıtlı müşteri seçilmedi — kupon kullanım kaydı operatör hesabına yazılır.
                </p>
              )}
            </div>
          </Card>

          {/* Özet + Submit */}
          <Card padding="p-5">
            <h2 className="text-[15px] font-semibold mb-4">Özet</h2>
            <div className="mb-4 flex items-center gap-2 text-[13px]">
              <span className="text-gri-700">Tahmini teslimat:</span>
              <Input
                value={String(deliveryDays)}
                onChange={(e) =>
                  setDeliveryDays(
                    Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)
                  )
                }
                className="w-16 h-9 text-center"
                inputMode="numeric"
                disabled={loading}
              />
              <span className="text-gri-600">
                iş günü (standart: etiket 12, sticker 7)
              </span>
            </div>
            <div className="space-y-2 mb-5">
              <Row
                label="Ara toplam (KDV hariç)"
                value={`${subtotal.toLocaleString("tr-TR")} ₺`}
              />
              {discountAmount > 0 && (
                <Row
                  label={
                    appliedCoupon && manualDiscountAmount > 0
                      ? "Toplam indirim"
                      : appliedCoupon
                        ? "Kupon indirimi"
                        : discountType === "percent"
                          ? `İndirim (%${discountValue})`
                          : "İndirim"
                  }
                  value={`-${discountAmount.toLocaleString("tr-TR")} ₺`}
                  accent="text-pim-mercan"
                />
              )}
              <Row label="KDV (%20)" value={`${vat.toLocaleString("tr-TR")} ₺`} />
              <Row
                label="Kargo"
                value={shipping === 0 ? "Ücretsiz" : `${shipping} ₺`}
                accent={shipping === 0 ? "text-yesil" : ""}
              />
              <div className="h-px bg-gri-200 my-2" />
              <Row
                label="Toplam (KDV dahil)"
                value={`${total.toLocaleString("tr-TR")} ₺`}
                bold
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin"
                className="flex-1 min-w-[120px] h-11 rounded-lg ring-1 ring-gri-200 bg-white text-lacivert text-[14px] font-semibold flex items-center justify-center hover:bg-gri-50"
              >
                İptal
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="flex-1 min-w-[160px]"
                disabled={loading || !canCreate}
                onClick={() => {
                  setSubmitAction("new");
                  void handleSubmit("new");
                }}
              >
                {loading && submitAction === "new"
                  ? "Kaydediliyor..."
                  : "Oluştur + yeni ekle"}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="flex-1 min-w-[160px]"
                disabled={loading || !canCreate}
              >
                {loading && submitAction === "redirect"
                  ? "Kaydediliyor..."
                  : "Oluştur ve detaya git"}
              </Button>
            </div>
            {total === 0 && items.length > 0 && (
              <p className="text-[13px] text-kirmizi font-semibold mt-2">
                Birim fiyat girilmeden siparis olusturulamaz.
              </p>
            )}
            <p className="text-[11.5px] text-gri-500 mt-3 leading-relaxed">
              Bu sipariş <strong>“Yeni”</strong> statüsünde oluşturulur. Operatör
              dosyasını alıp AI kontrolüne göndereceksin.
            </p>
          </Card>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-[12.5px] font-semibold text-gri-700 mb-1.5 block">
        {label} {required && <span className="text-kirmizi">*</span>}
      </span>
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-semibold text-gri-700 mb-1.5 block">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-2 rounded-lg ring-1 ring-gri-200 bg-white text-[13px] focus:ring-pim-mercan focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between text-[13.5px]">
      <span className="text-gri-700">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          bold ? "font-bold text-[16px] text-lacivert" : "",
          accent
        )}
      >
        {value}
      </span>
    </div>
  );
}
