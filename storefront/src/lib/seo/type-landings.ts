/**
 * Programatik tür/kesim SEO landing sayfaları — /etiket/[slug], /sticker/[slug]
 */

export interface TypeLanding {
  slug: string;
  productType: "etiket" | "sticker";
  name: string;
  h1: string;
  description: string;
  intro: string;
  useCases: string[];
  configHref: string;
  configQuery?: string;
  faqs: { q: string; a: string }[];
}

export const ETIKET_TYPE_LANDINGS: TypeLanding[] = [
  {
    slug: "rulo",
    productType: "etiket",
    name: "Rulo etiket",
    h1: "Rulo etiket baskı",
    description:
      "Rulo etiket baskı — kuşe, şeffaf ve kraft malzemelerde yüksek hacimli üretim. 1.000 adetten, AI dosya kontrolü, 10 iş günü kargoda.",
    intro:
      "Rulo etiket; otomatik etiketleme makineleri ve seri üretim hatları için en yaygın formattır. Kozmetik, gıda ve içecek ambalajlarında yüksek adetli baskı için idealdir.",
    useCases: [
      "Kozmetik ve parfüm şişe etiketleri",
      "Gıda ve içecek seri üretim hatları",
      "Otomatik etiketleme makineleri",
    ],
    configHref: "/etiket/yapilandir",
    configQuery: "form=rulo",
    faqs: [
      {
        q: "Rulo etiket minimum adet nedir?",
        a: "Konfigüratörde genelde 1.000 adetten başlar; malzeme ve boyuta göre anlık fiyat görürsünüz.",
      },
      {
        q: "Rulo mu tabaka mı seçmeliyim?",
        a: "Yüksek adet ve makine etiketleme → rulo. Düşük adet veya el yapıştırma → tabaka daha uygun olabilir.",
      },
      {
        q: "Hangi malzemeler rulo etikette kullanılır?",
        a: "Kuşe (beyaz semi-glos), kraft, şeffaf (ultra clear), metalik ve vinil rulo üretimde yaygındır.",
      },
    ],
  },
  {
    slug: "tabaka",
    productType: "etiket",
    name: "Tabaka etiket",
    h1: "Tabaka (sheet) etiket baskı",
    description:
      "Tabaka etiket baskı — düşük adet, butik ve el yapımı ürünler için. 250 adetten, özel kesim, AI dosya kontrolü.",
    intro:
      "Tabaka (sheet) etiket; düşük adetli, özel kesimli ve el ile uygulanan etiket ihtiyaçları için uygundur. Butik kozmetik, mum, bal ve hediye paketlerinde sık tercih edilir.",
    useCases: [
      "Butik ve el yapımı ürünler",
      "Hediye paketi ve kutu etiketleri",
      "Düşük adet özel kesim projeleri",
    ],
    configHref: "/etiket/yapilandir",
    configQuery: "form=tabaka",
    faqs: [
      {
        q: "Tabaka etiket minimum adet?",
        a: "250 adetten başlayan tabaka seçenekleri konfigüratörde listelenir.",
      },
      {
        q: "Tabaka etiket hangi malzemelerde?",
        a: "Kuşe, kraft ve opak PP tabaka üretimde en çok kullanılan malzemelerdir.",
      },
      {
        q: "Rulo ile tabaka fiyat farkı?",
        a: "Düşük adette tabaka genelde daha ekonomiktir; yüksek adette rulo birim maliyeti düşer.",
      },
    ],
  },
];

