/**
 * Pim Etiket — Geçici landing (D.5)
 *
 * AppShell layout (TopBar + Footer) + Hero (Pim + wordmark + CTA)
 * + 9-pose preview + Icon lib + UI lib showcase.
 * Gerçek anasayfa E.1 adımında design-prototype'tan taşınacak.
 */

import { Pim, type PimPose } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Eyebrow } from "@/components/ui";
import { UiShowcase } from "@/components/dev/UiShowcase";

const POSES: PimPose[] = [
  "wave",
  "think",
  "wait",
  "inspect",
  "happy",
  "sad",
  "excited",
  "box",
  "chat",
];

const ICON_LIST = Object.entries(Icon) as [
  keyof typeof Icon,
  (typeof Icon)[keyof typeof Icon]
][];

export default function Home() {
  return (
    <main className="bg-white animate-fade-up py-16">
      <div className="mx-auto px-6 max-w-3xl">
        {/* HERO */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Pim pose="wave" size={180} />
          </div>

          <div className="inline-flex items-center gap-3 mb-8">
            <span className="w-7 h-7 rounded-md bg-pim-mercan -rotate-6 shadow-mercan inline-block" />
            <span className="text-xl font-bold tracking-tight">Pim Etiket</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.04]">
            Markanın etiketi,
            <br />
            fikrinin <span className="text-pim-mercan">sticker&rsquo;ı</span>.
          </h1>
          <p className="mt-6 text-lg text-gri-700 max-w-md mx-auto leading-relaxed">
            1000 adetten başlayan, AI destekli dijital baskı.
            <br />
            10 günde elinde.
          </p>

          <div className="mt-10 flex gap-3 justify-center flex-wrap">
            <Button variant="primary" size="lg">
              <Icon.Roll size={18} />
              Etiket bastır
            </Button>
            <Button variant="secondary" size="lg">
              <Icon.Sticker size={18} />
              Sticker bastır
            </Button>
          </div>

          <div className="mt-20">
            <Eyebrow>D.5 — AppShell + UI lib hazır</Eyebrow>
          </div>
        </div>

        {/* 9-POSE GRID */}
        <section className="mt-12">
          <div className="text-xs font-semibold uppercase tracking-wider text-gri-500 mb-4">
            9 Pose API
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 justify-items-center">
            {POSES.map((pose) => (
              <div
                key={pose}
                className="flex flex-col items-center bg-gri-50 ring-1 ring-gri-200 rounded-lg px-3 py-3 w-full"
              >
                <Pim pose={pose} size={64} bob={false} />
                <span className="text-xs font-semibold text-lacivert mt-1">
                  {pose}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ICON GRID */}
        <section className="mt-12">
          <div className="text-xs font-semibold uppercase tracking-wider text-gri-500 mb-4">
            Icon library — {ICON_LIST.length} icon
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-lacivert">
            {ICON_LIST.map(([name, IconComponent]) => (
              <div
                key={name}
                className="flex flex-col items-center gap-1 w-16 py-2 rounded-md bg-gri-50 ring-1 ring-gri-200"
              >
                <IconComponent size={20} />
                <span className="text-[10px] text-gri-700">{name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* UI SHOWCASE — interactive demos */}
        <UiShowcase />

        <p className="mt-16 text-xs text-center text-gri-500">
          Pim Etiket • Bursa •{" "}
          <a
            href="/docs/brand/PIM_MASCOT_BRIEF.md"
            className="text-pim-mercan font-semibold hover:underline"
          >
            Mascot brief
          </a>{" "}
          (mevcut SVG placeholder, brief uyarınca yeniden çizilecek)
        </p>
      </div>
    </main>
  );
}
