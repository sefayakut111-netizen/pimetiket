/**
 * Tasarım şablonları lead magnet — e-posta karşılığı Canva/AI/Figma şablonları.
 * /sablonlar?tab=tasarim sekmesinde render edilir.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Input, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useSiteImage } from "@/lib/site-images-client";

const CATEGORIES: Array<{
  id: string;
  emoji: string;
  label: string;
  desc: string;
  examples: string;
}> = [
  {
    id: "zeytinyagi",
    emoji: "🫒",
    label: "Zeytinyağı & Doğal yağlar",
    desc: "Köy ürünleri, soğuk sıkım, butik üretim",
    examples: "Premium · Vintage · Modern minimal",
  },
  {
    id: "bal-recel",
    emoji: "🍯",
    label: "Bal, reçel, marmelat",
    desc: "Çiftlik markaları, ev yapımı",
    examples: "Rustik · Çiçekli · Pastel",
  },
  {
    id: "kozmetik",
    emoji: "🧴",
    label: "Kozmetik & Sabun",
    desc: "Doğal sabun, krem, esans",
    examples: "Botanik · Mermer · Pastel",
  },
  {
    id: "icecek",
    emoji: "🥤",
    label: "İçecek & Kombucha",
    desc: "Soda, kombucha, butik kahve",
    examples: "Pop art · Tipografik · Soğuk renk",
  },
  {
    id: "mum",
    emoji: "🕯️",
    label: "Mum & Wax melt",
    desc: "Soya mumu, dekoratif aromatik",
    examples: "Lüks · Boho · Pastel",
  },
  {
    id: "cay",
    emoji: "🍵",
    label: "Çay & Bitki çayı",
    desc: "Demlik, soğuk demleme, blendler",
    examples: "Doğal · El çizimi · Zen",
  },
  {
    id: "kahve",
    emoji: "☕",
    label: "Kahve & Çekirdek",
    desc: "Specialty kahve, single origin",
    examples: "Minimal · Endüstriyel · Vintage",
  },
  {
    id: "pet",
    emoji: "🐾",
    label: "Pet care & Mama",
    desc: "Pet bakım, mama, kedi/köpek aksesuar",
    examples: "Sevimli · Bold · Doğal",
  },
  {
    id: "ciftlik",
    emoji: "🌾",
    label: "Çiftlik ürünleri",
    desc: "Süt, yumurta, sebze, meyve",
    examples: "Çiftçi · Doğal kraft · Klasik",
  },
  {
    id: "anne-bebek",
    emoji: "👶",
    label: "Anne & Bebek",
    desc: "Bebek bakım, hediyelik, organik",
    examples: "Pastel · Yumuşak · El çizimi",
  },
  {
    id: "etkinlik",
    emoji: "🎉",
    label: "Etkinlik & Hediye",
    desc: "Düğün, doğum günü, kurumsal hediye",
    examples: "Şık · Folyo · Klasik",
  },
  {
    id: "kurumsal",
    emoji: "🏢",
    label: "Kurumsal & Marka",
    desc: "Logo etiketleri, kargo etiketleri",
    examples: "Modern · Endüstriyel · Profesyonel",
  },
];

export default function TasarimSablonlari() {
  const [email, setEmail] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const heroImage = useSiteImage("sablonlar_hero");
  const [result, setResult] = useState<
    | null
    | {
        ok: true;
        alreadySubscribed: boolean;
        downloadUrl: string | null;
      }
    | { ok: false; error: string }
  >(null);

  function toggleInterest(id: string) {
    setInterests((curr) =>
      curr.includes(id) ? curr.filter((c) => c !== id) : [...curr, id]
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !consent) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/lead/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          source: "sablonlar",
          interests,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        alreadySubscribed?: boolean;
        downloadUrl?: string | null;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.ok) {
        setResult({
          ok: false,
          error: data.detail ?? data.error ?? "Bir şey ters gitti, tekrar dene.",
        });
      } else {
        setResult({
          ok: true,
          alreadySubscribed: Boolean(data.alreadySubscribed),
          downloadUrl: data.downloadUrl ?? null,
        });
        try {
          const { track } = await import("@/lib/analytics/posthog-events");
          track("auth_signup_completed", {
            source: "sablonlar",
            interests_count: interests.length,
            already_subscribed: Boolean(data.alreadySubscribed),
          });
        } catch {
          /* silent */
        }
      }
    } catch (err) {
      setResult({
        ok: false,
        error:
          err instanceof Error ? err.message : "Bağlantı hatası, tekrar dene.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-8 items-center mb-10">
        <div>
          <Eyebrow>Lead magnet · Ücretsiz</Eyebrow>
          <h1 className="mt-4 text-[34px] md:text-[48px] leading-[1.05] font-semibold tracking-[-0.01em]">
            60+ <span className="text-pim-mercan">hazır şablon</span>
            <br />
            ile etiketin 5 dakikada hazır.
          </h1>
          <p className="mt-5 text-[16px] text-gri-700 max-w-[520px] leading-relaxed">
            Zeytinyağından kombucha&apos;ya, butik kozmetikten pet ürünlerine
            12 kategoride <strong>düzenlenebilir</strong> etiket şablonları.
            Canva, Illustrator, Figma uyumlu. Sefa&apos;nın tasarım ekibinin
            hazırladığı dosyalar — şablon size hediye.
          </p>
          <ul className="mt-5 space-y-2 text-[14px]">
            {[
              "60+ ayrı şablon, sürekli güncellenir",
              "Renk + yazı + logo serbestçe değiştirilebilir",
              "5 dakikada düzenle · Canva, Illustrator, Figma",
              "Bültene sadece yeni şablon çıkınca mail atarız (haftada bir bile değil)",
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
              alt={heroImage.altText ?? "Pim Etiket şablon paketi"}
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

      <section className="mb-10">
        <div className="mb-4">
          <h2 className="text-[22px] font-semibold">
            En çok ilgini çekenleri işaretle
          </h2>
          <p className="text-[13.5px] text-gri-700 mt-1">
            Hangi kategoride iş yaptığını söyle, sana özel öneri yapayım.
            Boş bırakırsan tüm 60+ şablonu alırsın.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {CATEGORIES.map((c) => {
            const isOn = interests.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleInterest(c.id)}
                className={cn(
                  "text-left rounded-xl ring-1 px-3.5 py-3 transition-all hover:-translate-y-0.5",
                  isOn
                    ? "bg-pim-mercan-tint ring-pim-mercan text-lacivert shadow-1"
                    : "bg-white ring-gri-200 text-lacivert hover:ring-pim-mercan"
                )}
                aria-pressed={isOn}
              >
                <div className="flex items-start gap-2">
                  <span className="text-[20px] leading-none">{c.emoji}</span>
                  <span className="text-[13px] font-semibold leading-tight flex-1">
                    {c.label}
                  </span>
                  {isOn && (
                    <Icon.Check
                      size={12}
                      className="text-pim-mercan shrink-0 mt-1"
                    />
                  )}
                </div>
                <div className="text-[11.5px] text-gri-700 mt-1.5 line-clamp-1">
                  {c.desc}
                </div>
                <div className="text-[10.5px] text-gri-500 mt-0.5 italic line-clamp-1">
                  {c.examples}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <Card padding="p-7" className="bg-gradient-to-br from-krem-soft to-white">
        {result?.ok ? (
          <SuccessState
            alreadySubscribed={result.alreadySubscribed}
            downloadUrl={result.downloadUrl}
            email={email}
          />
        ) : (
          <form onSubmit={onSubmit} className="max-w-[560px]">
            <div className="text-[11.5px] uppercase tracking-[0.06em] font-bold text-pim-mercan">
              Şablonları al
            </div>
            <h2 className="mt-2 text-[24px] font-semibold leading-tight">
              E-postanı bırak, ZIP&apos;i ve yeni eklenenleri sana yollayalım.
            </h2>
            <div className="mt-5">
              <label
                htmlFor="lead-email"
                className="block text-[13px] font-semibold mb-1.5"
              >
                E-posta adresin
              </label>
              <Input
                id="lead-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@isletmem.com"
                className="!h-12"
                autoComplete="email"
              />
            </div>

            <label className="mt-4 flex items-start gap-2.5 text-[12.5px] text-gri-700 leading-relaxed cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-pim-mercan cursor-pointer shrink-0"
                required
              />
              <span>
                E-postama yeni şablonlar ve özel teklifler gönderilmesini
                kabul ediyorum.{" "}
                <Link
                  href="/kvkk"
                  className="text-pim-mercan font-semibold hover:underline"
                >
                  KVKK aydınlatma
                </Link>{" "}
                ·{" "}
                <Link
                  href="/cerez"
                  className="text-pim-mercan font-semibold hover:underline"
                >
                  Çerez politikası
                </Link>
              </span>
            </label>

            {result && !result.ok && (
              <div className="mt-3 text-[12.5px] text-kirmizi bg-kirmizi-soft rounded-lg p-2.5">
                {result.error}
              </div>
            )}

            <div className="mt-5 flex flex-col sm:flex-row gap-3 items-start">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={!email || !consent || loading}
              >
                {loading ? "Kaydediliyor…" : "Şablonları gönder"}
              </Button>
              <p className="text-[11.5px] text-gri-500 leading-relaxed sm:max-w-[280px]">
                Şablon güncellemeleri ve seçilmiş duyurular. Spam atmıyoruz;
                bir tıkla abonelikten çıkabilirsin.
              </p>
            </div>
          </form>
        )}
      </Card>

      <section className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: "✨",
            title: "Düzenlenebilir",
            text: "Renk, yazı, logo — her şey serbestçe değişir. Canva linkini direkt aç, ihtiyacına göre özelleştir.",
          },
          {
            icon: "🚀",
            title: "Pim Etiket'te bastır",
            text: "Şablonu hazırlayınca uygulamadan direkt sipariş ver — yeniden tasarım yok.",
          },
          {
            icon: "🎯",
            title: "Pratik biçimde sıralı",
            text: "Yuvarlak/dikdörtgen, sticker/etiket boyutlarına göre kategorili. Aradığını 30 sn'de bul.",
          },
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

function SuccessState({
  alreadySubscribed,
  downloadUrl,
  email,
}: {
  alreadySubscribed: boolean;
  downloadUrl: string | null;
  email: string;
}) {
  return (
    <div className="max-w-[560px]">
      <div className="grid place-items-center w-14 h-14 rounded-2xl bg-yesil-soft text-yesil">
        <Icon.Check size={28} />
      </div>
      <h2 className="mt-4 text-[24px] font-semibold leading-tight">
        {alreadySubscribed
          ? "Zaten kayıtlısın — tekrar görüşmek güzel."
          : "Listeye eklendin."}
      </h2>
      <p className="mt-2 text-[14px] text-gri-700 leading-relaxed">
        {downloadUrl ? (
          <>
            Şablonların indirme linki hazır. Aşağıdaki butona bastığında ZIP
            iner. Yeni şablonlar eklenince <strong>{email}</strong> adresine
            mail atacağız.
          </>
        ) : (
          <>
            Şablonlar şu an son rötuşlardan geçiyor. <strong>{email}</strong>{" "}
            adresine hazırlanır hazırlanmaz mail atacağız — en geç 24 saat
            içinde.
          </>
        )}
      </p>
      {downloadUrl && (
        <div className="mt-5">
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="primary" size="lg">
              <Icon.Sparkle size={16} /> ZIP&apos;i indir
            </Button>
          </a>
        </div>
      )}
      <p className="mt-5 text-[12px] text-gri-500">
        İlgili bir konuda yardım ister misin?{" "}
        <Link
          href="/etiket"
          className="text-pim-mercan font-semibold hover:underline"
        >
          Etiket yapılandır →
        </Link>
      </p>
    </div>
  );
}
