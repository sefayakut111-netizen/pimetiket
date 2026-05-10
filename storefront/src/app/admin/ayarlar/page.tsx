/**
 * Pim Etiket — /admin/ayarlar
 *
 * Site geneli ayarlar: KDV oranı, kargo eşiği/ücreti, tatil günleri,
 * email gönderici, Pim chat varsayılan persona, vb.
 *
 * localStorage'da saklanır; backend swap'te `site_settings` tablosuna geçer.
 */

"use client";

import { useEffect, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Input, Eyebrow, useToast } from "@/components/ui";

const STORAGE_KEY = "pim_site_settings_v1";

interface SiteSettings {
  vatPct: number;
  shippingFee: number;
  freeShippingThreshold: number;
  defaultStickerDelivery: number;
  defaultEtiketDelivery: number;
  fastTrackEnabled: boolean;
  emailFrom: string;
  contactPhone: string;
  contactWhatsapp: string;
  holidays: string;
}

const DEFAULTS: SiteSettings = {
  vatPct: 20,
  shippingFee: 49,
  freeShippingThreshold: 1500,
  defaultStickerDelivery: 7, // 5-7 iş günü
  defaultEtiketDelivery: 12, // 8-12 iş günü
  fastTrackEnabled: true,
  emailFrom: "info@pimetiket.com",
  contactPhone: "", // Henüz hat yok — Sefa açacak
  contactWhatsapp: "", // Henüz aktif değil
  holidays: "1 Ocak, 23 Nisan, 1 Mayıs, 19 Mayıs, 15 Temmuz, 30 Ağustos, 29 Ekim",
};

function loadSettings(): SiteSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SiteSettings>) };
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(s: SiteSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export default function AdminAyarlarPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setHydrated(true);
  }, []);

  const update = <K extends keyof SiteSettings>(
    key: K,
    value: SiteSettings[K]
  ) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      saveSettings(settings);
      toast.success("Ayarlar kaydedildi");
      setSaving(false);
    }, 400);
  };

  const onReset = () => {
    if (!confirm("Tüm ayarlar varsayılana sıfırlansın mı?")) return;
    setSettings(DEFAULTS);
    saveSettings(DEFAULTS);
    toast.info("Varsayılana döndü");
  };

  if (!hydrated) {
    return (
      <main className="py-12">
        <div className="text-center text-gri-500">Yükleniyor…</div>
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
            <label className="flex items-center gap-2.5 mt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.fastTrackEnabled}
                onChange={(e) => update("fastTrackEnabled", e.target.checked)}
                className="accent-pim-mercan"
              />
              <span className="text-[14px]">
                Hızlı şerit (acele) seçeneği aktif
              </span>
            </label>
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
