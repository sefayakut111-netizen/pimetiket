/**
 * Pim Etiket — /odeme (E.2.3 Checkout)
 *
 * 3-step checkout: Adres → Fatura → Ödeme.
 * Mock — gerçek 3DS akış H adımında (iyzico/ParamPOS).
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Input, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";

const SAVED_ADDRESSES = [
  {
    id: "a1",
    label: "Atölye",
    name: "Ahmet Yılmaz",
    addr: "Yıldırım Mh. 15. Cd. No:3 D:2",
    city: "Bursa / Yıldırım",
    phone: "+90 5XX XXX XX XX",
  },
  {
    id: "a2",
    label: "Ev",
    name: "Ahmet Yılmaz",
    addr: "Çekirge Cd. No:42 D:7",
    city: "Bursa / Osmangazi",
    phone: "+90 5XX XXX XX XX",
  },
];

type Step = 1 | 2 | 3;
type InvoiceType = "individual" | "corporate";

export default function OdemePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [addressId, setAddressId] = useState("a1");
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("individual");
  const [tc, setTc] = useState("");
  const [vkn, setVkn] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  const [card, setCard] = useState({ no: "", name: "", exp: "", cvv: "" });
  const [acceptSatis, setAcceptSatis] = useState(false);
  const [loading, setLoading] = useState(false);

  const total = 5300; // mock subtotal + shipping
  const fmt = (n: number) => n.toLocaleString("tr-TR");

  const goNext = () => setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  const goPrev = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  const submit = () => {
    setLoading(true);
    setTimeout(() => {
      router.push("/odeme-sonuc?status=success&order=PE-2026-1183");
    }, 1500);
  };

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-8">
        <div className="mb-7">
          <Eyebrow>Ödeme</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Siparişini tamamla
          </h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8 max-w-[600px] mx-auto">
          {[
            { n: 1, label: "Adres" },
            { n: 2, label: "Fatura" },
            { n: 3, label: "Ödeme" },
          ].map((s, i, arr) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <span
                  className={cn(
                    "grid place-items-center w-9 h-9 rounded-full font-bold text-sm shrink-0",
                    step === s.n
                      ? "bg-pim-mercan text-white shadow-mercan"
                      : step > s.n
                        ? "bg-yesil text-white"
                        : "bg-gri-200 text-gri-500"
                  )}
                >
                  {step > s.n ? <Icon.Check size={14} /> : s.n}
                </span>
                <span
                  className={cn(
                    "text-[12.5px] font-semibold",
                    step === s.n ? "text-lacivert" : "text-gri-500"
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div className="flex-1 h-0.5 -mt-5">
                  <div
                    className={cn(
                      "h-full transition-colors",
                      step > s.n ? "bg-yesil" : "bg-gri-200"
                    )}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
          {/* MAIN CONTENT */}
          <div>
            {step === 1 && (
              <Card padding="p-6">
                <h2 className="text-xl font-semibold mb-1">Teslimat adresi</h2>
                <p className="text-[13px] text-gri-700 mb-5">
                  Kayıtlı bir adres seç veya yeni adres ekle.
                </p>
                <div className="flex flex-col gap-3">
                  {SAVED_ADDRESSES.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAddressId(a.id)}
                      aria-pressed={addressId === a.id}
                      className={cn(
                        "text-left p-4 rounded-lg ring-[1.5px] transition-all",
                        addressId === a.id
                          ? "ring-pim-mercan bg-pim-mercan-tint/40"
                          : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
                      )}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <div className="font-semibold text-[15px] mb-1 flex items-center gap-2">
                            {a.label}
                            <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-gri-100 text-gri-700 text-[11px] font-semibold">
                              Kayıtlı
                            </span>
                          </div>
                          <div className="text-[13px] text-gri-700 leading-relaxed">
                            {a.name}
                            <br />
                            {a.addr}
                            <br />
                            {a.city} · {a.phone}
                          </div>
                        </div>
                        {addressId === a.id && (
                          <span className="grid place-items-center w-6 h-6 rounded-full bg-pim-mercan text-white shrink-0">
                            <Icon.Check size={12} />
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="text-[13px] font-semibold text-pim-mercan hover:underline self-start mt-1 inline-flex items-center gap-1"
                  >
                    <Icon.Plus size={14} /> Yeni adres ekle
                  </button>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button variant="primary" size="lg" onClick={goNext}>
                    Faturaya geç <Icon.ArrowR />
                  </Button>
                </div>
              </Card>
            )}

            {step === 2 && (
              <Card padding="p-6">
                <h2 className="text-xl font-semibold mb-1">Fatura bilgileri</h2>
                <p className="text-[13px] text-gri-700 mb-5">
                  Bireysel veya kurumsal fatura tercihi.
                </p>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  {(["individual", "corporate"] as InvoiceType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setInvoiceType(t)}
                      aria-pressed={invoiceType === t}
                      className={cn(
                        "p-4 rounded-lg ring-[1.5px] text-left transition-all",
                        invoiceType === t
                          ? "ring-pim-mercan bg-pim-mercan-tint/40"
                          : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
                      )}
                    >
                      <div className="font-semibold text-base capitalize mb-0.5">
                        {t}
                      </div>
                      <div className="text-[13px] text-gri-700">
                        {t === "individual"
                          ? "TC kimlik · e-arşiv fatura"
                          : "VKN · e-fatura veya e-arşiv"}
                      </div>
                    </button>
                  ))}
                </div>

                {invoiceType === "individual" ? (
                  <label className="block">
                    <span className="text-[13px] font-semibold mb-1.5 block">
                      TC Kimlik No
                    </span>
                    <Input
                      value={tc}
                      onChange={(e) => setTc(e.target.value)}
                      placeholder="11 hane"
                      maxLength={11}
                      inputMode="numeric"
                    />
                  </label>
                ) : (
                  <div className="space-y-3.5">
                    <label className="block">
                      <span className="text-[13px] font-semibold mb-1.5 block">
                        Ünvan
                      </span>
                      <Input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Şirket/işletme tam ünvanı"
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
                  </div>
                )}

                <div className="mt-6 flex justify-between gap-3">
                  <Button variant="ghost" onClick={goPrev}>
                    ← Geri
                  </Button>
                  <Button variant="primary" size="lg" onClick={goNext}>
                    Ödemeye geç <Icon.ArrowR />
                  </Button>
                </div>
              </Card>
            )}

            {step === 3 && (
              <Card padding="p-6">
                <h2 className="text-xl font-semibold mb-1">Kart bilgileri</h2>
                <p className="text-[13px] text-gri-700 mb-5 flex items-center gap-2">
                  <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-yesil-soft text-yesil text-[11.5px] font-semibold">
                    🔒 3D Secure
                  </span>
                  Bilgilerin bankan tarafından korunur. Pim Etiket kart numarasını saklamaz.
                </p>

                <label className="block mb-3.5">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    Kart üzerindeki isim
                  </span>
                  <Input
                    value={card.name}
                    onChange={(e) => setCard({ ...card, name: e.target.value })}
                    placeholder="AHMET YILMAZ"
                    autoComplete="cc-name"
                  />
                </label>
                <label className="block mb-3.5">
                  <span className="text-[13px] font-semibold mb-1.5 block">
                    Kart numarası
                  </span>
                  <Input
                    value={card.no}
                    onChange={(e) => setCard({ ...card, no: e.target.value })}
                    placeholder="0000 0000 0000 0000"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    maxLength={19}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <label className="block">
                    <span className="text-[13px] font-semibold mb-1.5 block">
                      Son kullanma
                    </span>
                    <Input
                      value={card.exp}
                      onChange={(e) =>
                        setCard({ ...card, exp: e.target.value })
                      }
                      placeholder="AA/YY"
                      autoComplete="cc-exp"
                      maxLength={5}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-semibold mb-1.5 block">
                      CVV
                    </span>
                    <Input
                      type="password"
                      value={card.cvv}
                      onChange={(e) =>
                        setCard({ ...card, cvv: e.target.value })
                      }
                      placeholder="3 hane"
                      autoComplete="cc-csc"
                      maxLength={4}
                      inputMode="numeric"
                    />
                  </label>
                </div>

                <label className="flex items-start gap-2.5 text-[13px] text-gri-700 leading-relaxed cursor-pointer mb-5">
                  <input
                    type="checkbox"
                    checked={acceptSatis}
                    onChange={(e) => setAcceptSatis(e.target.checked)}
                    className="mt-1 accent-pim-mercan shrink-0"
                  />
                  <span>
                    <Link
                      href="/mesafeli-satis"
                      className="text-pim-mercan font-semibold hover:underline"
                    >
                      Mesafeli Satış Sözleşmesi
                    </Link>
                    &rsquo;ni okudum, kabul ediyorum. Kişiselleştirilmiş ürün
                    olduğu için cayma hakkımın bulunmadığını biliyorum.
                  </span>
                </label>

                <div className="flex justify-between gap-3">
                  <Button variant="ghost" onClick={goPrev}>
                    ← Geri
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={submit}
                    disabled={!acceptSatis || loading}
                  >
                    {loading
                      ? "İşleniyor..."
                      : `${fmt(total)} TL'yi öde`}{" "}
                    {!loading && <Icon.ArrowR />}
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* SIDE — order summary */}
          <div className="lg:sticky lg:top-20">
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
                <Pim pose="happy" size={32} bob={false} />
                Özet
              </h3>
              <div className="space-y-3 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-gri-700">Olea — etiket × 2.000</span>
                  <span className="font-semibold">4.250 TL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gri-700">Holografik sticker × 250</span>
                  <span className="font-semibold">1.050 TL</span>
                </div>
                <div className="flex justify-between border-t border-gri-200 pt-3">
                  <span className="text-gri-700">Ara toplam</span>
                  <span className="font-semibold">5.300 TL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gri-700">Kargo</span>
                  <span className="text-yesil font-semibold">Ücretsiz</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t-2 border-lacivert flex justify-between items-baseline">
                <span className="font-semibold">Toplam</span>
                <span className="text-2xl font-bold">
                  5.300{" "}
                  <span className="text-base font-semibold text-gri-700">
                    TL
                  </span>
                </span>
              </div>
              <div className="text-[11.5px] text-gri-700 text-right">
                KDV dahil
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
