/**
 * Pim Etiket — /sifre-sifirla (deprecated)
 *
 * UX audit P0-4: Pim Etiket passwordless (magic link) auth kullanıyor.
 * "Şifre sıfırla" akışı kullanıcı için anlamsız ve karışıklık yaratıyor.
 *
 * Bu sayfa /auth'a yönlendirir. Eski sayfa içeriği (Supabase password
 * reset flow) git history'de duruyor — gerçek password auth gelirse geri
 * çağrılabilir.
 *
 * Supabase recovery flow query param (?code=... veya ?token=...) ile
 * gelinmesi durumu için yine de bilgi mesajı.
 */

"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Button, Eyebrow } from "@/components/ui";
import { Icon } from "@/components/Icon";

export default function SifreSifirlaPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-64px)]" />}>
      <SifreSifirlaInner />
    </Suspense>
  );
}

function SifreSifirlaInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRecoveryToken =
    Boolean(searchParams.get("code")) || Boolean(searchParams.get("token"));

  useEffect(() => {
    if (hasRecoveryToken) return; // recovery flow varsa kullanıcıya bilgi göster
    // Otomatik 4 sn sonra /auth'a yönlendir
    const t = setTimeout(() => router.push("/auth"), 4000);
    return () => clearTimeout(t);
  }, [hasRecoveryToken, router]);

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-16">
      <div className="mx-auto max-w-[480px] px-6 text-center">
        <Pim pose="think" size={140} />
        <Eyebrow>Şifre Yok</Eyebrow>
        <h1 className="mt-3 text-[28px] md:text-[32px] font-semibold tracking-tight leading-tight">
          Şifren olmadığı için sıfırlanacak bir şey yok.
        </h1>
        <p className="mt-4 text-[14px] md:text-[15px] text-gri-700 leading-relaxed">
          Pim Etiket&rsquo;te <strong>parolasız giriş</strong> kullanıyoruz —
          her seferinde e-postana giriş bağlantısı yolluyoruz. Bu yüzden
          unutulacak bir şifre yok.
        </p>

        {hasRecoveryToken && (
          <div className="mt-5 p-4 rounded-lg bg-sari-soft text-[#7A560A] text-[13px] leading-relaxed">
            <strong>Not:</strong> Eski bir e-postadan gelen kurtarma linkini
            tıkladıysan, hesabına giriş için sadece e-postanı /auth&rsquo;a yaz —
            yeni bir giriş bağlantısı yollarız.
          </div>
        )}

        <div className="mt-7 flex gap-3 justify-center flex-wrap">
          <Button variant="primary" size="lg" href="/auth">
            <Icon.ArrowR size={16} /> Giriş sayfasına git
          </Button>
          <Button variant="secondary" size="lg" href="/iletisim">
            Sorun var, yardım al
          </Button>
        </div>

        {!hasRecoveryToken && (
          <p className="mt-6 text-[12px] text-gri-500">
            Otomatik olarak{" "}
            <Link href="/auth" className="text-pim-mercan font-semibold underline underline-offset-2 decoration-1">
              giriş sayfasına
            </Link>{" "}
            yönlendiriliyorsun…
          </p>
        )}
      </div>
    </main>
  );
}
