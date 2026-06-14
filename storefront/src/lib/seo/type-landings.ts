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

  // --- Sektör / kullanım-alanı landing'leri ---
  {
    slug: "kozmetik",
    productType: "etiket",
    name: "Kozmetik etiketi",
    h1: "Kozmetik etiket baskı",
    description:
      "Kozmetik etiket baskı — krem, serum ve şişe etiketleri. Şeffaf, kuşe ve metalik malzeme, su/yağ dayanımı, AI dosya kontrolü.",
    intro:
      "Kozmetik ürünleri için etiket; cam ve plastik ambalajda net duruş, krem ve yağa karşı dayanım ister. Şeffaf 'no-label' görünüm ve metalik premium seçenekler kozmetik markalarında öne çıkar.",
    useCases: [
      "Krem, serum ve kavanoz etiketleri",
      "Şampuan ve şişe sırt etiketleri",
      "Butik ve el yapımı kozmetik (tabaka)",
    ],
    configHref: "/etiket/yapilandir",
    faqs: [
      {
        q: "Kozmetik etiketi suya/yağa dayanır mı?",
        a: "Laminasyon ve uygun malzeme ile krem, yağ ve nemde dayanım sağlanır; konfigüratörde kaplama seçilir.",
      },
      {
        q: "Şeffaf kozmetik etiketi yapılır mı?",
        a: "Evet — ultra clear şeffaf malzemeyle 'baskısız' görünüm; açık tasarımlarda beyaz alt baskı önerilir.",
      },
      {
        q: "Düşük adet kozmetik etiketi?",
        a: "Butik üretim için 250 adetten tabaka etiket; seri üretim için 1.000 adetten rulo uygundur.",
      },
    ],
  },
  {
    slug: "gida",
    productType: "etiket",
    name: "Gıda etiketi",
    h1: "Gıda etiketi baskı",
    description:
      "Gıda etiketi baskı — reçel, bal, baharat ve paketli gıda etiketleri. Kraft ve kuşe malzeme, doğal görünüm, AI dosya kontrolü.",
    intro:
      "Gıda ambalajı etiketleri; içerik, son kullanma ve marka bilgisini taşır. Kraft doğal görünüm ve kuşe canlı baskı gıda ürünlerinde en çok tercih edilen malzemelerdir.",
    useCases: [
      "Reçel, bal ve kavanoz etiketleri",
      "Baharat ve kuruyemiş paketleri",
      "Paketli gıda ve fırın ürünleri",
    ],
    configHref: "/etiket/yapilandir",
    faqs: [
      {
        q: "Gıda etiketinde hangi malzeme?",
        a: "Doğal görünüm için kraft, canlı renk için kuşe; nemli ürünlerde laminasyonlu seçenek önerilir.",
      },
      {
        q: "Buzdolabı/dondurucu ürününe yapışır mı?",
        a: "Soğuk yüzey yapıştırıcılı malzeme ile nemli ve soğuk ambalajlarda tutunma sağlanır.",
      },
      {
        q: "Gıda etiketi minimum adet?",
        a: "Tabaka 250, rulo 1.000 adetten; konfigüratörde malzeme ve boyuta göre anlık fiyat görürsünüz.",
      },
    ],
  },
  {
    slug: "icecek",
    productType: "etiket",
    name: "İçecek etiketi",
    h1: "İçecek etiketi baskı",
    description:
      "İçecek etiketi baskı — şişe, kombucha, soğuk kahve ve içecek etiketleri. Şeffaf ve su geçirmez malzeme, AI dosya kontrolü.",
    intro:
      "İçecek şişeleri için etiket; buzdolabı nemine ve su temasına dayanmalı. Şeffaf malzeme cam şişede premium duruş, su geçirmez vinil ise dayanım sağlar.",
    useCases: [
      "Cam şişe ve kavanoz içecek",
      "Kombucha, soğuk kahve, limonata",
      "Butik içecek ve el yapımı seri",
    ],
    configHref: "/etiket/yapilandir",
    faqs: [
      {
        q: "İçecek etiketi suda dağılır mı?",
        a: "Su geçirmez malzeme ve laminasyon ile buzdolabı nemine ve ıslanmaya karşı korur.",
      },
      {
        q: "Cam şişede şeffaf etiket?",
        a: "Ultra clear şeffaf malzeme cam üzerinde 'no-label' görünüm verir.",
      },
    ],
  },
  {
    slug: "parfum",
    productType: "etiket",
    name: "Parfüm etiketi",
    h1: "Parfüm etiket baskı",
    description:
      "Parfüm etiket baskı — premium şişe etiketleri. Metalik, şeffaf ve dokulu malzeme, ince tipografi, AI dosya kontrolü.",
    intro:
      "Parfüm etiketi; küçük şişede yüksek kaliteli, premium duruş ister. Metalik ve şeffaf malzemeler, ince tipografi ile lüks marka algısı oluşturur.",
    useCases: [
      "Parfüm ve kolonya şişeleri",
      "Premium butik parfüm serileri",
      "Oda kokusu ve difüzör etiketleri",
    ],
    configHref: "/etiket/yapilandir",
    faqs: [
      {
        q: "Parfüm etiketi alkole dayanır mı?",
        a: "Laminasyon ve uygun malzeme ile alkol temasına karşı dayanım sağlanır.",
      },
      {
        q: "Metalik/parlak parfüm etiketi?",
        a: "Metalik malzeme ile ışıltılı zemin sağlanır; özel efektler için konfigüratör üzerinden bize ulaşın.",
      },
    ],
  },
  {
    slug: "mum",
    productType: "etiket",
    name: "Mum etiketi",
    h1: "Mum etiketi baskı",
    description:
      "Mum etiketi baskı — bardak mum, soya mumu ve kavanoz etiketleri. Kraft ve şeffaf malzeme, düşük adet (tabaka), AI dosya kontrolü.",
    intro:
      "Mum etiketi; cam kavanoz ve bardak mumlarda marka ve güvenlik bilgisini taşır. Butik mum üreticileri için düşük adetli tabaka etiket en pratik seçenektir.",
    useCases: [
      "Bardak ve kavanoz mum etiketleri",
      "Soya mumu butik seriler",
      "Alt güvenlik / uyarı etiketleri",
    ],
    configHref: "/etiket/yapilandir",
    configQuery: "form=tabaka",
    faqs: [
      {
        q: "Mum etiketi ısıdan etkilenir mi?",
        a: "Cam dış yüzeydeki ılık ısıya dayanır; doğrudan alev teması için tasarlanmaz.",
      },
      {
        q: "Az adet mum etiketi?",
        a: "Butik üretim için 250 adetten tabaka etiket idealdir.",
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

  // --- Kullanım-alanı landing'leri ---
  {
    slug: "marka",
    productType: "sticker",
    name: "Marka stickerı",
    h1: "Marka stickerı baskı",
    description:
      "Marka stickerı baskı — logo ve promosyon stickerları. Die-cut özel kesim, holografik ve mat seçenekler, AI dosya kontrolü.",
    intro:
      "Marka stickerı; logonuzu ambalaja, kutuya ve ürün üzerinde görünür kılar. Die-cut özel kesim ile logo formunda, holografik ile premium duruş sağlanır.",
    useCases: [
      "Logo ve marka kimliği stickerları",
      "Ambalaj ve kutu kapama",
      "Promosyon ve hediye dağıtımı",
    ],
    configHref: "/sticker/yapilandir",
    configQuery: "shape=diecut",
    faqs: [
      {
        q: "Logo formunda sticker (die-cut) yapılır mı?",
        a: "Evet — tasarımın dış konturuna göre özel kesim die-cut sticker üretilir.",
      },
      {
        q: "Marka stickerı minimum adet?",
        a: "Konfigüratörde adet ve ölçü seçerek anlık fiyat görürsünüz.",
      },
    ],
  },
  {
    slug: "laptop",
    productType: "sticker",
    name: "Laptop stickerı",
    h1: "Laptop stickerı baskı",
    description:
      "Laptop stickerı baskı — dayanıklı vinil, su ve çizilmeye dayanıklı. Die-cut özel kesim, mat ve şeffaf seçenekler.",
    intro:
      "Laptop stickerı; sık temas ve sürtünmeye dayanmalı. Laminasyonlu vinil malzeme su, çizik ve UV'ye karşı korur; die-cut ile özel form verir.",
    useCases: [
      "Laptop ve tablet stickerları",
      "Su şişesi ve termos",
      "Telefon ve aksesuar stickerı",
    ],
    configHref: "/sticker/yapilandir",
    configQuery: "shape=diecut",
    faqs: [
      {
        q: "Laptop stickerı çıkarken iz bırakır mı?",
        a: "Kaliteli vinil temiz soyulur; uzun kullanımda zemine göre değişebilir.",
      },
      {
        q: "Suya ve çizilmeye dayanır mı?",
        a: "Laminasyon ile su, çizik ve solmaya karşı dayanım sağlanır.",
      },
    ],
  },
  {
    slug: "etkinlik",
    productType: "sticker",
    name: "Etkinlik stickerı",
    h1: "Etkinlik stickerı baskı",
    description:
      "Etkinlik stickerı baskı — düğün, doğum günü ve organizasyon stickerları. Kiss-cut sayfa, hızlı dağıtım, AI dosya kontrolü.",
    intro:
      "Etkinlik stickerı; davet, hediye ve hatıra paketlerinde marka ve tema taşır. Kiss-cut sayfa formatı çoklu sticker'ı kolay dağıtım için idealdir.",
    useCases: [
      "Düğün ve nişan hatıra stickerları",
      "Doğum günü ve parti paketi",
      "Kurumsal etkinlik ve fuar",
    ],
    configHref: "/sticker/yapilandir",
    configQuery: "shape=kisscut",
    faqs: [
      {
        q: "Çok adetli etkinlik stickerı?",
        a: "Kiss-cut sayfa formatı ile bir sayfada çoklu sticker; toplu dağıtım için pratiktir.",
      },
      {
        q: "Kısa sürede teslim olur mu?",
        a: "Konfigüratörde tahmini üretim ve kargo süresi gösterilir.",
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
