/**
 * Pim Etiket — /panelim (E.2.2)
 *
 * Customer dashboard. v1-jsx/dashboard.jsx port.
 * Mock data — gerçek bağlantı I adımında.
 */

import Link from "next/link";
import { Pim, PimMini } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Pill } from "@/components/ui";
import { cn } from "@/lib/cn";

const PHASES = [
  "Konfigüre",
  "Ödendi",
  "Yüklendi",
  "AI kontrol",
  "Onay",
  "Üretim",
  "Kargo",
  "Teslim",
];

const ORDERS = [
  {
    id: "PE-2026-1182",
    title: "Olea Doğal Sabun — etiket",
    qty: 2000,
    mat: "Kraft + mat selefon",
    status: "Kontrolde",
    color: "var(--color-sari)",
    soft: "var(--color-sari-soft)",
    phase: 4,
    days: 3,
    action: "Provayı incele",
    pim: "inspect" as const,
  },
  {
    id: "PE-2026-1175",
    title: "Bulutlu Roastery — sticker",
    qty: 500,
    mat: "Vinil + parlak",
    status: "Üretimde",
    color: "var(--color-pim-mercan)",
    soft: "var(--color-pim-mercan-tint)",
    phase: 6,
    days: 5,
    action: "Detay",
    pim: "happy" as const,
  },
  {
    id: "PE-2026-1167",
    title: "Atölye Niş — Holografik tabaka",
    qty: 250,
    mat: "Holografik + glitter",
    status: "Kargoda",
    color: "var(--color-lacivert)",
    soft: "var(--color-gri-100)",
    phase: 7,
    days: 1,
    action: "Takip et",
    pim: "box" as const,
  },
];

const TRANSACTIONS = [
  { d: "2 May", t: "Sipariş PE-1175", a: -1750 },
  { d: "28 Nis", t: "İade bonusu", a: 120 },
  { d: "15 Nis", t: "Cüzdana yatırma", a: 5000 },
];

const DESIGNS = [
  { name: "Olea_v3.pdf", note: "Kullanıldı 2x", c: "bg-krem" },
  { name: "Bulutlu_logo.ai", note: "Kullanıldı 1x", c: "bg-[#FFE7D6]" },
  { name: "Niş_holo_2026.pdf", note: "Yeni", c: "bg-pim-mercan-tint" },
  { name: "Olea_kapak.pdf", note: "Taslak", c: "bg-yesil-soft" },
  { name: "Defterler_v1.eps", note: "Kullanıldı 4x", c: "bg-gri-100" },
];

const PROFILE_LINKS = [
  { t: "Profil ayarları", d: "Ad, e-posta, şifre", href: "/profil" },
  { t: "Adres defterim", d: "Teslim ve fatura adresleri", href: "/adreslerim" },
  { t: "Fatura bilgileri", d: "TC/VKN, e-fatura tercihi", href: "/fatura-bilgileri" },
  { t: "Yardım merkezi", d: "Pim ile sohbet", href: "/sss" },
];

