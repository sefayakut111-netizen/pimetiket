/**
 * Pim Etiket — Geçici landing (D.3)
 *
 * Pim mascot (TypeScript), 9 pose preview, Icon library — hepsi
 * canlı tokens üzerinden render oluyor. Gerçek anasayfa E.1
 * adımında design-prototype'tan taşınacak.
 */

import { Pim, type PimPose } from "@/components/Pim";
import { Icon } from "@/components/Icon";

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
    <main className="min-h-screen flex items-center justify-center bg-white animate-fade-up py-16">
      <div className="text-center px-6 max-w-3xl">
        {/* Hero — Pim + Wordmark */}
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

        {/* CTA */}
        <div className="mt-10 flex gap-3 justify-center flex-wrap">
          <button
            type="button"
            className="h-[52px] px-7 rounded-full bg-pim-mercan text-white font-semibold text-base shadow-mercan hover:bg-pim-mercan-koyu hover:-translate-y-0.5 transition-all duration-150 inline-flex items-center gap-2"
          >
            <Icon.Roll size={18} />
            Etiket bastır
          </button>
          <button
            type="button"
            className="h-[52px] px-7 rounded-full bg-white text-lacivert font-semibold text-base ring-[1.5px] ring-lacivert hover:bg-lacivert hover:text-white hover:-translate-y-0.5 transition-all duration-150 inline-flex items-center gap-2"
          >
            <Icon.Sticker size={18} />
            Sticker bastır
          </button>
        </div>

        {/* D.3 marker */}
        <div className="mt-20 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-pim-mercan">
          <span className="w-5 h-0.5 bg-current rounded" />
          D.3 — Pim mascot &amp; Icon lib yüklü
        </div>

        {/* 9-pose preview */}
        <section className="mt-10">
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

        {/* Icon library preview */}
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

        <p className="mt-12 text-xs text-gri-500">
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
