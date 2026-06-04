import Image from "next/image";

interface ProductionStep {
  n: string;
  img: string;
  alt: string;
  titleTr: string;
  titleEn: string;
  descTr: string;
  descEn: string;
  /** 03 — malzeme partnerleri satırı */
  partners?: boolean;
}

const STEPS: ProductionStep[] = [
  {
    n: "01",
    img: "/assets/img/uretim/mimaki-baski.jpg",
    alt: "Mimaki baskı makinesi",
    titleTr: "Mimaki ile baskı",
    titleEn: "Printed on Mimaki",
    descTr:
      "Baskıyı Mimaki makinelerde alıyoruz. Renkler canlı, detaylar keskin, sonuç her seferinde aynı.",
    descEn:
      "We print on Mimaki machines. Vivid colors, sharp details, consistent results every time.",
  },
  {
    n: "02",
    img: "/assets/img/uretim/greenguard-boya.jpg",
    alt: "GREENGUARD Gold sertifikası",
    titleTr: "GREENGUARD sertifikalı boya",
    titleEn: "GREENGUARD-certified inks",
    descTr:
      "Sağlığını riske atmıyoruz. Boyalarımız GREENGUARD sertifikalı — iç mekânda güvenle kullanılır.",
    descEn:
      "We don't risk your health. Our inks are GREENGUARD certified — safe for indoor use.",
  },
  {
    n: "03",
    img: "/assets/img/uretim/malzeme-folyo.jpg",
    alt: "Folyo ruloları — opak ve şeffaf",
    titleTr: "Orafol & Avery Dennison malzeme",
    titleEn: "Orafol & Avery Dennison materials",
    descTr:
      "Folyolarımız Avrupa'dan. Dış mekân koşullarına uzun süre dayanır, söküldüğünde iz bırakmaz.",
    descEn:
      "Our vinyl comes from Europe. It withstands outdoor conditions and removes without residue.",
    partners: true,
  },
  {
    n: "04",
    img: "/assets/img/uretim/laminasyon.jpg",
    alt: "Laminasyon makinesi",
    titleTr: "Laminasyon koruması",
    titleEn: "Lamination protection",
    descTr:
      "İstersen ekstra dayanım için laminasyonla koruma altına alabilir, parlak ya da mat bir görünüme kavuşturabilirsin.",
    descEn:
      "Optionally add lamination for extra durability — and choose a glossy or matte look.",
  },
  {
    n: "05",
    img: "/assets/img/uretim/kesim.jpg",
    alt: "Tek tek ve tabaka kesim",
    titleTr: "Talebine göre kesim",
    titleEn: "Cut to your needs",
    descTr:
      "İhtiyacına göre ister tek tek, istersen kolay istifleme için tabaka hâlinde kesiyoruz — özenle paketleyip yola çıkarıyoruz.",
    descEn:
      "Die-cut individually or in sheets for easy stacking — carefully packed and shipped.",
  },
];

export function StickerInfoSection({ isEn }: { isEn: boolean }) {
  return (
    <section className="mt-16 border-t border-gri-200 pt-16">
      <div className="text-center mb-10">
        <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-pim-mercan-koyu">
          {isEn ? "Production" : "Üretim"}
        </span>
        <h2 className="mt-3 text-2xl md:text-[32px] font-bold text-lacivert tracking-tight">
          {isEn ? "How we produce" : "Nasıl üretiyoruz?"}
        </h2>
        <p className="mt-3 text-gri-700 max-w-2xl mx-auto leading-relaxed">
          {isEn
            ? "A quick look behind your stickers."
            : "Sticker'ının arkasında ne var, kısaca anlatalım."}
        </p>
      </div>

      <div className="space-y-5 md:space-y-6">
        {STEPS.map((step, i) => (
          <div
            key={step.n}
            className={`overflow-hidden rounded-3xl bg-gri-50 ring-1 ring-black/[0.04] flex flex-col ${
              i % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"
            }`}
          >
            {/* Görsel — yarıyı baştan başa kaplar, beyaz kalmaz */}
            <div className="relative w-full aspect-[16/11] md:aspect-auto md:w-1/2 md:min-h-[300px]">
              <Image
                src={step.img}
                alt={step.alt}
                fill
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>

            {/* Metin — yumuşak zeminde dikey ortalı */}
            <div className="w-full md:w-1/2 p-7 md:p-12 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-pim-mercan font-bold text-lg tabular-nums">
                  {step.n}
                </span>
                <span className="h-px w-8 bg-pim-mercan/40" aria-hidden />
              </div>
              <h3 className="text-lg md:text-2xl font-bold text-lacivert">
                {isEn ? step.titleEn : step.titleTr}
              </h3>
              <p className="mt-2 text-gri-600 leading-relaxed">
                {isEn ? step.descEn : step.descTr}
              </p>
              {step.partners && (
                <p className="mt-3 text-[11px] text-gri-500">
                  {isEn ? "Material partners: " : "Malzeme partnerlerimiz: "}
                  <span className="font-semibold text-gri-700">
                    ORAFOL® · Avery Dennison®
                  </span>
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
