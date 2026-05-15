/**
 * ProductInfoSection — Ürün anlatım bölümü (etiket + sticker sayfalarında).
 *
 * Sefa kuralı (15 May v3): Stickermule.com'daki "Die cut labels stick out"
 * tarzı bir bölüm — feature ikonlarıyla başlayıp hero açıklama + ürün
 * galerisi şeklinde devam eder. Video yok (görsel + metin).
 *
 * Etiket ve sticker için ayrı içerik. Görseller şimdilik placeholder
 * (Sefa admin/site-images veya admin/galeri'den gerçek fotoğrafları
 * yükleyince otomatik bağlanır — gelecek versiyonda).
 *
 * Anatomi:
 *   1. 3 feature card (icon + title + desc + link)
 *   2. Highlight section (büyük görsel + sağ açıklama)
 *   3. Ürün galerisi (4-6 görsel grid)
 */

"use client";

import { Icon } from "@/components/Icon";

interface FeatureCard {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

interface GalleryImage {
  src: string;
  alt: string;
}

interface ProductInfoSectionProps {
  product: "etiket" | "sticker";
}

const ETIKET_FEATURES: FeatureCard[] = [
  {
    icon: <Icon.Box size={24} />,
    title: "5-7 iş günü kargo",
    desc: "Üretim + kalite kontrol + kargo dahil. Türkiye'nin her yerine.",
  },
  {
    icon: <Icon.Sparkle size={24} />,
    title: "AI dosya kontrol",
    desc: "DPI, CMYK, taşma, güvenli alan — dosyan otomatik check edilir.",
  },
  {
    icon: <Icon.Check size={24} />,
    title: "Esnek adetler",
    desc: "Rulo etiket 1.000'den, tabaka etiket 250 adetten başlar. Her ihtiyaca uygun parti.",
  },
];

const STICKER_FEATURES: FeatureCard[] = [
  {
    icon: <Icon.Box size={24} />,
    title: "3-5 iş günü kargo",
    desc: "Sticker daha hızlı üretilir. Acil mi? Premium kargo da var.",
  },
  {
    icon: <Icon.Sparkle size={24} />,
    title: "Die-cut precision kesim",
    desc: "Tasarımının dış hattı milimetrik kesilir, hiçbir fazla kağıt yok.",
  },
  {
    icon: <Icon.Check size={24} />,
    title: "Esnek adetler",
    desc: "25 adetten başlar. Küçük partilerde bile uygun fiyat — etkinlik, doğum günü, lansman.",
  },
];

// Şimdilik placeholder görseller — Sefa /admin/galeri'den yüklediğinde
// gallery_items DB'den çekilebilir (sonraki commit).
const ETIKET_GALLERY: GalleryImage[] = [
  { src: "/gallery/etiket-wine.jpg", alt: "Şarap şişesi etiketi" },
  { src: "/gallery/etiket-honey.jpg", alt: "Bal kavanozu etiketi" },
  { src: "/gallery/etiket-cosmetic.jpg", alt: "Kozmetik krem etiketi" },
  { src: "/gallery/etiket-coffee.jpg", alt: "Kahve paketi etiketi" },
];

const STICKER_GALLERY: GalleryImage[] = [
  { src: "/gallery/sticker-laptop.jpg", alt: "Laptop üzerinde sticker" },
  { src: "/gallery/sticker-wall.jpg", alt: "Duvar sticker'ı" },
  { src: "/gallery/sticker-roll.jpg", alt: "Sticker rulosu" },
  { src: "/gallery/sticker-die-cut.jpg", alt: "Die-cut sticker" },
];

export function ProductInfoSection({ product }: ProductInfoSectionProps) {
  const features = product === "etiket" ? ETIKET_FEATURES : STICKER_FEATURES;
  const gallery = product === "etiket" ? ETIKET_GALLERY : STICKER_GALLERY;

  const highlightTitle =
    product === "etiket"
      ? "Markanı detayda taşıyan etiketler"
      : "Tasarımın her yerde — özel kesim sticker'lar";

  const highlightBody =
    product === "etiket"
      ? "Bir boyut seç, dosyanı yükle, biz sana ücretsiz prova göndereyim. Hızlı, kolay başvurun ve hava şartlarına dayanıklı, tüm etiketlerimiz ürün paketlemesi için ideal."
      : "Bir boyut seç, dosyanı yükle, biz sana ücretsiz prova göndereyim. Die-cut hassas kesim, su geçirmez, dış mekan dayanımlı — kullanım için ideal.";

  const galleryTitle =
    product === "etiket"
      ? "Etiketler markanı öne çıkarır"
      : "Sticker'lar nereye konursa konsun göze çarpar";

  const galleryBody =
    product === "etiket"
      ? "Etiketler ürün paketleme, marka kimliği ve ürününüze özel bir dokunuş eklemek için ideal — hem işletmeler hem bireysel kullanıcılar için en çok tercih edilen seçeneklerden biri."
      : "Sticker'lar marka, ürün paketi, etkinlik veya kişisel kullanım için ideal — özel kesim formu ile her tasarıma uyum sağlar.";

  return (
    <section className="bg-white py-16 md:py-24 border-t border-gri-200">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* 3 feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-16 md:mb-20">
          {features.map((f) => (
            <div key={f.title} className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-pim-mercan-tint text-pim-mercan mb-4">
                {f.icon}
              </div>
              <h3 className="text-[18px] md:text-[20px] font-bold text-lacivert mb-2">
                {f.title}
              </h3>
              <p className="text-[14px] text-gri-700 leading-relaxed max-w-[320px] mx-auto">
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Highlight — büyük görsel + sağ açıklama */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center mb-16 md:mb-20">
          <div className="aspect-video rounded-2xl bg-krem ring-1 ring-gri-200 overflow-hidden grid place-items-center">
            {/* Placeholder — Sefa görsel yükleyince burada gerçek görsel olur */}
            <div className="text-center p-8">
              <Icon.Sparkle size={48} className="text-pim-mercan mx-auto mb-3 opacity-50" />
              <p className="text-[13px] text-gri-700 italic">
                {product === "etiket" ? "Etiket ürün görseli" : "Sticker ürün görseli"}
                <br />
                <span className="text-[11px] text-gri-500">
                  Yakında — gerçek ürün fotoğrafları
                </span>
              </p>
            </div>
          </div>
          <div>
            <h2 className="text-[24px] md:text-[32px] font-bold text-lacivert leading-tight mb-4">
              {highlightTitle}
            </h2>
            <p className="text-[15px] md:text-base text-gri-700 leading-relaxed">
              {highlightBody}
            </p>
          </div>
        </div>

        {/* Galeri başlık */}
        <div className="text-center mb-8 md:mb-10">
          <h2 className="text-[24px] md:text-[32px] font-bold text-lacivert leading-tight mb-3">
            {galleryTitle}
          </h2>
          <p className="text-[14px] md:text-[15px] text-gri-700 leading-relaxed max-w-[700px] mx-auto">
            {galleryBody}
          </p>
        </div>

        {/* Ürün galerisi grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {gallery.map((img) => (
            <div
              key={img.src}
              className="aspect-square rounded-xl bg-krem ring-1 ring-gri-200 overflow-hidden grid place-items-center group hover:ring-pim-mercan transition-colors"
            >
              {/* Şimdilik placeholder — gerçek görseller Sefa yükleyince */}
              <div className="text-center p-3 opacity-60 group-hover:opacity-100 transition-opacity">
                <Icon.Box size={28} className="text-pim-mercan mx-auto mb-2" />
                <p className="text-[11px] text-gri-700 leading-tight">
                  {img.alt}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
