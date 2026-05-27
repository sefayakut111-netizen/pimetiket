/**
 * Pim Etiket — /admin/fason/yeni (Üretim Partneri Yeni Kayıt Formu)
 *
 * Sefa 20 May v68 (Mig 067 + spec uyarlaması):
 * 4 kart, tek sayfa, dikey sıralı:
 *   1. Firma bilgileri
 *   2. Yetkili kişiler (owner / operator / accounting)
 *   3. Üretim yetkinliği (product types + materials + lead times)
 *   4. Sözleşme & mali (payment term + IBAN + PDF upload + notes)
 *
 * Submit: POST /api/admin/fason/partners (nested body)
 * PDF upload: önce /partners/[temp]/contract endpoint'i çağrılamaz
 * (partner henüz oluşmadı), bu yüzden iki-aşamalı:
 *   a) Form submit'inde partner ilk yaratılır (sözleşmesiz)
 *   b) PDF varsa sonra contract endpoint'e gönderilir
 */

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  Eyebrow,
  Button,
  Input,
  useToast,
} from "@/components/ui";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";
import { TR_IL_LIST, getIlceler, isValidIlIlce } from "@/lib/locations/tr-locations";

// ============================================================
// Tipler
// ============================================================

type ProductType = "roll_label" | "sheet_label" | "sticker";
type Material = "paper" | "transparent" | "metallic" | "holographic";
type PaymentTerm = "cash" | "net_15" | "net_30" | "net_60";

const PRODUCT_LABELS: Record<ProductType, string> = {
  roll_label: "Rulo Etiket",
  sheet_label: "Tabaka Etiket",
  sticker: "Sticker",
};

const MATERIAL_LABELS: Record<Material, string> = {
  paper: "Kağıt",
  transparent: "Şeffaf",
  metallic: "Metalize",
  holographic: "Holografik",
};

const PAYMENT_LABELS: Record<PaymentTerm, string> = {
  cash: "Peşin",
  net_15: "15 gün",
  net_30: "30 gün",
  net_60: "60 gün",
};

interface ContactForm {
  name: string;
  title: string;
  email: string;
  phone: string; // raw, 5XX XXX XX XX
  autoNotify?: boolean;
}

// ============================================================
// Helpers
// ============================================================

/** "5319340123" → "531 934 01 23" */
function formatPhoneTr(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)];
  return parts.filter((p) => p.length > 0).join(" ");
}

/** Raw → digit-only telefon (4 boşluksuz) */
function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function emptyContact(): ContactForm {
  return { name: "", title: "", email: "", phone: "" };
}

// ============================================================
// Sayfa
// ============================================================

