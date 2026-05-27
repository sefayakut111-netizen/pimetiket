/**
 * ProfileBar — kaydedilebilir pricing profilleri.
 *
 * 20 profil slotu (localStorage). Sefa hızlıca configurations
 * arasında geçer + parametre tuning + müşteri tipine göre kaydet.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listProfiles,
  saveProfile,
  deleteProfile,
  touchProfile,
  getProfileAge,
  PROFILE_LIMIT,
  type PricingProfile,
  type ProfileInputSnapshot,
  type CustomerType,
} from "@/lib/pricing-profiles";

interface ProfileBarProps {
  currentInput: ProfileInputSnapshot;
  /** Aktif profil ID (kullanıcı yüklediğinden beri değiştirildiyse, dirty flag) */
  activeProfileId?: string;
  onLoadProfile: (profile: PricingProfile) => void;
  onClearActive: () => void;
}

export function ProfileBar({
  currentInput,
  activeProfileId,
  onLoadProfile,
  onClearActive,
}: ProfileBarProps) {
  const [profiles, setProfiles] = useState<PricingProfile[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setProfiles(listProfiles());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeProfile = activeProfileId
    ? profiles.find((p) => p.id === activeProfileId)
    : undefined;

  function handleLoad(id: string) {
    const updated = touchProfile(id);
    if (updated) {
      onLoadProfile(updated);
      refresh();
    }
  }

  function handleSaveAsNew(name: string, notes: string) {
    const result = saveProfile({ name, notes, input: currentInput });
    if (!result.ok) {
      setErrorMsg(
        result.reason === "max_reached"
          ? `Profil limiti dolu (max ${PROFILE_LIMIT}). Önce birini sil.`
          : result.reason === "name_empty"
            ? "Profil adı boş olamaz."
            : "Bu adda zaten profil var."
      );
      return;
    }
    setErrorMsg(null);
    setShowSaveModal(false);
    refresh();
    // Kaydedilen yeni profili otomatik aktif yap
    onLoadProfile(result.profile);
  }

  function handleUpdateActive() {
    if (!activeProfile) return;
    const result = saveProfile({
      id: activeProfile.id,
      name: activeProfile.name,
      notes: activeProfile.notes,
      input: currentInput,
    });
    if (result.ok) {
      refresh();
      onLoadProfile(result.profile);
    }
  }

  function handleDelete(id: string) {
    deleteProfile(id);
    if (activeProfileId === id) onClearActive();
    refresh();
  }

  return (
    <Card padding="p-4" className="mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.08em] font-bold text-gri-700 shrink-0">
          <Icon.Sparkle size={14} className="text-pim-mercan" />
          Profil
        </div>

        {/* Profile selector dropdown */}
        <select
          value={activeProfileId ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            if (id) handleLoad(id);
            else onClearActive();
          }}
          className="flex-1 min-w-[200px] h-10 px-3 rounded-lg bg-gri-50 ring-1 ring-gri-200 text-[14px] font-medium focus:outline-none focus:ring-pim-mercan focus:bg-white transition-shadow"
        >
          <option value="">— Profil seç —</option>
          {profiles.length === 0 && <option disabled>Henüz profil yok</option>}
          {profiles.map((p) => {
            const age = getProfileAge(p);
            const ageBadge = age.status === "ancient" ? " ⚠️" : age.status === "stale" ? " ⏱" : "";
            return (
              <option key={p.id} value={p.id}>
                {p.name}
                {ageBadge}
              </option>
            );
          })}
        </select>

        {/* Active profile age indicator */}
        {activeProfile && (
          <ProfileAgeBadge profile={activeProfile} />
        )}

        {/* Actions */}
        <div className="flex gap-2 ml-auto">
          {activeProfile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUpdateActive}
              title="Aktif profili mevcut değerlerle güncelle"
            >
              <Icon.Check size={14} /> Güncelle
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setErrorMsg(null);
              setShowSaveModal(true);
            }}
            disabled={profiles.length >= PROFILE_LIMIT}
          >
            <Icon.Plus size={14} /> Yeni profil
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowManageModal(true)}
            disabled={profiles.length === 0}
          >
            Yönet ({profiles.length}/{PROFILE_LIMIT})
          </Button>
        </div>
      </div>

      {/* Save modal */}
      {showSaveModal && (
        <SaveProfileModal
          onCancel={() => {
            setShowSaveModal(false);
            setErrorMsg(null);
          }}
          onSave={handleSaveAsNew}
          errorMsg={errorMsg}
        />
      )}

      {/* Manage modal */}
      {showManageModal && (
        <ManageProfilesModal
          profiles={profiles}
          activeId={activeProfileId}
          onLoad={(id) => {
            handleLoad(id);
            setShowManageModal(false);
          }}
          onDelete={handleDelete}
          onClose={() => setShowManageModal(false)}
        />
      )}
    </Card>
  );
}

