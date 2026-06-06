/**
 * Pim Etiket — /admin/ayarlar
 *
 * Site geneli ayarlar — tek kaynak: site_settings (DB).
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Input, Eyebrow, useToast, Skeleton, Modal } from "@/components/ui";
import {
  DEFAULT_CONTACT_PHONE,
  DEFAULT_CONTACT_WHATSAPP,
  DEFAULT_ETIKET_DELIVERY_DAYS,
  DEFAULT_STICKER_DELIVERY_DAYS,
} from "@/lib/site-settings-shared";

interface SiteSettings {
  shippingFee: number;
  freeShippingThreshold: number;
  welcomeCreditTry: number;
  referralCreditTry: number;
  minSubtotalForCredit: number;
  minOrderTotal: number;
  maxOrderTotal: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  stickerDeliveryDays: number;
  etiketDeliveryDays: number;
  contactWhatsapp: string;
  seoSocialLinks: string;
  seoContactPhone: string;
}

const DEFAULTS: SiteSettings = {
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
  stickerDeliveryDays: DEFAULT_STICKER_DELIVERY_DAYS,
  etiketDeliveryDays: DEFAULT_ETIKET_DELIVERY_DAYS,
  contactWhatsapp: DEFAULT_CONTACT_WHATSAPP,
  seoSocialLinks: "",
  seoContactPhone: DEFAULT_CONTACT_PHONE,
};

type DbNumericKey =
  | "shipping_fee_try"
  | "free_shipping_threshold"
  | "welcome_credit_try"
  | "referral_credit_try"
  | "min_subtotal_for_credit"
  | "min_order_total_try"
  | "max_order_total_try"
  | "sticker_delivery_days"
  | "etiket_delivery_days";

const DB_NUMERIC_MAP: Record<
  | "shippingFee"
  | "freeShippingThreshold"
  | "welcomeCreditTry"
  | "referralCreditTry"
  | "minSubtotalForCredit"
  | "minOrderTotal"
  | "maxOrderTotal"
  | "stickerDeliveryDays"
  | "etiketDeliveryDays",
  DbNumericKey
> = {
  shippingFee: "shipping_fee_try",
  freeShippingThreshold: "free_shipping_threshold",
  welcomeCreditTry: "welcome_credit_try",
  referralCreditTry: "referral_credit_try",
  minSubtotalForCredit: "min_subtotal_for_credit",
  minOrderTotal: "min_order_total_try",
  maxOrderTotal: "max_order_total_try",
  stickerDeliveryDays: "sticker_delivery_days",
  etiketDeliveryDays: "etiket_delivery_days",
};

type DbBaseline = Partial<Record<DbNumericKey, number>> & {
  seoSocialLinks?: string;
  seoContactPhone?: string;
  contactWhatsapp?: string;
};

function parseNum(val: unknown, fallback: number): number {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function baselineFromSettings(s: Record<string, unknown>): DbBaseline {
  const baseline: DbBaseline = {};
  for (const [formKey, dbKey] of Object.entries(DB_NUMERIC_MAP) as Array<
    [keyof typeof DB_NUMERIC_MAP, DbNumericKey]
  >) {
    baseline[dbKey] = parseNum(
      s[dbKey],
      DEFAULTS[formKey as keyof typeof DB_NUMERIC_MAP]
    );
  }
  baseline.seoSocialLinks = String(s.social_links ?? "");
  baseline.seoContactPhone = String(
    s.seo_contact_phone ?? DEFAULTS.seoContactPhone
  );
  baseline.contactWhatsapp = String(
    s.contact_whatsapp ?? DEFAULTS.contactWhatsapp
  );
  return baseline;
}

function settingsFromDb(s: Record<string, unknown>): SiteSettings {
  const next = { ...DEFAULTS };
  for (const [formKey, dbKey] of Object.entries(DB_NUMERIC_MAP) as Array<
    [keyof typeof DB_NUMERIC_MAP, DbNumericKey]
  >) {
    next[formKey as keyof SiteSettings] = parseNum(
      s[dbKey],
      DEFAULTS[formKey as keyof typeof DB_NUMERIC_MAP]
    ) as never;
  }
  next.maintenanceMode = Boolean(s.maintenance_mode ?? next.maintenanceMode);
  next.maintenanceMessage = String(
    s.maintenance_message ?? next.maintenanceMessage
  );
  next.seoSocialLinks = String(s.social_links ?? next.seoSocialLinks);
  next.seoContactPhone = String(s.seo_contact_phone ?? next.seoContactPhone);
  next.contactWhatsapp = String(s.contact_whatsapp ?? next.contactWhatsapp);
  return next;
}

export default function AdminAyarlarPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS);
  const [canUpdate, setCanUpdate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const dbBaselineRef = useRef<DbBaseline>({});

  const patchMaintenance = async (
    patch: Partial<Pick<SiteSettings, "maintenanceMode" | "maintenanceMessage">>
  ) => {
    if (!canUpdate) {
      toast.error("Bu rol ayarları güncelleyemez");
      return false;
    }
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
    void fetch("/api/admin/settings", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          toast.error("Ayarlar yüklenemedi — yetki veya ağ hatası");
          return null;
        }
        return r.json();
      })
      .then((json) => {
        if (!json?.settings) return;
        const s = json.settings as Record<string, unknown>;
        dbBaselineRef.current = baselineFromSettings(s);
        setSettings(settingsFromDb(s));
        setCanUpdate(Boolean(json.canUpdate));
      })
      .catch(() => {
        toast.error("Ayarlar yüklenemedi");
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
    if (!canUpdate) {
      toast.error("Bu rol ayarları kaydedemez");
      return;
    }
    setSaving(true);
    try {
      const patchBody: Record<string, number | string> = {};
      for (const [formKey, dbKey] of Object.entries(DB_NUMERIC_MAP) as Array<
        [keyof typeof DB_NUMERIC_MAP, DbNumericKey]
      >) {
        const current = settings[formKey as keyof typeof DB_NUMERIC_MAP];
        const baseline = dbBaselineRef.current[dbKey];
        if (baseline === undefined || current !== baseline) {
          patchBody[dbKey] = current;
        }
      }

      if (settings.seoSocialLinks !== dbBaselineRef.current.seoSocialLinks) {
        patchBody.social_links = settings.seoSocialLinks;
      }
      if (settings.seoContactPhone !== dbBaselineRef.current.seoContactPhone) {
        patchBody.seo_contact_phone = settings.seoContactPhone;
      }
      if (settings.contactWhatsapp !== dbBaselineRef.current.contactWhatsapp) {
        patchBody.contact_whatsapp = settings.contactWhatsapp;
      }

      if (Object.keys(patchBody).length === 0) {
        toast.info("Değişiklik yok");
        return;
      }

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Ayarlar kaydedilemedi");
        return;
      }

      const j = (await res.json()) as { settings?: Record<string, unknown> };
      if (j.settings) {
        dbBaselineRef.current = baselineFromSettings(j.settings);
        setSettings(settingsFromDb(j.settings));
      }
      toast.success("Ayarlar kaydedildi");
    } catch (err) {
      console.error("[admin/ayarlar save]", err);
      toast.error("Kaydetme başarısız");
    } finally {
      setSaving(false);
    }
  };

  const confirmReset = () => {
    setSettings(DEFAULTS);
    setShowResetModal(false);
    toast.info("Varsayılana döndü — kaydetmek için butona bas");
  };

  if (dbLoading) {
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
            Kargo, teslim süreleri, iletişim ve sadakat ayarları.
          </p>
        </div>

        {!canUpdate && (
          <Card padding="p-4" className="mb-6 border border-amber-300 bg-amber-50">
            <p className="text-sm text-amber-900">
              Bu hesap ayarları görüntüleyebilir; kaydetmek için super_admin
              yetkisi gerekir.
            </p>
          </Card>
        )}

        <Card
          padding="p-6"
          className="mb-6 border-2 border-kirmizi/40 bg-kirmizi-soft/10"
        >
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-kirmizi-koyu">
              Bakım Modu
            </h2>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={settings.maintenanceMode}
              disabled={maintenanceSaving || !canUpdate}
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
              disabled={maintenanceSaving || !canUpdate}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  maintenanceMessage: e.target.value,
                }))
              }
              onBlur={async (e) => {
                if (!canUpdate) return;
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
          <Card padding="p-6">
            <h2 className="text-lg font-semibold mb-4">Kargo</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField
                label="Kargo ücreti (₺)"
                value={settings.shippingFee}
                onChange={(v) => update("shippingFee", v)}
                hint="Ücretsiz eşiğin altındaki siparişlere uygulanır"
                disabled={!canUpdate}
              />
              <NumberField
                label="Ücretsiz kargo eşiği (₺)"
                value={settings.freeShippingThreshold}
                onChange={(v) => update("freeShippingThreshold", v)}
                hint="Bu tutar üstünde kargo ücretsiz"
                disabled={!canUpdate}
              />
            </div>
          </Card>

          <Card padding="p-6">
            <h2 className="text-lg font-semibold mb-4">
              Sipariş tutarı limit
            </h2>
            <p className="text-[12.5px] text-gri-700 mb-4 leading-relaxed">
              Sepet bu aralığın dışına çıkarsa kullanıcıya uyarı gösterilir.
              KDV dahil tutar üzerinden kontrol edilir.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField
                label="Minimum sipariş tutarı (₺)"
                value={settings.minOrderTotal}
                onChange={(v) => update("minOrderTotal", v)}
                hint="Altındaki sepet ödemeye geçemez (0 = limit yok)"
                disabled={!canUpdate}
              />
              <NumberField
                label="Maksimum sipariş tutarı (₺)"
                value={settings.maxOrderTotal}
                onChange={(v) => update("maxOrderTotal", v)}
                hint="Üstündeki sepet WhatsApp'a yönlendirilir (0 = limit yok)"
                disabled={!canUpdate}
              />
            </div>
          </Card>

          <Card padding="p-6">
            <h2 className="text-lg font-semibold mb-4">Sadakat çekleri</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <NumberField
                label="Hoşgeldin çeki (₺)"
                value={settings.welcomeCreditTry}
                onChange={(v) => update("welcomeCreditTry", v)}
                disabled={!canUpdate}
              />
              <NumberField
                label="Referans çeki (₺)"
                value={settings.referralCreditTry}
                onChange={(v) => update("referralCreditTry", v)}
                disabled={!canUpdate}
              />
              <NumberField
                label="Min sepet (₺)"
                value={settings.minSubtotalForCredit}
                onChange={(v) => update("minSubtotalForCredit", v)}
                disabled={!canUpdate}
              />
            </div>
          </Card>

          <Card padding="p-6">
            <h2 className="text-lg font-semibold mb-4">Üretim ve teslim</h2>
            <p className="text-[12.5px] text-gri-700 mb-4 leading-relaxed">
              Ödeme sayfası, sipariş tahmini teslim tarihi ve footer bu
              değerleri kullanır.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField
                label="Sticker teslim (gün)"
                value={settings.stickerDeliveryDays}
                onChange={(v) => update("stickerDeliveryDays", v)}
                disabled={!canUpdate}
              />
              <NumberField
                label="Etiket teslim (gün)"
                value={settings.etiketDeliveryDays}
                onChange={(v) => update("etiketDeliveryDays", v)}
                disabled={!canUpdate}
              />
            </div>
            <div className="mt-4 rounded-lg bg-mavi-soft p-3 text-[12.5px] text-mavi-koyu">
              <strong>Sabit politika:</strong> Hızlı/acele baskı hizmeti yok.
              Tüm siparişler standart akış.
            </div>
          </Card>

          <Card padding="p-6">
            <h2 className="text-lg font-semibold mb-4">İletişim</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TextField
                label="Telefon (footer + schema)"
                value={settings.seoContactPhone}
                onChange={(v) => update("seoContactPhone", v)}
                placeholder="+90 5XX XXX XX XX"
                disabled={!canUpdate}
              />
              <TextField
                label="WhatsApp"
                value={settings.contactWhatsapp}
                onChange={(v) => update("contactWhatsapp", v)}
                placeholder="+90 5XX XXX XX XX"
                disabled={!canUpdate}
              />
            </div>
          </Card>

          <Card padding="p-6">
            <h2 className="text-lg font-semibold mb-4">SEO ve sosyal</h2>
            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block">
                Sosyal profil URL&apos;leri
              </span>
              <textarea
                value={settings.seoSocialLinks}
                onChange={(e) => update("seoSocialLinks", e.target.value)}
                rows={2}
                disabled={!canUpdate}
                className="block w-full px-3.5 py-2.5 rounded-[12px] bg-white text-[14px] text-lacivert ring-1 ring-gri-200 focus:outline-none focus:ring-pim-mercan resize-none disabled:opacity-60"
                placeholder="https://instagram.com/pimetiket,https://x.com/pimetiket"
              />
            </label>
          </Card>

          <div className="flex justify-between gap-3 sticky bottom-4 z-10 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-2 ring-1 ring-gri-200">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowResetModal(true)}
              disabled={!canUpdate}
            >
              Varsayılana sıfırla
            </Button>
            <div className="flex gap-2">
              <Pim pose="happy" size={32} bob={false} />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={saving || !canUpdate}
              >
                {saving ? "Kaydediliyor..." : "Ayarları kaydet"}{" "}
                {!saving && <Icon.Check size={14} />}
              </Button>
            </div>
          </div>
        </form>

        <Modal
          open={showResetModal}
          onClose={() => setShowResetModal(false)}
          title="Varsayılana sıfırla"
        >
          <p className="text-sm text-gri-700 leading-relaxed">
            Tüm alanları varsayılan değerlere döndürmek istediğinizden emin
            misiniz? Kaydet tuşuna basana kadar veritabanı değişmez.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowResetModal(false)}>
              İptal
            </Button>
            <Button variant="primary" onClick={confirmReset}>
              Sıfırla
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
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold mb-1.5 block">{label}</span>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        disabled={disabled}
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold mb-1.5 block">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </label>
  );
}
