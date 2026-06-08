/**
 * Pim Etiket — /nasil-uretiyoruz
 *
 * Üretim süreci + malzeme kalitesi (güven/dönüşüm).
 * v1: ikon-bazlı; gerçek foto slot'ları Sefa sonra doldurur.
 */

"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow } from "@/components/ui";
import { useT } from "@/lib/i18n/context";

function ProductionPhotoSlot({ label }: { label: string }) {
  return (
    <div
      className="w-full aspect-[16/10] rounded-lg bg-gri-100 ring-1 ring-black/[0.06] flex flex-col items-center justify-center gap-2 text-gri-500"
      aria-hidden
    >
      <Icon.Package size={28} className="opacity-40" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

const COPY = {
  tr: {
    eyebrow: "Kalite nasıl çıkıyor",
    h1: "Kaliteyi tesadüfe bırakmıyoruz",
    intro:
      "Her sticker ve etiket; doğru malzeme, doğru baskı tekniği ve baskı öncesi titiz kontrolle üretilir. Amacımız basit: ekranda gördüğünü elinde de gör.",
    photoSoon: "Foto yakında",
    s1Title: "Sadece Avrupa malzemeleri",
    s1Body:
      "Avery Dennison, Orafol ve Fasson gibi yalnızca Avrupa menşeli malzemeler kullanıyoruz. İşin ne ise ona en uygun malzemeyi seçiyoruz; dayanıklılık ve renk kalitesi bu yüzden tutarlı.",
    s2Title: "Renkler tok ve canlı",
    s2Body:
      "Şeffaf, hologram ve metalize gibi özel zeminlerde renkler soluk kalmasın diye, tasarımının altına önce beyaz bir zemin basıyoruz. Sonuç: örtücü, canlı ve net renkler.",
    s3Title: "Her ürüne uygun baskı tekniği",
    s3Items: [
      "Sticker → Mimaki baskı sistemleri.",
      "Folyo (vinil) & şeffaf etiket → UV baskı: canlı renk, suya ve çizilmeye dayanıklılık.",
      "Kuşe, PP & kraft etiket → lazer baskı: keskin detay, tutarlı renk.",
      "Rulo etiket → dijital baskı (29 Haziran'da açılıyor).",
    ],
    s4Title: "Baskıdan önce AI kontrol + prova",
    s4Body:
      "Dosyanı yapay zeka saniyeler içinde kontrol eder: çözünürlük, renk, kesim payı. Ardından dijital provanı görür, onaylarsın. Sen onaylamadan basmıyoruz.",
    s5Title: "Kontur kesim & son işlem",
    s5Body:
      "Tasarımının şekline göre die-cut kesim, mat/parlak selefon ve laminasyon. Sticker'a karakterini veren ince beyaz kontur burada çıkıyor.",
    s6Title: "Kalite kontrol & özenli paket",
    s6Body:
      "Her işi gözden geçiriyor, özenle paketleyip kargoluyoruz. Bir sorun görürsek basmadan önce sana haber veriyoruz.",
    ctaTitle: "Hadi başlayalım",
    ctaSticker: "Sticker bastır",
    ctaEtiket: "Etiket",
  },
  en: {
    eyebrow: "How quality comes through",
    h1: "We don't leave quality to chance",
    intro:
      "Every sticker and label is produced with the right material, the right print technique, and meticulous pre-press checks. Our goal is simple: what you see on screen is what you hold in your hand.",
    photoSoon: "Photo coming soon",
    s1Title: "European materials only",
    s1Body:
      "We use only European-origin materials such as Avery Dennison, Orafol, and Fasson. We pick the best fit for the job — that's why durability and color quality stay consistent.",
    s2Title: "Bold, vivid colors",
    s2Body:
      "On special substrates like clear, holographic, and metallized, we print a white underbase first so colors don't look washed out. The result: opaque, vivid, crisp color.",
    s3Title: "The right print technique per product",
    s3Items: [
      "Stickers → Mimaki print systems.",
      "Vinyl & clear labels → UV print: vivid color, water and scratch resistance.",
      "Coated, PP & kraft labels → laser print: sharp detail, consistent color.",
      "Roll labels → digital print (opening June 29).",
    ],
    s4Title: "AI check + proof before print",
    s4Body:
      "AI checks your file in seconds: resolution, color, bleed. Then you review the digital proof and approve. We don't print until you say yes.",
    s5Title: "Contour cut & finishing",
    s5Body:
      "Die-cut to your design shape, matte/gloss lamination and finishing. The thin white contour that gives stickers their character comes through here.",
    s6Title: "Quality control & careful packaging",
    s6Body:
      "We inspect every job, pack with care, and ship. If we spot an issue, we reach out before printing.",
    ctaTitle: "Let's get started",
    ctaSticker: "Print stickers",
    ctaEtiket: "Labels",
  },
};

type Section = {
  icon: ReactNode;
  title: string;
  body?: string;
  items?: string[];
  showPhoto?: boolean;
};

export default function NasilUretiyoruzPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;

  const SECTIONS: Section[] = [
    {
      icon: <Icon.Package size={22} />,
      title: c.s1Title,
      body: c.s1Body,
      showPhoto: true,
    },
    {
      icon: <Icon.Sparkle size={22} />,
      title: c.s2Title,
      body: c.s2Body,
    },
    {
      icon: <Icon.Print size={22} />,
      title: c.s3Title,
      items: c.s3Items,
      showPhoto: true,
    },
    {
      icon: <Icon.Shield size={22} />,
      title: c.s4Title,
      body: c.s4Body,
    },
    {
      icon: <Icon.Sticker size={22} />,
      title: c.s5Title,
      body: c.s5Body,
      showPhoto: true,
    },
    {
      icon: <Icon.Check size={22} />,
      title: c.s6Title,
      body: c.s6Body,
    },
  ];

  return (
    <main className="animate-fade-up">
      <section className="relative overflow-hidden pt-10 md:pt-16 pb-14 md:pb-20">
        <div
          aria-hidden
          className="absolute inset-0 -z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(800px 420px at 22% 30%, var(--color-krem) 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[800px] px-4 md:px-8 text-center md:text-left">
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className="mt-5 text-[34px] md:text-[48px] leading-[1.06] font-semibold tracking-[-0.02em] text-lacivert">
            {c.h1}
          </h1>
          <p className="mt-6 text-[15px] md:text-lg text-gri-700 max-w-[640px] leading-relaxed mx-auto md:mx-0">
            {c.intro}
          </p>
        </div>
      </section>

      <section className="pb-16 md:pb-20">
        <div className="mx-auto max-w-[960px] px-4 md:px-8 flex flex-col gap-8">
          {SECTIONS.map((s) => (
            <Card
              key={s.title}
              className="p-6 md:p-8 ring-1 ring-black/[0.04] shadow-1"
            >
              <div
                className={
                  s.showPhoto
                    ? "grid grid-cols-1 md:grid-cols-[1fr_220px] gap-6 md:gap-8 items-start"
                    : ""
                }
              >
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="grid place-items-center w-10 h-10 rounded-full bg-pim-mercan-tint text-pim-mercan-koyu shrink-0">
                      {s.icon}
                    </span>
                    <h2 className="text-[20px] md:text-[24px] font-semibold tracking-tight leading-tight text-lacivert">
                      {s.title}
                    </h2>
                  </div>
                  {s.body ? (
                    <p className="text-[15px] md:text-base text-gri-700 leading-[1.7]">
                      {s.body}
                    </p>
                  ) : null}
                  {s.items ? (
                    <ul className="mt-1 space-y-2 text-[15px] md:text-base text-gri-700 leading-[1.7]">
                      {s.items.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-pim-mercan mt-2.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {s.showPhoto ? (
                  <ProductionPhotoSlot label={c.photoSoon} />
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="py-14 md:py-16 bg-gri-50">
        <div className="mx-auto max-w-[640px] px-4 md:px-8 text-center">
          <h2 className="text-[26px] md:text-[32px] font-semibold tracking-tight text-lacivert">
            {c.ctaTitle}
          </h2>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="primary" href="/sticker">
              {c.ctaSticker}
            </Button>
            <Button variant="secondary" href="/etiket/yapilandir?form=tabaka">
              {c.ctaEtiket}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
