/**
 * /admin/siparis-ekle — Manuel sipariş giriş formu.
 *
 * Telefonla / WhatsApp'la / showroom'dan gelen siparişi sisteme alır.
 * Şu an: localStorage'a "paid" status'la kaydeder (dashboard'da görünür).
 * İleri faz: admin RPC fn_create_manual_order ile DB'ye yazılacak.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Card, Button, Input, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { addDaysIso } from "@/lib/customer-order";

type ProductType = "etiket" | "sticker";
type InvoiceType = "individual" | "corporate";
type PaymentMethod = "transfer" | "cash" | "card_in_person";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  transfer: "Havale / EFT",
  cash: "Nakit",
  card_in_person: "Kart (elden)",
};

export default function AdminCreateOrderPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Müşteri
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  // Fatura
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("individual");
  const [tc, setTc] = useState("");
  const [vkn, setVkn] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [taxOffice, setTaxOffice] = useState("");

  // Ürün — tek item
  const [product, setProduct] = useState<ProductType>("etiket");
  const [title, setTitle] = useState("");
  const [width, setWidth] = useState("60");
  const [height, setHeight] = useState("40");
  const [qty, setQty] = useState("1000");
  const [unit, setUnit] = useState("0.85");

  // Ödeme
  const [payment, setPayment] = useState<PaymentMethod>("transfer");
  const [notes, setNotes] = useState("");

  // Hesap
  const qtyNum = Number(qty) || 0;
  const unitNum = Number(unit) || 0;
  const subtotal = qtyNum * unitNum;
  const shipping = subtotal >= 1000 || subtotal === 0 ? 0 : 49;
  const total = subtotal + shipping;

  const validate = (): string | null => {
    if (!name.trim()) return "Müşteri adı zorunlu";
    if (!phone.trim()) return "Telefon zorunlu";
    if (!city.trim()) return "Şehir zorunlu";
    if (!address.trim()) return "Adres zorunlu";
    if (!title.trim()) return "Ürün başlığı zorunlu";
    if (qtyNum <= 0) return "Adet 0'dan büyük olmalı";
    if (unitNum <= 0) return "Birim fiyat 0'dan büyük olmalı";
    if (invoiceType === "individual" && !tc.trim())
      return "TC kimlik no zorunlu";
    if (invoiceType === "corporate") {
      if (!vkn.trim()) return "VKN zorunlu";
      if (!companyName.trim()) return "Şirket ünvanı zorunlu";
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setLoading(true);
    try {
      const itemPayload = {
        product,
        title: title.trim(),
        config: `${width}×${height}mm · ${qtyNum.toLocaleString("tr-TR")} adet`,
        width: Number(width) || 0,
        height: Number(height) || 0,
        qty: qtyNum,
        unit: unitNum,
        total: subtotal,
        meta: notes ? { notes: notes.trim() } : {},
      };

      const res = await fetch("/api/admin/orders/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtotal,
          shipping,
          total,
          address: {
            name: name.trim(),
            phone: phone.trim(),
            addr: address.trim(),
            city: city.trim(),
            label: "Manuel giriş",
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
          estimatedDelivery: addDaysIso(product === "sticker" ? 7 : 12),
          items: [itemPayload],
        }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Sipariş kaydedilemedi");
        return;
      }
      const json = (await res.json()) as { orderId: string };

      toast.success(
        `Sipariş oluşturuldu — ${json.orderId} · ${total.toLocaleString("tr-TR")} ₺`
      );
      router.push(`/admin/siparisler/${json.orderId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sipariş kaydedilemedi");
    } finally {
      setLoading(false);
    }
  };

  // Hızlı şablon — tipik etiket/sticker fiyatı
  const applyTemplate = (p: ProductType) => {
    setProduct(p);
    if (p === "etiket") {
      setTitle("Rulodan etiket — özel baskı");
      setWidth("60");
      setHeight("40");
      setQty("1000");
      setUnit("0.85");
    } else {
      setTitle("Sticker — die-cut özel");
      setWidth("70");
      setHeight("70");
      setQty("100");
      setUnit("4.50");
    }
  };

  return (
    <main className="py-8 pb-20 bg-gri-50 min-h-[calc(100vh-56px)]">
      <div className="mx-auto max-w-[920px] px-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <Link
              href="/admin"
              className="text-[12px] text-gri-700 hover:text-lacivert flex items-center gap-1 mb-2"
            >
              <Icon.ChevR size={12} className="rotate-180" /> Dashboard'a dön
            </Link>
            <Eyebrow>Manuel giriş</Eyebrow>
            <h1 className="mt-2 text-[28px] font-semibold tracking-tight">
              Yeni sipariş ekle
            </h1>
            <p className="mt-1 text-[14px] text-gri-700">
              Telefondan / WhatsApp'tan / showroom'dan gelen siparişi kayda al.
            </p>
          </div>

          {/* Quick templates */}
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="space-y-5"
        >
          {/* Müşteri */}
          <Card padding="p-5">
            <h2 className="text-[15px] font-semibold mb-4">Müşteri bilgileri</h2>
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
              <Field label="Şehir" required>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="İstanbul"
                  disabled={loading}
                />
              </Field>
              <Field label="Açık adres" required>
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
                />
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

          {/* Ürün */}
          <Card padding="p-5">
            <h2 className="text-[15px] font-semibold mb-4">Ürün</h2>
            <div className="flex gap-2 mb-4">
              {(["etiket", "sticker"] as ProductType[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProduct(p)}
                  className={cn(
                    "flex-1 h-10 rounded-lg ring-1 text-[13px] font-semibold transition-colors",
                    product === p
                      ? "ring-pim-mercan bg-pim-mercan-tint text-pim-mercan"
                      : "ring-gri-200 bg-white text-gri-700 hover:bg-gri-50"
                  )}
                >
                  {p === "etiket" ? "Etiket" : "Sticker"}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <Field label="Ürün başlığı" required>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn. Rulodan etiket — vinil parlak"
                  disabled={loading}
                />
              </Field>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Genişlik (mm)">
                  <Input
                    value={width}
                    onChange={(e) =>
                      setWidth(e.target.value.replace(/[^\d.]/g, ""))
                    }
                    inputMode="decimal"
                    disabled={loading}
                  />
                </Field>
                <Field label="Yükseklik (mm)">
                  <Input
                    value={height}
                    onChange={(e) =>
                      setHeight(e.target.value.replace(/[^\d.]/g, ""))
                    }
                    inputMode="decimal"
                    disabled={loading}
                  />
                </Field>
                <Field label="Adet" required>
                  <Input
                    value={qty}
                    onChange={(e) =>
                      setQty(e.target.value.replace(/[^\d]/g, ""))
                    }
                    inputMode="numeric"
                    disabled={loading}
                  />
                </Field>
                <Field label="Birim fiyat (₺)" required>
                  <Input
                    value={unit}
                    onChange={(e) =>
                      setUnit(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))
                    }
                    inputMode="decimal"
                    disabled={loading}
                  />
                </Field>
              </div>
            </div>
          </Card>

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
          </Card>

          {/* Özet + Submit */}
          <Card padding="p-5">
            <h2 className="text-[15px] font-semibold mb-4">Özet</h2>
            <div className="space-y-2 mb-5">
              <Row label="Ara toplam" value={`${subtotal.toLocaleString("tr-TR")} ₺`} />
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
            <div className="flex gap-3">
              <Link
                href="/admin"
                className="flex-1 h-11 rounded-lg ring-1 ring-gri-200 bg-white text-lacivert text-[14px] font-semibold flex items-center justify-center hover:bg-gri-50"
              >
                İptal
              </Link>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="flex-1"
                disabled={loading}
              >
                {loading ? "Kaydediliyor..." : "Siparişi oluştur"}
              </Button>
            </div>
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

// ============================================================
// Helpers
// ============================================================

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
