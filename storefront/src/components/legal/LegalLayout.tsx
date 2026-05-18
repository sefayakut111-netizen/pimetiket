/**
 * LegalLayout — yasal sayfaların ortak şablonu.
 * 2-col layout: ana içerik + sticky aside (diğer yasal sayfalar nav).
 *
 * Her yasal sayfa <LegalLayout title="..." lastUpdated="..." currentPath="...">
 * ile sarar. children = içerik (h2, p, ul, strong gibi semantik HTML).
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";

const LEGAL_LINKS = [
  { href: "/on-bilgilendirme", label: "Ön Bilgilendirme Formu" },
  { href: "/mesafeli-satis", label: "Mesafeli Satış Sözleşmesi" },
  { href: "/cayma-hakki", label: "Cayma Hakkı" },
  { href: "/iade-degisim-politikasi", label: "İade & Değişim Politikası" },
  { href: "/kvkk", label: "KVKK Aydınlatma Metni" },
  { href: "/gizlilik", label: "Gizlilik Politikası" },
  { href: "/cerez", label: "Çerez Politikası" },
  { href: "/sartlar", label: "Kullanım Şartları" },
];

interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  currentPath: string;
  children: ReactNode;
}

export function LegalLayout({
  title,
  lastUpdated,
  currentPath,
  children,
}: LegalLayoutProps) {
  return (
    <main className="animate-fade-up py-12 bg-white">
      <div className="mx-auto max-w-[1100px] px-8 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-10 items-start">
        <article>
          <Eyebrow>Yasal</Eyebrow>
          <h1 className="mt-4 text-[28px] md:text-[36px] font-semibold tracking-tight leading-tight">
            {title}
          </h1>
          <p className="text-[13px] text-gri-500 mt-2 mb-8">
            Son güncelleme: {lastUpdated}
          </p>

          <div className="legal-prose">{children}</div>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-20 bg-gri-50 rounded-lg p-5 ring-1 ring-gri-200">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-3">
              Yasal sayfalar
            </div>
            <nav className="flex flex-col gap-1">
              {LEGAL_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "text-[13px] py-2 px-2.5 rounded transition-colors",
                    l.href === currentPath
                      ? "bg-lacivert text-white font-semibold"
                      : "text-gri-700 hover:bg-gri-100 hover:text-lacivert"
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>
      </div>
    </main>
  );
}
