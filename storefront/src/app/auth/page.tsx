/**
 * Pim Etiket — /auth (E.2.1)
 *
 * Giriş + Kayıt — tek sayfa, tab pattern (useState).
 * Mock auth: form submit'te alert + redirect /panelim'e (gerçek auth I adımında).
 *
 * NOT: Google OAuth, email doğrulama, password reset gerçek akışları F+I
 * adımlarında. Şu an sadece UI taslağı.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Input, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/cn";

type Mode = "login" | "register";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [acceptKvkk, setAcceptKvkk] = useState(false);
  const [acceptSatis, setAcceptSatis] = useState(false);
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";
  const canSubmit = isLogin
    ? email.length > 3 && password.length >= 8
    : email.length > 3 &&
      password.length >= 8 &&
      name.length >= 2 &&
      acceptKvkk &&
      acceptSatis;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    // Mock — gerçek auth I adımında
    setTimeout(() => {
      setLoading(false);
      router.push("/panelim");
    }, 600);
  };

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-12">
      <div className="mx-auto max-w-[440px] px-6">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-block">
            <Pim pose={isLogin ? "wave" : "happy"} size={120} />
          </div>
          <Eyebrow>{isLogin ? "Tekrar hoş geldin" : "Aramıza katıl"}</Eyebrow>
          <h1 className="mt-3 text-[28px] font-semibold tracking-tight leading-tight">
            {isLogin
              ? "Hesabına giriş yap"
              : "5 dakikada hesap oluştur"}
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-1 ring-1 ring-black/[0.04] p-7">
          {/* Tab switch */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-gri-100 mb-6">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={cn(
                "h-9 rounded-full text-sm font-semibold transition-colors",
                isLogin
                  ? "bg-white text-lacivert shadow-1"
                  : "text-gri-700 hover:text-lacivert"
              )}
            >
              Giriş
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={cn(
                "h-9 rounded-full text-sm font-semibold transition-colors",
                !isLogin
                  ? "bg-white text-lacivert shadow-1"
                  : "text-gri-700 hover:text-lacivert"
              )}
            >
              Kayıt
            </button>
          </div>

          {/* Google placeholder */}
          <button
            type="button"
            disabled
            className="w-full h-11 rounded-full ring-1 ring-gri-200 bg-white text-sm font-semibold flex items-center justify-center gap-2 mb-3 hover:bg-gri-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Yakında — F adımı"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
              />
            </svg>
            Google ile {isLogin ? "giriş" : "kayıt"} (yakında)
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <span className="flex-1 h-px bg-gri-200" />
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-500">
              veya email ile
            </span>
            <span className="flex-1 h-px bg-gri-200" />
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
            {!isLogin && (
              <label className="block">
                <span className="text-[13px] font-semibold mb-1.5 block">
                  Ad Soyad
                </span>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sefa Yakut"
                  autoComplete="name"
                  required
                />
              </label>
            )}

            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block">
                E-posta
              </span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="merhaba@pimetiket.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block flex justify-between items-baseline">
                <span>Şifre</span>
                {isLogin && (
                  <Link
                    href="/sifre-sifirla"
                    className="text-[12.5px] font-semibold text-pim-mercan hover:underline"
                  >
                    Şifremi unuttum
                  </Link>
                )}
              </span>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="En az 8 karakter"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Şifreyi gizle" : "Şifreyi göster"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded text-gri-500 hover:text-lacivert hover:bg-gri-100"
                >
                  {showPw ? "🙈" : "👁️"}
                </button>
              </div>
            </label>

            {!isLogin && (
              <div className="space-y-2 mt-1">
                <label className="flex items-start gap-2.5 text-[13px] text-gri-700 leading-relaxed cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptKvkk}
                    onChange={(e) => setAcceptKvkk(e.target.checked)}
                    className="mt-1 accent-pim-mercan shrink-0"
                  />
                  <span>
                    <Link
                      href="/kvkk"
                      className="text-pim-mercan font-semibold hover:underline"
                    >
                      KVKK Aydınlatma Metni
                    </Link>
                    ,{" "}
                    <Link
                      href="/gizlilik"
                      className="text-pim-mercan font-semibold hover:underline"
                    >
                      Gizlilik Politikası
                    </Link>{" "}
                    ve{" "}
                    <Link
                      href="/cerez"
                      className="text-pim-mercan font-semibold hover:underline"
                    >
                      Çerez Politikası
                    </Link>
                    &rsquo;nı okudum, kabul ediyorum.
                  </span>
                </label>
                <label className="flex items-start gap-2.5 text-[13px] text-gri-700 leading-relaxed cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptSatis}
                    onChange={(e) => setAcceptSatis(e.target.checked)}
                    className="mt-1 accent-pim-mercan shrink-0"
                  />
                  <span>
                    <Link
                      href="/mesafeli-satis"
                      className="text-pim-mercan font-semibold hover:underline"
                    >
                      Mesafeli Satış Sözleşmesi
                    </Link>{" "}
                    ve{" "}
                    <Link
                      href="/sartlar"
                      className="text-pim-mercan font-semibold hover:underline"
                    >
                      Kullanım Şartları
                    </Link>
                    &rsquo;nı okudum, kabul ediyorum.
                  </span>
                </label>
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              block
              type="submit"
              disabled={!canSubmit || loading}
              className="mt-3"
            >
              {loading
                ? "Bekle..."
                : isLogin
                  ? "Giriş yap"
                  : "Hesabımı oluştur"}{" "}
              {!loading && <Icon.ArrowR />}
            </Button>
          </form>

          {/* Mode switch */}
          <div className="mt-5 text-center text-[13px] text-gri-700">
            {isLogin ? "Hesabın yok mu?" : "Zaten üye misin?"}{" "}
            <button
              type="button"
              onClick={() => setMode(isLogin ? "register" : "login")}
              className="text-pim-mercan font-semibold hover:underline"
            >
              {isLogin ? "Kayıt ol" : "Giriş yap"}
            </button>
          </div>
        </div>

        {/* Footnote */}
        <p className="text-[12.5px] text-gri-500 text-center mt-6 leading-relaxed">
          Pim Etiket olarak verilerini özenle koruyoruz. Detaylar{" "}
          <Link
            href="/gizlilik"
            className="text-pim-mercan font-semibold hover:underline"
          >
            Gizlilik Politikası
          </Link>
          &rsquo;nda.
        </p>
      </div>
    </main>
  );
}
