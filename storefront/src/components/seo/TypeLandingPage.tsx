import Link from "next/link";
import { Eyebrow, Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import {
  SchemaJsonLd,
  faqSchema,
  breadcrumbSchema,
  productSchema,
} from "@/components/SchemaJsonLd";
import type { TypeLanding } from "@/lib/seo/type-landings";

interface Props {
  landing: TypeLanding;
  hubLabel: string;
  hubHref: string;
}

export function TypeLandingPage({ landing, hubLabel, hubHref }: Props) {
  const path =
    landing.productType === "etiket"
      ? `/etiket/${landing.slug}`
      : `/sticker/${landing.slug}`;
  const configUrl = landing.configQuery
    ? `${landing.configHref}?${landing.configQuery}`
    : landing.configHref;

  return (
    <main className="bg-gri-50 animate-fade-up py-8 pb-20">
      <SchemaJsonLd data={faqSchema(landing.faqs)} />
      <SchemaJsonLd
        data={breadcrumbSchema([
          { label: "Anasayfa", url: "/" },
          { label: hubLabel, url: hubHref },
          { label: landing.name, url: path },
        ])}
      />
      <SchemaJsonLd
        data={productSchema({
          name: landing.h1,
          description: landing.description,
          category:
            landing.productType === "etiket" ? "Print/Labels" : "Print/Stickers",
          priceFrom: landing.productType === "etiket" ? 350 : 200,
          url: path,
        })}
      />

      <div className="mx-auto max-w-[800px] px-6">
        <nav className="flex items-center gap-2 text-[13px] text-gri-700 mb-6 flex-wrap">
          <Link href="/" className="hover:text-pim-mercan">
            Anasayfa
          </Link>
          <Icon.ChevR size={14} className="text-gri-500 shrink-0" />
          <Link href={hubHref} className="hover:text-pim-mercan">
            {hubLabel}
          </Link>
          <Icon.ChevR size={14} className="text-gri-500 shrink-0" />
          <span className="font-semibold text-lacivert">{landing.name}</span>
        </nav>

        <Eyebrow>{hubLabel}</Eyebrow>
        <h1 className="mt-2 text-[32px] md:text-[40px] font-semibold tracking-tight leading-tight">
          {landing.h1}
        </h1>
        <p className="mt-4 text-base text-gri-700 leading-relaxed">{landing.intro}</p>

        <ul className="mt-6 space-y-2 text-[15px] text-gri-800 list-disc pl-5">
          {landing.useCases.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="primary" size="lg" href={configUrl}>
            Fiyat al ve yapılandır
          </Button>
          <Button variant="ghost" size="lg" href={hubHref}>
            Tüm {hubLabel.toLowerCase()} seçenekleri
          </Button>
          <Button variant="ghost" size="lg" href="/malzemeler">
            Malzemeler
          </Button>
        </div>

        <section className="mt-12">
          <h2 className="text-xl font-semibold mb-4">Sık sorulan sorular</h2>
          <div className="space-y-4">
            {landing.faqs.map((faq) => (
              <div key={faq.q} className="rounded-xl bg-white p-5 shadow-1">
                <h3 className="font-semibold text-lacivert">{faq.q}</h3>
                <p className="mt-2 text-[15px] text-gri-700 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-10 text-[14px] text-gri-600">
          <Link href="/blog" className="text-pim-mercan font-medium hover:underline">
            Blog rehberleri
          </Link>
          {" · "}
          <Link href="/sss" className="text-pim-mercan font-medium hover:underline">
            SSS
          </Link>
        </p>
      </div>
    </main>
  );
}
