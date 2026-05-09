/**
 * Pim Etiket — /iade-degisim-politikasi
 *
 * Mesafeli Satış Sözleşmesi'nden ayrı: pratik iade-değişim açıklaması.
 * Müşterinin "ne yapabilirim, ne yapamam" anlamında okuyabileceği
 * sade dil. Hukuki dayanak referansları var.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "İade ve değişim politikası",
  description:
    "Pim Etiket iade-değişim koşulları: kişiselleştirilmiş ürün, üretim hatası, kargo hasarı durumları.",
  alternates: { canonical: "/iade-degisim-politikasi" },
};

export default function IadeDegisimPolitikasiPage() {
  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <article className="mx-auto max-w-[760px] px-6">
        <div className="text-center mb-8">
          <Pim pose="inspect" size={120} />
          <Eyebrow>Yasal</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight leading-tight">
            İade ve değişim politikası
          </h1>
          <p className="mt-2 text-[14px] text-gri-500">
            Son güncelleme: 9 Mayıs 2026
          </p>
        </div>

        {/* Quick summary */}
        <Card padding="p-6" className="mb-6 !bg-pim-mercan-tint">
          <h2 className="font-semibold text-base mb-3 text-pim-mercan-koyu">
            🎯 Kısa özet
          </h2>
          <ul className="space-y-2 text-[14px] text-lacivert leading-relaxed">
            <li>
              <strong>Kişiselleştirilmiş ürünlerde</strong> 14 gün cayma hakkı
              YOKTUR (TKHK m.15/b).
            </li>
            <li>
              <strong>Üretim hatası</strong> bizim sorumluluğumuz — ücretsiz
              yenileme veya iade.
            </li>
            <li>
              <strong>Kargo hasarı</strong> kargo şirketinin sorumluluğu, biz
              de takip ederiz.
            </li>
            <li>
              <strong>Yanlış ürün</strong> geldiyse (boyut/malzeme bizim
              hatamızla) ücretsiz değişim.
            </li>
          </ul>
        </Card>

        <div className="bg-white rounded-2xl shadow-1 ring-1 ring-black/[0.04] p-7 space-y-7 text-[15px] text-gri-700 leading-relaxed">
          <Section title="1. Cayma hakkı neden yok?">
            <p>
              Tüketicinin Korunması Hakkında Kanun (TKHK) m.15/b uyarınca,
              tüketicinin istekleri veya açıkça onun kişisel ihtiyaçları
              doğrultusunda hazırlanan ürünlerde 14 gün cayma hakkı
              kullanılamaz.
            </p>
            <p>
              Pim Etiket&rsquo;te bastığın her sipariş senin marka adınla,
              senin tasarımınla, senin ölçü ve adetinle üretilir. Bu yüzden
              başka müşteriye satılamaz. Bu sebeple cayma hakkı yasal olarak
              saklı değildir.
            </p>
          </Section>

          <Section title="2. Üretim hatası durumunda ne olur?">
            <p>Aşağıdaki durumlar üretim hatası kapsamına girer:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 my-3">
              <li>Renk profilinde ciddi sapma (CMYK kalibrasyonu)</li>
              <li>Baskıda lekelenme, çizik, mürekkep hatası</li>
              <li>Boyutlandırmada yanlış ölçü</li>
              <li>Kesim/kontur problemi</li>
              <li>Kaplama (selefon, soft touch) uygulanmamış veya bozuk</li>
              <li>Onayladığın provadan farklı çıkmış olması</li>
            </ul>
            <p>
              Bu durumlarda <strong className="text-lacivert">ücretsiz yenileme</strong>{" "}
              veya tam para iadesi sunarız. Talep, ürün eline geçtikten 7 gün
              içinde yapılmalıdır. Kanıt olarak fotoğraf ve sipariş numarası
              yeterlidir.
            </p>
          </Section>

          <Section title="3. Kargo hasarı durumunda ne olur?">
            <p>
              Kargo aldığın ürünü teslim alırken kutuda gözle görülür hasar
              varsa <strong className="text-lacivert">teslim almadan kargo görevlisine tutanak tutturmanı</strong>{" "}
              öneririz. Tutanaksız hasarda kargo şirketi sigortası devreye
              girmez ama biz de takip ederiz.
            </p>
            <p>
              Hasarsız teslim almıştın ama açtığında ürün hasarlıysa,{" "}
              <Link
                href="/iade-talep"
                className="text-pim-mercan font-semibold hover:underline"
              >
                İade talebi
              </Link>{" "}
              sayfasından foto ile bildir. Pim hızlı çözer.
            </p>
          </Section>

          <Section title="4. Yanlış ürün geldiyse">
            <p>
              Bizim hatamızla farklı boyut, farklı malzeme veya farklı sayıda
              ürün geldiyse: <strong className="text-lacivert">ücretsiz iade + ücretsiz yeniden baskı</strong>.
              Eski ürün için iade kargo etiketi göndeririz, yeni baskıyı
              hızlandırılmış teslimle yollarız.
            </p>
          </Section>

          <Section title="5. Tasarım dosya hatası senin elindeyse">
            <p>
              Yüklediğin dosyada yazım hatası, eksik bilgi, düşük çözünürlük
              veya yanlış renk profili varsa{" "}
              <strong>ürettiğimiz ürünlerden Pim Etiket sorumlu değildir</strong>.
              Pim AI ön kontrolü bu hataların çoğunu sipariş öncesi yakalar
              (DPI, CMYK, yazım), ama son söz senindir.
            </p>
            <p>
              Eğer sipariş öncesi Pim flag&rsquo;lemiş bir hatayı görmezden
              geldin ve baskıya gönderdin, sonradan bu hata sebebiyle iade
              talep edemezsin.
            </p>
          </Section>

          <Section title="6. İade süreci nasıl işler?">
            <ol className="list-decimal list-inside space-y-1.5 ml-2 my-3">
              <li>
                <Link
                  href="/iade-talep"
                  className="text-pim-mercan font-semibold hover:underline"
                >
                  /iade-talep
                </Link>{" "}
                sayfasından sipariş seç + sebep + açıklama + foto.
              </li>
              <li>Pim ekibi 1-2 iş günü içinde inceler ve sana döner.</li>
              <li>
                Onaylanırsa: kargo etiketi gönderirz, ürünü geri yollarsın
                (kargonu biz öderiz).
              </li>
              <li>
                Ürün eline ulaşır, kontrolden geçer, para iadesi başlatılır.
              </li>
              <li>
                İade <strong>cüzdana</strong> 1 günde,{" "}
                <strong>karta</strong> 7-14 iş günü (banka süresi).
              </li>
            </ol>
          </Section>

          <Section title="7. İade tutarı nasıl hesaplanır?">
            <p>
              Üretim hatası / yanlış ürün / kargo hasarı durumlarında
              <strong className="text-lacivert"> ödediğin tüm tutar</strong>{" "}
              (KDV dahil + kargo) iade edilir. Cüzdana iade alırsan +%2 bonus
              uygulanır.
            </p>
          </Section>

          <Section title="8. Sorularını kim cevaplar?">
            <p>
              Soru olursa Pim&rsquo;e WhatsApp ya da iletişim formundan yaz.
              Sefa veya operatör ekibi 1-2 iş günü içinde döner. Acil
              durumlarda (yarın etkinlik var, baskı eksik) WhatsApp en hızlı
              kanal.
            </p>
          </Section>
        </div>

        {/* CTA */}
        <Card padding="p-6" className="mt-7">
          <div className="flex gap-4 items-center">
            <Pim pose="happy" size={64} />
            <div className="flex-1">
              <h3 className="font-semibold text-base mb-1">
                İade talebim var
              </h3>
              <p className="text-[13.5px] text-gri-700 leading-relaxed">
                Sipariş seç, sebep yaz, foto ekle. Pim hızlı bakar.
              </p>
            </div>
            <Button variant="primary" size="lg" href="/iade-talep">
              Talep oluştur <Icon.ArrowR size={14} />
            </Button>
          </div>
        </Card>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-semibold text-[18px] text-lacivert mb-3">{title}</h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}
