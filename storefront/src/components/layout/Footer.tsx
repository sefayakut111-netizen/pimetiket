import Link from "next/link";
import { PimAsset } from "@/components/PimAsset";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterGroup {
  t: string;
  links: FooterLink[];
}

// "todo" → henüz mevcut sayfa yok. Boş hash yerine /iletisim'e yönlendiriliyor
// (en yakın anlamlı hedef). E.1.x sonrası uygun sayfalar açılınca href güncellenir.
const FOOTER_GROUPS: FooterGroup[] = [
  {
    t: "Ürün",
    links: [
      { label: "Etiket", href: "/etiket" },
      { label: "Sticker", href: "/sticker" },
      { label: "Malzemeler", href: "/etiket" }, // todo: /malzemeler
      { label: "Yaldız galerisi", href: "/etiket" }, // todo: /yaldiz-galerisi
    ],
  },
  {
    t: "Şirket",
    links: [
      { label: "Hakkımızda", href: "/hakkimizda" },
      { label: "Üretim ortakları", href: "/hakkimizda" }, // todo: /uretim-ortaklari
      { label: "Kariyer", href: "/iletisim" }, // todo: /kariyer
      { label: "Basın", href: "/iletisim" }, // todo: /basin
    ],
  },
  {
    t: "Destek",
    links: [
      { label: "SSS", href: "/sss" },
      { label: "Kargo", href: "/sss" }, // todo: /kargo-teslim
      { label: "İade", href: "/cayma-hakki" },
      { label: "Sözleşmeler", href: "/mesafeli-satis" },
    ],
  },
  {
    t: "İletişim",
    links: [
      { label: "WhatsApp", href: "/iletisim" },
      { label: "Mail", href: "/iletisim" },
      { label: "Bursa atölyesi", href: "/iletisim#harita" },
      { label: "Pim'le konuş", href: "/iletisim" },
    ],
  },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: "KVKK", href: "/kvkk" },
  { label: "Gizlilik", href: "/gizlilik" },
  { label: "Kullanım", href: "/sartlar" },
  { label: "Çerez", href: "/cerez" },
  { label: "Mesafeli Satış", href: "/mesafeli-satis" },
  { label: "Cayma Hakkı", href: "/cayma-hakki" },
];

export function Footer() {
  return (
    <footer className="bg-lacivert text-white/85 pt-16 pb-8 mt-20">
      <div className="mx-auto max-w-[1280px] px-8">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-8 mb-12">
          {/* Brand column */}
          <div>
            <Link
              href="/"
              className="mb-4 -ml-2 inline-block bg-white rounded-xl px-3 py-2"
              aria-label="Pim Etiket — Anasayfa"
            >
              <PimAsset variant="logo" size={220} bob={false} />
            </Link>
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
                  <Link
                    key={l.label}
                    href={l.href}
                    className="text-[13px] text-white/85 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom strip */}
        <div className="pt-6 border-t border-white/10 flex justify-between items-center text-[13px] text-white/55">
          <div>© {new Date().getFullYear()} Pim Etiket — Bursa</div>
          <div className="flex gap-5 flex-wrap">
            {LEGAL_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="hover:text-white transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
