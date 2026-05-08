/**
 * Pim Etiket — /fatura-bilgileri (E.2.4)
 *
 * Bireysel/Kurumsal fatura bilgileri. Mock.
 */

"use client";

import { useState } from "react";
import { Button, Card, Input, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/Icon";

type InvoiceType = "individual" | "corporate";

export default function FaturaBilgileriPage() {
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
          <Eyebrow>Hesabım</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Fatura bilgileri
          </h1>
          <p className="mt-2 text-base text-gri-700">
            Sipariş ödendiğinde otomatik olarak fatura kesilir. Tercihini
            buradan yönetebilirsin.
          </p>
        </div>

        <Card padding="p-6" className="mb-4">
          <h2 className="text-xl font-semibold mb-1">Fatura tipi</h2>
          <p className="text-[13px] text-gri-700 mb-5">
            Bireysel kullanım için TC kimlik, kurumsal için VKN.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {(["individual", "corporate"] as InvoiceType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className={cn(
                  "p-4 rounded-lg ring-[1.5px] text-left transition-all",
                  type === t
                    ? "ring-pim-mercan bg-pim-mercan-tint/40"
                    : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
                )}
              >
                <div className="font-semibold text-base mb-0.5">
                  {t === "individual" ? "Bireysel" : "Kurumsal"}
                </div>
                <div className="text-[13px] text-gri-700">
                  {t === "individual"
                    ? "Şahıs olarak alışveriş"
                    : "Şirket adına alışveriş"}
                </div>
              </button>
            ))}
          </div>

          {type === "individual" ? (
            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block">
                TC Kimlik No
              </span>
              <Input
                value={tc}
                onChange={(e) => setTc(e.target.value)}
                placeholder="11 hane (örn: 12345678901)"
                maxLength={11}
                inputMode="numeric"
              />
              <span className="text-[12px] text-gri-700 mt-1.5 block">
                E-arşiv fatura otomatik olarak e-postana gönderilir.
              </span>
            </label>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="text-[13px] font-semibold mb-1.5 block">
                  Şirket ünvanı
                </span>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Tam yasal ünvan"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    VKN
                  </span>
                  <Input
                    value={vkn}
                    onChange={(e) => setVkn(e.target.value)}
                    placeholder="10 hane"
                    maxLength={10}
                    inputMode="numeric"
                  />
                </label>
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    Vergi dairesi
                  </span>
                  <Input
                    value={taxOffice}
                    onChange={(e) => setTaxOffice(e.target.value)}
                    placeholder="Örn: Yıldırım VD"
                  />
                </label>
              </div>

              <div>
                <span className="text-[13px] font-semibold mb-1.5 block">
                  Fatura türü
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "earchive", label: "E-arşiv (mükellef değilim)" },
                      { id: "einvoice", label: "E-fatura (mükellefim)" },
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
                  E-fatura mükellefiysen GİB sistemine otomatik düşer; değilsen
                  e-arşiv olarak e-postana gönderilir.
                </span>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button variant="primary">Kaydet</Button>
          </div>
        </Card>

        {/* Info card */}
        <Card padding="p-5" className="!bg-krem">
          <div className="flex gap-3">
            <Icon.Info size={20} className="text-lacivert shrink-0 mt-0.5" />
            <div className="text-[13px] text-gri-700 leading-relaxed">
              <strong className="text-lacivert">İpucu:</strong> Fatura
              bilgileri her siparişte otomatik dolar; istersen sipariş
              esnasında değiştirebilirsin. Önceki siparişlerin faturaları
              değişmez.
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
