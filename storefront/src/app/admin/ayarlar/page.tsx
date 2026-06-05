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

import { useEffect, useRef, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Input, Eyebrow, useToast, Skeleton, Modal } from "@/components/ui";

const STORAGE_KEY = "pim_site_settings_v1";

interface SiteSettings {
  vatPct: number;
  shippingFee: number;
  freeShippingThreshold: number;
  welcomeCreditTry: number;
  referralCreditTry: number;
  minSubtotalForCredit: number;
  minOrderTotal: number;
  maxOrderTotal: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  defaultStickerDelivery: number;
  defaultEtiketDelivery: number;
  fastTrackEnabled: boolean; // DEPRECATED — Sefa kuralı "hızlı baskı yok", UI'dan kaldırıldı
  emailFrom: string;
  contactPhone: string;
  contactWhatsapp: string;
  holidays: string;
  /** Organization sameAs — virgülle ayrılmış HTTPS URL */
  seoSocialLinks: string;
  /** Schema.org contactPoint telefon */
  seoContactPhone: string;
}

const DEFAULTS: SiteSettings = {
  vatPct: 20,
  shippingFee: 49,
  freeShippingThreshold: 500,
  welcomeCreditTry: 250,
  referralCreditTry: 250,
  minSubtotalForCredit: 500,
  minOrderTotal: 250,
  maxOrderTotal: 250000,
  maintenanceMode: false,
  maintenanceMessage:
    "Kısa süreli bakım yapılıyor. Birkaç dakika içinde tekrar deneyin.",
  defaultStickerDelivery: 5,
  defaultEtiketDelivery: 10,
  fastTrackEnabled: false, // Hızlı baskı YOK
  emailFrom: "info@pimetiket.com",
  contactPhone: "", // Henüz hat yok — Sefa açacak
  contactWhatsapp: "", // Henüz aktif değil
  holidays: "1 Ocak, 23 Nisan, 1 Mayıs, 19 Mayıs, 15 Temmuz, 30 Ağustos, 29 Ekim + Ramazan + Kurban",
  seoSocialLinks: "",
  seoContactPhone: "+90 545 699 90 63",
};

const NUMERIC_KEYS: Array<
  keyof Pick<
    SiteSettings,
    | "vatPct"
    | "shippingFee"
    | "freeShippingThreshold"
    | "welcomeCreditTry"
    | "referralCreditTry"
    | "minSubtotalForCredit"
    | "minOrderTotal"
    | "maxOrderTotal"
    | "defaultStickerDelivery"
    | "defaultEtiketDelivery"
  >
> = [
  "vatPct",
  "shippingFee",
  "freeShippingThreshold",
  "welcomeCreditTry",
  "referralCreditTry",
  "minSubtotalForCredit",
  "minOrderTotal",
  "maxOrderTotal",
  "defaultStickerDelivery",
  "defaultEtiketDelivery",
];

type DbNumericKey =
  | "shipping_fee_try"
  | "free_shipping_threshold"
  | "welcome_credit_try"
  | "referral_credit_try"
  | "min_subtotal_for_credit"
  | "min_order_total_try"
  | "max_order_total_try";

const DB_FIELD_MAP: Record<
  | "shippingFee"
  | "freeShippingThreshold"
  | "welcomeCreditTry"
  | "referralCreditTry"
  | "minSubtotalForCredit"
  | "minOrderTotal"
  | "maxOrderTotal",
  DbNumericKey
> = {
  shippingFee: "shipping_fee_try",
  freeShippingThreshold: "free_shipping_threshold",
  welcomeCreditTry: "welcome_credit_try",
  referralCreditTry: "referral_credit_try",
  minSubtotalForCredit: "min_subtotal_for_credit",
  minOrderTotal: "min_order_total_try",
  maxOrderTotal: "max_order_total_try",
};