// ============================================================
// Age badge
// ============================================================

function ProfileAgeBadge({ profile }: { profile: PricingProfile }) {
  const age = getProfileAge(profile);
  const colors = {
    fresh: "bg-yesil-soft text-yesil",
    stale: "bg-sari-soft text-sari-koyu",
    ancient: "bg-kirmizi/10 text-kirmizi",
  };
  return (
    <span
      className={cn(
        "text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap",
        colors[age.status]
      )}
      title={age.message}
    >
      {age.status === "ancient" && "⚠️ "}
      {age.message}
    </span>
  );
}

// ============================================================
// Save modal
// ============================================================

function SaveProfileModal({
  onCancel,
  onSave,
  errorMsg,
}: {
  onCancel: () => void;
  onSave: (name: string, notes: string) => void;
  errorMsg: string | null;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div
      className="fixed inset-0 bg-lacivert/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2 max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-1">Yeni Profil Kaydet</h3>
        <p className="text-[13px] text-gri-700 mb-4">
          Mevcut tüm parametreler kaydedilir. Sonradan düzenlenebilir.
        </p>

        <label className="block mb-3">
          <span className="text-[12px] font-semibold uppercase tracking-[0.05em] mb-1 block">
            Profil adı
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn: Standart kraft konfigi"
            autoFocus
            className="w-full h-11 px-3 rounded-lg bg-gri-50 ring-1 ring-gri-200 text-[14px] focus:outline-none focus:ring-pim-mercan focus:bg-white"
          />
        </label>

        <label className="block mb-4">
          <span className="text-[12px] font-semibold uppercase tracking-[0.05em] mb-1 block">
            Not (opsiyonel)
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Bu profil ne için kullanılır?"
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-gri-50 ring-1 ring-gri-200 text-[13px] resize-none focus:outline-none focus:ring-pim-mercan focus:bg-white"
          />
        </label>

        {errorMsg && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-kirmizi/10 text-kirmizi text-[12px] font-semibold">
            {errorMsg}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            İptal
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onSave(name, notes)}
            disabled={!name.trim()}
          >
            Kaydet
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Manage modal
// ============================================================

function ManageProfilesModal({
  profiles,
  activeId,
  onLoad,
  onDelete,
  onClose,
}: {
  profiles: PricingProfile[];
  activeId?: string;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 bg-lacivert/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gri-200 flex items-center justify-between bg-gri-50">
          <div>
            <h3 className="text-lg font-semibold">Profil Yönetimi</h3>
            <p className="text-[12px] text-gri-700 mt-0.5">
              {profiles.length} kayıtlı / {PROFILE_LIMIT} max
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="p-2 rounded-full text-gri-700 hover:bg-gri-200"
          >
            <Icon.X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gri-100">
          {profiles.map((p) => {
            const age = getProfileAge(p);
            const ageColors = {
              fresh: "text-yesil",
              stale: "text-sari",
              ancient: "text-kirmizi",
            };
            const isActive = p.id === activeId;
            const isConfirming = confirmDeleteId === p.id;

            return (
              <div
                key={p.id}
                className={cn(
                  "px-6 py-3 hover:bg-gri-50 transition-colors",
                  isActive && "bg-pim-mercan-tint/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-[14px]">{p.name}</h4>
                      {isActive && (
                        <span className="text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full bg-pim-mercan text-white">
                          aktif
                        </span>
                      )}
                      <span className={cn("text-[11px] font-semibold", ageColors[age.status])}>
                        · {age.message}
                      </span>
                    </div>
                    {p.notes && (
                      <p className="text-[12.5px] text-gri-700 mt-0.5">{p.notes}</p>
                    )}
                    <div className="text-[11px] text-gri-500 mt-1 tabular-nums">
                      {p.input.mode} · {p.input.cut} · {p.input.width}×{p.input.height}mm · {p.input.qty} adet · {p.input.fasonRate} ₺/m²
                      {p.lastUsedAt && (
                        <>
                          {" · "}
                          son kullanım: {new Date(p.lastUsedAt).toLocaleDateString("tr-TR")}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onLoad(p.id)}
                      >
                        Yükle
                      </Button>
                    )}
                    {!isConfirming ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="text-[12px] font-semibold text-gri-500 hover:text-kirmizi px-2"
                      >
                        Sil
                      </button>
                    ) : (
                      <div className="flex gap-1 items-center">
                        <button
                          type="button"
                          onClick={() => {
                            onDelete(p.id);
                            setConfirmDeleteId(null);
                          }}
                          className="text-[11px] font-bold text-white bg-kirmizi px-2 py-1 rounded hover:bg-kirmizi-koyu"
                        >
                          Sil onayla
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[11px] text-gri-700 px-2"
                        >
                          Vazgeç
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
