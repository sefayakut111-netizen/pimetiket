/**
 * Pim Etiket — Anasayfa (E.1.1)
 *
 * design-prototype/v1-jsx/home.jsx → Next.js 14 + Tailwind 4 + TS portu.
 *
 * Bölümler:
 *   1. Hero (2 sütun grid: H1+CTA + Pim 300px + floating pills)
 *   2. 3 Pillar cards (Bolt / Sparkle / Truck)
 *   3. Product cards (Etiket + Sticker, SVG previews)
 *   4. How it works (4-adım yatay timeline)
 *   5. Testimonials (3 müşteri kartı)
 *   6. FAQ accordion (3 soru)
 *   7. Bottom CTA (lacivert dot-pattern + Pim excited)
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Pill, Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  // Root layout'taki default title kullanılır — template uygulanmaz.
  title: {
    absolute: "Pim Etiket — Markanın etiketi, fikrinin sticker'ı",
  },
  description:
    "1000 adetten başlayan etiket ve sticker baskı. AI dosyana bakar, 10 günde elinde. Bursa'dan, küçük markalar için.",
  alternates: { canonical: "/" },
};

const PILLARS = [
  {
    icon: <Icon.Bolt size={22} />,
    t: "1000 adetten başla",
    d: "Düşük adette de kaliteden ödün vermeden bastırırsın. Stoklamadan, esnek.",
  },
  {
    icon: <Icon.Sparkle size={22} />,
    t: "AI tasarımına bakıyor",
    d: "Yüklediğin dosyayı saniyeler içinde kontrol eder; DPI, marka, yazım — eksik varsa söyler.",
  },
  {
    icon: <Icon.Truck size={22} />,
    t: "10 günde elinde",
    d: "Bursa'dan kapına. Şeffaf üretim takibi, gerçek zamanlı statü ve Pim'in haberleri.",
  },
];

const STEPS = [
  { n: "01", t: "Konfigüre et", d: "Malzeme, kaplama, ölçü, adet — anlık fiyat." },
  { n: "02", t: "Dosyanı yükle", d: "PDF, AI, EPS… AI saniyeler içinde kontrol eder." },
  {
    n: "03",
    t: "Provayı onayla",
    d: "Rulonun üstünde nasıl görüneceğini gör, onayla.",
  },
  { n: "04", t: "Teslim al", d: "Bursa'dan kapına ortalama 10 günde." },
];

const TESTIMONIALS = [
  {
    n: "Defne Karaca",
    b: "Olea — Naturel sabun",
    q: "İlk siparişte 1500 adet etiketi 9 günde elimde gördüm. Pim hata diye saydığını gerçekten yakaladı.",
    bg: "bg-krem",
  },
  {
    n: "Mert Yılmaz",
    b: "Bulutlu Roastery",
    q: "Mat selefon + sıcak yaldızla raf etkisi inanılmaz oldu. Online sipariş ettiğim için inanamıyorum.",
    bg: "bg-white",
  },
  {
    n: "Ezgi & Can",
    b: "Atölye Niş",
    q: "Sticker tarafı tam bizim için. Az adet, hızlı, harika kâğıt. Müşterilerimize hediye olarak veriyoruz.",
    bg: "bg-pim-mercan-tint",
  },
];

const FAQS = [
  {
    q: "Minimum kaç adet basabiliyorum?",
    a: "Etiket için 1000, sticker için 25 adetten başlıyoruz.",
  },
  {
    q: "Tasarım dosyam yok, ne yapacağım?",
    a: "Pim'e söyle, basit bir tasarım için kütüphanemizdeki şablonlardan birini özelleştirebilirsin; daha karmaşık iş için partner stüdyolarımızla bağlarız.",
  },
  {
    q: "10 günden hızlı teslim mümkün mü?",
    a: "Evet, 'hızlı şerit' opsiyonu ile 5 güne kadar düşürebiliyoruz; ek ücreti konfigürasyon sayfasında görürsün.",
  },
];

const AVATAR_COLORS = ["#F5EBD9", "#FFCDB9", "#1F2937", "#FF9933"];

export default function HomePage() {
  return (
    <main className="animate-fade-up">
      {/* ============================== HERO ============================== */}
      <section className="relative overflow-hidden pt-16 pb-20">
        <div
          aria-hidden
          className="absolute inset-0 -z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 480px at 78% 28%, var(--color-krem) 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[1280px] px-8 grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
          {/* LEFT — copy */}
          <div>
            <Eyebrow>Türkiye&rsquo;nin akıllı dijital baskı atölyesi</Eyebrow>
            <h1 className="mt-5 text-[44px] md:text-[56px] leading-[1.04] font-semibold tracking-[-0.02em]">
              Markanın etiketi,
              <br />
              fikrinin{" "}
              <span className="relative text-pim-mercan">
                sticker&rsquo;ı
                <svg
                  width="240"
                  height="14"
                  viewBox="0 0 240 14"
                  className="absolute left-0 -bottom-1.5 w-full"
                  aria-hidden
                >
                  <path
                    d="M2 8 Q60 2 120 8 T238 6"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.5"
                  />
                </svg>
              </span>
              .
            </h1>
            <p className="mt-6 text-lg text-gri-700 max-w-[480px] leading-relaxed">
              1000 adetten başlayan, AI&rsquo;ın elinden geçen, on günde kapına
              gelen dijital baskı. Pim sana yardım eder.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="primary" size="lg" href="/etiket">
                <Icon.Roll size={18} /> Etiket bastır
              </Button>
              <Button variant="secondary" size="lg" href="/sticker">
                <Icon.Sticker size={18} /> Sticker bastır
              </Button>
            </div>
            <div className="mt-10 flex items-center gap-6 flex-wrap">
              <div className="flex">
                {AVATAR_COLORS.map((c, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full border-2 border-white ${
                      i ? "-ml-2.5" : ""
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div>
                <div className="flex gap-px text-sari">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Icon.Star key={i} size={14} />
                  ))}
                </div>
                <div className="text-[13px] text-gri-700 mt-0.5">
                  2,400+ Türk markasının tercihi
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Pim with floating pills + decorative cards */}
          <div className="relative flex justify-center items-center min-h-[380px]">
            {/* Decorative card behind */}
            <div
              aria-hidden
              className="absolute w-80 h-80 bg-white rounded-[32px] shadow-2 z-0"
              style={{ transform: "rotate(-4deg)" }}
            />
            <div
              aria-hidden
              className="absolute w-[280px] h-[280px] bg-pim-mercan-tint rounded-[28px] -z-10"
              style={{ transform: "rotate(6deg) translate(40px, 40px)" }}
            />
            {/* AI pill (top-left) */}
            <div
              className="absolute top-8 left-5 z-20"
              style={{ transform: "rotate(-12deg)" }}
            >
              <Pill variant="mercan" className="!h-8 !text-[13px] !px-3.5">
                <Icon.Sparkle size={14} /> AI kontrol
              </Pill>
            </div>
            {/* Truck pill (bottom-right) */}
            <div
              className="absolute bottom-16 right-0 z-20"
              style={{ transform: "rotate(8deg)" }}
            >
              <span className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-white shadow-1 text-[13px] font-semibold">
                <Icon.Truck size={14} className="text-pim-mercan" /> 10 gün teslim
              </span>
            </div>
            <div className="relative z-30">
              <Pim pose="wave" size={300} />
            </div>
          </div>
        </div>
      </section>

      {/* ============================== 3 PILLAR ============================== */}
      <section className="pt-8 pb-16">
        <div className="mx-auto max-w-[1280px] px-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {PILLARS.map((p, i) => (
            <Card key={i} padding="p-7">
              <div className="grid place-items-center w-11 h-11 rounded-xl bg-pim-mercan-tint text-pim-mercan mb-4">
                {p.icon}
              </div>
              <h3 className="text-xl font-semibold leading-snug mb-1.5">
                {p.t}
              </h3>
              <p className="text-base text-gri-700 leading-relaxed">{p.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ============================== PRODUCT CARDS ============================== */}
      <section className="py-12">
        <div className="mx-auto max-w-[1280px] px-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProductCard
            kind="etiket"
            title="Etiket"
            sub="Rulodan etiket — kozmetik, gıda, içecek, parfüm."
            from="1000 adetten"
            price="2.13 TL/adet"
            href="/etiket"
          />
          <ProductCard
            kind="sticker"
            title="Sticker"
            sub="Tekli ya da tabakada — laptop, defter, kampanya."
            from="25 adetten"
            price="3.50 TL/adet"
            href="/sticker"
          />
        </div>
      </section>

      {/* ============================== HOW IT WORKS ============================== */}
      <section className="py-20 bg-gri-50">
        <div className="mx-auto max-w-[1280px] px-8">
          <div className="text-center mb-12">
            <Eyebrow>Nasıl çalışır</Eyebrow>
            <h2 className="mt-4 text-[28px] md:text-[40px] font-semibold tracking-tight leading-tight max-w-[640px] mx-auto">
              Konfigüre et, dosyanı yükle, onayla — gerisini bize bırak.
            </h2>
          </div>
          <div className="relative">
            <div
              aria-hidden
              className="hidden md:block absolute left-[12.5%] right-[12.5%] top-9 h-0.5 bg-gri-200 z-0"
            />
            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6 z-10">
              {STEPS.map((s, i) => (
                <div key={i} className="text-center">
                  <div className="grid place-items-center w-[72px] h-[72px] rounded-full bg-white ring-2 ring-gri-200 mx-auto mb-5 font-bold text-[22px] text-pim-mercan shadow-1">
                    {s.n}
                  </div>
                  <h3 className="text-xl font-semibold mb-1.5">{s.t}</h3>
                  <p className="text-base text-gri-700 max-w-[220px] mx-auto leading-relaxed">
                    {s.d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================== TESTIMONIALS ============================== */}
      <section className="py-20">
        <div className="mx-auto max-w-[1280px] px-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t, i) => (
            <article
              key={i}
              className={`rounded-lg shadow-1 ring-1 ring-black/[0.04] p-7 ${t.bg}`}
            >
              <div className="flex gap-px text-sari mb-3.5">
                {[0, 1, 2, 3, 4].map((j) => (
                  <Icon.Star key={j} size={14} />
                ))}
              </div>
              <p className="text-[17px] leading-snug font-medium mb-6">
                &ldquo;{t.q}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-10 h-10 rounded-full bg-lacivert text-white font-bold">
                  {t.n[0]}
                </div>
                <div>
                  <div className="font-semibold">{t.n}</div>
                  <div className="text-[13px] text-gri-700">{t.b}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ============================== FAQ ============================== */}
      <section className="py-12">
        <div className="mx-auto max-w-[1280px] px-8 grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-16 items-start">
          <div>
            <Eyebrow>Sıkça sorulanlar</Eyebrow>
            <h2 className="mt-4 text-[28px] md:text-[40px] font-semibold tracking-tight leading-tight">
              Cevap genelde &ldquo;evet, hallederiz&rdquo;.
            </h2>
            <p className="mt-6 text-base text-gri-700 mb-6 leading-relaxed">
              Hâlâ kafa karışıyor mu? Pim cevap vermek için sayfanın sağ alt
              köşesinde bekliyor.
            </p>
            <Button variant="secondary" href="/sss">
              Tüm SSS <Icon.ChevR size={14} />
            </Button>
          </div>
          <div className="flex flex-col gap-4">
            {FAQS.map((f, i) => (
              <details
                key={i}
                className="bg-white rounded-lg shadow-1 ring-1 ring-black/[0.04] px-6 py-4 cursor-pointer group"
              >
                <summary className="flex justify-between items-center list-none font-semibold text-base">
                  {f.q}
                  <span className="text-pim-mercan text-xl group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="mt-2.5 text-base text-gri-700 leading-relaxed">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== BOTTOM CTA ============================== */}
      <section className="py-20">
        <div className="mx-auto max-w-[1280px] px-8">
          <div className="relative overflow-hidden bg-lacivert text-white rounded-[32px] px-8 md:px-14 py-16">
            <div
              aria-hidden
              className="absolute inset-0 opacity-70"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            />
            <div className="relative grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-8 items-center">
              <div>
                <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
                  Hadi başlayalım.
                </h2>
                <p className="mt-4 text-lg text-white/75 max-w-[520px] leading-relaxed">
                  İlk siparişin için Pim ile bir tur at. 5 dakikada konfigüre,
                  anında fiyat, gerisi bizden.
                </p>
                <div className="mt-7 flex gap-3 flex-wrap">
                  <Button variant="primary" size="lg" href="/etiket">
                    Etiket bastır <Icon.ArrowR />
                  </Button>
                  <Link
                    href="/sticker"
                    className="inline-flex items-center justify-center gap-2 h-[52px] px-7 rounded-full text-white font-semibold text-base hover:bg-white/10 transition-colors"
                  >
                    Sticker&rsquo;a göz at
                  </Link>
                </div>
              </div>
              <div className="flex justify-center">
                <Pim pose="excited" size={240} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ProductCard({
  kind,
  title,
  sub,
  from,
  price,
  href,
}: {
  kind: "etiket" | "sticker";
  title: string;
  sub: string;
  from: string;
  price: string;
  href: string;
}) {
  const isEtiket = kind === "etiket";
  return (
    <Link
      href={href}
      className="text-left bg-white rounded-2xl shadow-1 ring-1 ring-black/[0.04] overflow-hidden flex hover:-translate-y-0.5 transition-transform"
    >
      <div
        className={`flex-shrink-0 w-60 grid place-items-center min-h-[220px] ${
          isEtiket ? "bg-krem" : ""
        }`}
        style={
          !isEtiket
            ? {
                background: "linear-gradient(135deg, #FFE7D6 0%, #FFA89E 100%)",
              }
            : undefined
        }
      >
        {isEtiket ? <RolloPreview /> : <StickerPile />}
      </div>
      <div className="p-7 flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="text-2xl font-semibold m-0">{title}</h3>
          <Pill variant="krem">{from}</Pill>
        </div>
        <p className="text-base text-gri-700 mb-4 mt-1 leading-relaxed">
          {sub}
        </p>
        <div className="flex justify-between items-center">
          <div>
            <div className="text-[11.5px] uppercase tracking-[0.04em] font-semibold text-gri-700">
              {title} fiyatı, başlangıç
            </div>
            <div className="font-bold text-[22px]">{price}</div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-pim-mercan font-semibold">
            Konfigüre et <Icon.ArrowR size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function RolloPreview() {
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden>
      <defs>
        <linearGradient id="rollo" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#E8DCC4" />
          <stop offset="50%" stopColor="white" />
          <stop offset="100%" stopColor="#E8DCC4" />
        </linearGradient>
      </defs>
      <ellipse cx="90" cy="40" rx="62" ry="14" fill="#1F2937" opacity="0.08" />
      <rect x="28" y="40" width="124" height="100" fill="url(#rollo)" />
      <ellipse cx="90" cy="40" rx="62" ry="14" fill="white" />
      <ellipse
        cx="90"
        cy="40"
        rx="62"
        ry="14"
        fill="none"
        stroke="#1F2937"
        strokeWidth="1"
        opacity="0.2"
      />
      <rect
        x="50"
        y="60"
        width="80"
        height="60"
        rx="6"
        fill="white"
        stroke="#1F2937"
        strokeWidth="1"
      />
      <text
        x="90"
        y="86"
        textAnchor="middle"
        fontWeight="700"
        fontSize="14"
        fill="#1F2937"
        fontFamily="Nunito"
      >
        OLEA
      </text>
      <text
        x="90"
        y="102"
        textAnchor="middle"
        fontSize="9"
        fill="#FF6B5B"
        fontFamily="Nunito"
        fontWeight="600"
      >
        DOĞAL SABUN
      </text>
      <line
        x1="60"
        y1="110"
        x2="120"
        y2="110"
        stroke="#1F2937"
        strokeWidth="0.5"
        opacity="0.3"
      />
      <ellipse cx="90" cy="140" rx="62" ry="14" fill="#1F2937" opacity="0.05" />
    </svg>
  );
}

function StickerPile() {
  return (
    <svg width="200" height="180" viewBox="0 0 200 180" aria-hidden>
      <g transform="translate(40 30) rotate(-12)">
        <rect
          width="100"
          height="100"
          rx="20"
          fill="white"
          stroke="#1F2937"
          strokeWidth="1.5"
        />
        <text
          x="50"
          y="58"
          textAnchor="middle"
          fontWeight="800"
          fontSize="28"
          fill="#FF6B5B"
          fontFamily="Nunito"
        >
          PİM
        </text>
      </g>
      <g transform="translate(70 50) rotate(8)">
        <circle cx="50" cy="50" r="50" fill="#1F2937" />
        <text
          x="50"
          y="58"
          textAnchor="middle"
          fontWeight="800"
          fontSize="22"
          fill="white"
          fontFamily="Nunito"
        >
          YENİ!
        </text>
      </g>
      <g transform="translate(30 80) rotate(15)">
        <path
          d="M50 0 L60 38 L100 38 L68 60 L80 100 L50 75 L20 100 L32 60 L0 38 L40 38 Z"
          fill="#FF9933"
        />
      </g>
    </svg>
  );
}
