/**
 * Pim Etiket — /admin/calisanlar
 *
 * Sefa 18 May v68 (RBAC yayma — Migration 054):
 * Mevcut mock veri kaldırıldı, gerçek Supabase profiles tablosundan
 * admin_role NOT NULL kullanıcıları liste. 5 rol enum'una geçildi.
 *
 * Önceki mock roller (admin/operator/designer/accountant) artık geçerli
 * DEĞİL — Migration 054'teki 5 sabit role taşındı.
 */

"use client";

import { useEffect, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import {
  Button,
  Card,
  Eyebrow,
  useToast,
  Skeleton,
  Modal,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import type { StaffRow } from "@/app/api/admin/staff/route";

type AdminRole =
  | "super_admin"
  | "operations"
  | "customer_service"
  | "production"
  | "content_editor";

interface RoleOption {
  role: AdminRole;
  label: string;
  description: string;
}

const ROLE_COLOR: Record<AdminRole, string> = {
  super_admin: "bg-pim-mercan text-white",
  operations: "bg-mavi-soft text-mavi-koyu",
  customer_service: "bg-yesil-soft text-yesil-koyu",
  production: "bg-sari-soft text-sari-koyu",
  content_editor: "bg-mor/10 text-mor",
};

const ROLE_EMOJI: Record<AdminRole, string> = {
  super_admin: "",
  operations: "",
  customer_service: "",
  production: "",
  content_editor: "",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "Hiç giriş yapmadı";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat önce`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

export default function AdminCalisanlarPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<StaffRow | null>(null);

  async function fetchStaff() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Liste alınamadı");
        return;
      }
      setStaff(data.staff ?? []);
      setRoles(data.roles ?? []);
      setCurrentUserId(data.currentUserId ?? null);
    } catch (e) {
      toast.error(`Yükleme hatası: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRoleChange(userId: string, newRole: string | null) {
    setUpdating(userId);
    try {
      const res = await fetch(`/api/admin/staff/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Rol değiştirilemedi");
        return;
      }
      toast.success("Rol güncellendi");
      await fetchStaff();
    } finally {
      setUpdating(null);
    }
  }

  function requestRemove(target: StaffRow) {
    const superAdminCount = staff.filter(
      (s) => s.admin_role === "super_admin"
    ).length;
    if (target.admin_role === "super_admin" && superAdminCount <= 1) {
      toast.error("Tek super admin kaldirilamaz.");
      return;
    }
    setRemoveTarget(target);
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    const userId = removeTarget.user_id;
    const email = removeTarget.email;
    setUpdating(userId);
    try {
      const res = await fetch(`/api/admin/staff/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Kaldirilamadi");
        return;
      }
      toast.success(`${email ?? userId} calisan listesinden cikarildi`);
      setRemoveTarget(null);
      await fetchStaff();
    } finally {
      setUpdating(null);
    }
  }

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 md:px-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Eyebrow>RBAC — 5 Rol</Eyebrow>
          <h1 className="mt-1 text-2xl font-bold text-lacivert md:text-3xl">
            Çalışanlar & Yetki
          </h1>
          <p className="mt-1 text-sm text-gri-700">
            Migration 054 ile granular yetki. Her endpoint{" "}
            <code className="rounded bg-gri-100 px-1 text-[12px]">
              fn_has_permission(module, action)
            </code>{" "}
            ile korunur.
          </p>
        </div>
      </div>

      <p className="text-sm text-sari-koyu bg-sari-soft/30 rounded-lg p-3 mb-4">
        Calisan eklemek icin: kisi /auth sayfasindan hesap acar, sonra burada
        rolunu atarsiniz. Token bazli davet sistemi yakin zamanda eklenecek.
      </p>

      {/* Rol açıklamaları */}
      <Card padding="p-5" className="mb-6">
        <h2 className="text-base font-semibold mb-3 text-lacivert">
          Yetki matrisi (5 rol)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {roles.length === 0 ? (
            <>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </>
          ) : (
            roles.map((r) => (
              <div
                key={r.role}
                className="rounded-lg border border-gri-200 p-3"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span>{ROLE_EMOJI[r.role as AdminRole]}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      ROLE_COLOR[r.role as AdminRole]
                    )}
                  >
                    {r.label}
                  </span>
                </div>
                <p className="text-[11.5px] text-gri-700 leading-relaxed">
                  {r.description}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Çalışan listesi */}
      <Card padding="p-0" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gri-50 border-b border-gri-200 text-[12px] uppercase text-gri-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Kişi</th>
                <th className="px-4 py-3 text-left font-semibold">Rol</th>
                <th className="px-4 py-3 text-left font-semibold">2FA</th>
                <th className="px-4 py-3 text-left font-semibold">Son giriş</th>
                <th className="px-4 py-3 text-right font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-gri-100">
                    <td colSpan={5} className="px-4 py-3">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : staff.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-gri-500"
                  >
                    Henüz çalışan yok. Sefa süper admin tek başına.
                  </td>
                </tr>
              ) : (
                staff.map((s) => {
                  const isLegacy = !s.admin_role && s.legacy_role;
                  const displayRole = s.admin_role ?? null;
                  return (
                    <tr
                      key={s.user_id}
                      className="border-b border-gri-100 last:border-0 hover:bg-gri-50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-lacivert">
                          {s.display_name ?? s.email?.split("@")[0] ?? "—"}
                        </div>
                        <div className="text-[12px] text-gri-500">
                          {s.email ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isLegacy ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center rounded-full bg-sari-soft px-2 py-0.5 text-[11px] font-semibold text-sari-koyu">
                               Legacy "{s.legacy_role}"
                            </span>
                            <div className="text-[11px] text-gri-500">
                              Migration 054'e göre rol seçilmedi
                            </div>
                          </div>
                        ) : displayRole ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
                              ROLE_COLOR[displayRole as AdminRole]
                            )}
                          >
                            {ROLE_EMOJI[displayRole as AdminRole]}{" "}
                            {roles.find((r) => r.role === displayRole)?.label ??
                              displayRole}
                          </span>
                        ) : (
                          <span className="text-gri-500 text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.mfa_enabled ? (
                          <span className="inline-flex items-center gap-1 text-yesil-koyu text-[12px] font-semibold">
                             Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-kirmizi-koyu text-[12px] font-semibold">
                             Kapalı
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-gri-700">
                        {timeAgo(s.last_sign_in_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <select
                            value={s.admin_role ?? ""}
                            onChange={(e) =>
                              handleRoleChange(
                                s.user_id,
                                e.target.value || null
                              )
                            }
                            disabled={updating === s.user_id}
                            className="rounded-lg border border-gri-200 px-2 py-1.5 text-[12px] disabled:opacity-50"
                          >
                            <option value="">Rol seç…</option>
                            {roles.map((r) => (
                              <option key={r.role} value={r.role}>
                                {ROLE_EMOJI[r.role as AdminRole]} {r.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => requestRemove(s)}
                            disabled={
                              updating === s.user_id ||
                              (s.user_id === currentUserId &&
                                s.admin_role === "super_admin")
                            }
                            className="text-[12px] text-kirmizi-koyu hover:underline disabled:opacity-50"
                            title="Calisanlardan cikar"
                          >
                            Kaldir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Calisani kaldir"
      >
        <p className="text-sm text-gri-700">
          {removeTarget?.email ?? removeTarget?.user_id} calisan listesinden
          cikarilacak. Devam edilsin mi?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoveTarget(null)}>
            Iptal
          </Button>
          <Button
            variant="primary"
            disabled={!!updating}
            onClick={() => void confirmRemove()}
          >
            {updating ? "Kaldiriliyor…" : "Kaldir"}
          </Button>
        </div>
      </Modal>

      {/* Bilgilendirme — davet akışı henüz yok */}
      <div className="mt-6 rounded-lg bg-mavi-soft p-4 text-[12.5px] text-mavi-koyu">
        <strong className="block mb-1"> Yeni çalışan eklemek için:</strong>
        Önce kişi <code>/auth</code> sayfasından kendi hesabını açar (email
        + şifre veya Google). Sonra buraya gelir, listede görünür → rol
        atarsın. Resend email davet akışı Faz 2'de aktif olacak.
      </div>
    </main>
  );
}
