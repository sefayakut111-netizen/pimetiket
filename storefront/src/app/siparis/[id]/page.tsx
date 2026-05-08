/**
 * Pim Etiket — /siparis/[id] (E.2.2)
 *
 * Sipariş detayı dynamic route. Statü timeline + dosya yükleme +
 * prova onay + ürün özeti + adres + ödeme + kargo takip.
 *
 * Mock data — gerçek bağlantı I adımında.
 */

"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Pim, PimMini } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, StageDot } from "@/components/ui";
import { cn } from "@/lib/cn";

const PHASES = [
  { id: "konfigure", label: "Konfigüre" },
  { id: "odeme", label: "Ödendi" },
  { id: "dosya", label: "Dosya yüklendi" },
  { id: "ai", label: "AI kontrol" },
  { id: "operator", label: "Operatör onayı" },
  { id: "prova", label: "Prova bekleniyor" },
  { id: "uretim", label: "Üretimde" },
  { id: "kargo", label: "Kargoda" },
  { id: "teslim", label: "Teslim edildi" },
] as const;

// Mock — gerçek API I adımında
const ORDER = {
  id: "PE-2026-1182",
  title: "Olea Doğal Sabun — etiket",
  date: "5 Mayıs 2026",
  status: "Prova bekleniyor",
  phase: 5, // index in PHASES
  qty: 2000,
  unit: 2.13,
  total: 4250,
  delivery: "15 Mayıs 2026",
  config: {
    Malzeme: "Kraft kâğıt",
    Kaplama: "Mat selefon",
    Özelleştirme: "Sıcak yaldız (altın)",
    "Sarım yönü": "Sarım 1 (dışa)",
    Ölçü: "60 × 80 mm",
    Adet: "2.000 adet",
  },
  files: [
    { name: "Olea_v3.pdf", size: "2.4 MB", at: "5 May 14:32" },
  ],
  shipping: {
    addressName: "Ahmet Yılmaz",
    address: "[Sefa not: gerçek müşteri adresi]",
    phone: "+90 5XX XXX XX XX",
  },
  payment: {
    method: "Kredi kartı",
    masked: "**** **** **** 4242",
    invoiceType: "Bireysel (e-arşiv)",
  },
};

