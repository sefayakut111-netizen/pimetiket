/**
 * Pim Etiket — Geçici landing (D.2)
 *
 * Bu sayfa, tasarım sistemi token'larının (mercan, krem, lacivert,
 * Nunito font, custom shadow ve animation) düzgün yüklendiğini
 * görsel olarak doğrulamak için yazıldı. Gerçek anasayfa E.1
 * adımında design-prototype/v1-jsx/home.jsx'den taşınacak.
 */

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white animate-fade-up">
      <div className="text-center px-6 max-w-2xl">
        {/* Wordmark */}
        <div className="inline-flex items-center gap-3 mb-10">
          <span className="w-7 h-7 rounded-md bg-pim-mercan -rotate-6 shadow-mercan inline-block" />
          <span className="text-xl font-bold tracking-tight">Pim Etiket</span>
        </div>

        {/* Hero */}
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
            className="h-[52px] px-7 rounded-full bg-pim-mercan text-white font-semibold text-base shadow-mercan hover:bg-pim-mercan-koyu hover:-translate-y-0.5 transition-all duration-150"
          >
            Etiket bastır
          </button>
          <button
            type="button"
            className="h-[52px] px-7 rounded-full bg-white text-lacivert font-semibold text-base ring-[1.5px] ring-lacivert hover:bg-lacivert hover:text-white hover:-translate-y-0.5 transition-all duration-150"
          >
            Sticker bastır
          </button>
        </div>

        {/* Design system marker */}
        <div className="mt-20 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-pim-mercan">
          <span className="w-5 h-0.5 bg-current rounded" />
          D.2 — Tasarım sistemi yüklü
        </div>
        <p className="mt-2 text-xs text-gri-500">
          Mercan #FF6B5B · Krem #F5EBD9 · Lacivert #1F2937 · Nunito 400-800
        </p>

        {/* Token preview swatches */}
        <div className="mt-12 flex justify-center gap-2 flex-wrap">
          {[
            ["pim-mercan", "Mercan"],
            ["pim-mercan-soft", "Mercan soft"],
            ["pim-mercan-tint", "Mercan tint"],
            ["krem", "Krem"],
            ["lacivert", "Lacivert"],
            ["turuncu", "Turuncu"],
            ["yesil", "Yeşil"],
            ["sari", "Sarı"],
          ].map(([token, name]) => (
            <div
              key={token}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gri-50 ring-1 ring-gri-200"
            >
              <span
                className="w-3 h-3 rounded-full ring-1 ring-black/10"
                style={{ background: `var(--color-${token})` }}
              />
              <span className="text-xs font-medium text-gri-700">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
