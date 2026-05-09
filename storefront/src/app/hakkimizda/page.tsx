/**
 * Pim Etiket — /hakkimizda (E.1.4)
 *
 * Pim hikayesi, Bursa atölyesi, kurucu, değerler.
 * NOT: İçerik şu an placeholder — Sefa nihai metni yazacak.
 * Yapı/component'ler hazır.
 *
 * Client component (i18n hook için). Metadata layout.tsx'te.
 */

"use client";

import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow } from "@/components/ui";
import { useT } from "@/lib/i18n/context";

const COPY = {
  tr: {
    eyebrow: "Hakkımızda",
    h1Line1: "Bursa'dan,",
    h1Line2: "herkes için.",
    intro:
      "Pim Etiket'i kurarken aklımızda tek bir soru vardı: hayalindeki kalitede etiket bastırmak için neden binlerce adet stoklamak zorunda olsun? Bu site, o sorunun cevabı — küçük marka için de kurumsal alıcı için de aynı kapı.",
    storyEyebrow: "Pim Etiket nereden geliyor?",
    storyTitle: "Geleneksel ticaretin yapay zeka çağına ayak uyduruşu.",
    story1: "75 yıldır ticaretle uğraşan bir ailenin ferdiyiz. Yolumuz kırtasiyecilikten başladı — defterler, kâğıtlar, mürekkepler. Sonra matbaacılığa uzandı; baskı makinelerinin sesi, kâğıdın kokusu kuşaklar boyu evimizin parçası oldu. Daha sonra ambalaj sektörüne geçtik — markaların raflara çıkış hikâyelerine yakından şahit olduk.",
    story2:
      "Pim Etiket bu uzun hikâyenin son halkası. Ama bu kez bir farkla: teknolojinin yardımıyla.",
    storyWhy: "Neden böyle bir sistem?",
    story3:
      "Sektörün içinden gözlemledik: ister küçük marka olsun ister büyük alıcı, baskı süreci bir maraton olabiliyordu. Düşük adetlerde fiyatlar uçuyor, büyük adetlerde formaliteler uzuyor; ortada herkesin işini hızla halleden bir yer eksikti.",
    story4pre: "Mühendislik eğitiminin getirdiği bakış açısı şunu söyledi: otomasyon ve yapay zeka gelecek değil, bugün. Doğru kullanıldığında bu teknolojiler oyun alanını eşitliyor — küçük marka da kurumsal alıcı da aynı hızda iş çıkarabiliyor. Biz de o değişime \"mecburen\" değil, ",
    story4bold: "öngörerek",
    story4post: " katıldık.",
    storyPromise: "Sana ne vaat ediyoruz?",
    story5:
      "Seni anlayan bir sistem. Kıymetli vaktini boşa harcamayan, etiketini hızla ve doğru şekilde bastıran, sade bir vitrin. Sürpriz fiyat yok, gizli madde yok, \"5 iş günü\" diyince 10. günü beklemek yok.",
    story6: "Bu yolculukta bizimle birlikte yürüdüğün için teşekkür ederiz. 75 yıllık ticaret deneyimi + yapay zeka çağı — Pim Etiket bu ikisinin birleşim noktası.",
    pimWhoEyebrow: "Pim kim?",
    pimWhoTitle: "Selam, ben Pim. Bu işin baykuşuyum.",
    pimWho1:
      "İşler karışırsa beni ara — fiyat çıkarırım, sipariş takip ederim, gerekirse fason atölyeyi kovalarım, gerekirse kargoyu. Bir gözüm konfigüratörde, bir gözüm üretim hattında. Üçüncü göz lazımsa ondan da var — baykuşum, saymıyoruz.",
    pimWho2: "Tek başıma değilim aslında. Ekibim var, bütün soruları paylaşıyoruz:",
    pimRole1Name: "Karşılayıcı Pim",
    pimRole1Desc: "ilk soruyu yanıtlar, doğru kişiye yönlendirir",
    pimRole2Name: "Tasarımcı Pim",
    pimRole2Desc: "boyut, renk, fiyat hesabı",
    pimRole3Name: "Kargocu Pim",
    pimRole3Desc: "sipariş ve kargo takibi",
    pimWho3:
      "Hangisi lazımsa o gelir. Sen sadece sor, gerisini biz halletmeye çalışırız.",
    valuesEyebrow: "Değerlerimiz",
    valuesTitle: "Pim'in altında saklanan dört söz.",
    val1Title: "Düşük adetten esnek",
    val1Desc:
      "Stoklamadan, az miktarda da kaliteden ödün vermeden bastırırsın. 1000 etiketten başlıyoruz.",
    val2Title: "AI dosyana bakar",
    val2Desc:
      "DPI, CMYK, kenar boşluğu — eksik varsa üretime gitmeden söyler. Pre-press hatası elinde patlamaz.",
    val3Title: "Bursa'dan kapına",
    val3Desc:
      "10 günde elinde. Şeffaf üretim takibi, gerçek zamanlı statü, Pim'in haberleri.",
    val4Title: "Açık ve dürüst fiyat",
    val4Desc:
      "Konfigüratörde gördüğün anlık fiyat sepete düştüğünde aynı kalır. Sürpriz ek yok.",
    founderEyebrow: "Kurucu",
    founderTitle: "Merhaba, ben Sefa.",
    founderNote:
      "[Sefa not: kısa bir biyografi + neden bu işi kurduğun + LinkedIn linki]",
    founderText:
      " — Pim Etiket'i kurarken hedefim, sektörün online'a geçişinde herkesin — küçük marka veya kurumsal — adil bir başlangıca sahip olması idi. Sen de bizimle çalışmak istersen WhatsApp'tan veya ",
    founderLink: "iletişim",
    founderEnd: " sayfasından bana ulaşabilirsin.",
    ctaTitle: "Bizimle çalışmaya hazır mısın?",
    ctaDesc:
      "Konfigüre et, fiyatını gör, sepete ekle. Pim sayfanın sağ alt köşesinde — takıldığın yerde sor.",
    ctaEtiket: "Etiket bastır",
    ctaSticker: "Sticker bastır",
  },
  en: {
    eyebrow: "About us",
    h1Line1: "From Bursa,",
    h1Line2: "for everyone.",
    intro:
      "When we founded Pim Etiket we had only one question in mind: why should anyone — small brand or large — stock thousands of units just to print quality labels? This site is our answer. Same door for solo founders and corporate buyers.",
    storyEyebrow: "Where Pim Etiket comes from",
    storyTitle: "Traditional trade adapting to the AI era.",
    story1:
      "We come from a family with 75 years of trading experience. Our path started in stationery — notebooks, papers, inks. Then it moved into printing; the sound of press machines and the smell of paper became part of our home for generations. Then we entered the packaging industry — we witnessed brands' shelf-arrival stories firsthand.",
    story2:
      "Pim Etiket is the latest chapter in that long story. But this time with a difference: with technology's help.",
    storyWhy: "Why a system like this?",
    story3:
      "We saw it from inside the industry: whether you're a small brand or a corporate buyer, printing could turn into a marathon. Prices skyrocket at low volumes, paperwork drags at high volumes — the middle ground, where everyone could simply print, was missing.",
    story4pre:
      "An engineering perspective taught us one thing: automation and AI aren't the future, they're today. Used right, these technologies level the field — small brand or large, everyone gets the same speed. So we joined that shift not \"out of necessity\" but ",
    story4bold: "by foresight",
    story4post: ".",
    storyPromise: "What we promise you",
    story5:
      "A system that understands you. A clean storefront that doesn't waste your valuable time and prints your labels fast and right. No surprise fees, no hidden clauses, no \"5 business days\" turning into ten.",
    story6:
      "Thank you for walking with us on this journey. 75 years of trading experience + the AI era — Pim Etiket is where these two meet.",
    pimWhoEyebrow: "Who's Pim?",
    pimWhoTitle: "Hi, I'm Pim. The owl behind this whole thing.",
    pimWho1:
      "When things get tangled, just call me — I quote prices, track orders, chase the contract workshop when needed, or chase the courier. One eye on the configurator, one eye on the production line. Need a third? I'm an owl, I don't count.",
    pimWho2: "I'm not alone, by the way. I've got a team — we share the workload:",
    pimRole1Name: "Welcome Pim",
    pimRole1Desc: "answers the first question, points to the right person",
    pimRole2Name: "Designer Pim",
    pimRole2Desc: "sizing, colors, pricing",
    pimRole3Name: "Shipper Pim",
    pimRole3Desc: "order and shipment tracking",
    pimWho3:
      "Whichever one you need shows up. Just ask, we'll handle the rest.",
    valuesEyebrow: "Values",
    valuesTitle: "The four promises behind Pim.",
    val1Title: "Flexible from low quantity",
    val1Desc:
      "Print without stocking, no quality compromise even at low volumes. We start from 1000 labels.",
    val2Title: "AI checks your file",
    val2Desc:
      "DPI, CMYK, bleed — anything missing, we flag it before production. Pre-press errors don't blow up in your hand.",
    val3Title: "From Bursa to your door",
    val3Desc:
      "In your hands within 10 days. Transparent production tracking, real-time status, Pim's updates.",
    val4Title: "Clear and honest pricing",
    val4Desc:
      "The instant price you see in the configurator stays the same in the cart. No hidden fees.",
    founderEyebrow: "Founder",
    founderTitle: "Hi, I'm Sefa.",
    founderNote: "[Sefa note: short bio + why you started + LinkedIn]",
    founderText:
      " — When I founded Pim Etiket, my goal was simple: make sure everyone — small brand or corporate buyer — gets a fair start as the industry moves online. If you want to work with us, reach me via WhatsApp or the ",
    founderLink: "contact",
    founderEnd: " page.",
    ctaTitle: "Ready to work with us?",
    ctaDesc:
      "Configure, see the price, add to cart. Pim is in the bottom-right — ask if you get stuck.",
    ctaEtiket: "Print labels",
    ctaSticker: "Print stickers",
  },
};

