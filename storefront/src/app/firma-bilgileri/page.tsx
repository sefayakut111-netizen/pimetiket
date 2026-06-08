"use client";

import { Card, Eyebrow } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import { PIM_LEGAL_ENTITY } from "@/lib/pim/site-facts";

const COPY = {
  tr: {
    eyebrow: "Kurumsal",
    h1: "Firma Bilgileri",
    intro: "Pim Etiket'in yasal satıcı bilgileri aşağıdadır.",
    labelCompany: "Ticaret ünvanı",
    labelAddress: "Adres",
    labelTax: "Vergi Dairesi / VKN",
    brandNote: "Müşteri yüzünde «Pim Etiket» markası kullanılır.",
  },
  en: {
    eyebrow: "Corporate",
    h1: "Company Information",
    intro: "Legal seller details for Pim Etiket are listed below.",
    labelCompany: "Legal company name",
    labelAddress: "Address",
    labelTax: "Tax office / ID",
    brandNote: "The customer-facing brand name is «Pim Etiket».",
  },
};

function taxOfficeShort(taxOffice: string): string {
  return taxOffice.replace(/\s+Vergi Dairesi$/i, "");
}

export default function FirmaBilgileriPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;
  const entity = PIM_LEGAL_ENTITY;

  const rows = [
    { label: c.labelCompany, value: entity.companyName },
    { label: c.labelAddress, value: entity.address },
    {
      label: c.labelTax,
      value: `${taxOfficeShort(entity.taxOffice)} · ${entity.vkn}`,
    },
  ];

  return (
    <main className="animate-fade-up">
      <section className="pt-10 md:pt-16 pb-12 md:pb-16">
        <div className="mx-auto max-w-[720px] px-4 md:px-8">
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className="mt-4 text-[32px] md:text-[44px] font-semibold tracking-[-0.02em] leading-[1.08]">
            {c.h1}
          </h1>
          <p className="mt-5 text-[15px] md:text-base text-gri-700 leading-relaxed">
            {c.intro}
          </p>

          <Card padding="p-6 md:p-8" className="mt-8 md:mt-10">
            <dl className="space-y-6">
              {rows.map((row) => (
                <div key={row.label}>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-pim-mercan mb-1.5">
                    {row.label}
                  </dt>
                  <dd className="text-[15px] md:text-base text-lacivert leading-relaxed">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 pt-6 border-t border-gri-100 text-[13.5px] text-gri-700 leading-relaxed">
              {c.brandNote}
            </p>
          </Card>
        </div>
      </section>
    </main>
  );
}
