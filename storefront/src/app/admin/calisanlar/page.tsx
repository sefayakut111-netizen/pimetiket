/**
 * Pim Etiket — /admin/calisanlar
 *
 * Faz 4 RBAC UI: 3 rol preset (Admin / Operatör / Finans).
 * Backend admin_role_permissions korunur; preset → admin_role ataması.
 */

"use client";

import { useEffect, useState } from "react";
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
import { PermissionMatrix } from "@/components/admin/PermissionMatrix";
import {
  ROLE_PRESET_LIST,
  countGrantedPermissions,
  presetById,
  presetFromAdminRole,
  type RolePresetId,
} from "@/lib/admin-role-presets";

const PRESET_STYLE: Record<
  RolePresetId,
  { ring: string; badge: string; icon: React.ReactNode }
> = {
  admin: {
    ring: "ring-pim-mercan",
    badge: "bg-pim-mercan text-white",
    icon: <Icon.Shield size={20} />,
  },
  operator: {
    ring: "ring-mavi",
    badge: "bg-mavi-soft text-mavi-koyu",
    icon: <Icon.Box size={20} />,
  },
  finance: {
    ring: "ring-yesil",
    badge: "bg-yesil-soft text-yesil-koyu",
    icon: <Icon.Wallet size={20} />,
  },
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
  const [updating, setUpdating] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<StaffRow | null>(null);
  const [activePreset, setActivePreset] = useState<RolePresetId>("operator");

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

  async function handlePresetAssign(userId: string, presetId: RolePresetId) {
    const preset = presetById(presetId);
    setUpdating(userId);
    try {
      const res = await fetch(`/api/admin/staff/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_role: preset.adminRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Rol değiştirilemedi");
        return;
      }
      toast.success(`${preset.label} preset uygulandı`);
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

  const previewPreset = presetById(activePreset);

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 md:px-6">
      <div className="mb-6">
        <Eyebrow>RBAC — Rol preset</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-lacivert md:text-3xl">
          Çalışanlar & Yetki
        </h1>
        <p className="mt-1 text-sm text-gri-700">
          Üç hazır rol şablonu — arka planda{" "}
          {countGrantedPermissions(previewPreset.permissions)} izin hücresi (
          {previewPreset.adminRole}).
        </p>
      </div>

      <p className="text-sm text-sari-koyu bg-sari-soft/30 rounded-lg p-3 mb-4">
        Calisan eklemek icin: kisi /auth sayfasindan hesap acar, sonra burada
        preset rol atarsiniz.
      </p>

      {/* 3 rol preset */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {ROLE_PRESET_LIST.map((p) => {
          const style = PRESET_STYLE[p.id];
          const selected = activePreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivePreset(p.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                selected
                  ? `border-transparent ring-2 ${style.ring} bg-white shadow-1`
                  : "border-gri-200 bg-gri-50/50 hover:bg-white hover:border-gri-300"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={cn(
                    "grid place-items-center w-9 h-9 rounded-lg",
                    style.badge
                  )}
                >
                  {style.icon}
                </span>
                <span className="font-semibold text-lacivert">{p.label}</span>
              </div>
              <p className="text-[12px] text-gri-700 leading-relaxed">
                {p.description}
              </p>
              <p className="mt-2 text-[10.5px] font-mono text-gri-500">
                → {p.adminRole}
              </p>
            </button>
          );
        })}
      </div>

      <PermissionMatrix preset={previewPreset} className="mb-6" />

      {/* Çalışan listesi */}
      <Card padding="p-0" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gri-50 border-b border-gri-200 text-[12px] uppercase text-gri-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Kişi</th>
                <th className="px-4 py-3 text-left font-semibold">Preset</th>
                <th className="px-4 py-3 text-left font-semibold">2FA</th>
                <th className="px-4 py-3 text-left font-semibold">Son giriş</th>
                <th className="px-4 py-3 text-right font-semibold">Atama</th>
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
                    Henüz çalışan yok.
                  </td>
                </tr>
              ) : (
                staff.map((s) => {
                  const isLegacy = !s.admin_role && s.legacy_role;
                  const currentPreset = presetFromAdminRole(s.admin_role);
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
                          <span className="inline-flex items-center rounded-full bg-sari-soft px-2 py-0.5 text-[11px] font-semibold text-sari-koyu">
                            Legacy {s.legacy_role}
                          </span>
                        ) : currentPreset ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
                              PRESET_STYLE[currentPreset].badge
                            )}
                          >
                            {presetById(currentPreset).label}
                          </span>
                        ) : s.admin_role ? (
                          <span className="text-[12px] text-gri-600">
                            Eski rol: {s.admin_role}
                          </span>
                        ) : (
                          <span className="text-gri-500 text-[12px]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.mfa_enabled ? (
                          <span className="text-yesil-koyu text-[12px] font-semibold">
                            Aktif
                          </span>
                        ) : (
                          <span className="text-kirmizi-koyu text-[12px] font-semibold">
                            Kapalı
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-gri-700">
                        {timeAgo(s.last_sign_in_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2 flex-wrap justify-end">
                          <select
                            value={currentPreset ?? ""}
                            onChange={(e) => {
                              const v = e.target.value as RolePresetId;
                              if (v) void handlePresetAssign(s.user_id, v);
                            }}
                            disabled={updating === s.user_id}
                            className="rounded-lg border border-gri-200 px-2 py-1.5 text-[12px] disabled:opacity-50"
                          >
                            <option value="">Preset seç…</option>
                            {ROLE_PRESET_LIST.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.label}
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
    </main>
  );
}
