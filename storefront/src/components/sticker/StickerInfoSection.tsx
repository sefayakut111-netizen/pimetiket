export function StickerInfoSection() {
  return (
    <>
      {/* SEFA: başlık + özet + 4 görsel/metin. İçerik+görseller verilecek. */}
      <section className="mt-16 border-t border-gri-200 pt-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-lacivert">
            [Sefa başlık]
          </h2>
          <p className="mt-3 text-gri-700 max-w-2xl mx-auto leading-relaxed">
            [Sefa metin]
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex flex-col">
              <div className="aspect-[4/3] rounded-xl bg-gri-100 flex items-center justify-center text-gri-500 text-sm mb-3">
                Görsel
              </div>
              <h3 className="font-semibold text-lacivert text-sm">Alan {n}</h3>
              <p className="text-[13px] text-gri-700 mt-1 leading-relaxed line-clamp-2">
                [İçerik — Sefa]
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
