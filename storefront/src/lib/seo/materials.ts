import type { SurfaceId } from "@/components/ui";

export interface MaterialFaq {
  q: string;
  a: string;
}

export interface MaterialInfo {
  id: string;
  slug: string;
  name: string;
  description: string;
  use: string;
  surface: string;
  durability: string;
  suitableFor: string;
  productType: "etiket" | "sticker";
  swatchSurface?: SurfaceId;
  faqs: MaterialFaq[];
}

/** id (snake_case) → URL slug (kebab-case) */
export const MATERIAL_ID_TO_SLUG: Record<string, string> = {
  kraft: "kraft",
  beyaz_semi_glos: "beyaz-semi-glos",
  ultra_clear: "ultra-clear",
  metalik: "metalik",
  vinil: "vinil",
  transparan: "transparan",
  holografik: "holografik",
  simli: "simli",
};

export const MATERIAL_SLUGS = Object.values(MATERIAL_ID_TO_SLUG);

const SLUG_TO_ID = Object.fromEntries(
  Object.entries(MATERIAL_ID_TO_SLUG).map(([id, slug]) => [slug, id])
) as Record<string, string>;

export const ETIKET_MATERIALS: MaterialInfo[] = [
  {
    id: "kraft",
    slug: "kraft",
    name: "Kraft",
    description:
      "Geri dönüştürülmüş, doğal kahverengi kağıt. Doğallık vurgusu yapan markalar için ideal etiket malzemesi.",
    use: "Doğal kozmetik, organik gıda, el yapımı sabun, kuru çay/baharat",
    surface: "Mat, hafif dokulu yüzey. Yazı baskısı net, fotoğraf baskısı daha soft görünür.",
    durability: "Suya orta dayanım. Buzdolabı/kavanoz ürünleri için kaplama tavsiye edilir.",
    suitableFor:
      "Organik, sürdürülebilir veya el yapımı markalar; doğal kağıt dokusunu öne çıkarmak isteyenler.",
    productType: "etiket",
    swatchSurface: "kraft",
    faqs: [
      {
        q: "Kraft etiket suya dayanıklı mı?",
        a: "Tek başına orta dayanımdadır. Buzdolabı ve nemli ortamlar için mat veya parlak selefon kaplama önerilir.",
      },
      {
        q: "Kraft üzerine renkli baskı yapılır mı?",
        a: "Evet. CMYK baskı kahverengi zemin üzerinde doğal, sıcak bir ton verir; koyu renkler daha belirgin görünür.",
      },
      {
        q: "Hangi ürünlerde kraft tercih edilir?",
        a: "Organik gıda, kozmetik, çay/baharat ve el yapımı ürün ambalajlarında en çok tercih edilir.",
      },
      {
        q: "Minimum sipariş adedi nedir?",
        a: "Etiket konfigüratöründe malzeme seçerek adet ve fiyatı anında görebilirsin; genelde 1.000 adetten başlar.",
      },
    ],
  },
  {
    id: "beyaz_semi_glos",
    slug: "beyaz-semi-glos",
    name: "Beyaz Semi-Glos",
    description:
      "Yarı parlak beyaz kağıt etiket. Klasik üretim standardı; renkleri canlı ve net gösterir.",
    use: "Genel amaçlı — gıda, kozmetik, ev temizlik ürünleri",
    surface: "Yarı parlak, pürüzsüz. CMYK baskı tam doygunlukta basılır.",
    durability: "Yüksek kaplama ile su geçirmez hale getirilebilir.",
    suitableFor:
      "Çoğu perakende etiketi için güvenli varsayılan; yüksek renk doygunluğu ve okunaklı barkod isteyen markalar.",
    productType: "etiket",
    swatchSurface: "kuse",
    faqs: [
      {
        q: "Semi-glos ile mat kuşe farkı nedir?",
        a: "Semi-glos hafif parlaklık verir ve renkleri daha canlı gösterir; mat kuşe yansımasız, daha doğal bir his sunar.",
      },
      {
        q: "Barkod ve QR kod için uygun mu?",
        a: "Evet. Pürüzsüz yüzey barkod okumasını kolaylaştırır; kontrast için koyu mürekkep önerilir.",
      },
      {
        q: "Kaplama gerekli mi?",
        a: "Kuru ortamda şart değil; buzdolabı veya nemli yüzeylerde selefon veya laminasyon önerilir.",
      },
      {
        q: "Rulo ve tabaka etikette kullanılır mı?",
        a: "Evet. Hem rulo hem tabaka (sheet) etiket üretiminde en yaygın malzemedir.",
      },
    ],
  },
  {
    id: "ultra_clear",
    slug: "ultra-clear",
    name: "Ultra Clear (Şeffaf)",
    description:
      "Tamamen transparan film. Cam şişe ve şeffaf ambalajlarda ürün görüntüsünü bozmadan etiket basar.",
    use: "Cam şişeli içecekler, parfüm, şeffaf kavanozlu sos/reçel",
    surface: "Parlak şeffaf. Sadece basılan kısımları görünür, gerisi şeffaf kalır.",
    durability: "Suya dayanıklı. Soğuk zincir + buzdolabı uygundur.",
    suitableFor:
      "Cam veya şeffaf ambalajlı ürünler; “no-label look” isteyen içecek ve kozmetik markaları.",
    productType: "etiket",
    swatchSurface: "ultraclear",
    faqs: [
      {
        q: "Şeffaf etikette beyaz mürekkep gerekir mi?",
        a: "Açık renkli tasarımlarda veya cam üzerinde okunaklılık için beyaz alt baskı (white ink) gerekebilir.",
      },
      {
        q: "Ultra clear ile transparan vinil sticker farkı nedir?",
        a: "Ultra clear etiket (kağıt/film tabanlı rulo-tabaka); transparan vinil sticker daha kalın ve dış mekana yöneliktir.",
      },
      {
        q: "Soğuk ortamda yapışır mı?",
        a: "Evet, uygun yapışkan ve yüzey hazırlığı ile buzdolabı ve soğuk içecek uygulamalarına uygundur.",
      },
      {
        q: "Hangi kesim türleri desteklenir?",
        a: "Die-cut ve özel şekil kesimler konfigüratörde seçilebilir; detay için etiket sayfasına gidin.",
      },
    ],
  },
  {
    id: "metalik",
    slug: "metalik",
    name: "Metalik",
    description:
      "Altın veya gümüş metalik yüzeyli kağıt. Premium ürün hissi yaratır; rafta dikkat çeker.",
    use: "Lüks parfüm, premium çikolata, şarap, viski etiketleri",
    surface: "Pürüzsüz metalik parlak. Renkler metalik zemin üzerinde yumuşak görünür.",
    durability: "Yüksek. Premium ürünlerde standart kaplama yeter.",
    suitableFor:
      "Premium ve lüks segment markalar; altın/gümüş hissiyatıyla fark yaratmak isteyen ambalajlar.",
    productType: "etiket",
    swatchSurface: "metalik",
    faqs: [
      {
        q: "Metalik etikette tam renk baskı mümkün mü?",
        a: "Evet, ancak metalik zemin renkleri yumuşatır; kontrast için koyu tonlar ve sınırlı palet önerilir.",
      },
      {
        q: "Altın ve gümüş seçenekleri var mı?",
        a: "Konfigüratörde metalik altın ve gümüş zemin seçenekleri mevcuttur.",
      },
      {
        q: "Sıcak yaldız ile birlikte kullanılır mı?",
        a: "Evet. Metalik zemin üzerine sıcak yaldız veya spot UV kombinasyonları mümkündür.",
      },
      {
        q: "Şarap ve içki etiketlerine uygun mu?",
        a: "Evet. Şarap, viski ve premium içecek etiketlerinde sık tercih edilir.",
      },
    ],
  },
];

