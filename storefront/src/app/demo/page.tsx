/**
 * Pim Etiket — /demo
 *
 * Sefa için demo modu — tüm localStorage store'larını mock veriyle doldurup
 * sistemde dolaşmasını sağlar. "Defne Karaca" demo müşterisi olarak 4
 * sipariş, 1 iade, 5 audit kaydı, 1 sepet itemi gelir.
 *
 * Tek tıkla yükle / sıfırla. localStorage'da kalır, sunucuya gitmez.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, useToast, Skeleton } from "@/components/ui";
import { useSiteImage } from "@/lib/site-images-client";
import {
  seedDemoData,
  clearDemoData,
  isDemoMode,
  DEMO_CUSTOMER_NAME,
} from "@/lib/demo-seeder";

const SECTIONS = [
  {
    icon: <Icon.Box size={18} />,
    title: "4 sipariş — farklı statülerde",
    description:
      "PE-2026-DEMO1 (yeni ödendi) · DEMO2 (prova bekliyor) · DEMO3 (üretimde) · DEMO4 (teslim edildi). Hepsi için timeline + items + adres + ödeme detayı dolu.",
    href: "/siparislerim",
  },
  {
    icon: <Icon.Cart size={18} />,
    title: "1 ürün sepete eklenmiş",
    description:
      "Simli sticker, 100 adet, 60×60mm yuvarlak — sanki devam ettiğin bir alışveriş varmış gibi.",
    href: "/sepet",
  },
  {
    icon: <Icon.Info size={18} />,
    title: "1 iade talebi — incelemede",
    description:
      "PE-2026-DEMO4'e bağlı kalite problemi şikayeti, foto ekli. Admin tarafında onayla/reddet/iade et akışını test edebilirsin.",
    href: "/iadelerim",
  },
  {
    icon: <Icon.Sparkle size={18} />,
    title: "5 audit log kaydı",
    description:
      "Sefa'nın son 10 gündeki admin işlemleri — sipariş güncellemesi, ayar değişikliği, kupon oluşturma, yorum onayı, giriş.",
    href: "/admin/audit-log",
  },
  {
    icon: <Icon.User size={18} />,
    title: "Müşteri profili",
    description: `"${DEMO_CUSTOMER_NAME}" · İstanbul/Kadıköy · TC ile fatura. Tüm siparişler bu adres üzerine.`,
    href: "/admin/musteriler",
  },
  {
    icon: <Icon.ChatBubble size={18} />,
    title: "Pim chat hazır",
    description:
      "Pim açıldığı sayfanın bağlamını kendi anlar — etikette fiyat, siparişte takip, ana sayfada genel sohbet.",
    href: "/sticker",
  },
];

export default function DemoPage() {
  const router = useRouter();
  const toast = useToast();
  const [active, setActive] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const demoHero = useSiteImage("demo_hero");

  useEffect(() => {
    setActive(isDemoMode());
    setHydrated(true);
  }, []);

  const handleSeed = () => {
    setBusy(true);
    const result = seedDemoData();
    toast.success(
      `Demo veriler yüklendi: ${result.ordersCount} sipariş, ${result.cartCount} sepet itemi, ${result.returnsCount} iade`
    );
    setActive(true);
    setTimeout(() => {
      setBusy(false);
      router.push("/panelim");
    }, 800);
  };

  const handleClear = () => {
    if (!confirm("Demo veriler silinsin mi? Tüm sipariş, iade ve sepet kaybolacak.")) {
      return;
    }
    setBusy(true);
    clearDemoData();
    toast.info("Demo veriler temizlendi");
    setActive(false);
    setTimeout(() => setBusy(false), 400);
  };

  if (!hydrated) {
    return (
      <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[920px] px-6 space-y-4">
          <Skeleton className="h-10 w-1/2 mx-auto" />
          <Skeleton className="h-6 w-2/3 mx-auto" />
          <Skeleton.Card />
          <Skeleton.Card />
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
      <div className="mx-auto max-w-[920px] px-6">
        {/* Hero */}
        <div className="text-center mb-10">
          {demoHero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={demoHero.publicUrl}
              alt={demoHero.altText ?? "Pim Etiket demo"}
              className="mx-auto max-w-[480px] aspect-video h-auto object-cover rounded-2xl shadow-2"
            />
          ) : (
            <Pim pose="excited" size={140} />
          )}
          <Eyebrow>Demo modu</Eyebrow>
          <h1 className="mt-3 text-[32px] md:text-[44px] font-semibold tracking-tight leading-tight">
            Sistemi gerçek veriyle dolaş
          </h1>
          <p className="mt-3 text-base text-gri-700 max-w-[560px] mx-auto leading-relaxed">
            Tek tıkla {DEMO_CUSTOMER_NAME} müşterisinin verileri yüklenir —
            siparişler, iadeler, admin işlemleri. Sunucuya hiçbir şey
            gitmez, sadece bu cihazın hafızasında kalır.
          </p>
        </div>

        {/* Status */}
        {active ? (
          <Card padding="p-6" className="mb-6 !bg-yesil-soft !ring-yesil/30">
            <div className="flex items-center gap-3">
              <div className="grid place-items-center w-10 h-10 rounded-full bg-yesil text-white shrink-0">
                <Icon.Check size={18} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-base text-yesil">
                  Demo modu aktif
                </h3>
                <p className="text-[13px] text-gri-700 mt-0.5">
                  Sistem demo verilerle çalışıyor. Aşağıdaki linklerden istediğin
                  yere atla.
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={handleClear}
                disabled={busy}
              >
                Demo&rsquo;yu sıfırla
              </Button>
            </div>
          </Card>
        ) : (
          <Card padding="p-7" className="mb-6 text-center">
            <h3 className="font-semibold text-xl mb-2">
              Demo verileri henüz yüklü değil
            </h3>
            <p className="text-[14px] text-gri-700 mb-5 max-w-[440px] mx-auto leading-relaxed">
              Aşağıdaki butona bas, 1 saniye içinde sistem dolu hale gelsin.
              Sonra istediğin sayfaya git, dolaş, dene.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={handleSeed}
              disabled={busy}
            >
              {busy ? "Yükleniyor..." : "Demo verileriyle doldur"}{" "}
              {!busy && <Icon.ArrowR size={16} />}
            </Button>
          </Card>
        )}

        {/* Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="block p-5 rounded-2xl bg-white ring-1 ring-gri-200 hover:ring-pim-mercan hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="grid place-items-center w-10 h-10 rounded-xl bg-pim-mercan-tint text-pim-mercan shrink-0 group-hover:bg-pim-mercan group-hover:text-white transition-colors">
                  {s.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-[14.5px] text-lacivert">
                    {s.title}
                  </h4>
                  <p className="text-[12.5px] text-gri-700 mt-1 leading-relaxed">
                    {s.description}
                  </p>
                </div>
                <Icon.ChevR
                  size={14}
                  className="text-gri-500 shrink-0 mt-1.5 group-hover:text-pim-mercan transition-colors"
                />
              </div>
            </Link>
          ))}
        </div>

        {/* Tour suggestions */}
        <Card padding="p-6" className="!bg-krem">
          <div className="flex items-start gap-4">
            <Pim pose="happy" size={64} bob={false} />
            <div className="flex-1">
              <h3 className="font-bold text-base mb-2">
                Önerilen tur — sırayla bak, takıldığın yerde sor
              </h3>
              <ol className="space-y-2 text-[13.5px] text-gri-700 leading-relaxed list-decimal list-inside">
                <li>
                  <Link
                    href="/panelim"
                    className="text-pim-mercan font-semibold hover:underline"
                  >
                    /panelim
                  </Link>{" "}
                  — &ldquo;Hoş geldin Defne&rdquo; karşılaması, aktif siparişler timeline
                </li>
                <li>
                  <Link
                    href="/siparis/PE-2026-DEMO2"
                    className="text-pim-mercan font-semibold hover:underline"
                  >
                    /siparis/PE-2026-DEMO2
                  </Link>{" "}
                  — Prova bekleyen sipariş, dosya + prova canvas
                </li>
                <li>
                  <Link
                    href="/sepet"
                    className="text-pim-mercan font-semibold hover:underline"
                  >
                    /sepet
                  </Link>{" "}
                  → ödemeye geç → yeni sipariş ver (gerçek tier hesabıyla)
                </li>
                <li>
                  <Link
                    href="/admin"
                    className="text-pim-mercan font-semibold hover:underline"
                  >
                    /admin
                  </Link>{" "}
                  — KPI dashboard + son siparişler
                </li>
                <li>
                  <Link
                    href="/admin/iadeler"
                    className="text-pim-mercan font-semibold hover:underline"
                  >
                    /admin/iadeler
                  </Link>{" "}
                  → bekleyen iadeyi onayla / iade et
                </li>
                <li>
                  <Link
                    href="/admin/raporlar"
                    className="text-pim-mercan font-semibold hover:underline"
                  >
                    /admin/raporlar
                  </Link>{" "}
                  — aylık ciro chart + Top 5 boyut
                </li>
                <li>
                  <Link
                    href="/sticker"
                    className="text-pim-mercan font-semibold hover:underline"
                  >
                    /sticker
                  </Link>{" "}
                  → sağ alt Pim&rsquo;e &ldquo;100×100 holografik 250 adet ne kadar?&rdquo; sor
                </li>
              </ol>
            </div>
          </div>
        </Card>

        <p className="mt-6 text-[12px] text-gri-500 text-center max-w-[640px] mx-auto leading-relaxed">
          ⚠️ Demo veriler sadece bu cihazın localStorage&rsquo;ında. Tarayıcı
          önbelleğini temizlersen de gider. Backend swap (Faz 1.2) sonrası
          gerçek Supabase verisi devreye girecek.
        </p>
      </div>
    </main>
  );
}
