/**
 * Pim Etiket — /bildirim-tercihleri
 *
 * Email + SMS opt-in tercihleri. Kategori bazlı kontrol:
 *   - Sipariş bildirimleri (her zaman açık, opt-out edilemez)
 *   - Pazarlama (kampanya, blog) — opt-in
 *   - Acil durum SMS (kargo gecikme, prova bekleyen) — opt-in
 *
 * localStorage; backend swap'te `notification_preferences` tablosuna geçer.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

const STORAGE_KEY = "pim_notification_prefs_v1";

interface Prefs {
  email: {
    orderUpdates: boolean;
    proofReady: boolean;
    shippingUpdates: boolean;
    marketing: boolean;
    blog: boolean;
  };
  sms: {
    urgentOrder: boolean;
    proofReady: boolean;
    delivery: boolean;
  };
}

const DEFAULTS: Prefs = {
  email: {
    orderUpdates: true,
    proofReady: true,
    shippingUpdates: true,
    marketing: false,
    blog: false,
  },
  sms: {
    urgentOrder: true,
    proofReady: false,
    delivery: false,
  },
};

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      email: { ...DEFAULTS.email, ...(parsed.email ?? {}) },
      sms: { ...DEFAULTS.sms, ...(parsed.sms ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

function savePrefs(p: Prefs): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export default function BildirimTercihleriPage() {
  const toast = useToast();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
    setHydrated(true);
  }, []);

  const toggleEmail = (key: keyof Prefs["email"]) => {
    const next = {
      ...prefs,
      email: { ...prefs.email, [key]: !prefs.email[key] },
    };
    setPrefs(next);
    savePrefs(next);
    toast.success("Tercih güncellendi");
  };

  const toggleSms = (key: keyof Prefs["sms"]) => {
    const next = {
      ...prefs,
      sms: { ...prefs.sms, [key]: !prefs.sms[key] },
    };
    setPrefs(next);
    savePrefs(next);
    toast.success("Tercih güncellendi");
  };

  if (!hydrated) {
    return (
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-12">
        <div className="text-center text-gri-500">Yükleniyor…</div>
      </main>
    );
  }

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[760px] px-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[14px] mb-5">
          <Link
            href="/panelim"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert"
          >
            Panelim
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <span className="font-semibold">Bildirim tercihleri</span>
        </div>

        <div className="mb-6">
          <Eyebrow>Hesap ayarları</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Bildirim tercihleri
          </h1>
          <p className="mt-2 text-base text-gri-700 leading-relaxed">
            Pim&rsquo;den ne zaman email/SMS almak istediğini sen belirle.
            Sipariş güncellemeleri zorunlu (yasal), diğer her şey kapatılabilir.
          </p>
        </div>

        {/* Email */}
        <Card padding="p-6" className="mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid place-items-center w-10 h-10 rounded-xl bg-pim-mercan-tint text-pim-mercan">
              <Icon.ChatBubble size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-lg">E-posta bildirimleri</h2>
              <p className="text-[12px] text-gri-700">Mail ile gönderilir</p>
            </div>
          </div>

          <div className="space-y-1">
            <ToggleRow
              label="Sipariş güncellemeleri"
              description="Ödeme alındı, üretime girdi, kargoya verildi."
              required
              checked={prefs.email.orderUpdates}
              onChange={() => toggleEmail("orderUpdates")}
            />
            <ToggleRow
              label="Prova hazır"
              description="Provayı incele ve onayla emaili."
              checked={prefs.email.proofReady}
              onChange={() => toggleEmail("proofReady")}
            />
            <ToggleRow
              label="Kargo bildirimi"
              description="Kargo takip linki + tahmini teslim."
              checked={prefs.email.shippingUpdates}
              onChange={() => toggleEmail("shippingUpdates")}
            />
            <ToggleRow
              label="Kampanya ve duyurular"
              description="Yeni malzeme, indirim, etkinlikler. Ayda 1-2 email."
              checked={prefs.email.marketing}
              onChange={() => toggleEmail("marketing")}
            />
            <ToggleRow
              label="Blog yazıları"
              description="Yeni rehber yayınlandığında özet email."
              checked={prefs.email.blog}
              onChange={() => toggleEmail("blog")}
            />
          </div>
        </Card>

        {/* SMS */}
        <Card padding="p-6" className="mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid place-items-center w-10 h-10 rounded-xl bg-yesil-soft text-yesil">
              <Icon.Bolt size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-lg">SMS bildirimleri</h2>
              <p className="text-[12px] text-gri-700">
                Acil + zamana duyarlı durumlar için
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <ToggleRow
              label="Acil sipariş bildirimi"
              description="Üretimde sorun, geç teslim riski gibi durumlar."
              checked={prefs.sms.urgentOrder}
              onChange={() => toggleSms("urgentOrder")}
            />
            <ToggleRow
              label="Prova bekliyor SMS"
              description="Email yetmez, kısa süre içinde onay gerekiyorsa."
              checked={prefs.sms.proofReady}
              onChange={() => toggleSms("proofReady")}
            />
            <ToggleRow
              label="Kargo teslimat günü"
              description="Kargo gelmeden önce bilgi notu."
              checked={prefs.sms.delivery}
              onChange={() => toggleSms("delivery")}
            />
          </div>
        </Card>

        {/* Footer */}
        <Card padding="p-5" className="!bg-krem">
          <div className="flex gap-4 items-start">
            <Pim pose="happy" size={48} bob={false} />
            <div>
              <h3 className="font-semibold text-base mb-1">
                Tercihler hemen uygulanır
              </h3>
              <p className="text-[13px] text-gri-700 leading-relaxed">
                İstediğin zaman kapatabilir/açabilirsin. Email gönderim
                altyapısı Faz 2&rsquo;de Resend ile aktif olacak; şimdilik
                tercihler kayıtlı tutuluyor.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

function ToggleRow({
  label,
  description,
  required,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  required?: boolean;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-4 py-3 cursor-pointer",
        required && "opacity-70 cursor-not-allowed"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[14.5px]">{label}</span>
          {required && (
            <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-gri-100 text-gri-700 text-[11px] font-semibold">
              Zorunlu
            </span>
          )}
        </div>
        <p className="text-[12.5px] text-gri-700 mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={required}
        onClick={() => !required && onChange()}
        className={cn(
          "relative w-11 h-6 rounded-full transition-colors shrink-0",
          checked ? "bg-pim-mercan" : "bg-gri-200",
          required && "cursor-not-allowed opacity-60"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </label>
  );
}
