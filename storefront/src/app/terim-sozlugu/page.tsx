import Link from "next/link";
import { TERIMLER } from "@/lib/terimler";
import { cn } from "@/lib/cn";

const TURKISH_ALPHABET = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ".split("");

function firstLetter(text: string): string {
  return text.trim().charAt(0).toLocaleUpperCase("tr-TR");
}

export default function TerimSozluguPage() {
  const usedLetters = new Set(TERIMLER.map((t) => firstLetter(t.terim)));

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
          aria-label="Alfabeye göre atlama"
          className="mb-8 flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin"
        >
          {TURKISH_ALPHABET.map((letter) => {
            const active = usedLetters.has(letter);
            return active ? (
              <Link
                key={letter}
                href={`#harf-${letter}`}
                className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-gri-200 bg-white px-2 text-[13px] font-semibold text-lacivert hover:border-pim-mercan hover:text-pim-mercan transition-colors"
              >
                {letter}
              </Link>
            ) : (
              <span
                key={letter}
                className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg px-2 text-[13px] font-semibold text-gri-300"
                aria-hidden
              >
                {letter}
              </span>
            );
          })}
        </nav>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TERIMLER.map((item, idx) => {
            const letter = firstLetter(item.terim);
            const prevLetter =
              idx > 0 ? firstLetter(TERIMLER[idx - 1].terim) : null;
            const isFirstOfLetter = letter !== prevLetter;

            return (
              <article
                key={item.terim}
                id={isFirstOfLetter ? `harf-${letter}` : undefined}
                className={cn(
                  "flex flex-col h-full bg-white border border-gri-200 rounded-2xl p-4",
                  "hover:shadow-md transition-shadow scroll-mt-28"
                )}
              >
                <div>
                  <h2 className="text-[15px] font-semibold text-lacivert leading-snug">
                    {item.terim}
                  </h2>
                  {item.ingilizce ? (
                    <p className="text-[12px] text-gri-500 mt-0.5">{item.ingilizce}</p>
                  ) : null}
                </div>
                <p className="text-[13px] text-gri-700 leading-relaxed mt-2 flex-1">
                  {item.aciklama}
                </p>
                <span
                  className="mt-auto pt-3 inline-flex self-start rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ backgroundColor: "#FFF1EE", color: "#FF6B5B" }}
                >
                  {item.kategori}
                </span>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
