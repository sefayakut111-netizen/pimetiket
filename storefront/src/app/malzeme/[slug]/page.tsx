import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eyebrow, MaterialSwatch, Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import {
  SchemaJsonLd,
  faqSchema,
  breadcrumbSchema,
  productSchema,
} from "@/components/SchemaJsonLd";
import { withSocialMetadata } from "@/lib/seo/page-metadata";
import {
  MATERIAL_SLUGS,
  getMaterialBySlug,
  materialDetailPath,
} from "@/lib/seo/materials";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return MATERIAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const material = getMaterialBySlug(slug);
  if (!material) return { title: "Malzeme bulunamadı" };

  const title = `${material.name} Etiket & Sticker Baskı — Pim Etiket`;
  const canonical = materialDetailPath(slug);
  return {
    title,
    description: material.description,
    alternates: { canonical },
    ...withSocialMetadata({
      title,
      description: material.description,
      canonical,
    }),
  };
}

export default async function MalzemeLandingPage({ params }: Props) {
  const { slug } = await params;
  const material = getMaterialBySlug(slug);
  if (!material) notFound();

  const configHref = material.productType === "etiket" ? "/etiket" : "/sticker";
  const configLabel =
    material.productType === "etiket" ? "Etiket bastır" : "Sticker bastır";

  return (
    <main className="bg-gri-50 animate-fade-up py-8 pb-20">
      <SchemaJsonLd data={faqSchema(material.faqs)} />
      <SchemaJsonLd
        data={productSchema({
          name: `${material.name} etiket ve sticker baskı`,
          description: material.description,
          category:
            material.productType === "etiket" ? "Print/Labels" : "Print/Stickers",
          priceFrom: material.productType === "etiket" ? 500 : 200,
        })}
      />
      <SchemaJsonLd
        data={breadcrumbSchema([
          { label: "Anasayfa", url: "/" },
          { label: "Malzemeler", url: "/malzemeler" },
          { label: material.name, url: materialDetailPath(slug) },
        ])}
      />

      <div className="mx-auto max-w-[800px] px-6">
        <nav className="flex items-center gap-2 text-[13px] text-gri-700 mb-6 flex-wrap">
          <Link href="/" className="hover:text-pim-mercan">
            Anasayfa
          </Link>
          <Icon.ChevR size={14} className="text-gri-500 shrink-0" />
          <Link href="/malzemeler" className="hover:text-pim-mercan">
            Malzemeler
          </Link>
          <Icon.ChevR size={14} className="text-gri-500 shrink-0" />
          <span className="font-semibold text-lacivert">{material.name}</span>
        </nav>

        {material.swatchSurface && (
          <MaterialSwatch
            surface={material.swatchSurface}
            className="w-full aspect-[2/1] mb-6 rounded-xl"
            rounded="xl"
            label={material.name}
          />
        )}

        <Eyebrow>
          {material.productType === "etiket" ? "Etiket malzemesi" : "Sticker malzemesi"}
        </Eyebrow>
        <h1 className="mt-3 text-[28px] md:text-[40px] font-semibold tracking-tight">
          {material.name} etiket & sticker baskı
        </h1>
        <p className="mt-4 text-base text-gri-700 leading-relaxed">
          {material.description}
        </p>

        <section className="mt-8 rounded-xl bg-white p-5 ring-1 ring-gri-200">
          <h2 className="text-[18px] font-semibold text-lacivert mb-3">
            Kullanım alanları
          </h2>
          <p className="text-[15px] text-gri-700 leading-relaxed">{material.use}</p>
        </section>

        <section className="mt-4 rounded-xl bg-white p-5 ring-1 ring-gri-200">
          <h2 className="text-[18px] font-semibold text-lacivert mb-3">
            Kime uygun?
          </h2>
          <p className="text-[15px] text-gri-700 leading-relaxed">
            {material.suitableFor}
          </p>
        </section>

        <dl className="mt-4 grid grid-cols-1 gap-3 text-[14px]">
          <div className="rounded-xl bg-white p-4 ring-1 ring-gri-200">
            <dt className="font-semibold text-gri-700">Yüzey</dt>
            <dd className="text-lacivert mt-1 leading-relaxed">{material.surface}</dd>
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-gri-200">
            <dt className="font-semibold text-gri-700">Dayanım</dt>
            <dd className="text-lacivert mt-1 leading-relaxed">{material.durability}</dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="primary" size="lg" href={configHref}>
            {configLabel}
          </Button>
          <Button variant="secondary" size="lg" href="/malzemeler">
            Tüm malzemeler
          </Button>
        </div>

        <section className="mt-12">
          <h2 className="text-[22px] font-semibold tracking-tight mb-4">
            Sık sorulan sorular
          </h2>
          <div className="space-y-3">
            {material.faqs.map((f) => (
              <details
                key={f.q}
                className="rounded-xl bg-white p-4 ring-1 ring-gri-200 group"
              >
                <summary className="font-semibold text-[15px] text-lacivert cursor-pointer list-none flex justify-between gap-2">
                  {f.q}
                  <Icon.ChevR
                    size={18}
                    className="text-gri-500 shrink-0 rotate-90 group-open:-rotate-90 transition-transform"
                  />
                </summary>
                <p className="mt-3 text-[14px] text-gri-700 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <p className="mt-8 text-[13px] text-gri-700">
          Diğer malzeme seçenekleri için{" "}
          <Link
            href="/malzemeler"
            className="text-pim-mercan font-semibold hover:underline"
          >
            malzemeler sayfasına
          </Link>{" "}
          göz atın veya{" "}
          <Link
            href="/iletisim"
            className="text-pim-mercan font-semibold hover:underline"
          >
            bize yazın
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