export default function HakkimizdaPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;

  const VALUES = [
    { icon: <Icon.Bolt size={22} />, t: c.val1Title, d: c.val1Desc },
    { icon: <Icon.Sparkle size={22} />, t: c.val2Title, d: c.val2Desc },
    { icon: <Icon.Truck size={22} />, t: c.val3Title, d: c.val3Desc },
    { icon: <Icon.Wallet size={22} />, t: c.val4Title, d: c.val4Desc },
  ];

  return (
    <main className="animate-fade-up">
      {/* HERO */}
      <section className="relative overflow-hidden pt-10 md:pt-16 pb-14 md:pb-20">
        <div
          aria-hidden
          className="absolute inset-0 -z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(800px 420px at 78% 25%, var(--color-krem) 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[1280px] px-4 md:px-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 md:gap-10 items-center">
          <div>
            <Eyebrow>{c.eyebrow}</Eyebrow>
            <h1 className="mt-5 text-[34px] md:text-[56px] leading-[1.04] font-semibold tracking-[-0.02em]">
              {c.h1Line1}
              <br />
              {c.h1Line2}
            </h1>
            <p className="mt-6 text-[15px] md:text-lg text-gri-700 max-w-[540px] leading-relaxed">
              {c.intro}
            </p>
          </div>
          <div className="hidden md:block shrink-0">
            <Pim pose="happy" size={220} />
          </div>
        </div>
      </section>

      {/* HİKAYE */}
      <section className="py-10 md:py-12">
        <div className="mx-auto max-w-[800px] px-4 md:px-8">
          <Eyebrow>{c.storyEyebrow}</Eyebrow>
          <h2 className="mt-3 text-[24px] md:text-[32px] font-semibold tracking-tight leading-tight">
            {c.storyTitle}
          </h2>
          <div className="mt-5 space-y-5 text-[15px] md:text-base text-gri-700 leading-[1.7]">
            <p>{c.story1}</p>
            <p>
              <strong className="text-lacivert">{c.story2}</strong>
            </p>
          </div>

          <h3 className="mt-10 text-[20px] md:text-[24px] font-semibold tracking-tight leading-tight">
            {c.storyWhy}
          </h3>
          <div className="mt-4 space-y-5 text-[15px] md:text-base text-gri-700 leading-[1.7]">
            <p>{c.story3}</p>
            <p>
              {c.story4pre}
              <strong className="text-lacivert">{c.story4bold}</strong>
              {c.story4post}
            </p>
          </div>

          <h3 className="mt-10 text-[20px] md:text-[24px] font-semibold tracking-tight leading-tight">
            {c.storyPromise}
          </h3>
          <div className="mt-4 space-y-5 text-[15px] md:text-base text-gri-700 leading-[1.7]">
            <p>{c.story5}</p>
            <p className="text-lacivert font-medium">{c.story6}</p>
          </div>
        </div>
      </section>

      {/* PIM KİM? */}
      <section className="py-10 md:py-14 bg-pim-mercan-tint/30">
        <div className="mx-auto max-w-[800px] px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 md:gap-8 items-start">
            <div className="shrink-0 mx-auto md:mx-0">
              <Pim pose="wave" size={140} />
            </div>
            <div>
              <Eyebrow>{c.pimWhoEyebrow}</Eyebrow>
              <h2 className="mt-3 text-[22px] md:text-[28px] font-semibold tracking-tight leading-tight">
                {c.pimWhoTitle}
              </h2>
              <p className="mt-4 text-[15px] md:text-base text-gri-700 leading-[1.7]">
                {c.pimWho1}
              </p>
              <p className="mt-4 text-[15px] md:text-base text-gri-700 leading-[1.7]">
                {c.pimWho2}
              </p>
              <ul className="mt-4 space-y-2 text-[15px] md:text-base text-gri-700">
                {[
                  { name: c.pimRole1Name, desc: c.pimRole1Desc },
                  { name: c.pimRole2Name, desc: c.pimRole2Desc },
                  { name: c.pimRole3Name, desc: c.pimRole3Desc },
                ].map((r) => (
                  <li key={r.name} className="flex items-start gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-pim-mercan mt-2.5 shrink-0" />
                    <span>
                      <strong className="text-lacivert">{r.name}</strong>
                      <span className="text-gri-700"> — {r.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[15px] md:text-base text-gri-700 leading-[1.7] italic">
                {c.pimWho3}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* DEĞERLER */}
      <section className="py-10 md:py-12 bg-gri-50">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="text-center mb-10 md:mb-12">
            <Eyebrow>{c.valuesEyebrow}</Eyebrow>
            <h2 className="mt-4 text-[24px] md:text-[40px] font-semibold tracking-tight leading-tight max-w-[640px] mx-auto">
              {c.valuesTitle}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[900px] mx-auto">
            {VALUES.map((v, i) => (
              <Card key={i} padding="p-6 md:p-7">
                <div className="grid place-items-center w-11 h-11 rounded-xl bg-pim-mercan-tint text-pim-mercan mb-4">
                  {v.icon}
                </div>
                <h3 className="text-lg md:text-xl font-semibold leading-snug mb-1.5">
                  {v.t}
                </h3>
                <p className="text-[15px] md:text-base text-gri-700 leading-relaxed">
                  {v.d}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* KURUCU */}
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-[800px] px-4 md:px-8">
          <div className="bg-krem rounded-2xl p-6 md:p-12 ring-1 ring-black/[0.04]">
            <Eyebrow>{c.founderEyebrow}</Eyebrow>
            <h2 className="mt-4 text-[24px] md:text-[36px] font-semibold tracking-tight leading-tight">
              {c.founderTitle}
            </h2>
            <p className="mt-5 text-[15px] md:text-base text-gri-700 leading-[1.7]">
              <strong className="text-lacivert">{c.founderNote}</strong>
              {c.founderText}
              <a
                href="/iletisim"
                className="text-pim-mercan font-semibold hover:underline"
              >
                {c.founderLink}
              </a>
              {c.founderEnd}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="relative overflow-hidden bg-lacivert text-white rounded-[32px] px-6 md:px-14 py-10 md:py-14">
            <div
              aria-hidden
              className="absolute inset-0 opacity-70"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            />
            <div className="relative grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6 md:gap-8 items-center">
              <div>
                <h2 className="text-2xl md:text-4xl font-semibold tracking-tight leading-tight">
                  {c.ctaTitle}
                </h2>
                <p className="mt-3 text-[15px] md:text-base text-white/75 max-w-[480px] leading-relaxed">
                  {c.ctaDesc}
                </p>
                <div className="mt-6 flex gap-3 flex-wrap">
                  <Button variant="primary" size="lg" href="/etiket">
                    <Icon.Roll size={18} /> {c.ctaEtiket}
                  </Button>
                  <Button variant="primary" size="lg" href="/sticker">
                    <Icon.Sticker size={18} /> {c.ctaSticker}
                  </Button>
                </div>
              </div>
              <div className="hidden md:flex justify-center">
                <Pim pose="excited" size={180} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
