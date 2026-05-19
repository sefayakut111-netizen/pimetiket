/**
 * Pim Etiket — /admin/ayarlar
 *
 * Site geneli ayarlar: KDV oranı, kargo eşiği/ücreti, tatil günleri,
 * email gönderici, sadakat çek miktarları.
 *
 * Hibrit (11 May):
 *   - DB alanları (kargo + sadakat) → /api/admin/settings → site_settings
 *   - Diğer alanlar (KDV, holidays, mail vs) → localStorage backup
 */

"use client";

import { useEffect, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Input, Eyebrow, useToast, Skeleton } from "@/components/ui";

const STORAGE_KEY = "pim_site_settings_v1";

interface SiteSettings {
  vatPct: number;
  shippingFee: number;
  freeShippingThreshold: number;
  welcomeCreditTry: number;
  referralCreditTry: number;
  minSubtotalForCredit: number;
  // Sefa 18 May Migration 053: min/max sipariş tutarı
  minOrderTotal: number;
  maxOrderTotal: number;
  defaultStickerDelivery: number;
  defaultEtiketDelivery: number;
  fastTrackEnabled: boolean; // DEPRECATED — Sefa kuralı "hızlı baskı yok", UI'dan kaldırıldı
  emailFrom: string;
  contactPhone: string;
  contactWhatsapp: string;
  holidays: string;
}

const DEFAULTS: SiteSettings = {
  vatPct: 20,
  shippingFee: 49,
  freeShippingThreshold: 500,
  welcomeCreditTry: 250,
  referralCreditTry: 250,
  minSubtotalForCredit: 500,
  minOrderTotal: 100,
  maxOrderTotal: 100000,
  // Sefa kuralı (18 May v68): Etiket 10 iş günü, Sticker 5 iş günü.
  defaultStickerDelivery: 5,
  defaultEtiketDelivery: 10,
  fastTrackEnabled: false, // Hızlı baskı YOK
  emailFrom: "info@pimetiket.com",
  contactPhone: "", // Henüz hat yok — Sefa açacak
  contactWhatsapp: "", // Henüz aktif değil
  holidays: "1 Ocak, 23 Nisan, 1 Mayıs, 19 Mayıs, 15 Temmuz, 30 Ağustos, 29 Ekim + Ramazan + Kurban",
};

function loadLocalSettings(): Partial<SiteSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<SiteSettings>;
  } catch {
    return {};
  }
}

