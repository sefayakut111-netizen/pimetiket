/**
 * Pim Etiket — Global error boundary (App Router)
 *
 * Bu dosya beklenmedik runtime hataları yakalar. Pim "şaşırmış" hâliyle
 * "ay ay" mesajı + tekrar dene + anasayfa CTA + iletişim linki.
 *
 * Production'da Sentry entegrasyonu sırasında error.digest log'lanır.
 */

"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Eyebrow } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry'ye gönder (DSN yoksa no-op)
    Sentry.captureException(error);
    console.error("[Pim Etiket] Unhandled error:", error);
  }, [error]);

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12 flex items-center">
      <div className="mx-auto max-w-[560px] px-6 text-center">
        <div className="relative inline-block mb-2">
          <Pim pose="sad" size={160} />
        </div>

        <Eyebrow>Bir şeyler ters gitti</Eyebrow>
        <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight leading-tight">
          Pim de şaşırdı
        </h1>
        <p className="mt-3 text-base text-gri-700 leading-relaxed max-w-[440px] mx-auto">
          Beklenmedik bir hata oldu. Tekrar denersen büyük olasılıkla
          düzelir. Devam ederse Pim&rsquo;e haber ver — düzeltelim.
        </p>

        {error.digest && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gri-100 text-gri-700 text-[12px] font-mono">
            <Icon.Info size={12} />
            <span>ref: {error.digest}</span>
          </div>
        )}

        <div className="mt-7 flex gap-3 justify-center flex-wrap">
          <Button variant="primary" size="lg" onClick={reset}>
            Tekrar dene
          </Button>
          <Button variant="secondary" size="lg" href="/">
            <Icon.Home size={16} /> Anasayfa
          </Button>
          <Button variant="ghost" size="lg" href="/iletisim">
            <Icon.ChatBubble size={16} /> Bize yaz
          </Button>
        </div>

        {/* Dev-only: error mesajını göster */}
        {process.env.NODE_ENV === "development" && (
          <details className="mt-10 text-left">
            <summary className="text-[12px] text-gri-500 cursor-pointer hover:text-gri-700">
              Dev detay
            </summary>
            <pre className="mt-2 p-4 rounded-lg bg-gri-100 text-[11px] font-mono text-gri-700 overflow-auto whitespace-pre-wrap break-words">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </main>
  );
}