export default function YeniPartnerPage() {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  // 1. Firma
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [town, setTown] = useState("");
  const [status, setStatus] = useState<"active" | "paused">("active");

  // 2. Yetkili kişiler
  const [owner, setOwner] = useState<ContactForm>(emptyContact());
  const [operator, setOperator] = useState<ContactForm>({
    ...emptyContact(),
    autoNotify: true,
  });
  const [accounting, setAccounting] = useState<ContactForm>(emptyContact());

  // 3. Üretim yetkinliği
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [defaultLeadTimeDays, setDefaultLeadTimeDays] = useState<number>(7);
  const [expressLeadTimeDays, setExpressLeadTimeDays] = useState<number | null>(
    null
  );
  const [minOrderAmountTry, setMinOrderAmountTry] = useState<number | null>(
    null
  );

  // 4. Sözleşme & mali
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm | "">("");
  const [iban, setIban] = useState("");
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  const toggleProductType = (pt: ProductType) =>
    setProductTypes((prev) =>
      prev.includes(pt) ? prev.filter((p) => p !== pt) : [...prev, pt]
    );

  const toggleMaterial = (m: Material) =>
    setMaterials((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );

  // Validation (kısa öz)
  const errors = useMemo(() => {
    const e: string[] = [];
    if (name.trim().length < 2) e.push("Firma adı zorunlu (min 2 karakter)");
    if (!city) e.push("İl zorunlu");
    if (!town) e.push("İlçe zorunlu");
    else if (!isValidIlIlce(city, town)) e.push("Geçerli bir il-ilçe seçin");
    if (taxNumber && !/^\d{10,11}$/.test(taxNumber))
      e.push("Vergi no 10 veya 11 hane olmalı");
    if (iban && !/^TR\d{24}$/.test(iban.replace(/\s/g, "")))
      e.push("IBAN: TR + 24 hane bekleniyor");
    if (owner.name.trim().length < 3) e.push("Firma yetkilisi adı zorunlu");
    if (!owner.email.includes("@")) e.push("Firma yetkilisi e-postası geçersiz");
    if (digitsOnly(owner.phone).length !== 10)
      e.push("Firma yetkilisi telefonu 10 rakam olmalı");
    if (operator.name.trim().length < 3) e.push("Operatör adı zorunlu");
    if (!operator.email.includes("@")) e.push("Operatör e-postası geçersiz");
    if (digitsOnly(operator.phone).length !== 10)
      e.push("Operatör telefonu 10 rakam olmalı");
    if (productTypes.length === 0) e.push("En az 1 ürün grubu seçilmeli");
    if (defaultLeadTimeDays < 1 || defaultLeadTimeDays > 30)
      e.push("Teslim süresi 1-30 gün arası");
    if (
      expressLeadTimeDays !== null &&
      (expressLeadTimeDays < 1 || expressLeadTimeDays >= defaultLeadTimeDays)
    )
      e.push("Hızlı teslim süresi normal süreden küçük olmalı (1-7 gün)");
    return e;
  }, [
    name,
    city,
    town,
    taxNumber,
    iban,
    owner,
    operator,
    productTypes,
    defaultLeadTimeDays,
    expressLeadTimeDays,
  ]);

  const handleSubmit = async () => {
    if (errors.length > 0) {
      toast.error(`Form hatalı: ${errors[0]}`);
      return;
    }
    setSaving(true);
    try {
      // 1) Önce partner kaydet (sözleşmesiz)
      const body = {
        name: name.trim(),
        shortName: shortName.trim() || undefined,
        taxNumber: taxNumber || undefined,
        taxOffice: taxOffice.trim() || undefined,
        addressLine: addressLine.trim() || undefined,
        city,
        town: town.trim(),
        status,
        productTypes,
        materials: materials.length > 0 ? materials : undefined,
        defaultLeadTimeDays,
        expressLeadTimeDays: expressLeadTimeDays ?? undefined,
        minOrderAmountTry: minOrderAmountTry ?? undefined,
        paymentTerm: paymentTerm || undefined,
        iban: iban.replace(/\s/g, "") || undefined,
        owner: {
          name: owner.name.trim(),
          title: owner.title.trim() || undefined,
          email: owner.email.trim().toLowerCase(),
          phone: digitsOnly(owner.phone),
        },
        operator: {
          name: operator.name.trim(),
          title: operator.title.trim() || undefined,
          email: operator.email.trim().toLowerCase(),
          phone: digitsOnly(operator.phone),
          autoNotify: operator.autoNotify ?? true,
        },
        accounting:
          accounting.name.trim().length >= 3
            ? {
                name: accounting.name.trim(),
                email: accounting.email.trim().toLowerCase(),
                phone: digitsOnly(accounting.phone),
              }
            : undefined,
        notes: notes.trim() || undefined,
      };

      const res = await fetch("/api/admin/fason/partners", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { id?: string; error?: string; details?: unknown };
      if (!res.ok || !json.id) {
        toast.error(json.error ?? "Kayıt başarısız");
        console.error("[partner POST]", json);
        return;
      }
      const partnerId = json.id;

      // 2) PDF varsa contract upload
      if (contractFile) {
        const fd = new FormData();
        fd.append("file", contractFile);
        const upRes = await fetch(
          `/api/admin/fason/partners/${partnerId}/contract`,
          { method: "POST", body: fd }
        );
        if (!upRes.ok) {
          const upJson = (await upRes.json().catch(() => ({}))) as {
            error?: string;
          };
          toast.warning(
            `Partner kaydedildi ama sözleşme PDF yüklenmedi: ${upJson.error ?? "—"}`
          );
        }
      }

      toast.success(`${name.trim()} eklendi`);
      router.push("/admin/fason");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Beklenmedik hata");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[920px] px-4 md:px-8">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-[12.5px] text-gri-700">
          <Link href="/admin" className="hover:text-lacivert">Dashboard</Link>
          <Icon.ChevR size={10} />
          <Link href="/admin/fason" className="hover:text-lacivert">
            Üretim Partnerleri
          </Link>
          <Icon.ChevR size={10} />
          <span className="text-lacivert font-semibold">Yeni partner</span>
        </div>

        <div className="mb-6">
          <Eyebrow>Üretim Partnerleri</Eyebrow>
          <h1 className="mt-2 text-[28px] md:text-[34px] font-semibold tracking-tight">
            Yeni Üretim Partneri
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            Firma + yetkili kişiler + üretim yetkinliği + sözleşme bilgilerini gir.
            Form kaydedildiğinde sistem otomatik atama için bu partner'ı dikkate alır.
          </p>
        </div>

        {/* 1. Firma */}
        <Card padding="p-5" className="mb-4">
          <h2 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
            <span className="text-[18px]">🏢</span> 1. Firma bilgileri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Firma ünvanı *" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Etiketbox A.Ş."
                maxLength={150}
              />
            </Field>
            <Field label="Kısa ad" hint="Sistem içi (örn. Etiketbox-İST)">
              <Input
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="Etiketbox-İST"
                maxLength={40}
              />
            </Field>
            <Field label="Vergi no" hint="10 (VKN) veya 11 (TC)">
              <Input
                value={taxNumber}
                onChange={(e) =>
                  setTaxNumber(e.target.value.replace(/\D/g, "").slice(0, 11))
                }
                placeholder="1234567890"
                inputMode="numeric"
              />
            </Field>
            <Field label="Vergi dairesi">
              <Input
                value={taxOffice}
                onChange={(e) => setTaxOffice(e.target.value)}
                placeholder="Maslak V.D."
                maxLength={80}
              />
            </Field>
            <Field label="Adres" fullWidth>
              <Input
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="Mahalle / cadde / sokak no"
                maxLength={200}
              />
            </Field>
            <Field label="İl *" required>
              <select
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setTown("");
                }}
                className="w-full px-3 h-10 rounded-lg bg-white ring-1 ring-gri-200 text-[13.5px] focus:outline-none focus:ring-pim-mercan"
              >
                <option value="">— Seç —</option>
                {TR_IL_LIST.map((il) => (
                  <option key={il} value={il}>
                    {il}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="İlçe *" required>
              <select
                value={town}
                onChange={(e) => setTown(e.target.value)}
                disabled={!city}
                className="w-full px-3 h-10 rounded-lg bg-white ring-1 ring-gri-200 text-[13.5px] focus:outline-none focus:ring-pim-mercan disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {city ? "— Seç —" : "Önce il seçin"}
                </option>
                {getIlceler(city).map((ilce) => (
                  <option key={ilce} value={ilce}>
                    {ilce}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Durum" fullWidth>
              <div className="flex gap-2">
                {(["active", "paused"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "px-4 h-9 rounded-full text-[12.5px] font-semibold",
                      status === s
                        ? "bg-lacivert text-white"
                        : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                    )}
                  >
                    {s === "active" ? "● Aktif" : "◐ Pasif"}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Card>

        {/* 2. Yetkili kişiler */}
        <Card padding="p-5" className="mb-4">
          <h2 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
            <span className="text-[18px]">👥</span> 2. Yetkili kişiler
          </h2>
          <ContactBlock
            color="bg-pim-mercan-tint border-pim-mercan/30"
            title="Firma yetkilisi"
            required
            data={owner}
            onChange={setOwner}
          />
          <div className="mt-4">
            <ContactBlock
              color="bg-yesil-soft border-yesil/30"
              title="Basım operatörü"
              required
              data={operator}
              onChange={setOperator}
              showAutoNotify
            />
          </div>
          <div className="mt-4">
            <ContactBlock
              color="bg-gri-100 border-gri-200"
              title="Muhasebe"
              data={accounting}
              onChange={setAccounting}
            />
          </div>
        </Card>

        {/* 3. Üretim yetkinliği */}
        <Card padding="p-5" className="mb-4">
          <h2 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
            <span className="text-[18px]">⚙️</span> 3. Üretim yetkinliği
          </h2>

          <div className="mb-4">
            <label className="block text-[11.5px] font-bold uppercase tracking-[0.04em] text-gri-700 mb-1.5">
              Ürün grupları *
            </label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(PRODUCT_LABELS) as ProductType[]).map((pt) => {
                const active = productTypes.includes(pt);
                return (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => toggleProductType(pt)}
                    className={cn(
                      "px-3 h-9 rounded-full text-[12.5px] font-semibold transition-colors",
                      active
                        ? "bg-pim-mercan text-white"
                        : "bg-white ring-1 ring-gri-200 text-gri-700 hover:ring-pim-mercan"
                    )}
                  >
                    {active ? "✓ " : ""}{PRODUCT_LABELS[pt]}
                  </button>
                );
              })}
            </div>
            <p className="text-[11.5px] text-gri-500 mt-1.5">
              En az 1 grup seçilmeli — otomatik atama bu listeye göre filtreler.
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-[11.5px] font-bold uppercase tracking-[0.04em] text-gri-700 mb-1.5">
              Basılabilir malzemeler
            </label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(MATERIAL_LABELS) as Material[]).map((m) => {
                const active = materials.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMaterial(m)}
                    className={cn(
                      "px-3 h-9 rounded-full text-[12.5px] font-semibold transition-colors",
                      active
                        ? "bg-lacivert text-white"
                        : "bg-white ring-1 ring-gri-200 text-gri-700 hover:ring-lacivert"
                    )}
                  >
                    {active ? "✓ " : ""}{MATERIAL_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Standart teslim (gün) *" required>
              <Input
                type="number"
                value={defaultLeadTimeDays}
                onChange={(e) => setDefaultLeadTimeDays(Number(e.target.value))}
                min={1}
                max={30}
              />
            </Field>
            <Field label="Hızlı teslim (gün)" hint="Standart'tan küçük olmalı">
              <Input
                type="number"
                value={expressLeadTimeDays ?? ""}
                onChange={(e) =>
                  setExpressLeadTimeDays(
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                min={1}
                max={7}
                placeholder="—"
              />
            </Field>
            <Field label="Min. sipariş tutarı (₺)">
              <Input
                type="number"
                value={minOrderAmountTry ?? ""}
                onChange={(e) =>
                  setMinOrderAmountTry(
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                min={0}
                placeholder="0 = sınırsız"
              />
            </Field>
          </div>
        </Card>

        {/* 4. Sözleşme & Mali */}
        <Card padding="p-5" className="mb-4">
          <h2 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
            <span className="text-[18px]">📑</span> 4. Sözleşme & Mali
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Ödeme vadesi">
              <select
                value={paymentTerm}
                onChange={(e) => setPaymentTerm(e.target.value as PaymentTerm | "")}
                className="w-full px-3 h-10 rounded-lg bg-white ring-1 ring-gri-200 text-[13.5px] focus:outline-none focus:ring-pim-mercan"
              >
                <option value="">— Seç —</option>
                {(Object.keys(PAYMENT_LABELS) as PaymentTerm[]).map((p) => (
                  <option key={p} value={p}>{PAYMENT_LABELS[p]}</option>
                ))}
              </select>
            </Field>
            <Field label="IBAN" hint="TR + 24 hane">
              <Input
                value={iban}
                onChange={(e) => setIban(e.target.value.toUpperCase())}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                maxLength={32}
              />
            </Field>
            <Field label="Sözleşme PDF" fullWidth hint="Maks 10 MB, sadece PDF">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) =>
                  setContractFile(e.target.files?.[0] ?? null)
                }
                className="block w-full text-[13px] file:mr-3 file:px-3 file:h-9 file:rounded-lg file:border-0 file:bg-pim-mercan file:text-white file:font-semibold file:cursor-pointer file:hover:bg-pim-mercan/90"
              />
              {contractFile && (
                <p className="text-[11.5px] text-gri-700 mt-1">
                  Seçili: <strong>{contractFile.name}</strong> (
                  {(contractFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </Field>
            <Field label="Notlar" fullWidth>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Özel istek, dikkat edilecek nokta, geçmiş..."
                className="w-full px-3 py-2 rounded-lg bg-white ring-1 ring-gri-200 text-[13.5px] focus:outline-none focus:ring-pim-mercan resize-y"
              />
            </Field>
          </div>
        </Card>

        {/* Hata listesi */}
        {errors.length > 0 && (
          <Card padding="p-4" className="mb-4 !bg-kirmizi-soft ring-1 ring-kirmizi/30">
            <div className="text-[12.5px] font-bold uppercase tracking-[0.04em] text-kirmizi mb-2">
              Düzeltilmesi gereken {errors.length} alan
            </div>
            <ul className="text-[12.5px] text-kirmizi-koyu space-y-1 list-disc pl-5">
              {errors.slice(0, 5).map((e, i) => (<li key={i}>{e}</li>))}
              {errors.length > 5 && (
                <li className="italic">… ve {errors.length - 5} tane daha</li>
              )}
            </ul>
          </Card>
        )}

        {/* Footer aksiyonları */}
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/admin/fason")}
            disabled={saving}
          >
            İptal
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={saving || errors.length > 0}
          >
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// Helpers
// ============================================================

function Field({
  label,
  hint,
  required,
  fullWidth,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(fullWidth && "md:col-span-2")}>
      <label className="block text-[11.5px] font-bold uppercase tracking-[0.04em] text-gri-700 mb-1.5">
        {label}
        {required && <span className="text-pim-mercan ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11.5px] text-gri-500 mt-1">{hint}</p>}
    </div>
  );
}

function ContactBlock({
  color,
  title,
  required,
  data,
  onChange,
  showAutoNotify,
}: {
  color: string;
  title: string;
  required?: boolean;
  data: ContactForm;
  onChange: (next: ContactForm) => void;
  showAutoNotify?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border p-4", color)}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-[13.5px] text-lacivert">
          {title} {required && <span className="text-pim-mercan">*</span>}
        </div>
        {showAutoNotify && (
          <label className="flex items-center gap-2 text-[12px] text-gri-700 cursor-pointer">
            <input
              type="checkbox"
              checked={data.autoNotify ?? true}
              onChange={(e) =>
                onChange({ ...data, autoNotify: e.target.checked })
              }
              className="accent-pim-mercan"
            />
            Otomatik iş bildirimi
          </label>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Ad Soyad" required={required}>
          <Input
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            placeholder="Ad Soyad"
            maxLength={100}
          />
        </Field>
        <Field label="Unvan">
          <Input
            value={data.title}
            onChange={(e) => onChange({ ...data, title: e.target.value })}
            placeholder="Genel Müdür, Operatör, vb."
            maxLength={80}
          />
        </Field>
        <Field label="E-posta" required={required}>
          <Input
            type="email"
            value={data.email}
            onChange={(e) => onChange({ ...data, email: e.target.value })}
            placeholder="ad@firma.com"
          />
        </Field>
        <Field label="Telefon (+90)" required={required}>
          <div className="flex items-stretch">
            <span className="px-3 bg-gri-100 ring-1 ring-r-0 ring-gri-200 rounded-l-lg text-[13px] text-gri-700 inline-flex items-center font-semibold">
              +90
            </span>
            <input
              type="tel"
              value={data.phone}
              onChange={(e) =>
                onChange({ ...data, phone: formatPhoneTr(e.target.value) })
              }
              placeholder="5XX XXX XX XX"
              maxLength={13}
              className="flex-1 px-3 h-10 rounded-r-lg bg-white ring-1 ring-l-0 ring-gri-200 text-[13.5px] focus:outline-none focus:ring-pim-mercan tabular-nums"
            />
          </div>
        </Field>
      </div>
    </div>
  );
}