function parseNum(val: unknown, fallback: number): number {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function sanitizeLocalSettings(local: Partial<SiteSettings>): Partial<SiteSettings> {
  const out = { ...local };
  for (const key of NUMERIC_KEYS) {
    const fallback = DEFAULTS[key];
    out[key] = parseNum(out[key], fallback) as SiteSettings[typeof key];
  }
  return out;
}

function loadLocalSettings(): Partial<SiteSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return sanitizeLocalSettings(JSON.parse(raw) as Partial<SiteSettings>);
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
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const dbBaselineRef = useRef<
    Partial<Record<DbNumericKey, number>> & {
      seoSocialLinks?: string;
      seoContactPhone?: string;
    }
  >({});

  const patchMaintenance = async (
    patch: Partial<Pick<SiteSettings, "maintenanceMode" | "maintenanceMessage">>
  ) => {
    setMaintenanceSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          maintenance_mode: patch.maintenanceMode,
          maintenance_message: patch.maintenanceMessage,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Bakım modu güncellenemedi");
        return false;
      }
      toast.success(
        patch.maintenanceMode === true
          ? "Bakım modu açıldı"
          : patch.maintenanceMode === false
            ? "Bakım modu kapatıldı"
            : "Bakım mesajı güncellendi"
      );
      return true;
    } catch {
      toast.error("Bakım modu güncellenemedi");
      return false;
    } finally {
      setMaintenanceSaving(false);
    }
  };

  useEffect(() => {
    const local = loadLocalSettings();
    const cleaned = {
      ...DEFAULTS,
      ...sanitizeLocalSettings(local),
      fastTrackEnabled: false,
    };
    setSettings(cleaned);
    setHydrated(true);

    void fetch("/api/admin/settings", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          toast.error("DB ayarlari yuklenemedi — yetki veya ag hatasi");
          return null;
        }
        return r.json();
      })
      .then((json) => {
        if (!json?.settings) return;
        const s = json.settings as Record<string, unknown>;
        const baseline: Partial<Record<DbNumericKey, number>> = {};
        const dbPatch: Partial<SiteSettings> = {};

        for (const [formKey, dbKey] of Object.entries(DB_FIELD_MAP) as Array<
          [keyof typeof DB_FIELD_MAP, DbNumericKey]
        >) {
          const val = parseNum(
            s[dbKey],
            DEFAULTS[formKey as keyof typeof DB_FIELD_MAP]
          );
          baseline[dbKey] = val;
          dbPatch[formKey as keyof SiteSettings] = val as never;
        }

        dbBaselineRef.current = {
          ...baseline,
          seoSocialLinks: String(s.social_links ?? ""),
          seoContactPhone: String(s.seo_contact_phone ?? DEFAULTS.seoContactPhone),
        };
        setSettings((prev) => ({
          ...prev,
          ...dbPatch,
          maintenanceMode: Boolean(s.maintenance_mode ?? prev.maintenanceMode),
          maintenanceMessage: String(
            s.maintenance_message ?? prev.maintenanceMessage
          ),
          seoSocialLinks: String(s.social_links ?? prev.seoSocialLinks),
          seoContactPhone: String(
            s.seo_contact_phone ?? prev.seoContactPhone
          ),
        }));
      })
      .catch(() => {
        toast.error("DB ayarlari yuklenemedi");
      })
      .finally(() => {
        setDbLoading(false);
      });
  }, [toast]);

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
      const patchBody: Record<string, number> = {};
      for (const [formKey, dbKey] of Object.entries(DB_FIELD_MAP) as Array<
        [keyof typeof DB_FIELD_MAP, DbNumericKey]
      >) {
        const current = settings[formKey as keyof typeof DB_FIELD_MAP];
        const baseline = dbBaselineRef.current[dbKey];
        if (baseline === undefined || current !== baseline) {
          patchBody[dbKey] = current;
        }
      }

      const seoPatch: Record<string, string> = {};
      if (settings.seoSocialLinks !== dbBaselineRef.current.seoSocialLinks) {
        seoPatch.social_links = settings.seoSocialLinks;
      }
      if (settings.seoContactPhone !== dbBaselineRef.current.seoContactPhone) {
        seoPatch.seo_contact_phone = settings.seoContactPhone;
      }

      const fullPatch = { ...patchBody, ...seoPatch };

      if (Object.keys(fullPatch).length === 0) {
        toast.info("DB alanlarinda degisiklik yok (local ayarlar kaydedildi)");
        return;
      }

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fullPatch),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "DB ayarlari kaydedilemedi (local yine de yazildi)");
      } else {
        const j = (await res.json()) as { settings?: Record<string, unknown> };
        if (j.settings) {
          for (const [formKey, dbKey] of Object.entries(DB_FIELD_MAP) as Array<
            [keyof typeof DB_FIELD_MAP, DbNumericKey]
          >) {
            dbBaselineRef.current[dbKey] = parseNum(
              j.settings[dbKey],
              settings[formKey as keyof typeof DB_FIELD_MAP]
            );
          }
        }
        toast.success("Ayarlar kaydedildi");
      }
    } catch (err) {
      console.error("[admin/ayarlar save]", err);
      toast.error("Kaydetme başarısız");
    } finally {
      setSaving(false);
    }
  };

  const confirmReset = () => {
    setSettings(DEFAULTS);
    saveLocalSettings(DEFAULTS);
    setShowResetModal(false);
    toast.info("Varsayilana dondu (kaydetmek icin butona bas)");
  };

  if (!hydrated || dbLoading) {
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

        <Card
          padding="p-6"
          className="mb-6 border-2 border-kirmizi/40 bg-kirmizi-soft/10"
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="text-lg"></span>
            <h2 className="text-lg font-semibold text-kirmizi-koyu">
              Bakım Modu
            </h2>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={settings.maintenanceMode}
              disabled={maintenanceSaving}
              onChange={async (e) => {
                const next = e.target.checked;
                setSettings((s) => ({ ...s, maintenanceMode: next }));
                const ok = await patchMaintenance({ maintenanceMode: next });
                if (!ok) {
                  setSettings((s) => ({ ...s, maintenanceMode: !next }));
                }
              }}
              className="h-5 w-5 rounded border-gri-300 text-kirmizi focus:ring-kirmizi"
            />
            <span className="text-sm font-medium text-lacivert">
              {settings.maintenanceMode ? "Açık" : "Kapalı"}
            </span>
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[13px] font-semibold">
              Mesaj
            </span>
            <Input
              value={settings.maintenanceMessage}
              disabled={maintenanceSaving}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  maintenanceMessage: e.target.value,
                }))
              }
              onBlur={async (e) => {
                await patchMaintenance({
                  maintenanceMessage: e.target.value,
                });
              }}
            />
          </label>
          <p className="mt-3 text-[12.5px] leading-relaxed text-gri-700">
             Açıkken müşteriler siteye erişemez. Admin paneli etkilenmez.
          </p>
        </Card>

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
                label="Kargo ücreti (₺)"
                value={settings.shippingFee}
                onChange={(v) => update("shippingFee", v)}
                hint="Ücretsiz eşiğin altındaki siparişlere uygulanır"
              />
              <NumberField
                label="Ücretsiz kargo eşiği (₺)"
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
              Min altında "X ₺ daha ekle"; max üstünde "toplu sipariş için
              WhatsApp" yönlendirmesi. KDV dahil tutar üzerinden kontrol edilir.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField
                label="Minimum sipariş tutarı (₺)"
                value={settings.minOrderTotal}
                onChange={(v) => update("minOrderTotal", v)}
                hint="Altındaki sepet ödemeye geçemez (0 = limit yok)"
              />
              <NumberField
                label="Maksimum sipariş tutarı (₺)"
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
                label="Hoşgeldin çeki (₺)"
                value={settings.welcomeCreditTry}
                onChange={(v) => update("welcomeCreditTry", v)}
                hint="Yeni üye ilk siparişte"
              />
              <NumberField
                label="Referans çeki (₺)"
                value={settings.referralCreditTry}
                onChange={(v) => update("referralCreditTry", v)}
                hint="Davet eden + davet edilen"
              />
              <NumberField
                label="Min sepet (₺)"
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

          <Card padding="p-6">
            <h2 className="text-lg font-semibold mb-4">SEO ve sosyal</h2>
            <p className="text-[12.5px] text-gri-700 mb-4 leading-relaxed">
              Organization schema (<code className="text-[12px]">sameAs</code>,{" "}
              <code className="text-[12px]">contactPoint</code>). OG görselleri
              için{" "}
              <a href="/admin/gorseller" className="text-pim-mercan font-medium">
                Görsel yönetimi
              </a>
              .
            </p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[13px] font-semibold mb-1.5 block">
                  Sosyal profil URL&apos;leri
                </span>
                <textarea
                  value={settings.seoSocialLinks}
                  onChange={(e) => update("seoSocialLinks", e.target.value)}
                  rows={2}
                  className="block w-full px-3.5 py-2.5 rounded-[12px] bg-white text-[14px] text-lacivert ring-1 ring-gri-200 focus:outline-none focus:ring-pim-mercan resize-none"
                  placeholder="https://instagram.com/pimetiket,https://x.com/pimetiket"
                />
              </label>
              <TextField
                label="Schema telefon (contactPoint)"
                value={settings.seoContactPhone}
                onChange={(v) => update("seoContactPhone", v)}
                placeholder="+90 5XX XXX XX XX"
              />
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
              onClick={() => setShowResetModal(true)}
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

        <Modal
          open={showResetModal}
          onClose={() => setShowResetModal(false)}
          title="Varsayilana sifirla"
        >
          <p className="text-sm text-gri-700 leading-relaxed">
            Tum ayarlari varsayilan degerlere dondurmek istediginizden emin
            misiniz? Bu islem geri alinamaz. DB alanlari icin ayrica Kaydet
            tusuna basmaniz gerekir.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowResetModal(false)}>
              Iptal
            </Button>
            <Button variant="primary" onClick={confirmReset}>
              Sifirla
            </Button>
          </div>
        </Modal>
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
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return;
          const n = Number(raw);
          if (Number.isFinite(n) && n >= 0) onChange(n);
        }}
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
