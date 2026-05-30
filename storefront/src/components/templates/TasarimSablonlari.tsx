/**
 * Tasarım şablonları — Canva/AI/Figma uyumlu hazır etiket tasarımları.
 *
 * /sablonlar?tab=tasarim sekmesinde render edilir.
 *
 * 31 May 2026 (Sefa): E-posta karşılığı gönderim (lead magnet) modeli İPTAL.
 * Yeni model — Kesim sekmesiyle aynı: herkes görebilir, dosyaları sadece ÜYELER indirir.
 * Tasarım dosyaları (klasör/ZIP) Sefa tarafından verilecek; gelince kesim gibi
 * R2 + signed URL galeri kurulacak. O zamana kadar bu sekme "üyelere açılıyor"
 * bilgilendirme durumunda kalır (e-posta formu YOK).
 *
 * NOT: /api/lead/subscribe endpoint'i SİLİNMEDİ — footer bülten kaydı kullanıyor.
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow } from "@/components/ui";
import { useUser } from "@/lib/supabase/use-user";
import { useSiteImage } from "@/lib/site-images-client";

const CATEGORIES: Array<{
  emoji: string;
  label: string;
  desc: string;
  examples: string;
}> = [
  { emoji: "🫒", label: "Zeytinyağı & Doğal yağlar", desc: "Köy ürünleri, soğuk sıkım, butik üretim", examples: "Premium · Vintage · Modern minimal" },
  { emoji: "🍯", label: "Bal, reçel, marmelat", desc: "Çiftlik markaları, ev yapımı", examples: "Rustik · Çiçekli · Pastel" },
  { emoji: "🧴", label: "Kozmetik & Sabun", desc: "Doğal sabun, krem, esans", examples: "Botanik · Mermer · Pastel" },
  { emoji: "🥤", label: "İçecek & Kombucha", desc: "Soda, kombucha, butik kahve", examples: "Pop art · Tipografik · Soğuk renk" },
  { emoji: "🕯️", label: "Mum & Wax melt", desc: "Soya mumu, dekoratif aromatik", examples: "Lüks · Boho · Pastel" },
  { emoji: "🍵", label: "Çay & Bitki çayı", desc: "Demlik, soğuk demleme, blendler", examples: "Doğal · El çizimi · Zen" },
  { emoji: "☕", label: "Kahve & Çekirdek", desc: "Specialty kahve, single origin", examples: "Minimal · Endüstriyel · Vintage" },
  { emoji: "🐾", label: "Pet care & Mama", desc: "Pet bakım, mama, kedi/köpek aksesuar", examples: "Sevimli · Bold · Doğal" },
  { emoji: "🌾", label: "Çiftlik ürünleri", desc: "Süt, yumurta, sebze, meyve", examples: "Çiftçi · Doğal kraft · Klasik" },
  { emoji: "👶", label: "Anne & Bebek", desc: "Bebek bakım, hediyelik, organik", examples: "Pastel · Yumuşak · El çizimi" },
  { emoji: "🎉", label: "Etkinlik & Hediye", desc: "Düğün, doğum günü, kurumsal hediye", examples: "Şık · Folyo · Klasik" },
  { emoji: "🏢", label: "Kurumsal & Marka", desc: "Logo etiketleri, kargo etiketleri", examples: "Modern · Endüstriyel · Profesyonel" },
];

export default function TasarimSablonlari() {
  const heroImage = useSiteImage("sablonlar_hero");
  const { user } = useUser();

  return (
    <>
      {/* Hero */}
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-8 items-center mb-10">
        <div>
          <Eyebrow>Üyelere özel</Eyebrow>
          <h1 className="mt-4 text-[34px] md:text-[48px] leading-[1.05] font-semibold tracking-[-0.01em]">
            Hazır <span className="text-pim-mercan">tasarım şablonları</span>
            <br />
            ile etiketin 5 dakikada hazır.
          </h1>
          <p className="mt-5 text-[16px] text-gri-700 max-w-[520px] leading-relaxed">
            Zeytinyağından kombucha&apos;ya, butik kozmetikten pet ürünlerine
            12 kategoride <strong>düzenlenebilir</strong> etiket tasarımları.
            Canva, Illustrator, Figma uyumlu. Herkes önizleyebilir;
            dosyaları <strong>üyeler indirir</strong>.
          </p>
          <ul className="mt-5 space-y-2 text-[14px]">
            {[
              "Düzenlenebilir tasarımlar — renk, yazı, logo serbest",
              "Canva, Illustrator, Figma uyumlu",
              "Üye girişiyle ücretsiz indir",
              "Hazırlayınca uygulamadan direkt bastır",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2 text-gri-700">
                <span className="inline-grid place-items-center w-5 h-5 rounded-full bg-yesil-soft text-yesil shrink-0 mt-0.5">
                  <Icon.Check size={11} />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative aspect-square max-w-[360px] mx-auto md:ml-auto">
          {heroImage ? (
            <Image
              src={heroImage.publicUrl}
              alt={heroImage.altText ?? "Pim Etiket tasarım şablonları"}
              fill
              sizes="(max-width: 768px) 100vw, 360px"
              className="object-contain rounded-3xl"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              <Pim pose="excited" size={220} />
            </div>
          )}
        </div>
      </div>

      {/* Kategori showcase (bilgilendirici) */}
      <section className="mb-10">
        <div className="mb-4">
          <h2 className="text-[22px] font-semibold">12 kategoride tasarım</h2>
          <p className="text-[13.5px] text-gri-700 mt-1">
            İşine en yakın kategoriden başla — hepsi düzenlenebilir.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {CATEGORIES.map((c) => (
            <div
              key={c.label}
              className="text-left rounded-xl ring-1 ring-gri-200 bg-white px-3.5 py-3"
            >
              <div className="flex items-start gap-2">
                <span className="text-[20px] leading-none">{c.emoji}</span>
                <span className="text-[13px] font-semibold leading-tight flex-1 text-lacivert">
                  {c.label}
                </span>
              </div>
              <div className="text-[11.5px] text-gri-700 mt-1.5 line-clamp-1">
                {c.desc}
              </div>
              <div className="text-[10.5px] text-gri-500 mt-0.5 italic line-clamp-1">
                {c.examples}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Üye kapısı / durum — e-posta YOK */}
      <Card padding="p-7" className="bg-gradient-to-br from-krem-soft to-white">
        <div className="max-w-[560px]">
          <div className="grid place-items-center w-14 h-14 rounded-2xl bg-pim-mercan-tint text-pim-mercan">
            <Icon.Sparkle size={28} />
          </div>
          <h2 className="mt-4 text-[24px] font-semibold leading-tight">
            Tasarım şablonları üyelere açılıyor
          </h2>
          <p className="mt-2 text-[14px] text-gri-700 leading-relaxed">
            Düzenlenebilir tasarım paketini son rötuşlardan geçiriyoruz.
            Yayına girdiğinde, <strong>üye girişi yapan</strong> herkes
            buradan ücretsiz indirebilecek. Şimdi hazır kesim şablonlarına da
            göz at.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            {user ? (
              <Link href="/sablonlar?tab=kesim">
                <Button variant="primary" size="lg">
                  Kesim şablonlarına göz at
                </Button>
              </Link>
            ) : (
              <Link href="/auth?next=/sablonlar%3Ftab%3Dtasarim">
                <Button variant="primary" size="lg">
                  <Icon.User size={16} /> Üye ol / Giriş yap
                </Button>
              </Link>
            )}
            <Link href="/sablonlar?tab=kesim">
              <Button variant="secondary" size="lg">
                Kesim şablonları
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Sosyal kanıt */}
      <section className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: "✨", title: "Düzenlenebilir", text: "Renk, yazı, logo — her şey serbestçe değişir. Canva linkini direkt aç, ihtiyacına göre özelleştir." },
          { icon: "🚀", title: "Pim Etiket'te bastır", text: "Şablonu hazırlayınca uygulamadan direkt sipariş ver — yeniden tasarım yok." },
          { icon: "🎯", title: "Kategorili", text: "İş alanına göre düzenli. Aradığını 30 sn'de bul." },
        ].map((b, i) => (
          <Card key={i} padding="p-5">
            <div className="text-[26px]">{b.icon}</div>
            <h3 className="mt-2 text-[15px] font-semibold">{b.title}</h3>
            <p className="text-[12.5px] text-gri-700 mt-1 leading-relaxed">
              {b.text}
            </p>
          </Card>
        ))}
      </section>

      {/* Alt CTA */}
      <section className="mt-12 text-center bg-pim-mercan-tint rounded-2xl p-8">
        <h2 className="text-[20px] font-semibold">
          Şablonun yetmiyor mu, kişisel tasarım mı lazım?
        </h2>
        <p className="mt-2 text-[13.5px] text-gri-700 max-w-[520px] mx-auto leading-relaxed">
          Pim&apos;e söyle, fikrini brief&apos;e dönüştürelim. Daha sonra
          dilersen ekibimiz tasarımı hazırlasın.
        </p>
        <div className="mt-4 flex gap-2 justify-center flex-wrap">
          <Link href="/etiket">
            <Button variant="primary" size="md">
              Etiket yapılandır
            </Button>
          </Link>
          <Link href="/sticker">
            <Button variant="secondary" size="md">
              Sticker yapılandır
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
