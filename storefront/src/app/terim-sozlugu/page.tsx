import Link from "next/link";
import { TERIMLER, type Terim } from "@/lib/terimler";

const CATEGORY_ORDER = [
  "Kesim & Üretim",
  "Malzeme",
  "Kaplama & Sonlandırma",
  "Baskı & Dosya",
  "Form & Sarım",
  "Ölçü & Ticari",
] as const;

const CATEGORY_SLUG: Record<(typeof CATEGORY_ORDER)[number], string> = {
  "Kesim & Üretim": "kesim-uretim",
  Malzeme: "malzeme",
  "Kaplama & Sonlandırma": "kaplama-sonlandirma",
  "Baskı & Dosya": "baski-dosya",
  "Form & Sarım": "form-sarim",
  "Ölçü & Ticari": "olcu-ticari",
};

function groupByCategory(): { kategori: (typeof CATEGORY_ORDER)[number]; items: Terim[] }[] {
  const byCat = new Map<string, Terim[]>();
  for (const item of TERIMLER) {
    const list = byCat.get(item.kategori) ?? [];
    list.push(item);
    byCat.set(item.kategori, list);
  }

  return CATEGORY_ORDER.map((kategori) => ({
    kategori,
    items: (byCat.get(kategori) ?? []).sort((a, b) =>
      a.terim.localeCompare(b.terim, "tr-TR")
    ),
  })).filter((section) => section.items.length > 0);
}

export default function TerimSozluguPage() {
  const sections = groupByCategory();

  return (
    <main className="min-h-screen bg-gri-50 pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-4">
        <header className="mb-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gri-700 mb-3">
            Sözlük
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-lacivert tracking-tight">
            Terim Sözlüğü
          </h1>
          <p className="mt-3 text-[15px] text-gri-700 max-w-2xl mx-auto leading-relaxed">
            Etiket ve sticker dünyasında kullandığımız terimler ve ne anlama
            geldikleri.
          </p>
        </header>

        <nav
          aria-label="Kategoriye göre atlama"
          className="mb-10 flex flex-wrap justify-center gap-2"
        >
          {sections.map(({ kategori }) => (
            <Link
              key={kategori}
              href={`#kat-${CATEGORY_SLUG[kategori]}`}
              className="inline-flex shrink-0 items-center rounded-full border border-gri-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-lacivert hover:border-pim-mercan hover:text-pim-mercan transition-colors"
            >
              {kategori}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-12">
          {sections.map(({ kategori, items }) => (
            <section
              key={kategori}
              id={`kat-${CATEGORY_SLUG[kategori]}`}
              className="scroll-mt-28"
            >
              <h2 className="text-xl md:text-2xl font-bold text-lacivert mb-4">
                {kategori}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {items.map((item) => (
                  <article
                    key={item.terim}
                    className="flex flex-col h-full bg-white border border-gri-200 rounded-2xl p-4 hover:shadow-md transition-shadow"
                  >
                    <div>
                      <h3 className="text-[15px] font-semibold text-lacivert leading-snug">
                        {item.terim}
                      </h3>
                      {item.ingilizce ? (
                        <p className="text-[12px] text-gri-500 mt-0.5">
                          {item.ingilizce}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-[13px] text-gri-700 leading-relaxed mt-2 flex-1">
                      {item.aciklama}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