export const STICKER_TYPE_LANDINGS: TypeLanding[] = [
  {
    slug: "die-cut",
    productType: "sticker",
    name: "Die-cut sticker",
    h1: "Die-cut sticker baskı",
    description:
      "Die-cut (özel kesim) sticker baskı — logo, marka ve promosyon stickerları. Holografik, transparan ve mat seçenekler.",
    intro:
      "Die-cut sticker, tasarımınızın konturuna göre tek tek kesilen sticker formatıdır. Laptop, ambalaj ve promosyon uygulamalarında en popüler kesim türüdür.",
    useCases: [
      "Marka logosu ve promosyon stickerları",
      "Laptop ve su şişesi stickerları",
      "Özel şekilli ürün stickerları",
    ],
    configHref: "/sticker/yapilandir",
    configQuery: "shape=diecut",
    faqs: [
      {
        q: "Die-cut sticker nedir?",
        a: "Tasarımınızın dış hatlarına göre tek tek kesilen sticker; standart kare/daire değil, özel form.",
      },
      {
        q: "Die-cut ile kiss-cut farkı?",
        a: "Die-cut tek sticker; kiss-cut sayfada çoklu sticker, arka planla birlikte soyulur.",
      },
      {
        q: "Holografik die-cut yapılır mı?",
        a: "Evet — holografik ve metalik malzemelerde die-cut sticker üretilebilir.",
      },
    ],
  },
  {
    slug: "kiss-cut",
    productType: "sticker",
    name: "Kiss-cut sticker",
    h1: "Kiss-cut sticker baskı",
    description:
      "Kiss-cut sticker baskı — sayfa üzerinde çoklu sticker, kolay soyma. Promosyon ve perakende setleri için.",
    intro:
      "Kiss-cut sticker; tasarım kesilir, arka zemin (liner) kalır. Bir sayfada birden fazla sticker veya sticker sheet üretimi için idealdir.",
    useCases: [
      "Sticker sheet / çoklu tasarım sayfaları",
      "Promosyon setleri ve hediye paketleri",
      "Perakende teşhir stickerları",
    ],
    configHref: "/sticker/yapilandir",
    configQuery: "shape=kisscut",
    faqs: [
      {
        q: "Kiss-cut ne demek?",
        a: "Yalnızca sticker katmanı kesilir; arka kağıt (liner) bütün kalır, kolay dağıtım için.",
      },
      {
        q: "Bir sayfada kaç sticker?",
        a: "Boyut ve layout'a göre değişir; konfigüratörde adet ve ölçü seçerek fiyat alırsınız.",
      },
      {
        q: "Die-cut mu kiss-cut mu?",
        a: "Tek tek dağıtılacak logo sticker → die-cut. Sayfa/set halinde → kiss-cut.",
      },
    ],
  },
  {
    slug: "holografik",
    productType: "sticker",
    name: "Holografik sticker",
    h1: "Holografik sticker baskı",
    description:
      "Holografik sticker baskı — ışıkta değişen efekt, premium ambalaj ve marka stickerları.",
    intro:
      "Holografik sticker; ışıkla oynayan yüzeyiyle dikkat çeker. Kozmetik, içecek ve lüks marka promosyonlarında tercih edilir.",
    useCases: ["Premium marka stickerları", "Sınırlı seri promosyon", "Ambalaj güvenlik etiketi"],
    configHref: "/sticker/yapilandir",
    configQuery: "material=holografik",
    faqs: [
      {
        q: "Holografik sticker dış mekana dayanır mı?",
        a: "Kaplama ile kısa süreli dış kullanım mümkün; uzun süreli dış mekan için vinil önerilir.",
      },
      {
        q: "Baskı renkleri holografikte nasıl görünür?",
        a: "Zemin ışıltılı olduğu için koyu ve doygun renkler daha belirgin sonuç verir.",
      },
    ],
  },
  {
    slug: "transparan",
    productType: "sticker",
    name: "Transparan sticker",
    h1: "Transparan sticker baskı",
    description:
      "Şeffaf / transparan sticker baskı — cam, şişe ve ambalaj üzerinde “baskısız” görünüm.",
    intro:
      "Transparan sticker; zemin rengini gösterir, etiket cam veya renkli ambalajda doğal durur. İçecek ve kozmetik şişelerde yaygındır.",
    useCases: ["Cam şişe ve kavanoz", "Renkli ambalaj üzeri sticker", "No-label görünüm"],
    configHref: "/sticker/yapilandir",
    configQuery: "material=transparan",
    faqs: [
      {
        q: "Transparan sticker ile şeffaf etiket farkı?",
        a: "Transparan sticker vinil tabanlı ve daha kalın; şeffaf etiket (ultra clear) kağıt/film rulo-tabaka ürünüdür.",
      },
      {
        q: "Beyaz mürekkep gerekir mi?",
        a: "Açık renkli tasarımlarda beyaz alt baskı önerilir; konfigüratörde dosya kontrolü yapılır.",
      },
    ],
  },
];

export const ETIKET_TYPE_SLUGS = ETIKET_TYPE_LANDINGS.map((l) => l.slug);
export const STICKER_TYPE_SLUGS = STICKER_TYPE_LANDINGS.map((l) => l.slug);

export function getEtiketTypeLanding(slug: string): TypeLanding | undefined {
  return ETIKET_TYPE_LANDINGS.find((l) => l.slug === slug);
}

export function getStickerTypeLanding(slug: string): TypeLanding | undefined {
  return STICKER_TYPE_LANDINGS.find((l) => l.slug === slug);
}