export default function SiparisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [proofApproved, setProofApproved] = useState(false);

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[14px] mb-5">
          <Link
            href="/panelim"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert"
          >
            Panelim
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <Link
            href="/siparislerim"
            className="px-2 py-1 rounded text-gri-700 hover:bg-gri-100 hover:text-lacivert"
          >
            Siparişlerim
          </Link>
          <Icon.ChevR size={14} className="text-gri-500" />
          <span className="font-semibold">{id}</span>
        </div>

        {/* Header */}
        <div className="flex items-end justify-between gap-6 mb-7 flex-wrap">
          <div>
            <Eyebrow>Sipariş</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight leading-tight">
              {ORDER.title}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-[13px] text-gri-700 flex-wrap">
              <span className="font-semibold uppercase tracking-[0.04em]">
                {id}
              </span>
              <span>·</span>
              <span>Sipariş tarihi: {ORDER.date}</span>
              <span>·</span>
              <span>
                Tahmini teslim:{" "}
                <strong className="text-lacivert">{ORDER.delivery}</strong>
              </span>
            </div>
          </div>
          <Button variant="secondary" href="/etiket">
            <Icon.Bolt size={14} /> Tekrar sipariş
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
          {/* MAIN */}
          <div className="flex flex-col gap-6">
            {/* Vertical timeline */}
            <Card padding="p-6">
              <h2 className="text-xl font-semibold mb-5">Sipariş yolculuğu</h2>
              <ol className="flex flex-col gap-0">
                {PHASES.map((p, i) => {
                  const state =
                    i < ORDER.phase ? "done" : i === ORDER.phase ? "curr" : "todo";
                  return (
                    <li
                      key={p.id}
                      className="flex gap-4 relative pb-5 last:pb-0"
                    >
                      {/* Vertical line */}
                      {i < PHASES.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute left-[13px] top-8 bottom-0 w-0.5"
                          style={{
                            background:
                              i < ORDER.phase
                                ? "var(--color-yesil)"
                                : "var(--color-gri-200)",
                          }}
                        />
                      )}
                      <StageDot
                        state={state}
                        label={state === "curr" ? i + 1 : i + 1}
                      />
                      <div className="flex-1 pt-0.5">
                        <div
                          className={cn(
                            "font-semibold text-[15px]",
                            state === "todo" && "text-gri-500"
                          )}
                        >
                          {p.label}
                        </div>
                        {state === "curr" && (
                          <div className="text-[13px] text-gri-700 mt-0.5">
                            Sıradaki adım — Pim sana ne yapacağını söylüyor.
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            {/* Proof card — current phase'e göre */}
            {ORDER.phase === 5 && !proofApproved && (
              <div className="rounded-2xl p-6 bg-gradient-to-br from-pim-mercan-tint to-krem-soft ring-1 ring-pim-mercan-soft">
                <div className="flex gap-4 items-start">
                  <PimMini pose="inspect" size={56} />
                  <div className="flex-1">
                    <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-pim-mercan">
                      Aksiyon gerekli
                    </div>
                    <h3 className="font-semibold text-xl mt-1.5">
                      Provanı incele ve onayla
                    </h3>
                    <p className="text-base text-gri-700 mt-2 leading-relaxed">
                      AI ön kontrolünden geçti, operatörümüz baktı —
                      tasarımının matbaa öncesi nasıl görüneceğini hazırladık.
                      Onayladığında üretime giriyor.
                    </p>
                    <div className="mt-4 flex gap-2 flex-wrap">
                      <Button
                        variant="primary"
                        onClick={() => setProofApproved(true)}
                      >
                        <Icon.Check size={14} /> Provayı onayla
                      </Button>
                      <Button variant="secondary">Değişiklik iste</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {proofApproved && (
              <div className="rounded-2xl p-6 bg-yesil-soft ring-1 ring-yesil/30 flex gap-4 items-center">
                <div className="grid place-items-center w-12 h-12 rounded-full bg-yesil text-white shrink-0">
                  <Icon.Check size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base">
                    Prova onayın alındı 🎉
                  </h3>
                  <p className="text-[13px] text-gri-700 mt-0.5">
                    Sipariş üretime gönderildi. Yaklaşık 5 gün içinde kargoya
                    verilir.
                  </p>
                </div>
              </div>
            )}

            {/* File upload card */}
            <Card padding="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Yüklenen dosyalar</h2>
                <Button variant="ghost" size="sm">
                  <Icon.Plus size={14} /> Yeni dosya
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                {ORDER.files.map((f) => (
                  <div
                    key={f.name}
                    className="flex items-center gap-4 p-4 rounded-lg bg-gri-50 ring-1 ring-gri-200"
                  >
                    <div className="grid place-items-center w-12 h-12 rounded-lg bg-pim-mercan-tint text-pim-mercan shrink-0">
                      <Icon.Box size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[15px] truncate">
                        {f.name}
                      </div>
                      <div className="text-[13px] text-gri-700 mt-0.5">
                        {f.size} · Yüklenme: {f.at}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full bg-yesil-soft text-yesil text-[12px] font-semibold">
                      <Icon.Check size={11} /> AI kontrol geçti
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* SIDE — özet bilgileri */}
          <div className="flex flex-col gap-4">
            {/* Order summary */}
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-4">Sipariş özeti</h3>
              <dl className="flex flex-col gap-2.5 text-[13px]">
                {Object.entries(ORDER.config).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-3 py-2 border-b border-gri-100 last:border-0"
                  >
                    <dt className="text-gri-700">{k}</dt>
                    <dd className="font-semibold text-right">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 pt-4 border-t-2 border-lacivert flex justify-between items-baseline">
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700">
                  TOPLAM
                </span>
                <span className="text-2xl font-bold">
                  {ORDER.total.toLocaleString("tr-TR")}{" "}
                  <span className="text-base text-gri-700">TL</span>
                </span>
              </div>
              <div className="text-[11.5px] text-gri-700 text-right mt-1">
                Birim: {ORDER.unit.toFixed(2).replace(".", ",")} TL · KDV dahil
              </div>
            </Card>

            {/* Shipping */}
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                <Icon.Truck size={16} /> Teslimat
              </h3>
              <div className="text-[13px] text-gri-700 space-y-1.5 leading-relaxed">
                <div className="font-semibold text-lacivert">
                  {ORDER.shipping.addressName}
                </div>
                <div>{ORDER.shipping.address}</div>
                <div>{ORDER.shipping.phone}</div>
              </div>
            </Card>

            {/* Payment */}
            <Card padding="p-6">
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                <Icon.Wallet size={16} /> Ödeme
              </h3>
              <div className="text-[13px] text-gri-700 space-y-1.5 leading-relaxed">
                <div>{ORDER.payment.method}</div>
                <div className="font-mono">{ORDER.payment.masked}</div>
                <div className="text-[11.5px] text-gri-500 mt-2">
                  Fatura: {ORDER.payment.invoiceType}
                </div>
              </div>
            </Card>

            {/* Pim help */}
            <Card padding="p-5" className="!bg-krem">
              <div className="flex gap-3 items-center">
                <Pim pose="chat" size={64} bob={false} />
                <div>
                  <div className="font-bold text-sm">Pim&rsquo;e sor</div>
                  <div className="text-[11.5px] text-gri-700 mt-0.5">
                    Bu sipariş hakkında soru?
                  </div>
                  <button className="text-[12.5px] font-semibold text-pim-mercan mt-2 hover:underline">
                    Sohbeti aç →
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
