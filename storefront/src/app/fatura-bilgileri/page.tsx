/**
 * Pim Etiket — /fatura-bilgileri (E.2.4)
 *
 * Bireysel/Kurumsal fatura bilgileri. Mock.
 */

"use client";

import { useState } from "react";
import { Button, Card, Input, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n/context";

type InvoiceType = "individual" | "corporate";

const COPY = {
  tr: {
    eyebrow: "Hesabım",
    title: "Fatura bilgileri",
    intro:
      "Sipariş ödendiğinde otomatik olarak fatura kesilir. Tercihini buradan yönetebilirsin.",
    typeTitle: "Fatura tipi",
    typeDesc: "Bireysel kullanım için TC kimlik, kurumsal için VKN.",
    individual: "Bireysel",
    individualDesc: "Şahıs olarak alışveriş",
    corporate: "Kurumsal",
    corporateDesc: "Şirket adına alışveriş",
    tcLabel: "TC Kimlik No",
    tcPh: "11 hane (örn: 12345678901)",
    tcHint: "E-arşiv fatura otomatik olarak e-postana gönderilir.",
    companyName: "Şirket ünvanı",
    companyNamePh: "Tam yasal ünvan",
    vkn: "VKN",
    vknPh: "10 hane",
    taxOffice: "Vergi dairesi",
    taxOfficePh: "Örn: Yıldırım VD",
    invoiceFormat: "Fatura türü",
    earchive: "E-arşiv (mükellef değilim)",
    einvoice: "E-fatura (mükellefim)",
    formatHint:
      "E-fatura mükellefiysen GİB sistemine otomatik düşer; değilsen e-arşiv olarak e-postana gönderilir.",
    save: "Kaydet",
    saved: "Fatura bilgileri kaydedildi (mock)",
    tipTitle: "İpucu:",
    tipDesc:
      "Fatura bilgileri her siparişte otomatik dolar; istersen sipariş esnasında değiştirebilirsin. Önceki siparişlerin faturaları değişmez.",
  },
  en: {
    eyebrow: "My account",
    title: "Invoice info",
    intro:
      "An invoice is generated automatically when an order is paid. Manage your preferences here.",
    typeTitle: "Invoice type",
    typeDesc: "Use TC number for individuals, VKN for businesses.",
    individual: "Individual",
    individualDesc: "Personal shopping",
    corporate: "Corporate",
    corporateDesc: "Shopping under a company",
    tcLabel: "TC ID number",
    tcPh: "11 digits (e.g. 12345678901)",
    tcHint: "An e-archive invoice is automatically emailed to you.",
    companyName: "Company legal name",
    companyNamePh: "Full legal name",
    vkn: "VAT number",
    vknPh: "10 digits",
    taxOffice: "Tax office",
    taxOfficePh: "e.g. Yıldırım VD",
    invoiceFormat: "Invoice format",
    earchive: "E-archive (not VAT-registered)",
    einvoice: "E-invoice (VAT-registered)",
    formatHint:
      "If you're VAT-registered, the e-invoice goes directly to the GIB portal; otherwise an e-archive is emailed to you.",
    save: "Save",
    saved: "Invoice info saved (mock)",
    tipTitle: "Tip:",
    tipDesc:
      "Invoice info auto-fills on every order; you can change it during checkout. Previous orders' invoices stay unchanged.",
  },
};

export default function FaturaBilgileriPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;

  const toast = useToast();
  const [type, setType] = useState<InvoiceType>("individual");
  const [tc, setTc] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [vkn, setVkn] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  const [invoiceFormat, setEFaturaTercih] = useState<"earchive" | "einvoice">(
    "earchive"
  );

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[800px] px-8">
        <div className="mb-7">
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            {c.title}
          </h1>
          <p className="mt-2 text-base text-gri-700">{c.intro}</p>
        </div>

        <Card padding="p-6" className="mb-4">
          <h2 className="text-xl font-semibold mb-1">{c.typeTitle}</h2>
          <p className="text-[13px] text-gri-700 mb-5">{c.typeDesc}</p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {(["individual", "corporate"] as InvoiceType[]).map((it) => (
              <button
                key={it}
                type="button"
                onClick={() => setType(it)}
                aria-pressed={type === it}
                className={cn(
                  "p-4 rounded-lg ring-[1.5px] text-left transition-all",
                  type === it
                    ? "ring-pim-mercan bg-pim-mercan-tint/40"
                    : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
                )}
              >
                <div className="font-semibold text-base mb-0.5">
                  {it === "individual" ? c.individual : c.corporate}
                </div>
                <div className="text-[13px] text-gri-700">
                  {it === "individual" ? c.individualDesc : c.corporateDesc}
                </div>
              </button>
            ))}
          </div>

          {type === "individual" ? (
            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block">
                {c.tcLabel}
              </span>
              <Input
                value={tc}
                onChange={(e) => setTc(e.target.value)}
                placeholder={c.tcPh}
                maxLength={11}
                inputMode="numeric"
              />
              <span className="text-[12px] text-gri-700 mt-1.5 block">
                {c.tcHint}
              </span>
            </label>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="text-[13px] font-semibold mb-1.5 block">
                  {c.companyName}
                </span>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={c.companyNamePh}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    {c.vkn}
                  </span>
                  <Input
                    value={vkn}
                    onChange={(e) => setVkn(e.target.value)}
                    placeholder={c.vknPh}
                    maxLength={10}
                    inputMode="numeric"
                  />
                </label>
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    {c.taxOffice}
                  </span>
                  <Input
                    value={taxOffice}
                    onChange={(e) => setTaxOffice(e.target.value)}
                    placeholder={c.taxOfficePh}
                  />
                </label>
              </div>

              <div>
                <span className="text-[13px] font-semibold mb-1.5 block">
                  {c.invoiceFormat}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "earchive", label: c.earchive },
                      { id: "einvoice", label: c.einvoice },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setEFaturaTercih(opt.id)}
                      aria-pressed={invoiceFormat === opt.id}
                      className={cn(
                        "p-3 rounded-lg ring-1 text-[13px] font-semibold transition-colors",
                        invoiceFormat === opt.id
                          ? "ring-pim-mercan bg-pim-mercan-tint/40 text-lacivert"
                          : "ring-gri-200 bg-white text-gri-700 hover:ring-pim-mercan-soft"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <span className="text-[12px] text-gri-700 mt-2 block leading-relaxed">
                  {c.formatHint}
                </span>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button variant="primary" onClick={() => toast.success(c.saved)}>
              {c.save}
            </Button>
          </div>
        </Card>

        {/* Info card */}
        <Card padding="p-5" className="!bg-krem">
          <div className="flex gap-3">
            <Icon.Info size={20} className="text-lacivert shrink-0 mt-0.5" />
            <div className="text-[13px] text-gri-700 leading-relaxed">
              <strong className="text-lacivert">{c.tipTitle}</strong> {c.tipDesc}
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
