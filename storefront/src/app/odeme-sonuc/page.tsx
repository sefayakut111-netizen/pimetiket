/**
 * Pim Etiket — /odeme-sonuc (E.2.3)
 *
 * Ödeme sonrası dönüş sayfası: ?status=success|fail&order=PE-XXX
 */

"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card } from "@/components/ui";

export default function OdemeSonucPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-64px)]" />}>
      <OdemeSonucInner />
    </Suspense>
  );
}

function OdemeSonucInner() {
  const sp = useSearchParams();
  const status = sp.get("status") ?? "success";
  const orderId = sp.get("order") ?? "PE-2026-XXXX";

  if (status === "fail") {
    return (
      <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <Pim pose="sad" size={160} />
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Ödeme alınamadı
          </h1>
          <p className="mt-3 text-base text-gri-700 leading-relaxed">
            Bankadan onay gelmedi. Kart bilgilerini kontrol edip tekrar
            denemen gerekiyor. Tutar hesabından çekilmedi.
          </p>
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <Button variant="primary" size="lg" href="/odeme">
              Tekrar dene
            </Button>
            <Button variant="secondary" size="lg" href="/iletisim">
              <Icon.ChatBubble size={16} /> Bize yaz
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
      <div className="mx-auto max-w-[680px] px-6 text-center">
        <Pim pose="excited" size={180} />

        <span className="inline-flex items-center gap-1.5 mt-4 h-[26px] px-3 rounded-full bg-yesil-soft text-yesil text-[12.5px] font-semibold">
          <Icon.Check size={12} /> Ödeme başarılı
        </span>

        <h1 className="mt-4 text-[32px] md:text-[44px] font-semibold tracking-tight leading-[1.1]">
          Sipariş alındı! 🎉
        </h1>
        <p className="mt-4 text-lg text-gri-700 leading-relaxed">
          Sipariş numaran:{" "}
          <strong className="text-lacivert font-mono">{orderId}</strong>
          <br />
          Onay e-postası kayıtlı adresine gitti.
        </p>

        <Card padding="p-7" className="text-left mt-8">
          <h3 className="font-semibold text-lg mb-4 text-center">
            Sırada ne var?
          </h3>
          <ol className="space-y-4">
            <li className="flex gap-3.5 items-start">
              <span className="grid place-items-center w-7 h-7 rounded-full bg-pim-mercan text-white font-bold text-[13px] shrink-0">
                1
              </span>
              <div>
                <div className="font-semibold text-base">
                  Tasarım dosyanı yükle (3 gün içinde)
                </div>
                <p className="text-[13px] text-gri-700 mt-0.5 leading-relaxed">
                  Sipariş detayı sayfasından PDF/AI/EPS dosyanı yükle. AI ön
                  kontrolü saniyeler içinde yapılır.
                </p>
              </div>
            </li>
            <li className="flex gap-3.5 items-start">
              <span className="grid place-items-center w-7 h-7 rounded-full bg-gri-200 text-gri-500 font-bold text-[13px] shrink-0">
                2
              </span>
              <div>
                <div className="font-semibold text-base">Provanı incele</div>
                <p className="text-[13px] text-gri-700 mt-0.5 leading-relaxed">
                  Operatör manuel kontrolünden sonra prova göndereceğiz.
                  Onayladıktan sonra üretime girer.
                </p>
              </div>
            </li>
            <li className="flex gap-3.5 items-start">
              <span className="grid place-items-center w-7 h-7 rounded-full bg-gri-200 text-gri-500 font-bold text-[13px] shrink-0">
                3
              </span>
              <div>
                <div className="font-semibold text-base">
                  Bursa&rsquo;dan kapına
                </div>
                <p className="text-[13px] text-gri-700 mt-0.5 leading-relaxed">
                  Ortalama 8-10 gün içinde elinde. Kargo takip linkini
                  e-posta + SMS ile gönderirim.
                </p>
              </div>
            </li>
          </ol>
        </Card>

        <div className="mt-8 flex gap-3 justify-center flex-wrap">
          <Button variant="primary" size="lg" href={`/siparis/${orderId}`}>
            <Icon.Box size={16} /> Sipariş detayı
          </Button>
          <Button variant="secondary" size="lg" href="/panelim">
            Panele git
          </Button>
        </div>

        <p className="mt-8 text-[13px] text-gri-500 leading-relaxed">
          Soru olursa{" "}
          <a
            href="/iletisim"
            className="text-pim-mercan font-semibold hover:underline"
          >
            bize yaz
          </a>{" "}
          veya sağ alt köşedeki Pim&rsquo;e sor.
        </p>
      </div>
    </main>
  );
}
