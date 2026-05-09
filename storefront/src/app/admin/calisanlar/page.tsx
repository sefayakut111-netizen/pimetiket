/**
 * Pim Etiket — /admin/calisanlar
 *
 * Rol bazlı yetki yönetimi. Auth gelene kadar mock; backend swap'te
 * Supabase Auth kullanıcılarına `role` claim eklenir.
 */

"use client";

import { useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Input, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

type Role = "admin" | "operator" | "designer" | "accountant";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Yönetici",
  operator: "Operatör",
  designer: "Tasarımcı",
  accountant: "Muhasebeci",
};

const ROLE_COLOR: Record<Role, string> = {
  admin: "bg-pim-mercan text-white",
  operator: "bg-yesil-soft text-yesil",
  designer: "bg-krem text-lacivert",
  accountant: "bg-gri-100 text-gri-700",
};

const ROLE_DESC: Record<Role, string> = {
  admin: "Tam yetki: ayarlar, çalışan yönetimi, raporlar, audit",
  operator: "Sipariş + AI QC + prova + fason atama",
  designer: "Sipariş + tasarım dosyası + prova üretimi",
  accountant: "Sipariş listesi + raporlar + iade ödemeleri",
};

interface Staff {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastLoginAt: number | null;
}

const INITIAL_STAFF: Staff[] = [
  {
    id: "s1",
    name: "Sefa Yakut",
    email: "sefa@pimetiket.com",
    role: "admin",
    active: true,
    lastLoginAt: Date.now() - 1000 * 60 * 5,
  },
];

function timeAgo(ts: number | null): string {
  if (!ts) return "Hiç";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  return `${day} gün önce`;
}

export default function AdminCalisanlarPage() {
  const toast = useToast();
  const [staff, setStaff] = useState<Staff[]>(INITIAL_STAFF);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("operator");

  const onInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.includes("@") || !inviteName.trim()) {
      toast.error("Email ve isim gerekli");
      return;
    }
    setStaff((arr) => [
      ...arr,
      {
        id: `s-${Date.now()}`,
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        active: true,
        lastLoginAt: null,
      },
    ]);
    toast.success(`${inviteEmail} davet edildi (mock — Faz 2'de email)`);
    setInviteEmail("");
    setInviteName("");
    setInviteRole("operator");
    setShowInvite(false);
  };

  const toggleActive = (id: string) => {
    setStaff((arr) =>
      arr.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
  };

  const remove = (s: Staff) => {
    if (s.role === "admin") {
      toast.error("Admin kullanıcı silinemez");
      return;
    }
    if (!confirm(`${s.name} çıkarılsın mı?`)) return;
    setStaff((arr) => arr.filter((x) => x.id !== s.id));
    toast.info(`${s.name} çıkarıldı`);
  };

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1080px] px-6">
        <div className="flex items-end justify-between gap-6 mb-7 flex-wrap">
          <div>
            <Eyebrow>Ekip yönetimi</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              Çalışanlar
            </h1>
            <p className="mt-1.5 text-base text-gri-700">
              {staff.length} çalışan · rol bazlı yetki
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => setShowInvite((v) => !v)}
          >
            <Icon.Plus size={16} /> Çalışan davet et
          </Button>
        </div>

        {/* Invite form */}
        {showInvite && (
          <Card padding="p-6" className="mb-5">
            <h2 className="text-lg font-semibold mb-4">Yeni çalışan davet et</h2>
            <form onSubmit={onInvite} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1.5 block">İsim</span>
                  <Input
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Ahmet Operatör"
                  />
                </label>
                <label className="block">
                  <span className="text-[13px] font-semibold mb-1.5 block">E-posta</span>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="ahmet@pimetiket.com"
                  />
                </label>
              </div>
              <div>
                <span className="text-[13px] font-semibold mb-2 block">Rol</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(Object.keys(ROLE_LABEL) as Role[])
                    .filter((r) => r !== "admin")
                    .map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setInviteRole(r)}
                        className={cn(
                          "px-3 py-2.5 rounded-lg ring-[1.5px] text-left transition-all",
                          inviteRole === r
                            ? "ring-pim-mercan bg-pim-mercan-tint/40"
                            : "ring-gri-200 bg-white hover:ring-pim-mercan-soft"
                        )}
                      >
                        <div className="font-semibold text-[13px]">
                          {ROLE_LABEL[r]}
                        </div>
                        <div className="text-[11.5px] text-gri-700 mt-0.5 leading-tight">
                          {ROLE_DESC[r]}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" type="button" onClick={() => setShowInvite(false)}>
                  İptal
                </Button>
                <Button type="submit" variant="primary">
                  Davet gönder <Icon.ArrowR size={14} />
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Staff list */}
        <div className="flex flex-col gap-3">
          {staff.map((s) => (
            <Card key={s.id} padding="p-5">
              <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-4 items-center">
                <div className="grid place-items-center w-12 h-12 rounded-full bg-pim-mercan text-white font-bold text-[15px] shrink-0">
                  {s.name
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase())
                    .join("")}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-base">{s.name}</span>
                    <span
                      className={cn(
                        "inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold",
                        ROLE_COLOR[s.role]
                      )}
                    >
                      {ROLE_LABEL[s.role]}
                    </span>
                    {!s.active && (
                      <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold bg-gri-100 text-gri-700">
                        Pasif
                      </span>
                    )}
                  </div>
                  <div className="text-[13px] text-gri-700">{s.email}</div>
                  <div className="text-[11.5px] text-gri-500 mt-0.5">
                    Son giriş: {timeAgo(s.lastLoginAt)}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleActive(s.id)}
                  >
                    {s.active ? "Pasifleştir" : "Aktifleştir"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(s)}
                    disabled={s.role === "admin"}
                  >
                    <Icon.Info size={12} /> Çıkar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3 text-[12px] text-gri-500">
          <Icon.Info size={14} />
          <span>
            Davet emaili Faz 2&rsquo;de Resend ile gönderilir. Şimdilik
            mock — backend swap sonrası gerçek invite linki çıkacak.
          </span>
        </div>
      </div>
    </main>
  );
}
