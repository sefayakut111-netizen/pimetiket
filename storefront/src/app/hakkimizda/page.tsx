/**
 * Pim Etiket — /hakkimizda (E.1.4)
 *
 * Pim hikayesi, Bursa atölyesi, kurucu, değerler.
 * NOT: İçerik şu an placeholder — Sefa nihai metni yazacak.
 * Yapı/component'ler hazır.
 */

import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow } from "@/components/ui";

const VALUES = [
  {
    icon: <Icon.Bolt size={22} />,
    t: "Düşük adetten esnek",
    d: "Stoklamadan, az miktarda da kaliteden ödün vermeden bastırırsın. 1000 etiketten başlıyoruz.",
  },
  {
    icon: <Icon.Sparkle size={22} />,
    t: "AI'lı akıllı süreç",
    d: "Pim, dosyanı saniyeler içinde inceler — eksiği varsa söyler. Operatörün gözüyle uzaklaşırsın.",
  },
  {
    icon: <Icon.Truck size={22} />,
    t: "Bursa'dan kapına",
    d: "10 günde elinde. Şeffaf üretim takibi, gerçek zamanlı statü, Pim'in haberleri.",
  },
  {
    icon: <Icon.Wallet size={22} />,
    t: "Açık ve dürüst fiyat",
    d: "Konfigüratörde gördüğün anlık fiyat sepete düştüğünde aynı kalır. Sürpriz ek yok.",
  },
];

export default function HakkimizdaPage() {
  return (
    <main className="animate-fade-up">
      {/* HERO */}
      <section className="relative overflow-hidden pt-16 pb-20">
        <div
          aria-hidden
          className="absolute inset-0 -z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(800px 420px at 78% 25%, var(--color-krem) 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[1280px] px-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-10 items-center">
          <div>
            <Eyebrow>Hakkımızda</Eyebrow>
            <h1 className="mt-5 text-[40px] md:text-[56px] leading-[1.04] font-semibold tracking-[-0.02em]">
              Bursa&rsquo;dan,
              <br />
              küçük markalar için.
            </h1>
            <p className="mt-6 text-lg text-gri-700 max-w-[540px] leading-relaxed">
              Pim Etiket&rsquo;i kurarken aklımızda tek bir soru vardı: küçük
              markalar, hayalindeki kalitede etiket bastırmak için neden binlerce
              adet stoklamak zorunda olsun? Cevabımız bu site.
            </p>
          </div>
          <div className="hidden md:block shrink-0">
            <Pim pose="happy" size={220} />
          </div>
        </div>
      </section>

      {/* HİKAYE */}
      <section className="py-12">
        <div className="mx-auto max-w-[800px] px-8">
          <Eyebrow>Hikayemiz</Eyebrow>
          <div className="mt-4 space-y-5 text-base text-gri-700 leading-[1.7]">
            <p>
              <strong className="text-lacivert">[Sefa not: bu metni
              kendi hikayene göre düzenle]</strong>
              {" "}— Pim Etiket, Bursa&rsquo;da bir atölyede doğdu. Sektörde
              yıllarını vermiş baskı ustalarıyla, küçük markaların etiket
              ihtiyaçlarına basit bir cevap aradık. Online konfigürasyon, AI
              destekli kalite kontrolü ve fason üretim ortaklarıyla esnek bir
              vitrin kurduk.
            </p>
            <p>
              İlk müşterilerimiz Bursa&rsquo;daki butik üreticiler oldu — sabun
              atölyeleri, kavurucular, butik gıda. Onlar bize öğretti: &ldquo;hızlı
              ve doğru&rdquo; yetmez, &ldquo;esnek ve dürüst&rdquo; lazım. Şimdi
              tüm Türkiye&rsquo;ye aynı vaatle hizmet ediyoruz.
            </p>
            <p>
              Üretimimizi, sektörde yıllarını vermiş{" "}
              <strong className="text-lacivert">fason baskı ortaklarımızla</strong>{" "}
              yapıyoruz. Onlar makineyi tanır, biz dijital süreci yönetiriz —
              müşteri kazanır.
            </p>
          </div>
        </div>
      </section>

      {/* DEĞERLER */}
      <section className="py-12 bg-gri-50">
        <div className="mx-auto max-w-[1280px] px-8">
          <div className="text-center mb-12">
            <Eyebrow>Değerlerimiz</Eyebrow>
            <h2 className="mt-4 text-[28px] md:text-[40px] font-semibold tracking-tight leading-tight max-w-[640px] mx-auto">
              Pim&rsquo;in altında saklanan dört söz.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[900px] mx-auto">
            {VALUES.map((v, i) => (
              <Card key={i} padding="p-7">
                <div className="grid place-items-center w-11 h-11 rounded-xl bg-pim-mercan-tint text-pim-mercan mb-4">
                  {v.icon}
                </div>
                <h3 className="text-xl font-semibold leading-snug mb-1.5">
                  {v.t}
                </h3>
                <p className="text-base text-gri-700 leading-relaxed">{v.d}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* KURUCU */}
      <section className="py-16">
        <div className="mx-auto max-w-[800px] px-8">
          <div className="bg-krem rounded-2xl p-8 md:p-12 ring-1 ring-black/[0.04]">
            <Eyebrow>Kurucu</Eyebrow>
            <h2 className="mt-4 text-[28px] md:text-[36px] font-semibold tracking-tight leading-tight">
              Merhaba, ben Sefa.
            </h2>
            <p className="mt-5 text-base text-gri-700 leading-[1.7]">
              <strong className="text-lacivert">[Sefa not: kısa bir biyografi
              + neden bu işi kurduğun + LinkedIn linki]</strong>
              {" "}— Pim Etiket&rsquo;i kurarken hedefim, sektörün online&rsquo;a
              geçişinde küçük markaları kimsenin geride bırakmaması idi. Sen de
              bizimle çalışmak istersen WhatsApp&rsquo;tan veya{" "}
              <a
                href="/iletisim"
                className="text-pim-mercan font-semibold hover:underline"
              >
                iletişim
              </a>{" "}
              sayfasından bana ulaşabilirsin.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-[1280px] px-8">
          <div className="relative overflow-hidden bg-lacivert text-white rounded-[32px] px-8 md:px-14 py-14">
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
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
                  Bizimle çalışmaya hazır mısın?
                </h2>
                <p className="mt-3 text-base text-white/75 max-w-[480px] leading-relaxed">
                  İlk siparişin için Pim ile bir tur at. 5 dakikada konfigüre,
                  anında fiyat, gerisi bizden.
                </p>
                <div className="mt-6 flex gap-3 flex-wrap">
                  <Button variant="primary" size="lg" href="/etiket">
                    <Icon.Roll size={18} /> Etiket bastır
                  </Button>
                  <Button variant="primary" size="lg" href="/sticker">
                    <Icon.Sticker size={18} /> Sticker bastır
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