export default function PanelimPage() {
  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-8">
        {/* HERO */}
        <div className="relative overflow-hidden rounded-2xl p-8 mb-6 bg-gradient-to-br from-krem to-krem-soft ring-1 ring-black/[0.04]">
          <div className="absolute -top-5 right-8 hidden md:block">
            <Pim pose="wave" size={160} />
          </div>
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
            8 MAYIS, CUMA
          </div>
          <h1 className="text-[28px] md:text-[40px] font-semibold tracking-tight leading-tight mt-2 mb-1.5">
            Hoş geldin, Ahmet 👋
          </h1>
          <p className="text-base text-gri-700">
            Bugün üç siparişin yolda. Olea provasını bekliyorum, hazır olunca bakalım.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-7 max-w-[720px]">
            <Stat
              label="Aktif sipariş"
              value="3"
              sub="2 üretimde, 1 kargoda"
              icon={<Icon.Box size={18} />}
              accent="text-pim-mercan"
            />
            <Stat
              label="Cüzdan bakiyen"
              value="2.480 TL"
              sub="Son işlem: 6 gün önce"
              icon={<Icon.Wallet size={18} />}
              accent="text-yesil"
            />
            <Stat
              label="Bu yıl basıldı"
              value="14.250"
              sub="adet etiket + sticker"
              icon={<Icon.Sparkle size={18} />}
              accent="text-turuncu"
            />
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <QuickAction
            icon={<Icon.Roll size={20} />}
            title="Yeni etiket"
            desc="1000 adetten başla"
            href="/etiket"
            primary
          />
          <QuickAction
            icon={<Icon.Sticker size={20} />}
            title="Yeni sticker"
            desc="25 adetten başla"
            href="/sticker"
          />
          <QuickAction
            icon={<Icon.Bolt size={20} />}
            title="Tekrar sipariş"
            desc="Olea — 2000 adet"
            href="/etiket"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
          {/* MAIN */}
          <div className="flex flex-col gap-6">
            {/* Active orders */}
            <section>
              <div className="flex justify-between items-center mb-3.5">
                <h2 className="text-[24px] font-semibold tracking-tight">
                  Aktif siparişler
                </h2>
                <Link
                  href="/siparislerim"
                  className="text-[13px] font-semibold text-gri-700 hover:text-pim-mercan inline-flex items-center gap-1"
                >
                  Tümünü gör <Icon.ChevR size={12} />
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                {ORDERS.map((o) => (
                  <Card key={o.id} padding="p-5">
                    <div className="flex gap-4 items-start">
                      <div
                        className="grid place-items-center w-14 h-14 rounded-xl shrink-0"
                        style={{ background: o.soft }}
                      >
                        <PimMini pose={o.pim} size={48} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
                          <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
                            {o.id}
                          </span>
                          <span
                            className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[12px] font-semibold"
                            style={{ background: o.soft, color: o.color }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: o.color }}
                            />
                            {o.status}
                          </span>
                        </div>
                        <div className="font-semibold text-base mb-0.5">
                          {o.title}
                        </div>
                        <div className="text-[13px] text-gri-700">
                          {o.qty} adet · {o.mat}
                        </div>

                        {/* Phase mini timeline */}
                        <div className="flex items-center gap-1 mt-3.5">
                          {PHASES.map((_, i) => (
                            <div
                              key={i}
                              className="flex-1 flex items-center gap-1"
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                  background:
                                    i < o.phase
                                      ? "var(--color-yesil)"
                                      : i === o.phase
                                        ? o.color
                                        : "var(--color-gri-200)",
                                  boxShadow:
                                    i === o.phase
                                      ? `0 0 0 3px ${o.soft}`
                                      : "none",
                                }}
                              />
                              {i < PHASES.length - 1 && (
                                <span
                                  className="flex-1 h-0.5"
                                  style={{
                                    background:
                                      i < o.phase
                                        ? "var(--color-yesil)"
                                        : "var(--color-gri-200)",
                                  }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between mt-1.5">
                          <span className="text-[11.5px] text-gri-700 font-semibold uppercase tracking-[0.04em]">
                            {PHASES[o.phase]}
                          </span>
                          <span
                            className="text-[11.5px] font-bold uppercase tracking-[0.04em]"
                            style={{ color: o.color }}
                          >
                            {o.phase >= 4
                              ? `${o.days} gün kaldı`
                              : "Devam ediyor"}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        href={`/siparis/${o.id}`}
                        className="shrink-0"
                      >
                        {o.action} <Icon.ChevR size={12} />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            {/* AI suggestion */}
            <div className="rounded-lg p-5 bg-gradient-to-br from-lacivert to-[#2C3849] text-white flex gap-5 items-center">
              <PimMini pose="think" size={56} />
              <div className="flex-1">
                <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-white/60">
                  SANA ÖZEL
                </div>
                <div className="font-semibold text-[15px] mt-1 leading-snug">
                  Geçen ay 5.000 etiket bastın — stokun azalmış olabilir, tekrar sipariş?
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                href="/etiket"
                className="!bg-white !text-lacivert !ring-0 shrink-0"
              >
                Yeniden bastır <Icon.ArrowR size={14} />
              </Button>
            </div>

            {/* Design library */}
            <section>
              <div className="flex justify-between items-center mb-3.5">
                <h2 className="text-[24px] font-semibold tracking-tight">
                  Tasarım kütüphanen
                </h2>
                <Button variant="ghost" size="sm">
                  <Icon.Plus size={14} /> Yeni yükle
                </Button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
                {DESIGNS.map((f) => (
                  <Card
                    key={f.name}
                    padding=""
                    className="w-[180px] shrink-0 overflow-hidden p-0!"
                  >
                    <div
                      className={cn(
                        "h-32 grid place-items-center",
                        f.c
                      )}
                    >
                      <svg width="64" height="80" viewBox="0 0 64 80" aria-hidden>
                        <rect
                          x="6"
                          y="2"
                          width="52"
                          height="74"
                          rx="4"
                          fill="white"
                          stroke="#1F2937"
                          strokeWidth="1"
                        />
                        <rect
                          x="14"
                          y="14"
                          width="36"
                          height="6"
                          rx="1"
                          fill="#FF6B5B"
                        />
                        <rect
                          x="14"
                          y="26"
                          width="28"
                          height="3"
                          rx="1"
                          fill="#1F2937"
                          opacity="0.4"
                        />
                        <rect
                          x="14"
                          y="34"
                          width="32"
                          height="3"
                          rx="1"
                          fill="#1F2937"
                          opacity="0.4"
                        />
                        <rect
                          x="14"
                          y="48"
                          width="36"
                          height="20"
                          rx="2"
                          fill="#F5EBD9"
                        />
                      </svg>
                    </div>
                    <div className="p-3">
                      <div className="font-semibold text-[13px] truncate">
                        {f.name}
                      </div>
                      <div className="text-[11.5px] text-gri-700 mt-0.5">
                        {f.note}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          </div>

          {/* SIDE */}
          <div className="flex flex-col gap-4">
            {/* Wallet */}
            <Card padding="p-5">
              <div className="flex justify-between items-center mb-3.5">
                <h3 className="text-base font-semibold m-0">Cüzdan</h3>
                <Icon.Wallet size={18} />
              </div>
              <div className="text-[28px] font-bold tracking-tight">
                2.480{" "}
                <span className="text-base font-semibold text-gri-700">TL</span>
              </div>
              <div className="text-[13px] text-gri-700 mt-1">
                Cüzdandan ödeyince{" "}
                <strong className="text-yesil">+%2 indirim</strong> kazanırsın
              </div>
              <div className="flex gap-2 mt-3.5">
                <Button variant="primary" size="sm" href="/cuzdan" className="flex-1">
                  <Icon.Plus size={14} /> Yatır
                </Button>
                <Button variant="secondary" size="sm" href="/cuzdan" className="flex-1">
                  Geçmiş
                </Button>
              </div>
              <div className="border-t border-gri-200 mt-4 pt-3.5 flex flex-col gap-2">
                {TRANSACTIONS.map((tr, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center text-[13px]"
                  >
                    <div>
                      <div className="font-medium">{tr.t}</div>
                      <div className="text-[11.5px] text-gri-700">{tr.d}</div>
                    </div>
                    <div
                      className={cn(
                        "font-semibold",
                        tr.a > 0 ? "text-yesil" : "text-lacivert"
                      )}
                    >
                      {tr.a > 0 ? "+" : ""}
                      {tr.a.toLocaleString("tr-TR")} TL
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Profile shortcuts */}
            <Card padding="p-2">
              {PROFILE_LINKS.map((s, i, a) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3.5 rounded-lg hover:bg-gri-50 transition-colors",
                    i < a.length - 1 && "border-b border-gri-100"
                  )}
                >
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{s.t}</div>
                    <div className="text-[11.5px] text-gri-700 mt-0.5">
                      {s.d}
                    </div>
                  </div>
                  <Icon.ChevR size={14} className="text-gri-500" />
                </Link>
              ))}
            </Card>

            {/* Pim chat */}
            <Card padding="p-5" className="!bg-krem">
              <div className="flex gap-3 items-center mb-2.5">
                <PimMini pose="chat" size={40} />
                <div>
                  <div className="font-bold">Pim&rsquo;le konuş</div>
                  <div className="text-[11.5px] text-gri-700">
                    Etiket Profesörü · şu an çevrimiçi
                  </div>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                block
                className="!bg-lacivert hover:!bg-lacivert-soft"
              >
                Sohbeti aç
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Stat({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl p-4 bg-white/70 backdrop-blur ring-1 ring-white/60">
      <div className="flex justify-between items-center">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
          {label}
        </div>
        <div className={accent}>{icon}</div>
      </div>
      <div className="text-[28px] font-bold tracking-tight mt-1.5 leading-none">
        {value}
      </div>
      <div className="text-[11.5px] text-gri-700 mt-1.5">{sub}</div>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  desc,
  href,
  primary,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg p-4 flex items-center gap-3.5 ring-1 transition-transform hover:-translate-y-0.5 shadow-1",
        primary
          ? "bg-lacivert text-white ring-lacivert"
          : "bg-white text-lacivert ring-gri-200"
      )}
    >
      <div
        className={cn(
          "grid place-items-center w-11 h-11 rounded-xl shrink-0",
          primary ? "bg-pim-mercan text-white" : "bg-pim-mercan-tint text-pim-mercan"
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[15px]">{title}</div>
        <div className="text-[13px] opacity-70 mt-0.5">{desc}</div>
      </div>
      <Icon.ArrowR size={16} />
    </Link>
  );
}
