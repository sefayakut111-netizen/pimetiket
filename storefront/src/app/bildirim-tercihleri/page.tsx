/**
 * Pim Etiket — /bildirim-tercihleri
 *
 * Email + SMS opt-in tercihleri. Kategori bazlı kontrol:
 *   - Sipariş bildirimleri (her zaman açık, opt-out edilemez)
 *   - Pazarlama (kampanya, blog) — opt-in
 *   - Acil durum SMS (kargo gecikme, prova bekleyen) — opt-in
 *
 * notification_prefs tablosu (Supabase RLS) — cihazlar arası senkron.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Card, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/context";
import {
  DEFAULT_NOTIFICATION_PREFS,
  fetchNotificationPrefs,
  updateNotificationPrefs,
  type NotificationPrefsUi,
  type NotificationPrefsPatch,
} from "@/lib/customer-notification-prefs";

type Prefs = NotificationPrefsUi;

const DEFAULTS = DEFAULT_NOTIFICATION_PREFS;

const COPY = {
  tr: {
    breadPanel: "Panelim",
    breadCurrent: "Bildirim tercihleri",
    eyebrow: "Hesap ayarları",
    title: "Bildirim tercihleri",
    intro:
      "Pim'den ne zaman e-posta veya SMS almak istediğini sen belirle. Sipariş güncellemeleri zorunlu (yasal), diğer her şey kapatılabilir.",
    loading: "Yükleniyor…",
    prefSaved: "Tercih güncellendi",
    emailTitle: "E-posta bildirimleri",
    emailSub: "E-posta ile gönderilir",
    smsTitle: "SMS bildirimleri",
    smsSub: "Acil + zamana duyarlı durumlar için",
    requiredBadge: "Zorunlu",
    footerTitle: "Tercihler hemen uygulanır",
    footerDesc:
      "Bildirim tercihlerinizi istediğiniz zaman kapatıp açabilirsiniz. Sipariş güncellemeleri yasal zorunluluk gereği daima aktif kalır.",
    emailRows: {
      orderUpdates: {
        label: "Sipariş güncellemeleri",
        desc: "Ödeme alındı, üretime girdi, kargoya verildi.",
      },
      proofReady: {
        label: "Prova hazır",
        desc: "Provayı incele ve onayla e-postası.",
      },
      shippingUpdates: {
        label: "Kargo bildirimi",
        desc: "Kargo takip linki + tahmini teslim.",
      },
      marketing: {
        label: "Kampanya ve duyurular",
        desc: "Yeni malzeme, indirim, etkinlikler. Ayda 1-2 e-posta.",
      },
      blog: {
        label: "Blog yazıları",
        desc: "Yeni rehber yayınlandığında özet e-posta.",
      },
    },
    smsRows: {
      delivery: {
        label: "Kargo teslimat günü",
        desc: "Kargo gelmeden önce bilgi notu.",
      },
    },
  },
  en: {
    breadPanel: "Dashboard",
    breadCurrent: "Notification preferences",
    eyebrow: "Account settings",
    title: "Notification preferences",
    intro:
      "Decide when Pim should email or text you. Order updates are mandatory (legal); everything else can be turned off.",
    loading: "Loading…",
    prefSaved: "Preference updated",
    emailTitle: "Email notifications",
    emailSub: "Sent via email",
    smsTitle: "SMS notifications",
    smsSub: "For urgent + time-sensitive cases",
    requiredBadge: "Required",
    footerTitle: "Preferences apply immediately",
    footerDesc:
      "You can turn notifications on or off anytime. Order updates remain active by legal requirement.",
    emailRows: {
      orderUpdates: {
        label: "Order updates",
        desc: "Payment received, in production, shipped.",
      },
      proofReady: {
        label: "Proof ready",
        desc: "Email asking you to review and approve the proof.",
      },
      shippingUpdates: {
        label: "Shipping updates",
        desc: "Tracking link + estimated delivery.",
      },
      marketing: {
        label: "Campaigns & announcements",
        desc: "New materials, discounts, events. 1-2 emails per month.",
      },
      blog: {
        label: "Blog posts",
        desc: "Short summary email when a new guide is published.",
      },
    },
    smsRows: {
      delivery: {
        label: "Delivery day notice",
        desc: "Heads-up before the courier arrives.",
      },
    },
  },
};

export default function BildirimTercihleriPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;

  const toast = useToast();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void fetchNotificationPrefs().then((loaded) => {
      if (loaded) setPrefs(loaded);
      setHydrated(true);
    });
  }, []);

  const persist = async (next: Prefs, patch: NotificationPrefsPatch) => {
    setPrefs(next);
    const r = await updateNotificationPrefs(patch);
    if (r.ok) toast.success(c.prefSaved);
    else toast.error(r.reason);
  };

  const toggleEmail = (key: keyof Prefs["email"]) => {
    if (key === "orderUpdates") return;
    const newVal = !prefs.email[key];
    const next = {
      ...prefs,
      email: { ...prefs.email, [key]: newVal },
    };
    const emailPatch = { [key]: newVal } as Partial<Prefs["email"]>;
    void persist(next, { email: emailPatch });
  };

  const toggleSms = (key: keyof Prefs["sms"]) => {
    const newVal = !prefs.sms[key];
    const next = {
      ...prefs,
      sms: { ...prefs.sms, [key]: newVal },
    };
    const smsPatch = { [key]: newVal } as Partial<Prefs["sms"]>;
    void persist(next, { sms: smsPatch });
  };

  if (!hydrated) {
    return (
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-12">
        <div className="text-center text-gri-500">{c.loading}</div>
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
            {c.breadPanel}
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <span className="font-semibold">{c.breadCurrent}</span>
        </div>

        <div className="mb-6">
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            {c.title}
          </h1>
          <p className="mt-2 text-base text-gri-700 leading-relaxed">
            {c.intro}
          </p>
        </div>

        {/* Email */}
        <Card padding="p-6" className="mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid place-items-center w-10 h-10 rounded-xl bg-pim-mercan-tint text-pim-mercan">
              <Icon.ChatBubble size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{c.emailTitle}</h2>
              <p className="text-[12px] text-gri-700">{c.emailSub}</p>
            </div>
          </div>

          <div className="space-y-1">
            <ToggleRow
              label={c.emailRows.orderUpdates.label}
              description={c.emailRows.orderUpdates.desc}
              required
              requiredLabel={c.requiredBadge}
              checked={prefs.email.orderUpdates}
              onChange={() => toggleEmail("orderUpdates")}
            />
            <ToggleRow
              label={c.emailRows.proofReady.label}
              description={c.emailRows.proofReady.desc}
              checked={prefs.email.proofReady}
              onChange={() => toggleEmail("proofReady")}
            />
            <ToggleRow
              label={c.emailRows.shippingUpdates.label}
              description={c.emailRows.shippingUpdates.desc}
              checked={prefs.email.shippingUpdates}
              onChange={() => toggleEmail("shippingUpdates")}
            />
            <ToggleRow
              label={c.emailRows.marketing.label}
              description={c.emailRows.marketing.desc}
              checked={prefs.email.marketing}
              onChange={() => toggleEmail("marketing")}
            />
            <ToggleRow
              label={c.emailRows.blog.label}
              description={c.emailRows.blog.desc}
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
              <h2 className="font-semibold text-lg">{c.smsTitle}</h2>
              <p className="text-[12px] text-gri-700">{c.smsSub}</p>
            </div>
          </div>

          <div className="space-y-1">
            {/* Sefa 18 May v68: 'Acil sipariş bildirimi' + 'Prova bekliyor SMS' iptal */}
            <ToggleRow
              label={c.smsRows.delivery.label}
              description={c.smsRows.delivery.desc}
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
              <h3 className="font-semibold text-base mb-1">{c.footerTitle}</h3>
              <p className="text-[13px] text-gri-700 leading-relaxed">
                {c.footerDesc}
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
  requiredLabel,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  required?: boolean;
  requiredLabel?: string;
  checked: boolean;
  onChange: () => void;
}) {
  // Sefa 18 May v68: Toggle UI fix — required state opacity-60 ile yarı saydam
  // mercan "bozuk gibi" görünüyordu. Şimdi required iken bg-lacivert (kilitli
  // ama aktif net mesaj), opacity korunmuyor. Thumb içinde ✓ ikonu var.
  return (
    <label
      className={cn(
        "flex items-center gap-4 py-3",
        required ? "cursor-not-allowed" : "cursor-pointer"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[14.5px] text-lacivert">
            {label}
          </span>
          {required && (
            <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-lacivert/10 text-lacivert text-[11px] font-semibold ring-1 ring-lacivert/20">
              🔒 {requiredLabel ?? "Required"}
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
          required
            ? "bg-lacivert cursor-not-allowed"
            : checked
              ? "bg-pim-mercan"
              : "bg-gri-200"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform flex items-center justify-center text-[10px]",
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        >
          {required && (
            <span aria-hidden className="text-lacivert font-bold">
              ✓
            </span>
          )}
        </span>
      </button>
    </label>
  );
}