function saveLocalSettings(s: SiteSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export default function AdminAyarlarPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const local = loadLocalSettings();
    // Sefa 18 May v68: fastTrackEnabled deprecated, eski localStorage
    // kayıtlarını sıfırla (true kalmışsa false'a çek)
    const cleaned = { ...DEFAULTS, ...local, fastTrackEnabled: false };
    setSettings(cleaned);
    setHydrated(true);

    // DB'den canlı değerleri çek — kargo + sadakat fields override eder
    void fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json?.settings) return;
        const s = json.settings;
        setSettings((prev) => ({
          ...prev,
          shippingFee: Number(s.shipping_fee_try ?? prev.shippingFee),
          freeShippingThreshold: Number(
            s.free_shipping_threshold ?? prev.freeShippingThreshold
          ),
          welcomeCreditTry: Number(s.welcome_credit_try ?? prev.welcomeCreditTry),
          referralCreditTry: Number(
            s.referral_credit_try ?? prev.referralCreditTry
          ),
          minSubtotalForCredit: Number(
            s.min_subtotal_for_credit ?? prev.minSubtotalForCredit
          ),
          minOrderTotal: Number(
            s.min_order_total_try ?? prev.minOrderTotal
          ),
          maxOrderTotal: Number(
            s.max_order_total_try ?? prev.maxOrderTotal
          ),
        }));
      })
      .catch(() => {
        /* silent — local defaults kullanılır */
      });
  }, []);

  const update = <K extends keyof SiteSettings>(
    key: K,
    value: SiteSettings[K]
  ) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // 1. Local'e tamamını yaz (UI persist için)
      saveLocalSettings(settings);
      // 2. DB'ye sadece kargo + sadakat alanları (Migration 029'da var)
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shipping_fee_try: settings.shippingFee,
          free_shipping_threshold: settings.freeShippingThreshold,
          welcome_credit_try: settings.welcomeCreditTry,
          referral_credit_try: settings.referralCreditTry,
          min_subtotal_for_credit: settings.minSubtotalForCredit,
          min_order_total_try: settings.minOrderTotal,
          max_order_total_try: settings.maxOrderTotal,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "DB ayarları kaydedilemedi (local yine de yazıldı)");
      } else {
        toast.success("Ayarlar kaydedildi");
      }
    } catch (err) {
      console.error("[admin/ayarlar save]", err);
      toast.error("Kaydetme başarısız");
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    if (!confirm("Tüm ayarlar varsayılana sıfırlansın mı?")) return;
    setSettings(DEFAULTS);
    saveLocalSettings(DEFAULTS);
    toast.info("Varsayılana döndü (kaydetmek için butona bas)");
  };

  if (!hydrated) {
    return (
      <main className="py-12">
        <div className="mx-auto max-w-[760px] px-6 space-y-3">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton.Card />
          <Skeleton.Card />
        </div>
      </main>
    );
  }

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[760px] px-6">
        <div className="mb-6">
          <Eyebrow>Site geneli</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Ayarlar
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            Vergi, kargo, tatil günleri ve iletişim ayarları.
          </p>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          {/* Finans */}
          <Card padding="p-6">
            <h2 className="text-lg font-semibold mb-4">Finans</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField
                label="KDV oranı (%)"
                value={settings.vatPct}
                onChange={(v) => update("vatPct", v)}
                hint="Standart 20%, kategoriye göre 1/8/10 olabilir"
              />
            </div>
          </Card>

          {/* Kargo */}
          <Card padding="p-6">
            <h2 className="text-lg font-semibold mb-4">Kargo</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField
                label="Kargo ücreti (TL)"
                value={settings.shippingFee}
                onChange={(v) => update("shippingFee", v)}
                hint="Ücretsiz eşiğin altındaki siparişlere uygulanır"
              />
              <NumberField
                label="Ücretsiz kargo eşiği (TL)"
                value={settings.freeShippingThreshold}
                onChange={(v) => update("freeShippingThreshold", v)}
                hint="Bu tutar üstünde kargo ücretsiz"
              />
            </div>
          </Card>

          {/* Sefa 18 May v68 (CRO denetim): Sepet min/max sipariş tutarı */}
          <Card padding="p-6">
            <h2 className="text-lg font-semibold mb-4">
              Sipariş tutarı limit
            </h2>
            <p className="text-[12.5px] text-gri-700 mb-4 leading-relaxed">
              Sepet bu aralığın dışına çıkarsa kullanıcıya uyarı gösterilir.
              Min altında "X TL daha ekle"; max üstünde "toplu sipariş için
              WhatsApp" yönlendirmesi. KDV dahil tutar üzerinden kontrol edilir.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField
                label="Minimum sipariş tutarı (TL)"
                value={settings.minOrderTotal}
                onChange={(v) => update("minOrderTotal", v)}
                hint="Altındaki sepet ödemeye geçemez (0 = limit yok)"
              />
              <NumberField
                label="Maksimum sipariş tutarı (TL)"
                value={settings.maxOrderTotal}
                onChange={(v) => update("maxOrderTotal", v)}
                hint="Üstündeki sepet WhatsApp'a yönlendirilir (0 = limit yok)"
              />
            </div>
          </Card>

          {/* Sadakat / hediye çekleri */}
          <Card padding="p-6">
            <h2 className="text-lg font-semibold mb-4">Sadakat çekleri</h2>
            <p className="text-[12.5px] text-gri-700 mb-4 leading-relaxed">
              Yeni üyeye verilen hoşgeldin çeki ve davet edene/davet edilen
              kişiye verilen referans hediyesi. Çek kullanımı için min sepet
              tutarı zorunlu.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <NumberField
                label="Hoşgeldin çeki (TL)"
                value={settings.welcomeCreditTry}
                onChange={(v) => update("welcomeCreditTry", v)}
                hint="Yeni üye ilk siparişte"
              />
              <NumberField
                label="Referans çeki (TL)"
                value={settings.referralCreditTry}
                onChange={(v) => update("referralCreditTry", v)}
                hint="Davet eden + davet edilen"
              />
              <NumberField
                label="Min sepet (TL)"
                value={settings.minSubtotalForCredit}
                onChange={(v) => update("minSubtotalForCredit", v)}
                hint="Çek kullanım eşiği"
              />
            </div>
          </Card>

          {/* Üretim süresi */}
          <Card padding="p-6">
            <h2 className="text-lg font-semibold mb-4">Üretim ve teslim</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField
                label="Sticker teslim (gün)"
                value={settings.defaultStickerDelivery}
                onChange={(v) => update("defaultStickerDelivery", v)}
              />
              <NumberField
                label="Etiket teslim (gün)"
                value={settings.defaultEtiketDelivery}
                onChange={(v) => update("defaultEtiketDelivery", v)}
              />
            </div>
            {/* Sefa 18 May v68 (senkronizasyon denetimi):
                "Hızlı şerit (acele)" checkbox kaldırıldı. Sefa kuralı:
                "Hızlı/acele baskı YOK" — Pim AI KB + SSS + anasayfada
                tutarlı. Checkbox UI'da kalırsa yanlış toggle riski +
                Pim AI'a yanlış sinyal verir. */}
            <div className="mt-4 rounded-lg bg-mavi-soft p-3 text-[12.5px] text-mavi-koyu">
              <strong>Sabit politika:</strong> Hızlı/acele baskı hizmeti
              YOK. Tüm siparişler standart akış. Bu kural kod tabanında
              sabit (Pim AI KB + SSS + Pim chat KB ile senkron).
            </div>
          </Card>

          {/* İletişim */}
          <Card padding="p-6">
            <h2 className="text-lg font-semibold mb-4">İletişim</h2>
            <div className="space-y-3">
              <TextField
                label="Email gönderici adresi"
                value={settings.emailFrom}
                onChange={(v) => update("emailFrom", v)}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <TextField
                  label="Telefon"
                  value={settings.contactPhone}
                  onChange={(v) => update("contactPhone", v)}
                  placeholder="Hat henüz aktif değil"
                />
                <TextField
                  label="WhatsApp"
                  value={settings.contactWhatsapp}
                  onChange={(v) => update("contactWhatsapp", v)}
                  placeholder="Aktif olunca ekle"
                />
              </div>
            </div>
          </Card>

          {/* Tatil */}
          <Card padding="p-6">
            <h2 className="text-lg font-semibold mb-4">Tatil günleri</h2>
            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block">
                Resmi tatiller (üretim duraksaması)
              </span>
              <textarea
                value={settings.holidays}
                onChange={(e) => update("holidays", e.target.value)}
                rows={3}
                className="block w-full px-3.5 py-2.5 rounded-[12px] bg-white text-[14px] text-lacivert ring-1 ring-gri-200 focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)] transition-shadow resize-none"
                placeholder="Virgülle ayrılmış tarihler"
              />
            </label>
            <p className="text-[12px] text-gri-500 mt-2">
              Bu günlerde teslim tahmini otomatik kayar (ileride pazarlama
              banner&rsquo;ı gösterilebilir).
            </p>
          </Card>

          {/* Aksiyon */}
          <div className="flex justify-between gap-3 sticky bottom-4 z-10 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-2 ring-1 ring-gri-200">
            <Button
              type="button"
              variant="ghost"
              onClick={onReset}
            >
              Varsayılana sıfırla
            </Button>
            <div className="flex gap-2">
              <Pim pose="happy" size={32} bob={false} />
              <Button type="submit" variant="primary" size="lg" disabled={saving}>
                {saving ? "Kaydediliyor..." : "Ayarları kaydet"}{" "}
                {!saving && <Icon.Check size={14} />}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold mb-1.5 block">{label}</span>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        step="any"
      />
      {hint && (
        <span className="text-[11.5px] text-gri-500 mt-1 block leading-relaxed">
          {hint}
        </span>
      )}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold mb-1.5 block">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
