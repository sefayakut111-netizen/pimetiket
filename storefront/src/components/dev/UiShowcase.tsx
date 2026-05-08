"use client";

/**
 * UI Showcase — D.4 doğrulama componenti.
 * UI primitive'lerini görsel olarak sergiler.
 * E.1 sayfaları yazılırken silinecek (dev-only).
 */

import { useState } from "react";
import {
  Button,
  Pill,
  Input,
  Eyebrow,
  StageDot,
  FormSection,
  SelectableCard,
  QtySlider,
  PriceCard,
} from "@/components/ui";
import { Icon } from "@/components/Icon";

const MATERIALS = [
  { id: "kraft", name: "Kraft", desc: "Doğal, dokunsal" },
  { id: "beyaz", name: "Beyaz semi-glos", desc: "Klasik, parlak" },
  { id: "ultra", name: "Ultra clear", desc: "Şeffaf cam etkisi" },
  { id: "metalik", name: "Metalik", desc: "Folyo gümüş" },
];

export function UiShowcase() {
  const [material, setMaterial] = useState("kraft");
  const [qty, setQty] = useState(2000);
  const [emailValue, setEmailValue] = useState("");

  return (
    <div className="text-left space-y-12 mt-16">
      {/* Buttons */}
      <section>
        <Eyebrow>Buton</Eyebrow>
        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <Button variant="primary" size="sm">
            Primary sm
          </Button>
          <Button variant="primary" size="md">
            Primary md
          </Button>
          <Button variant="primary" size="lg">
            Primary lg <Icon.ArrowR />
          </Button>
          <Button variant="secondary">
            <Icon.Sticker size={16} /> Secondary
          </Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </section>

      {/* Pills */}
      <section>
        <Eyebrow>Pill — 6 variant</Eyebrow>
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill variant="mercan">
            <Icon.Sparkle size={14} /> AI kontrol
          </Pill>
          <Pill variant="yesil">%10 indirim</Pill>
          <Pill variant="sari">Üretimde</Pill>
          <Pill variant="gri">3 gün kaldı</Pill>
          <Pill variant="lacivert">Popüler</Pill>
          <Pill variant="krem">1000+ adetten</Pill>
        </div>
      </section>

      {/* Input */}
      <section className="max-w-sm">
        <Eyebrow>Input</Eyebrow>
        <Input
          type="email"
          placeholder="Email adresin"
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
          className="mt-3"
        />
      </section>

      {/* StageDot */}
      <section>
        <Eyebrow>Stage Dot — sipariş timeline</Eyebrow>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-2">
            <StageDot state="done" />
            <span className="text-[13px] text-gri-700">Tamamlandı</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <StageDot state="curr" label={3} />
            <span className="text-[13px] text-gri-700">Şu an</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <StageDot state="todo" label={4} />
            <span className="text-[13px] text-gri-700">Bekliyor</span>
          </span>
        </div>
      </section>

      {/* SelectableCard */}
      <section>
        <Eyebrow>Selectable Card</Eyebrow>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {MATERIALS.map((m) => (
            <SelectableCard
              key={m.id}
              selected={material === m.id}
              onClick={() => setMaterial(m.id)}
              padding={14}
            >
              <div className="font-semibold text-sm">{m.name}</div>
              <div className="text-[13px] text-gri-700 mt-0.5">{m.desc}</div>
            </SelectableCard>
          ))}
        </div>
      </section>

      {/* FormSection */}
      <section>
        <Eyebrow>Form Section</Eyebrow>
        <div className="mt-4 space-y-3">
          <FormSection
            number={1}
            title="Numaralı (etiket akışı)"
            hint="Etiketin dokusunu ve hissini belirler."
          >
            <p className="text-[13px] text-gri-700">Step içeriği burada.</p>
          </FormSection>
          <FormSection title="Numarasız (sticker akışı)">
            <p className="text-[13px] text-gri-700">Section içeriği burada.</p>
          </FormSection>
        </div>
      </section>

      {/* QtySlider */}
      <section className="max-w-md">
        <Eyebrow>Qty Slider</Eyebrow>
        <div className="mt-4">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[13px] font-semibold">Adet</span>
            <span className="text-xl font-bold">
              {qty.toLocaleString("tr-TR")}{" "}
              <span className="text-[13px] font-normal text-gri-700">adet</span>
            </span>
          </div>
          <QtySlider
            value={qty}
            min={1000}
            max={50000}
            step={1000}
            onChange={setQty}
          />
        </div>
      </section>

      {/* PriceCard */}
      <section>
        <Eyebrow>Price Card — 2 variant</Eyebrow>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <PriceCard
            variant="quiet"
            topLabel="TOPLAM"
            total={4250}
            unitPrice={
              <>
                Birim fiyat{" "}
                <strong className="text-lacivert">2,13 TL/adet</strong> · KDV
                dahil
              </>
            }
            savingsLabel="%4 adet indirimi"
            upsell={{
              msg: "+1000 adet ekle, %6 daha tasarruf",
              onClick: () => setQty(qty + 1000),
            }}
            deliveryDate="22 Mayıs 2026"
            ctaLabel="Sepete ekle"
            footnote="3 gün içinde dosya yüklemen yeterli"
          />
          <PriceCard
            variant="bold"
            topLabel="SEÇİMİN"
            total={1050}
            unitPrice="250 adet × 4,20 TL · KDV dahil"
            savingsLabel="%40 tasarruf"
            deliveryDate="22 Mayıs 2026"
            ctaLabel="Sepete ekle"
          />
        </div>
      </section>
    </div>
  );
}