export const STICKER_MATERIALS: MaterialInfo[] = [
  {
    id: "vinil",
    slug: "vinil",
    name: "Vinil",
    description:
      "Kalın, esnek vinil film. Sticker klasiği — UV ve suya dayanıklı, dış mekana uygun.",
    use: "Laptop, su şişesi, araba, dış mekan, ürün ambalajı",
    surface: "Standart parlak ya da mat. Renkler canlı, kontrast yüksek.",
    durability: "3-5 yıl dış mekan dayanımı. Çamaşır makinesi tehlikesi DEĞİL.",
    suitableFor:
      "Dış mekan, promosyon ve dayanıklılık isteyen markalar; laptop ve araç stickerları.",
    productType: "sticker",
    swatchSurface: "opakpp",
    faqs: [
      {
        q: "Vinil sticker dış mekanda ne kadar dayanır?",
        a: "UV ve suya dayanımlı laminasyon ile 3-5 yıl dış mekan kullanımı hedeflenir; güneşe maruz yüzeye göre değişir.",
      },
      {
        q: "Die-cut ve kiss-cut farkı vinilde geçerli mi?",
        a: "Evet. Vinil hem özel şekil (die-cut) hem yaprak (kiss-cut) kesimde kullanılır.",
      },
      {
        q: "Vinil sticker yıkanabilir mi?",
        a: "Elde yıkama ve hafif nem genelde sorun değil; çamaşır makinesi ve agresif kimyasallardan kaçının.",
      },
      {
        q: "Bumper sticker için uygun mu?",
        a: "Evet. Otomobil ve promosyon bumper stickerları için standart malzemedir.",
      },
    ],
  },
  {
    id: "transparan",
    slug: "transparan",
    name: "Transparan Vinil",
    description:
      "Şeffaf zeminli vinil. Yapıştığı yüzeyde “havada duruyor” etkisi yaratır.",
    use: "Cam kavanoz, şampuan/krem şişeleri, vitrin etiketleri",
    surface: "Şeffaf, sadece basılan kısımlar görünür.",
    durability: "Vinil ile aynı — dış mekan + su uygundur.",
    suitableFor:
      "Cam şişe, vitrin ve şeffaf ambalaj; görünür yapışkan kenarı minimize etmek isteyen tasarımlar.",
    productType: "sticker",
    swatchSurface: "transparan",
    faqs: [
      {
        q: "Transparan stickerda beyaz baskı şart mı?",
        a: "Açık renkler ve cam üzerinde okunaklılık için çoğu tasarımda beyaz alt baskı kullanılır.",
      },
      {
        q: "Opak vinilden farkı nedir?",
        a: "Zemin şeffaftır; sadece baskılı alanlar görünür, geri kalan yüzey şeffaf kalır.",
      },
      {
        q: "İç ve dış mekanda kullanılır mı?",
        a: "Evet. Vinil tabanlı olduğu için nem ve dış mekan uygulamalarına uygundur.",
      },
      {
        q: "Holografik ile kombine edilebilir mi?",
        a: "Ayrı malzeme seçenekleri olarak sunulur; tek stickerda kombinasyon için iletişime geçin.",
      },
    ],
  },
  {
    id: "holografik",
    slug: "holografik",
    name: "Holografik",
    description:
      "Yansıyan, ışıkta renk değiştiren özel film. Etkinlik ve marka coşkusu için dikkat çekici sticker.",
    use: "Etkinlik sticker, sınırlı koleksiyon, dergi ekleri, çocuk ürünleri",
    surface: "Parlak, ışıkta renkler kayar (gökkuşağı/baklava efekti).",
    durability: "İç mekan optimum. Dış mekanda yansıma 6-12 ayda solar.",
    suitableFor:
      "Etkinlik, promosyon ve koleksiyon ürünleri; rafta ve sosyal medyada fark yaratmak isteyenler.",
    productType: "sticker",
    swatchSurface: "holografik",
    faqs: [
      {
        q: "Holografik sticker dış mekanda solar mı?",
        a: "Güneşe uzun maruziyette holografik efekt 6-12 ay içinde solabilir; iç mekan ve promosyon için idealdir.",
      },
      {
        q: "Üzerine tam renk baskı yapılır mı?",
        a: "Evet. Tasarım holografik zemin üzerine basılır; kontrast için koyu ve doygun renkler önerilir.",
      },
      {
        q: "Die-cut özel şekil mümkün mü?",
        a: "Evet. Konfigüratörde özel kesim şablonları veya özel şekil yüklenebilir.",
      },
      {
        q: "Etiket malzemesi olarak da var mı?",
        a: "Bu landing sticker odaklıdır; holografik etiket ihtiyacı için iletişime geçin veya sticker konfigüratörünü kullanın.",
      },
    ],
  },
  {
    id: "simli",
    slug: "simli",
    name: "Simli (Glitter)",
    description:
      "Simli, ışıltılı yüzey. Ürünü düz baskıdan ayırmak isteyen markalar için öne çıkan sticker malzemesi.",
    use: "Çocuk ürünleri, parti malzemeleri, kozmetik, kırtasiye",
    surface: "Simli parlak. Renkler sim arasından parlar.",
    durability: "İç mekan. Yıkamada sim dökülmez, ama çamaşır makinesi önerilmez.",
    suitableFor:
      "Çocuk, parti ve kırtasiye segmenti; ışıltılı, eğlenceli ambalaj ve promosyon stickerları.",
    productType: "sticker",
    swatchSurface: "simli",
    faqs: [
      {
        q: "Simli sticker yıkamaya dayanır mı?",
        a: "Hafif nem ve elde silme genelde sorun değil; çamaşır makinesi ve sert sürtünmeden kaçının.",
      },
      {
        q: "Baskı kalitesi nasıl görünür?",
        a: "Renkler simli zemin arasından parlar; pastel ve parlak tonlar iyi sonuç verir.",
      },
      {
        q: "İç mekan kullanımı için mi?",
        a: "Evet. İç mekan, promosyon ve kısa ömürlü kampanyalar için optimize edilmiştir.",
      },
      {
        q: "Minimum adet ve fiyat nereden görülür?",
        a: "Sticker konfigüratöründe simli malzeme seçerek anında fiyat alabilirsiniz.",
      },
    ],
  },
];

export const ALL_MATERIALS: MaterialInfo[] = [
  ...ETIKET_MATERIALS,
  ...STICKER_MATERIALS,
];

export function getMaterialBySlug(slug: string): MaterialInfo | undefined {
  const id = SLUG_TO_ID[slug];
  if (!id) return undefined;
  return ALL_MATERIALS.find((m) => m.id === id);
}

export function materialDetailPath(slug: string): string {
  return `/malzeme/${slug}`;
}
