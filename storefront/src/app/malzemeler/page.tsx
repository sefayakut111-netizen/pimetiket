/**
 * /malzemeler — Etiket ve sticker malzemelerinin detaylı tanıtımı.
 *
 * Sefa kuralı (Madde 11, 11 May): Konfigüratörlerden "Malzeme detayı"
 * linki bu sayfaya açar, müşteri detaylı bilgi alıp geri döner.
 *
 * Malzeme verisi: src/lib/seo/materials.ts (tek kaynak)
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Eyebrow, MaterialSwatch, type SurfaceId } from "@/components/ui";
import {
  ETIKET_MATERIALS,
  STICKER_MATERIALS,
  materialDetailPath,
  type MaterialInfo,
} from "@/lib/seo/materials";

export const metadata: Metadata = {
  title: "Malzemeler — Pim Etiket",
  description:
    "Etiket ve sticker malzemelerinin detayları: kraft, beyaz semi-glos, ultra clear, metalik, vinil, transparan, holografik, simli. Kaplama seçenekleri ve özelleştirmeler.",
  alternates: { canonical: "/malzemeler" },
};

const COATINGS: { name: string; desc: string; swatchSurface: SurfaceId }[] = [
  {
    name: "Mat Selefon",
    desc: "Yansıma yok, dokunulduğunda yumuşak. Doğal/premium hissi.",
    swatchSurface: "matselefon",
  },
  {
    name: "Parlak Selefon",
    desc: "Yüksek parlaklık, renkleri canlandırır. Klasik perakende.",
    swatchSurface: "parlakselefon",
  },
  {
    name: "Soft Touch",
    desc: "Kadife dokuda mat. Premium kozmetik ve şişelerde tercih edilir.",
    swatchSurface: "softtouch",
  },
  {
    name: "Kaplamasız",
    desc: "Hiç kaplama yok. Doğal kağıt hissini korur.",
    swatchSurface: "kaplamasiz",
  },
];

const CUSTOMIZATIONS: { name: string; desc: string; swatchSurface: SurfaceId }[] = [
  {
    name: "Kabartma (Emboss)",
    desc: "Tasarımın belirli kısımları kabartılır. Logo, başlık, çerçeve için.",
    swatchSurface: "emboss",
  },
  {
    name: "Sıcak Yaldız",
    desc: "Altın, gümüş, bakır 8 renk metalik folyo baskı. Lüks dokunuş.",
    swatchSurface: "sicakyaldiz",
  },
  {
    name: "Spot UV",
    desc: "Belirli kısımlara parlak vernik. Foto/logo'yu öne çıkarır.",
    swatchSurface: "spotuv",
  },
];

function MaterialCard({ m }: { m: MaterialInfo }) {
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-gri-200">
      {m.swatchSurface && (
        <MaterialSwatch
          surface={m.swatchSurface}
          className="w-full aspect-[2/1] mb-3"
          rounded="xl"
          label={m.name}
        />
      )}
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
      <Link
        href={materialDetailPath(m.slug)}
        className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-pim-mercan hover:underline"
      >
        {m.name} detay sayfası <Icon.ArrowR size={14} />
      </Link>
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
                className="rounded-xl bg-white p-4 ring-1 ring-gri-200 flex gap-4 items-start"
              >
                <MaterialSwatch
                  surface={c.swatchSurface}
                  className="w-24 aspect-[2/1] shrink-0"
                  rounded="lg"
                  label={c.name}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[14.5px] text-lacivert">
                    {c.name}
                  </div>
                  <div className="text-[13px] text-gri-700 mt-1 leading-relaxed">
                    {c.desc}
                  </div>
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
                <MaterialSwatch
                  surface={c.swatchSurface}
                  className="w-full aspect-[2/1] mb-2"
                  rounded="lg"
                  label={c.name}
                />
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
