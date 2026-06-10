"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Eyebrow } from "@/components/ui";
import { useT } from "@/lib/i18n/context";

export default function EditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useT();
  const isEn = locale === "en";

  useEffect(() => {
    Sentry.captureException(error, { tags: { route: "editor" } });
    console.error("[editor] Unhandled error:", error);
  }, [error]);

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12 flex items-center">
      <div className="mx-auto max-w-[560px] px-6 text-center">
        <div className="relative inline-block mb-2">
          <Pim pose="sad" size={160} />
        </div>

        <Eyebrow>{isEn ? "Something went wrong" : "Bir şeyler ters gitti"}</Eyebrow>
        <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight leading-tight">
          {isEn ? "Editor hit a snag" : "Editörde bir sorun oluştu"}
        </h1>
        <p className="mt-3 text-base text-gri-700 leading-relaxed max-w-[440px] mx-auto">
          {isEn
            ? "Try again — your design may still be saved. If it persists, contact us with the ref below."
            : "Tekrar dene — tasarımın kaydedilmiş olabilir. Devam ederse ref numarasıyla bize yaz."}
        </p>

        {error.digest && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gri-100 text-gri-700 text-[12px] font-mono">
            <Icon.Info size={12} />
            <span>ref: {error.digest}</span>
          </div>
        )}

        <div className="mt-7 flex gap-3 justify-center flex-wrap">
          <Button variant="primary" size="lg" onClick={reset}>
            <Icon.ArrowR size={14} /> {isEn ? "Try again" : "Tekrar dene"}
          </Button>
          <Button variant="secondary" size="lg" href="/panelim">
            <Icon.Home size={16} /> {isEn ? "My orders" : "Siparişlerim"}
          </Button>
          <Button variant="ghost" size="lg" href="/iletisim">
            <Icon.ChatBubble size={16} /> {isEn ? "Contact" : "Bize yaz"}
          </Button>
        </div>

        <div className="mt-10 pt-8 border-t border-gri-200">
          <p className="text-[13px] text-gri-700 leading-relaxed">
            {isEn ? "Share the ref on " : "Ref'i "}
            <Link
              href="/iletisim"
              className="text-pim-mercan font-semibold hover:underline"
            >
              {isEn ? "the contact page" : "iletişim sayfasında"}
            </Link>
            {isEn ? " if this keeps happening." : " iletirsen hızlı çözeriz."}
          </p>
        </div>
      </div>
    </main>
  );
}
