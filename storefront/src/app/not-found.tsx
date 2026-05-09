/**
 * Pim Etiket — 404 not found
 *
 * Next.js App Router not-found.tsx — bilinmeyen route'larda otomatik
 * gösterilir. Pim "şaşırmış" hâlinde, üst navigasyona yönlendirme.
 */

"use client";

import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Eyebrow } from "@/components/ui";
import { useT } from "@/lib/i18n/context";

export default function NotFoundPage() {
  const { t, locale } = useT();
  const isEn = locale === "en";

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12 flex items-center">
      <div className="mx-auto max-w-[560px] px-6 text-center">
        {/* Pim think + büyük 404 */}
        <div className="relative inline-block mb-2">
          <Pim pose="think" size={160} />
          <span
            aria-hidden
            className="absolute -bottom-2 -right-4 inline-flex items-center justify-center w-14 h-14 rounded-full bg-pim-mercan text-white font-bold text-xl ring-4 ring-white shadow-mercan"
          >
            ?
          </span>
        </div>

        <Eyebrow>404</Eyebrow>
        <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight leading-tight">
          {isEn
            ? "Pim couldn't find this page"
            : "Pim bu sayfayı bulamadı"}
        </h1>
        <p className="mt-3 text-base text-gri-700 leading-relaxed max-w-[440px] mx-auto">
          {isEn
            ? "The link might be broken, or the page might have moved. Let me show you around."
            : "Link bozuk olabilir ya da sayfa taşınmış. Sana yolu göstereyim."}
        </p>

        <div className="mt-7 flex gap-3 justify-center flex-wrap">
          <Button variant="primary" size="lg" href="/">
            <Icon.Home size={16} /> {t.nav.home}
          </Button>
          <Button variant="secondary" size="lg" href="/etiket">
            <Icon.Roll size={16} /> {t.nav.etiket}
          </Button>
          <Button variant="secondary" size="lg" href="/sticker">
            <Icon.Sticker size={16} /> {t.nav.sticker}
          </Button>
        </div>

        <div className="mt-10 pt-8 border-t border-gri-200">
          <p className="text-[13px] text-gri-700 leading-relaxed">
            {isEn
              ? "Need help? Pim is in the bottom-right corner of every page, or "
              : "Yardım gerekirse Pim sağ alt köşede bekliyor, ya da "}
            <Link
              href="/iletisim"
              className="text-pim-mercan font-semibold hover:underline"
            >
              {isEn ? "contact us" : "bize yaz"}
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
