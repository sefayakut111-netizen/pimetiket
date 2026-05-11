/**
 * Pim Etiket — /profil (E.2.4)
 *
 * Ad/email/şifre değiştirme + hesap silme. Mock — gerçek API I adımında.
 */

"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, Input, Eyebrow, useToast } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import {
  getMyProfile,
  updateMyProfile,
} from "@/lib/customer-profile";
import { ensureAuthBindings } from "@/lib/customer-cart";

const COPY = {
  tr: {
    eyebrow: "Hesabım",
    title: "Profil ayarları",
    personalTitle: "Kişisel bilgiler",
    personalDesc: "Sipariş ve fatura bilgileriyle eşleşmesi önemli.",
    fullName: "Ad Soyad",
    email: "E-posta",
    verified: "Doğrulandı",
    save: "Kaydet",
    saved: "Bilgiler güncellendi (mock)",
    pwTitle: "Şifre değiştir",
    pwDesc: "Güvenlik için 3-6 ayda bir değiştirmeni öneririz.",
    pwCurrent: "Mevcut şifre",
    pwNew: "Yeni şifre",
    pwNewPh: "En az 8 karakter",
    pwRepeat: "Yeni şifreyi tekrarla",
    pwRepeatPh: "Yeniden gir",
    pwUpdate: "Şifreyi güncelle",
    pwUpdated: "Şifre güncellendi (mock)",
    notifTitle: "Bildirim tercihleri",
    notifDesc: "Hangi durumlarda haber vereyim?",
    notifs: [
      { id: "order", label: "Sipariş güncellemeleri", default: true, desc: "AI kontrol, prova, kargo" },
      { id: "promo", label: "Kampanya ve indirimler", default: false, desc: "Ayda en fazla 2 e-posta" },
      { id: "product", label: "Yeni özellikler", default: true, desc: "Yeni malzeme/yaldız çıktığında" },
    ],
    dangerTitle: "Tehlikeli alan",
    dangerDesc: (
      <>
        Hesabını silersen tüm sipariş geçmişi ve kayıtlı tasarımlar
        <strong> kalıcı olarak silinir</strong>. KVKK kapsamında
        verilerin yasal saklama süresi sonunda yok edilir.
      </>
    ),
    deleteCta: "Hesabımı silmek istiyorum →",
    confirmInstr: (
      <>
        Onaylamak için aşağıya <strong className="font-mono">SIL</strong> yaz:
      </>
    ),
    confirmKeyword: "SIL",
    cancel: "Vazgeç",
    confirmDelete: "Hesabımı kalıcı olarak sil",
    deleteSubmitted:
      "Hesap silme talebi alındı (mock — gerçek silme I adımında)",
  },
  en: {
    eyebrow: "My account",
    title: "Profile settings",
    personalTitle: "Personal info",
    personalDesc: "Should match your order and invoice details.",
    fullName: "Full name",
    email: "Email",
    verified: "Verified",
    save: "Save",
    saved: "Info updated (mock)",
    pwTitle: "Change password",
    pwDesc: "We recommend changing it every 3-6 months for security.",
    pwCurrent: "Current password",
    pwNew: "New password",
    pwNewPh: "At least 8 characters",
    pwRepeat: "Repeat new password",
    pwRepeatPh: "Re-enter",
    pwUpdate: "Update password",
    pwUpdated: "Password updated (mock)",
    notifTitle: "Notification preferences",
    notifDesc: "When should I let you know?",
    notifs: [
      { id: "order", label: "Order updates", default: true, desc: "AI check, proof, shipping" },
      { id: "promo", label: "Campaigns & discounts", default: false, desc: "At most 2 emails per month" },
      { id: "product", label: "New features", default: true, desc: "When a new material/foil ships" },
    ],
    dangerTitle: "Danger zone",
    dangerDesc: (
      <>
        Deleting your account <strong>permanently removes</strong> all order
        history and saved designs. Under KVKK, data is destroyed at the end
        of its legal retention period.
      </>
    ),
    deleteCta: "I want to delete my account →",
    confirmInstr: (
      <>
        To confirm, type <strong className="font-mono">DELETE</strong> below:
      </>
    ),
    confirmKeyword: "DELETE",
    cancel: "Cancel",
    confirmDelete: "Delete my account permanently",
    deleteSubmitted:
      "Account deletion request received (mock — real deletion in step I)",
  },
};

