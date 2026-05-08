const FOOTER_GROUPS = [
  { t: "Ürün", links: ["Etiket", "Sticker", "Malzemeler", "Yaldız galerisi"] },
  { t: "Şirket", links: ["Hakkımızda", "Üretim ortakları", "Kariyer", "Basın"] },
  { t: "Destek", links: ["SSS", "Kargo", "İade", "Sözleşmeler"] },
  { t: "İletişim", links: ["WhatsApp", "Mail", "Bursa atölyesi", "Pim'le konuş"] },
];

const LEGAL_LINKS = ["KVKK", "Gizlilik", "Kullanım", "Çerez"];

export function Footer() {
  return (
    <footer className="bg-lacivert text-white/85 pt-16 pb-8 mt-20">
      <div className="mx-auto max-w-[1280px] px-8">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-8 mb-12">
          {/* Brand column */}
          <div>
            <div className="inline-flex items-center gap-2 font-bold text-[19px] tracking-tight mb-4 text-white">
              <span
                aria-hidden
                className="w-[22px] h-[22px] rounded-md bg-pim-mercan -rotate-6 shadow-mercan inline-block"
              />
              Pim Etiket
            </div>
            <p className="text-[13px] max-w-[280px] text-white/65 leading-relaxed">
              Türkiye&rsquo;nin akıllı dijital baskı atölyesi. Bursa&rsquo;dan,
              küçük markalar için.
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_GROUPS.map((g) => (
            <div key={g.t}>
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] mb-3.5 text-white/50">
                {g.t}
              </div>
              <div className="flex flex-col gap-2.5">
                {g.links.map((l) => (
                  <a
                    key={l}
                    href="#"
                    className="text-[13px] text-white/85 hover:text-white transition-colors"
                  >
                    {l}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom strip */}
        <div className="pt-6 border-t border-white/10 flex justify-between items-center text-[13px] text-white/55">
          <div>© {new Date().getFullYear()} Pim Etiket — Bursa</div>
          <div className="flex gap-5">
            {LEGAL_LINKS.map((l) => (
              <a key={l} href="#" className="hover:text-white transition-colors">
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
