/**
 * /admin/fiyat-hesapla-tabaka — Tabaka etiket fiyat hesap (placeholder)
 *
 * Sefa 17 May v5: 3 profil arasında geçiş — tabaka için ayrı modül.
 * Şu an "Yakında" placeholder. Aşama 3'te tam modül eklenir (rulo etiketin
 * adapte edilmiş hali: rolls yerine sheets, küçük tabaka 23×31 cm).
 *
 * Şu anda fiyat YÖNETIMI (parametre kaydet) zaten /admin/fiyatlar →
 * Tabaka Etiket tab'ında mevcut.
 */

"use client";

import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Card, Eyebrow, Button } from "@/components/ui";
import { ProfileTabs } from "@/components/admin/pricing/ProfileTabs";

export default function TabakaPlaceholderPage() {
  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-56px)] py-8 pb-20">
      <div className="mx-auto max-w-[800px] px-4 md:px-8">
        <ProfileTabs active="tabaka" />

        <div className="mb-6">
          <Eyebrow>Operatör · Hesaplama aracı</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            📄 Tabaka Etiket Fiyat Hesapla
          </h1>
          <p className="mt-2 text-base text-gri-700">
            Tabaka etiket (kraft/kuşe/beyaz) · 23×31 cm tabaka · min 250 adet.
          </p>
        </div>

        <Card padding="p-12" className="text-center">
          <Pim pose="think" size={140} />
          <h2 className="mt-4 text-[22px] font-semibold tracking-tight">
            Yakında
          </h2>
          <p className="mt-3 text-[14px] text-gri-700 leading-relaxed max-w-[440px] mx-auto">
            Tabaka etiket için manuel hesap modülü hazırlanıyor (rulo
            modülünden adapte ediliyor: rulo sayısı yerine tabaka sayısı,
            küçük zarf 24×32 cm, gap 6 mm).
          </p>

          <div className="mt-6 inline-flex flex-col gap-2 text-[12.5px] text-gri-700 max-w-[420px] mx-auto">
            <div className="rounded-lg bg-pim-mercan-tint/40 ring-1 ring-pim-mercan-soft p-3 text-left">
              <strong className="text-lacivert">Şu an alternatif:</strong>
              <br />
              <Link
                href="/admin/fiyatlar"
                className="text-pim-mercan font-semibold hover:underline"
              >
                /admin/fiyatlar
              </Link>{" "}
              → "📄 Tabaka Etiket" sekmesinden parametreleri görüp, sağ
              paneldeki "Canlı önizleme"den her boyut+adet için fiyat
              hesaplayabilirsin.
            </div>
          </div>

          <div className="mt-6 flex gap-2 justify-center flex-wrap">
            <Button variant="primary" href="/admin/fiyatlar">
              📄 Fiyat Yönetimine git
            </Button>
            <Button variant="ghost" href="/admin/fiyat-hesapla-etiket">
              📋 Rulo Etiket Hesap
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