export default function ProfilPage() {
  const { locale } = useT();
  const c = locale === "en" ? COPY.en : COPY.tr;

  const toast = useToast();
  const [name, setName] = useState("Ahmet Yılmaz");
  const [email, setEmail] = useState("ahmet@example.com");
  const [phone, setPhone] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    ensureAuthBindings();
    void getMyProfile().then((p) => {
      if (!p) return;
      setName(p.displayName ?? "");
      setPhone(p.phone ?? "");
      setEmailVerified(Boolean(p.emailVerifiedAt));
    });
    // Email auth user'dan al — async
    import("@/lib/supabase/auth-bridge").then(({ getCurrentUser }) =>
      getCurrentUser().then((u) => {
        if (u?.email) setEmail(u.email);
      })
    );
  }, []);

  const onSavePersonal = async () => {
    setSavingProfile(true);
    const r = await updateMyProfile({
      displayName: name.trim(),
      phone: phone.trim() || null,
    });
    setSavingProfile(false);
    if (r.ok) toast.success(c.saved);
    else toast.error(r.reason);
  };

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)] py-8 pb-20">
      <div className="mx-auto max-w-[800px] px-8">
        <div className="mb-7">
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            {c.title}
          </h1>
        </div>

        {/* Personal */}
        <Card padding="p-6" className="mb-4">
          <h2 className="text-xl font-semibold mb-1">{c.personalTitle}</h2>
          <p className="text-[13px] text-gri-700 mb-5">{c.personalDesc}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block">
                {c.fullName}
              </span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block">
                {c.email}
              </span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                readOnly
              />
              {emailVerified && (
                <span className="inline-flex items-center gap-1 mt-1.5 text-[12px] text-yesil font-semibold">
                  <Icon.Check size={12} /> {c.verified}
                </span>
              )}
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <Button
              variant="primary"
              onClick={onSavePersonal}
              disabled={savingProfile}
            >
              {savingProfile ? "..." : c.save}
            </Button>
          </div>
        </Card>

        {/* Password */}
        <Card padding="p-6" className="mb-4">
          <h2 className="text-xl font-semibold mb-1">{c.pwTitle}</h2>
          <p className="text-[13px] text-gri-700 mb-5">{c.pwDesc}</p>
          <div className="space-y-3.5">
            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block">
                {c.pwCurrent}
              </span>
              <Input
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block">
                {c.pwNew}
              </span>
              <Input
                type="password"
                placeholder={c.pwNewPh}
                autoComplete="new-password"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold mb-1.5 block">
                {c.pwRepeat}
              </span>
              <Input
                type="password"
                placeholder={c.pwRepeatPh}
                autoComplete="new-password"
              />
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <Button
              variant="primary"
              onClick={() => toast.success(c.pwUpdated)}
            >
              {c.pwUpdate}
            </Button>
          </div>
        </Card>

        {/* Notifications */}
        <Card padding="p-6" className="mb-4">
          <h2 className="text-xl font-semibold mb-1">{c.notifTitle}</h2>
          <p className="text-[13px] text-gri-700 mb-5">{c.notifDesc}</p>
          <div className="space-y-3">
            {c.notifs.map((row) => (
              <label
                key={row.id}
                htmlFor={`notif-${row.id}`}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gri-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  id={`notif-${row.id}`}
                  name={`notif-${row.id}`}
                  defaultChecked={row.default}
                  className="mt-1 accent-pim-mercan shrink-0"
                />
                <div className="flex-1">
                  <div className="font-semibold text-[15px]">{row.label}</div>
                  <div className="text-[13px] text-gri-700 mt-0.5">
                    {row.desc}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </Card>

        {/* Danger zone */}
        <Card padding="p-6" className="ring-1 ring-kirmizi/20">
          <h2 className="text-xl font-semibold mb-1 text-kirmizi">
            {c.dangerTitle}
          </h2>
          <p className="text-[13px] text-gri-700 mb-5 leading-relaxed">
            {c.dangerDesc}
          </p>
          {!showDelete ? (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="text-[13px] font-semibold text-kirmizi hover:underline"
            >
              {c.deleteCta}
            </button>
          ) : (
            <div className="bg-kirmizi/5 ring-1 ring-kirmizi/20 rounded-lg p-4">
              <div className="text-[13px] mb-3 leading-relaxed">
                {c.confirmInstr}
              </div>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={c.confirmKeyword}
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
                  {c.cancel}
                </Button>
                <button
                  type="button"
                  disabled={confirmText !== c.confirmKeyword}
                  onClick={() => {
                    toast.warning(c.deleteSubmitted);
                    setShowDelete(false);
                    setConfirmText("");
                  }}
                  className="h-9 px-3.5 rounded-full bg-kirmizi text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#C73A2D]"
                >
                  {c.confirmDelete}
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
