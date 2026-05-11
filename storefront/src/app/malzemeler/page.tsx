/**
 * /malzemeler — Etiket ve sticker malzemelerinin detaylı tanıtımı.
 *
 * Sefa kuralı (Madde 11, 11 May): Konfigüratörlerden "Malzeme detayı"
 * linki bu sayfaya açar, müşteri detaylı bilgi alıp geri döner.
 *
 * İçerik: 4 etiket + 4 sticker malzemesi · kaplamalar · özelleştirmeler
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Malzemeler — Pim Etiket",
  description:
    "Etiket ve sticker malzemelerinin detayları: kraft, beyaz semi-glos, ultra clear, metalik, vinil, transparan, holografik, simli. Kaplama seçenekleri ve özelleştirmeler.",
  alternates: { canonical: "/malzemeler" },
};

interface MaterialInfo {
  id: string;
  name: string;
  description: string;
  use: string;
  surface: string;
  durability: string;
}

const ETIKET_MATERIALS: MaterialInfo[] = [
  {
    id: "kraft",
    name: "Kraft",
    description:
      "Geri dönüştürülmüş, doğal kahverengi kağıt. Doğallık vurgusu yapan markalar için.",
    use: "Doğal kozmetik, organik gıda, el yapımı sabun, kuru çay/baharat",
    surface: "Mat, hafif dokulu yüzey. Yazı baskısı net, fotoğraf baskısı daha soft görünür.",
    durability: "Suya orta dayanım. Buzdolabı/kavanoz ürünleri için kaplama tavsiye edilir.",
  },
  {
    id: "beyaz_semi_glos",
    name: "Beyaz Semi-Glos",
    description:
      "Yarı parlak beyaz kağıt etiket. Klasik üretim standardı, renkleri canlı gösterir.",
    use: "Genel amaçlı — gıda, kozmetik, ev temizlik ürünleri",
    surface: "Yarı parlak, pürüzsüz. CMYK baskı tam doygunlukta basılır.",
    durability: "Yüksek kaplama ile su geçirmez hale getirilebilir.",
  },
  {
    id: "ultra_clear",
    name: "Ultra Clear (Şeffaf)",
    description:
      "Tamamen transparan film. Cam şişe ve şeffaf kavanozlarda ürünün görüntüsünü bozmadan etiket basar.",
    use: "Cam şişeli içecekler, parfüm, şeffaf kavanozlu sos/reçel",
    surface: "Parlak şeffaf. Sadece basılan kısımları görünür, gerisi şeffaf kalır.",
    durability: "Suya dayanıklı. Soğuk zincir + buzdolabı uygundur.",
  },
  {
    id: "metalik",
    name: "Metalik",
    description:
      "Altın veya gümüş metalik yüzeyli kağıt. Premium ürün hissi yaratır.",
    use: "Lüks parfüm, premium çikolata, şarap, viski etiketleri",
    surface: "Pürüzsüz metalik parlak. Renkler metalik zemin üzerinde yumuşak görünür.",
    durability: "Yüksek. Premium ürünlerde standart kaplama yeter.",
  },
];

const STICKER_MATERIALS: MaterialInfo[] = [
  {
    id: "vinil",
    name: "Vinil",
    description:
      "Kalın, esnek vinil film. Sticker'ın klasiği — UV ve suya dayanıklı.",
    use: "Laptop, su şişesi, araba, dış mekan, ürün ambalajı",
    surface: "Standart parlak ya da mat. Renkler canlı, kontrast yüksek.",
    durability: "3-5 yıl dış mekan dayanımı. Çamaşır makinesi tehlikesi DEĞİL.",
  },
  {
    id: "transparan",
    name: "Transparan Vinil",
    description:
      "Şeffaf zeminli vinil. Sticker, ürün ya da yüzey üzerine yapıştığında 'havada duruyor' etkisi yaratır.",
    use: "Cam kavanoz, şampuan/krem şişeleri, vitrin etiketleri",
    surface: "Şeffaf, sadece basılan kısımlar görünür.",
    durability: "Vinil ile aynı — dış mekan + su uygundur.",
  },
  {
    id: "holografik",
    name: "Holografik",
    description:
      "Yansıyan, ışıkta renk değiştiren özel film. Etkinlik ve marka coşkusu için.",
    use: "Etkinlik sticker, sınırlı koleksiyon, dergi ekleri, çocuk ürünleri",
    surface: "Parlak, ışıkta renkler kayar (gökkuşağı/baklava efekti).",
    durability: "İç mekan optimum. Dış mekanda yansıma 6-12 ayda solar.",
  },
  {
    id: "simli",
    name: "Simli (Glitter)",
    description:
      "Simli, ışıltılı yüzey. Ürünü düz baskıdan ayırmak isteyen markalar için.",
    use: "Çocuk ürünleri, parti malzemeleri, kozmetik, kırtasiye",
    surface: "Simli parlak. Renkler sim arasından parlar.",
    durability: "İç mekan. Yıkamada sim dökülmez, ama çamaşır makinesi önerilmez.",
  },
];

const COATINGS = [
  {
    name: "Mat Selefon",
    desc: "Yansıma yok, dokunulduğunda yumuşak. Doğal/premium hissi.",
  },
  {
    name: "Parlak Selefon",
    desc: "Yüksek parlaklık, renkleri canlandırır. Klasik perakende.",
  },
  {
    name: "Soft Touch",
    desc: "Kadife dokuda mat. Premium kozmetik ve şişelerde tercih edilir.",
  },
  {
    name: "Kaplamasız",
    desc: "Hiç kaplama yok. Doğal kağıt hissini korur.",
  },
];

const CUSTOMIZATIONS = [
  {
    name: "Kabartma (Emboss)",
    desc: "Tasarımın belirli kısımları kabartılır. Logo, başlık, çerçeve için.",
  },
  {
    name: "Sıcak Yaldız",
    desc: "Altın, gümüş, bakır 8 renk metalik folyo baskı. Lüks dokunuş.",
  },
  {
    name: "Spot UV",
    desc: "Belirli kısımlara parlak vernik. Foto/logo'yu öne çıkarır.",
  },
];

function MaterialCard({ m }: { m: MaterialInfo }) {
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-gri-200">
      <h3 className="font-semibold text-[16px] text-lacivert mb-1.5">{m.name}</h3>
      <p className="text-[13px] text-gri-700 leading-relaxed mb-3">{m.description}</p>
      <dl className="space-y-2 text-[12.5px]">
        <div>
          <dt className="font-semibold text-gri-700">Nerede kullanılır</dt>
          <dd className="text-lacivert mt-0.5">{m.use}</dd>
        </div>
        <div>
          <dt className="font-semibold text-gri-700">Yüzey</dt>
          <dd className="text-lacivert mt-0.5">{m.surface}</dd>
        </div>
        <div>
          <dt className="font-semibold text-gri-700">Dayanım</dt>
          <dd className="text-lacivert mt-0.5">{m.durability}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function MalzemelerPage() {
  return (
    <main className="bg-gri-50 animate-fade-up py-8 pb-20">
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="mb-8">
          <Eyebrow>Tanıtım</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[40px] font-semibold tracking-tight">
            Malzemeler
          </h1>
          <p className="mt-2 text-base text-gri-700 leading-relaxed max-w-[680px]">
            Hangi malzemeyi seçeceğine karar verirken ürünün ortamı,
            dayanım ihtiyacı ve markanın hissiyatı önemli. Aşağıda her
            seçeneği ne için kullanıldığı + dayanım bilgisiyle topladık.
          </p>
        </div>

        <section id="etiket-malzemeleri" className="mb-10 scroll-mt-20">
          <h2 className="text-[20px] font-semibold tracking-tight mb-4">
            Etiket malzemeleri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ETIKET_MATERIALS.map((m) => (
              <MaterialCard key={m.id} m={m} />
            ))}
          </div>
          <div className="mt-4 text-right">
            <Link
              href="/etiket"
              className="text-[13px] font-semibold text-pim-mercan hover:underline"
            >
              Etiket konfigüratörüne dön →
            </Link>
          </div>
        </section>

        <section id="sticker-malzemeleri" className="mb-10 scroll-mt-20">
          <h2 className="text-[20px] font-semibold tracking-tight mb-4">
            Sticker malzemeleri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STICKER_MATERIALS.map((m) => (
              <MaterialCard key={m.id} m={m} />
            ))}
          </div>
          <div className="mt-4 text-right">
            <Link
              href="/sticker"
              className="text-[13px] font-semibold text-pim-mercan hover:underline"
            >
              Sticker konfigüratörüne dön →
            </Link>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-[20px] font-semibold tracking-tight mb-4">
            Kaplama seçenekleri
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {COATINGS.map((c) => (
              <div
                key={c.name}
                className="rounded-xl bg-white p-4 ring-1 ring-gri-200"
              >
                <div className="font-semibold text-[14.5px] text-lacivert">
                  {c.name}
                </div>
                <div className="text-[13px] text-gri-700 mt-1 leading-relaxed">
                  {c.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[20px] font-semibold tracking-tight mb-4">
            Özelleştirmeler
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {CUSTOMIZATIONS.map((c) => (
              <div
                key={c.name}
                className="rounded-xl bg-white p-4 ring-1 ring-gri-200"
              >
                <div className="font-semibold text-[14.5px] text-lacivert">
                  {c.name}
                </div>
                <div className="text-[13px] text-gri-700 mt-1 leading-relaxed">
                  {c.desc}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12.5px] text-gri-700">
            Yaldız, kabartma ve Spot UV kombinasyonları mümkün. Detay için{" "}
            <Link
              href="/iletisim"
              className="text-pim-mercan font-semibold hover:underline"
            >
              bize yaz
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
