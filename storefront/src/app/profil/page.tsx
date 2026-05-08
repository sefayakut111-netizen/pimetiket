/**
 * Pim Etiket — /profil (E.2.4)
 *
 * Ad/email/şifre değiştirme + hesap silme. Mock — gerçek API I adımında.
 */

"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, Input, Eyebrow, useToast } from "@/components/ui";

export default function ProfilPage() {
  const toast = useToast();
  const [name, setName] = useState("Ahmet Yılmaz");
  const [email, setEmail] = useState("ahmet@example.com");
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[800px] px-8">
        <div className="mb-7">
          <Eyebrow>Hesabım</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Profil ayarları
          </h1>
        </div>

        {/* Personal */}
        <Card padding="p-6" className="mb-4">
          <h2 className="text-xl font-semibold mb-1">Kişisel bilgiler</h2>
          <p className="text-[13px] text-gri-700 mb-5">
            Sipariş ve fatura bilgileriyle eşleşmesi önemli.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block">
                Ad Soyad
              </span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block">
                E-posta
              </span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <span className="inline-flex items-center gap-1 mt-1.5 text-[12px] text-yesil font-semibold">
                <Icon.Check size={12} /> Doğrulandı
              </span>
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <Button
              variant="primary"
              onClick={() => toast.success("Bilgiler güncellendi (mock)")}
            >
              Kaydet
            </Button>
          </div>
        </Card>

        {/* Password */}
        <Card padding="p-6" className="mb-4">
          <h2 className="text-xl font-semibold mb-1">Şifre değiştir</h2>
          <p className="text-[13px] text-gri-700 mb-5">
            Güvenlik için 3-6 ayda bir değiştirmeni öneririz.
          </p>
          <div className="space-y-3.5">
            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block">
                Mevcut şifre
              </span>
              <Input
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block">
                Yeni şifre
              </span>
              <Input
                type="password"
                placeholder="En az 8 karakter"
                autoComplete="new-password"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block">
                Yeni şifreyi tekrarla
              </span>
              <Input
                type="password"
                placeholder="Yeniden gir"
                autoComplete="new-password"
              />
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <Button
              variant="primary"
              onClick={() => toast.success("Şifre güncellendi (mock)")}
            >
              Şifreyi güncelle
            </Button>
          </div>
        </Card>

        {/* Notifications */}
        <Card padding="p-6" className="mb-4">
          <h2 className="text-xl font-semibold mb-1">Bildirim tercihleri</h2>
          <p className="text-[13px] text-gri-700 mb-5">
            Hangi durumlarda haber vereyim?
          </p>
          <div className="space-y-3">
            {[
              { id: "order", label: "Sipariş güncellemeleri", default: true, desc: "AI kontrol, prova, kargo" },
              { id: "promo", label: "Kampanya ve indirimler", default: false, desc: "Ayda en fazla 2 e-posta" },
              { id: "product", label: "Yeni özellikler", default: true, desc: "Yeni malzeme/yaldız çıktığında" },
            ].map((t) => (
              <label
                key={t.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gri-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  defaultChecked={t.default}
                  className="mt-1 accent-pim-mercan shrink-0"
                />
                <div className="flex-1">
                  <div className="font-semibold text-[15px]">{t.label}</div>
                  <div className="text-[13px] text-gri-700 mt-0.5">{t.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </Card>

        {/* Danger zone */}
        <Card padding="p-6" className="ring-1 ring-kirmizi/20">
          <h2 className="text-xl font-semibold mb-1 text-kirmizi">
            Tehlikeli alan
          </h2>
          <p className="text-[13px] text-gri-700 mb-5 leading-relaxed">
            Hesabını silersen tüm sipariş geçmişi, kayıtlı tasarımlar ve
            cüzdan bakiyesi <strong>kalıcı olarak silinir</strong>.
            KVKK kapsamında verilerin yasal saklama süresi sonunda yok edilir.
          </p>
          {!showDelete ? (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="text-[13px] font-semibold text-kirmizi hover:underline"
            >
              Hesabımı silmek istiyorum →
            </button>
          ) : (
            <div className="bg-kirmizi/5 ring-1 ring-kirmizi/20 rounded-lg p-4">
              <div className="text-[13px] mb-3 leading-relaxed">
                Onaylamak için aşağıya{" "}
                <strong className="font-mono">SIL</strong> yaz:
              </div>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="SIL"
                className="!ring-kirmizi/30"
              />
              <div className="flex gap-2 mt-3 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowDelete(false);
                    setConfirmText("");
                  }}
                >
                  Vazgeç
                </Button>
                <button
                  type="button"
                  disabled={confirmText !== "SIL"}
                  onClick={() => {
                    toast.warning("Hesap silme talebi alındı (mock — gerçek silme I adımında)");
                    setShowDelete(false);
                    setConfirmText("");
                  }}
                  className="h-9 px-3.5 rounded-full bg-kirmizi text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#C73A2D]"
                >
                  Hesabımı kalıcı olarak sil
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
