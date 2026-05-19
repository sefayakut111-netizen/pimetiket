/**
 * Pim Etiket — /admin/fiyatlar (v2)
 *
 * Sefa 17 May v2: 3 profil (Sticker / Rulo Etiket / Tabaka Etiket).
 *
 * Her profil:
 *   - Materials (m² maliyet TL)
 *   - Options (groups: finish/coating/customization, toplamsal %)
 *   - Tiers (adet kademesi, çarpansal)
 *   - Operation (setup/packaging/cargo/fee%)
 *   - Margin + KDV
 *
 * Sağ panel: Canlı preview (örnek sipariş ile gerçek hesap)
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pim } from "@/components/Pim";
import { Card, Eyebrow, Button, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type {
  ProfileConfig,
  PricingHistoryRow,
  ScopeName,
  MaterialItem,
  OptionGroup,
  OptionItem,
  TierConfig,
} from "@/lib/pricing-config";
import { calculatePrice } from "@/lib/pricing-calc";
import {
  diffProfileConfig,
  isMaterialChanged,
  isOptionChanged,
  isTierChanged,
  type DiffEntry,
} from "@/lib/pricing-diff";

type Scope = "sticker" | "etiket_rulo" | "etiket_tabaka";

interface ApiResponse {
  ok?: boolean;
  scope?: ScopeName;
  draft?: ProfileConfig;
  live?: ProfileConfig;
  draft_updated_at?: string | null;
  draft_updated_by_email?: string | null;
  live_updated_at?: string | null;
  live_updated_by_email?: string | null;
  history?: PricingHistoryRow[];
  error?: string;
}

const SCOPE_META: Record<Scope, { label: string; emoji: string; desc: string }> = {
  sticker: {
    label: "Sticker",
    emoji: "🏷",
    desc: "Vinil / Opak / Şeffaf / Holografik / Metalik · Finiş seçimi",
  },
  etiket_rulo: {
    label: "Rulo Etiket",
    emoji: "📋",
    desc: "Kraft / Kuşe / Beyaz / Ultra / Metalik · Kaplama + Özelleştirme",
  },
  etiket_tabaka: {
    label: "Tabaka Etiket",
    emoji: "📄",
    desc: "Kraft / Kuşe / Beyaz · Kaplama (özelleştirme yok)",
  },
};

const SCOPE_PREVIEW_DEFAULTS: Record<
  Scope,
  { width: number; height: number; qty: number }
> = {
  sticker: { width: 50, height: 50, qty: 250 },
  etiket_rulo: { width: 60, height: 40, qty: 5000 },
  etiket_tabaka: { width: 70, height: 50, qty: 1000 },
};

// ============================================================
// Tabaka geometry — sheet preview için sheets_needed hesabı
// (fiyat-hesapla-tabaka sayfasındaki ile aynı kurallar)
// ============================================================
const SHEET_W_MM = 230;
const SHEET_H_MM = 310;
const SHEET_MARGIN_MM = 20;
const USABLE_W_MM = SHEET_W_MM - 2 * SHEET_MARGIN_MM; // 190
const USABLE_H_MM = SHEET_H_MM - 2 * SHEET_MARGIN_MM; // 270
const GAP_MM = 6;

function calcSheetsNeeded(width_mm: number, height_mm: number, qty: number): number {
  const w = Math.max(5, Math.ceil(width_mm / 5) * 5);
  const h = Math.max(5, Math.ceil(height_mm / 5) * 5);
  const per_a =
    Math.max(0, Math.floor((USABLE_W_MM + GAP_MM) / (w + GAP_MM))) *
    Math.max(0, Math.floor((USABLE_H_MM + GAP_MM) / (h + GAP_MM)));
  const per_b =
    Math.max(0, Math.floor((USABLE_W_MM + GAP_MM) / (h + GAP_MM))) *
    Math.max(0, Math.floor((USABLE_H_MM + GAP_MM) / (w + GAP_MM)));
  const per_sheet = Math.max(per_a, per_b, 1);
  return Math.ceil(qty / per_sheet);
}

function fmtMoney(n: number): string {
  return Math.round(n).toLocaleString("tr-TR") + " TL";
}

function fmtMoney2(n: number): string {
  return n.toFixed(2).replace(".", ",") + " TL";
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün önce`;
  return fmtDateTime(iso);
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function FiyatlarPage() {
  const toast = useToast();
  const [scope, setScope] = useState<Scope>("sticker");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [draft, setDraft] = useState<ProfileConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Preview state — örnek sipariş için
  const [previewMaterialId, setPreviewMaterialId] = useState<string>("");
  const [previewOptions, setPreviewOptions] = useState<
    Record<string, string | string[]>
  >({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/pricing?scope=${scope}`, {
        cache: "no-store",
      });
      const j = (await r.json()) as ApiResponse;
      if (!j.ok || !j.draft) {
        setError(j.error ?? "fetch_failed");
        setData(null);
        return;
      }
      setData(j);
      setDraft(JSON.parse(JSON.stringify(j.draft)) as ProfileConfig);

      // Preview defaults
      const firstMaterial = (j.draft as ProfileConfig).materials[0];
      if (firstMaterial) setPreviewMaterialId(firstMaterial.id);

      const defaultOptions: Record<string, string | string[]> = {};
      for (const [group_id, group] of Object.entries(
        (j.draft as ProfileConfig).options
      )) {
        if (group.single_select && group.items[0]) {
          defaultOptions[group_id] = group.items[0].id;
        } else if (!group.single_select) {
          defaultOptions[group_id] = [];
        }
      }
      setPreviewOptions(defaultOptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "network");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Sefa 17 May v4: Single-step save. Form değişti mi (canlıdan farklı mı)?
  const isDirty = data && draft && !deepEqual(draft, data.live);

  // Form-anında diff (canlı vs şu anki form)
  const draftFormDiff = useMemo<DiffEntry[]>(() => {
    if (!data?.live || !draft) return [];
    return diffProfileConfig(data.live, draft);
  }, [data?.live, draft]);

  // Material/option/tier satırlarında "değişti" rozet için
  // Satır seviyesi değişiklik kontrolü — form ↔ canlı
  const isItemChanged = (
    section: "material" | "option" | "tier",
    id_or_idx: string | number,
    group_id?: string
  ): boolean => {
    if (!data?.live || !draft) return false;
    if (section === "material" && typeof id_or_idx === "string") {
      return isMaterialChanged(data.live, draft, id_or_idx);
    }
    if (section === "option" && typeof id_or_idx === "string" && group_id) {
      return isOptionChanged(data.live, draft, group_id, id_or_idx);
    }
    if (section === "tier" && typeof id_or_idx === "number") {
      return isTierChanged(data.live, draft, id_or_idx);
    }
    return false;
  };

  // Sefa 17 May v4: Single-step save. Form değişikliği direkt canlıya kaydedilir.
  // Draft mekanizması kaldırıldı (gerçek hayatta solo founder için gereksiz).
  // Canlı önizleme zaten teklif/hesap fonksiyonu görüyor.
  const handleSave = async () => {
    if (!draft) return;
    if (
      !confirm(
        "Değişiklikler canlıya kaydedilecek. Müşteri tarafı yeni fiyatları görür. Devam?"
      )
    )
      return;
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/pricing?scope=${scope}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: draft }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (j.ok) {
        toast.success("✓ Canlıya kaydedildi");
        await refresh();
      } else toast.error(j.error ?? "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async (historyId: string) => {
    if (!confirm("Bu noktaya geri dönülecek. Devam?")) return;
    const r = await fetch(`/api/admin/pricing/revert?scope=${scope}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ history_id: historyId }),
    });
    const j = (await r.json()) as { ok?: boolean; error?: string };
    if (j.ok) {
      toast.success("↩ Geri alındı");
      await refresh();
    } else toast.error(j.error ?? "Hata");
  };

  // Tabaka mode mu? (pricing_mode === "sheet" veya scope etiket_tabaka)
  const isSheetMode = useMemo(() => {
    if (draft?.pricing_mode) return draft.pricing_mode === "sheet";
    return scope === "etiket_tabaka";
  }, [draft, scope]);

  // Live preview hesaplama
  const previewResult = useMemo(() => {
    if (!draft || !previewMaterialId) return null;
    const defaults = SCOPE_PREVIEW_DEFAULTS[scope];
    const sheets_needed = isSheetMode
      ? calcSheetsNeeded(defaults.width, defaults.height, defaults.qty)
      : undefined;
    return calculatePrice(
      {
        width_mm: defaults.width,
        height_mm: defaults.height,
        qty: defaults.qty,
        material_id: previewMaterialId,
        selected_options: previewOptions,
        sheets_needed,
      },
      draft
    );
  }, [draft, previewMaterialId, previewOptions, scope, isSheetMode]);

  if (loading && !data) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="h-8 bg-gri-100 rounded animate-pulse w-1/3 mb-4" />
          <div className="h-[600px] bg-gri-100 rounded-2xl animate-pulse" />
        </div>
      </main>
    );
  }

  if (error || !data || !draft) {
    return (
      <main className="py-12">
        <div className="mx-auto max-w-[640px] px-4 text-center">
          <Pim pose="sad" size={140} />
          <h1 className="mt-4 text-[22px] font-semibold">
            Fiyat config yüklenemedi
          </h1>
          <p className="mt-2 text-base text-gri-700">{error ?? "?"}</p>
          <Button variant="primary" onClick={() => void refresh()} className="mt-4">
            Tekrar dene
          </Button>
        </div>
      </main>
    );
  }

  const updateMaterial = (idx: number, patch: Partial<MaterialItem>) => {
    const next = { ...draft, materials: [...draft.materials] };
    next.materials[idx] = { ...next.materials[idx], ...patch };
    setDraft(next);
  };

  // Sefa 19 May v68: sıralama desteği — admin sırası müşteri tarafına
  // aynen yansır (/sticker /etiket render adminConfig.materials/options'tan).
  const moveMaterial = (idx: number, direction: -1 | 1) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= draft.materials.length) return;
    const next = { ...draft, materials: [...draft.materials] };
    [next.materials[idx], next.materials[newIdx]] = [
      next.materials[newIdx],
      next.materials[idx],
    ];
    setDraft(next);
  };

  const moveOptionItem = (
    group_id: string,
    item_idx: number,
    direction: -1 | 1
  ) => {
    const newIdx = item_idx + direction;
    const items = draft.options[group_id]?.items;
    if (!items || newIdx < 0 || newIdx >= items.length) return;
    const next: ProfileConfig = JSON.parse(JSON.stringify(draft));
    [next.options[group_id].items[item_idx], next.options[group_id].items[newIdx]] = [
      next.options[group_id].items[newIdx],
      next.options[group_id].items[item_idx],
    ];
    setDraft(next);
  };

  const updateOptionItem = (
    group_id: string,
    item_idx: number,
    patch: Partial<OptionItem>
  ) => {
    const next: ProfileConfig = JSON.parse(JSON.stringify(draft));
    if (!next.options[group_id]) return;
    next.options[group_id].items[item_idx] = {
      ...next.options[group_id].items[item_idx],
      ...patch,
    };
    setDraft(next);
  };

  const updateTier = (idx: number, patch: Partial<TierConfig>) => {
    const next = { ...draft, tiers: [...draft.tiers] };
    next.tiers[idx] = { ...next.tiers[idx], ...patch };
    setDraft(next);
  };

  const updateOperationField = (key: keyof ProfileConfig["operation"], value: number) => {
    setDraft({ ...draft, operation: { ...draft.operation, [key]: value } });
  };

  const updateMarginPct = (value: number) => {
    setDraft({ ...draft, margin: { pct: value } });
  };

  const updateVatPct = (value: number) => {
    setDraft({ ...draft, vat: { pct: value } });
  };

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1400px] px-4 md:px-8">
        {/* Header */}
        <div className="mb-5">
          <Eyebrow>Yönetim</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Fiyat Yönetimi
          </h1>
          <p className="mt-1.5 text-base text-gri-700 leading-relaxed max-w-[700px]">
            <strong>Birim maliyet</strong> gir (sticker/rulo &rarr; m² · tabaka
            &rarr; 1 tabaka), sistem üstüne adet kademesi + özelleştirme % + kâr
            marjı + KDV ekler. Tatmin olunca{" "}
            <strong>Canlıya kaydet</strong>.
          </p>
        </div>

        {/* Status banner — Sefa 17 May v4 sadeleştirildi (Draft kaldırıldı) */}
        <Card
          padding="p-4"
          className={cn(
            "mb-4",
            isDirty
              ? "!bg-saman/10 ring-saman/30"
              : "!bg-yesil-soft/30 ring-yesil/30"
          )}
        >
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <span className="text-[28px]">{isDirty ? "✏" : "🟢"}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[15px] text-lacivert">
                {isDirty
                  ? "Kaydedilmemiş değişiklikler var"
                  : "Her şey canlıda — güncel"}
              </div>
              <div className="text-[12px] text-gri-700 mt-1 leading-relaxed">
                <span className="inline-flex items-center gap-1">
                  🟢 <strong>Son kayıt:</strong>
                  <span>{timeAgo(data.live_updated_at ?? null)}</span>
                  {data.live_updated_by_email && (
                    <span className="text-gri-500">
                      · {data.live_updated_by_email}
                    </span>
                  )}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory((s) => !s)}
            >
              {showHistory ? "Geçmiş gizle" : "📋 Tüm geçmiş"}
            </Button>
          </div>

          {/* Form-anında diff — canlıdan ne değişti */}
          {isDirty && draftFormDiff.length > 0 && (
            <div className="rounded-lg bg-white/60 ring-1 ring-saman/30 p-3">
              <div className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-saman-koyu mb-2">
                ✏ Kayıt sonrası canlıya çıkacak ({draftFormDiff.length})
              </div>
              <ul className="space-y-1 text-[12.5px] max-h-[180px] overflow-y-auto">
                {draftFormDiff.slice(0, 8).map((d, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 leading-relaxed"
                  >
                    <span className="inline-flex items-center h-[16px] px-1.5 rounded text-[9.5px] font-bold uppercase bg-gri-100 text-gri-700">
                      {d.section}
                    </span>
                    <span className="text-gri-700">{d.label}:</span>
                    <span className="font-mono text-kirmizi line-through text-[11.5px]">
                      {d.old_value}
                    </span>
                    <span className="text-gri-500">→</span>
                    <span className="font-mono text-yesil font-bold text-[11.5px]">
                      {d.new_value}
                    </span>
                  </li>
                ))}
                {draftFormDiff.length > 8 && (
                  <li className="text-[11.5px] text-gri-500 italic">
                    ... ve {draftFormDiff.length - 8} değişiklik daha
                  </li>
                )}
              </ul>
            </div>
          )}
        </Card>

        {/* Scope tabs */}
        <div className="mb-5 flex gap-2 flex-wrap">
          {(["sticker", "etiket_rulo", "etiket_tabaka"] as Scope[]).map((s) => {
            const meta = SCOPE_META[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  if (isDirty) {
                    if (
                      !confirm(
                        "Kaydedilmemiş değişiklik var, yine de geçeyim mi?"
                      )
                    )
                      return;
                  }
                  setScope(s);
                }}
                className={cn(
                  "px-4 py-2.5 rounded-full text-[13.5px] font-semibold transition-colors",
                  scope === s
                    ? "bg-lacivert text-white"
                    : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                )}
              >
                {meta.emoji} {meta.label}
              </button>
            );
          })}
        </div>

        {/* Scope description */}
        <p className="text-[12.5px] text-gri-700 italic mb-5">
          {SCOPE_META[scope].desc}
        </p>

        {/* History panel */}
        {showHistory && (
          <Card padding="p-4" className="mb-5">
            <h3 className="font-semibold text-[14px] mb-3">
              📋 Son 30 değişiklik
            </h3>
            {!data.history || data.history.length === 0 ? (
              <div className="text-[13px] text-gri-500 italic">
                Henüz değişiklik yok
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {data.history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-3 p-2 rounded bg-gri-50 ring-1 ring-gri-200 text-[12px]"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center h-[20px] px-2 rounded-full text-[10.5px] font-bold uppercase",
                          h.action === "publish"
                            ? "bg-yesil-soft text-yesil"
                            : h.action === "revert"
                              ? "bg-saman/15 text-saman-koyu"
                              : "bg-gri-100 text-gri-700"
                        )}
                      >
                        {h.action === "publish"
                          ? "🚀 Yayın"
                          : h.action === "revert"
                            ? "↩ Geri"
                            : "💾 Draft"}
                      </span>
                      <span className="font-mono text-[11px] text-lacivert">
                        {fmtDateTime(h.changed_at)}
                      </span>
                      <span className="text-gri-700">
                        {h.changed_by_email ?? "—"}
                      </span>
                    </div>
                    {h.action !== "revert" && (
                      <button
                        type="button"
                        onClick={() => void handleRevert(h.id)}
                        className="text-[11.5px] font-semibold text-pim-mercan hover:underline"
                      >
                        Geri dön ↩
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Main grid: Form (left) + Preview (right) */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
          {/* SOL — FORM */}
          <div className="space-y-5">
            {/* Materials — scope'a göre m² ya da tabaka bazlı */}
            <Card padding="p-5">
              <h2 className="font-semibold text-[16px] mb-1 flex items-center gap-2">
                🎨{" "}
                <span>
                  Malzemeler (
                  {isSheetMode ? "1 tabaka maliyeti" : "m² maliyet"})
                </span>
              </h2>
              <p className="text-[12px] text-gri-700 mb-3 leading-relaxed">
                {isSheetMode ? (
                  <>
                    Her malzeme için <strong>TL/tabaka</strong> (23×31 cm 1
                    tabaka) maliyeti. Sistem geometriye göre kaç tabaka
                    gerektiğini hesaplar.
                  </>
                ) : (
                  <>
                    Her malzeme için <strong>TL/m²</strong> birim maliyeti.
                    Atölye tarifesinden direkt girersin.
                  </>
                )}
              </p>
              <div className="space-y-2">
                <div className="grid grid-cols-[32px_80px_1.5fr_2fr_160px] gap-2 text-[10.5px] uppercase tracking-[0.04em] font-bold text-gri-700">
                  <span className="text-center">Sıra</span>
                  <span>ID</span>
                  <span>Ad</span>
                  <span>Açıklama</span>
                  <span className="text-right">
                    {isSheetMode ? "Tabaka mal. (TL)" : "m² maliyet (TL)"}
                  </span>
                </div>
                {draft.materials.map((m, i) => {
                  const changed = isItemChanged("material", m.id);
                  const inputVal = isSheetMode
                    ? (m.sheet_cost_try ?? 0)
                    : (m.m2_cost_try ?? 0);
                  const isFirst = i === 0;
                  const isLast = i === draft.materials.length - 1;
                  return (
                  <div
                    key={m.id}
                    className={cn(
                      "grid grid-cols-[32px_80px_1.5fr_2fr_160px] gap-2 items-center rounded px-1 py-0.5",
                      changed && "bg-saman/10"
                    )}
                  >
                    {/* Sefa 19 May v68: sıra ↑↓ — müşteri tarafına bire bir yansır */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveMaterial(i, -1)}
                        disabled={isFirst}
                        title="Yukarı taşı"
                        className="h-4 rounded text-[10px] text-gri-700 hover:bg-gri-100 hover:text-pim-mercan disabled:opacity-25 disabled:hover:bg-transparent"
                      >▲</button>
                      <button
                        type="button"
                        onClick={() => moveMaterial(i, +1)}
                        disabled={isLast}
                        title="Aşağı taşı"
                        className="h-4 rounded text-[10px] text-gri-700 hover:bg-gri-100 hover:text-pim-mercan disabled:opacity-25 disabled:hover:bg-transparent"
                      >▼</button>
                    </div>
                    <span className="px-2 h-9 rounded bg-gri-100 text-[11px] font-mono text-gri-700 inline-flex items-center gap-1">
                      {m.id}
                      {changed && <span className="text-saman-koyu" title="Değişti">●</span>}
                    </span>
                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) => updateMaterial(i, { name: e.target.value })}
                      className="px-3 h-9 rounded-lg bg-white ring-1 ring-gri-200 text-[13px] focus:outline-none focus:ring-pim-mercan"
                    />
                    <input
                      type="text"
                      value={m.desc ?? ""}
                      onChange={(e) => updateMaterial(i, { desc: e.target.value })}
                      className="px-3 h-9 rounded-lg bg-white ring-1 ring-gri-200 text-[12.5px] focus:outline-none focus:ring-pim-mercan"
                    />
                    <input
                      type="number"
                      value={inputVal}
                      step={isSheetMode ? 1 : 10}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        updateMaterial(
                          i,
                          isSheetMode
                            ? { sheet_cost_try: v }
                            : { m2_cost_try: v }
                        );
                      }}
                      className={cn(
                        "px-3 h-9 rounded-lg bg-white ring-1 ring-gri-200 text-[13px] text-right font-semibold tabular-nums focus:outline-none focus:ring-pim-mercan",
                        changed && "ring-saman bg-saman/10"
                      )}
                    />
                  </div>
                );
                })}
              </div>
            </Card>

            {/* Options groups — dynamic render */}
            {Object.entries(draft.options).map(([group_id, group]) => (
              <Card padding="p-5" key={group_id}>
                <h2 className="font-semibold text-[16px] mb-1 flex items-center gap-2">
                  ✨ <span>{group.label}</span>
                  <span
                    className={cn(
                      "ml-2 inline-flex items-center h-[20px] px-2 rounded-full text-[10px] font-bold",
                      group.single_select
                        ? "bg-pim-mercan-tint text-pim-mercan"
                        : "bg-yesil-soft text-yesil"
                    )}
                  >
                    {group.single_select ? "TEK SEÇİM" : "ÇOKLU SEÇİM"}
                  </span>
                </h2>
                <p className="text-[12px] text-gri-700 mb-3 leading-relaxed">
                  Yüzde <strong>toplamsal</strong> eklenir (ana fiyat × (1 + Σ%)).
                  {!group.single_select && (
                    <> Birden fazla seçilebilir, %'ler toplanır.</>
                  )}
                </p>
                <div className="space-y-2">
                  <div className="grid grid-cols-[32px_80px_1.5fr_2fr_120px] gap-2 text-[10.5px] uppercase tracking-[0.04em] font-bold text-gri-700">
                    <span className="text-center">Sıra</span>
                    <span>ID</span>
                    <span>Ad</span>
                    <span>Açıklama</span>
                    <span className="text-right">% Ekleme</span>
                  </div>
                  {group.items.map((it: OptionItem, idx: number) => {
                    const changed = isItemChanged("option", it.id, group_id);
                    const isFirst = idx === 0;
                    const isLast = idx === group.items.length - 1;
                    return (
                    <div
                      key={it.id}
                      className={cn(
                        "grid grid-cols-[32px_80px_1.5fr_2fr_120px] gap-2 items-center rounded px-1 py-0.5",
                        changed && "bg-saman/10"
                      )}
                    >
                      {/* Sefa 19 May v68: option sırası müşteri tarafına yansır */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveOptionItem(group_id, idx, -1)}
                          disabled={isFirst}
                          title="Yukarı taşı"
                          className="h-4 rounded text-[10px] text-gri-700 hover:bg-gri-100 hover:text-pim-mercan disabled:opacity-25 disabled:hover:bg-transparent"
                        >▲</button>
                        <button
                          type="button"
                          onClick={() => moveOptionItem(group_id, idx, +1)}
                          disabled={isLast}
                          title="Aşağı taşı"
                          className="h-4 rounded text-[10px] text-gri-700 hover:bg-gri-100 hover:text-pim-mercan disabled:opacity-25 disabled:hover:bg-transparent"
                        >▼</button>
                      </div>
                      <span className="px-2 h-9 rounded bg-gri-100 text-[11px] font-mono text-gri-700 inline-flex items-center gap-1">
                        {it.id}
                        {changed && <span className="text-saman-koyu" title="Değişti">●</span>}
                      </span>
                      <input
                        type="text"
                        value={it.name}
                        onChange={(e) =>
                          updateOptionItem(group_id, idx, { name: e.target.value })
                        }
                        className="px-3 h-9 rounded-lg bg-white ring-1 ring-gri-200 text-[13px] focus:outline-none focus:ring-pim-mercan"
                      />
                      <input
                        type="text"
                        value={it.desc ?? ""}
                        onChange={(e) =>
                          updateOptionItem(group_id, idx, { desc: e.target.value })
                        }
                        className="px-3 h-9 rounded-lg bg-white ring-1 ring-gri-200 text-[12.5px] focus:outline-none focus:ring-pim-mercan"
                      />
                      <div className="relative">
                        <input
                          type="number"
                          value={it.pct_add}
                          step={1}
                          onChange={(e) =>
                            updateOptionItem(group_id, idx, {
                              pct_add: Number(e.target.value),
                            })
                          }
                          className={cn(
                            "w-full px-3 pr-7 h-9 rounded-lg bg-white ring-1 ring-gri-200 text-[13px] text-right font-semibold tabular-nums focus:outline-none focus:ring-pim-mercan",
                            it.pct_add === 0 && "text-gri-500"
                          )}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gri-500 text-[11px]">
                          %
                        </span>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </Card>
            ))}

            {/* Tiers */}
            <Card padding="p-5">
              <h2 className="font-semibold text-[16px] mb-1 flex items-center gap-2">
                📊 <span>Adet kademeleri (çarpansal)</span>
              </h2>
              <p className="text-[12px] text-gri-700 mb-3 leading-relaxed">
                Adet × çarpan. <strong>1.00 = referans</strong>, <strong>&gt;1.00 = zam</strong>,{" "}
                <strong>&lt;1.00 = indirim</strong>.
              </p>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_2fr] gap-2 text-[10.5px] uppercase tracking-[0.04em] font-bold text-gri-700">
                  <span>Adet</span>
                  <span>Çarpan</span>
                  <span>Label</span>
                </div>
                {draft.tiers.map((t, i) => {
                  const changed = isItemChanged("tier", i);
                  return (
                  <div
                    key={i}
                    className={cn(
                      "grid grid-cols-[1fr_1fr_2fr] gap-2 items-center rounded px-1 py-0.5",
                      changed && "bg-saman/10"
                    )}
                  >
                    <input
                      type="number"
                      value={t.qty}
                      step={1}
                      onChange={(e) => updateTier(i, { qty: Number(e.target.value) })}
                      className="px-3 h-9 rounded-lg bg-white ring-1 ring-gri-200 text-[13px] tabular-nums focus:outline-none focus:ring-pim-mercan"
                    />
                    <input
                      type="number"
                      value={t.multiplier}
                      step={0.01}
                      onChange={(e) =>
                        updateTier(i, { multiplier: Number(e.target.value) })
                      }
                      className={cn(
                        "px-3 h-9 rounded-lg bg-white ring-1 ring-gri-200 text-[13px] tabular-nums focus:outline-none focus:ring-pim-mercan",
                        t.multiplier === 1 && "ring-yesil bg-yesil-soft/40",
                        t.multiplier < 1 && "text-yesil",
                        t.multiplier > 1 && "text-kirmizi"
                      )}
                    />
                    <input
                      type="text"
                      value={t.label}
                      onChange={(e) => updateTier(i, { label: e.target.value })}
                      className="px-3 h-9 rounded-lg bg-white ring-1 ring-gri-200 text-[13px] focus:outline-none focus:ring-pim-mercan"
                    />
                  </div>
                  );
                })}
              </div>
            </Card>

            {/* Operation + Margin + KDV (single card) */}
            <Card padding="p-5">
              <h2 className="font-semibold text-[16px] mb-3 flex items-center gap-2">
                💰 <span>Operasyon + Marj + KDV</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <NumField
                  label="Setup (TL)"
                  value={draft.operation.setup}
                  step={5}
                  onChange={(v) => updateOperationField("setup", v)}
                />
                <NumField
                  label="Paketleme (TL/adet)"
                  value={draft.operation.packaging_per_unit}
                  step={0.005}
                  onChange={(v) => updateOperationField("packaging_per_unit", v)}
                />
                <NumField
                  label="Kargo (TL)"
                  value={draft.operation.cargo}
                  step={5}
                  onChange={(v) => updateOperationField("cargo", v)}
                />
                <NumField
                  label="Komisyon (%)"
                  value={draft.operation.fee_pct}
                  step={0.1}
                  onChange={(v) => updateOperationField("fee_pct", v)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumField
                  label="Kâr marjı (%)"
                  value={draft.margin.pct}
                  step={1}
                  onChange={updateMarginPct}
                />
                <NumField
                  label="KDV (%)"
                  value={draft.vat.pct}
                  step={1}
                  onChange={updateVatPct}
                />
              </div>
            </Card>
          </div>

          {/* SAĞ — Aksiyon + Preview */}
          <div className="space-y-4 xl:sticky xl:top-4 h-fit">
            {/* Sefa 17 May v4: Tek buton — direkt canlıya kaydet */}
            <Card padding="p-4">
              <h3 className="font-semibold text-[13.5px] mb-3">⚡ Aksiyon</h3>
              <Button
                variant="primary"
                size="md"
                block
                onClick={() => void handleSave()}
                disabled={!isDirty || saving}
                className={cn(
                  "!bg-yesil hover:!bg-yesil/90 !text-white",
                  !isDirty && "!bg-gri-200 !text-gri-500"
                )}
              >
                {saving
                  ? "Kaydediliyor..."
                  : isDirty
                    ? "💾 Canlıya kaydet"
                    : "✓ Güncel"}
              </Button>
              <div className="mt-3 text-[11px] text-gri-700 leading-relaxed">
                Değişiklikler <strong>anında canlıya</strong> kaydedilir,
                müşteriler 5 dakika içinde yeni fiyatları görür. Hata olursa{" "}
                <strong>Geçmiş</strong> panelinden eski sürüme geri dönebilirsin.
              </div>
            </Card>

            {/* Live preview */}
            <Card padding="p-4" className="!bg-krem">
              <h3 className="font-semibold text-[13.5px] mb-3 flex items-center gap-2">
                🔮 <span>Canlı önizleme</span>
              </h3>

              {/* Material seçimi */}
              <div className="mb-3">
                <label className="block text-[10.5px] font-bold uppercase text-gri-700 mb-1">
                  Malzeme
                </label>
                <select
                  value={previewMaterialId}
                  onChange={(e) => setPreviewMaterialId(e.target.value)}
                  className="w-full px-2 h-9 rounded-lg bg-white ring-1 ring-gri-200 text-[12.5px]"
                >
                  {draft.materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (
                      {isSheetMode
                        ? `${m.sheet_cost_try ?? "?"} TL/tabaka`
                        : `${m.m2_cost_try ?? "?"} TL/m²`}
                      )
                    </option>
                  ))}
                </select>
              </div>

              {/* Options seçimi */}
              {Object.entries(draft.options).map(([gid, group]) => (
                <div key={gid} className="mb-3">
                  <label className="block text-[10.5px] font-bold uppercase text-gri-700 mb-1">
                    {group.label}
                  </label>
                  {group.single_select ? (
                    <select
                      value={(previewOptions[gid] as string) ?? ""}
                      onChange={(e) =>
                        setPreviewOptions({
                          ...previewOptions,
                          [gid]: e.target.value,
                        })
                      }
                      className="w-full px-2 h-9 rounded-lg bg-white ring-1 ring-gri-200 text-[12.5px]"
                    >
                      <option value="">— seçilmedi —</option>
                      {group.items.map((it: OptionItem) => (
                        <option key={it.id} value={it.id}>
                          {it.name} (+{it.pct_add}%)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-1">
                      {group.items.map((it: OptionItem) => {
                        const arr = (previewOptions[gid] as string[]) ?? [];
                        const checked = arr.includes(it.id);
                        return (
                          <label
                            key={it.id}
                            className="flex items-center gap-2 text-[12px] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const newArr = e.target.checked
                                  ? [...arr, it.id]
                                  : arr.filter((id) => id !== it.id);
                                setPreviewOptions({
                                  ...previewOptions,
                                  [gid]: newArr,
                                });
                              }}
                              className="accent-pim-mercan"
                            />
                            <span>
                              {it.name} (+{it.pct_add}%)
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              <div className="text-[11px] text-gri-700 mb-2">
                Boyut:{" "}
                <strong>
                  {SCOPE_PREVIEW_DEFAULTS[scope].width}×
                  {SCOPE_PREVIEW_DEFAULTS[scope].height}mm
                </strong>{" "}
                · Adet: <strong>{SCOPE_PREVIEW_DEFAULTS[scope].qty}</strong>
              </div>

              {/* Hesap sonucu */}
              {previewResult?.ok ? (
                <div className="text-[11.5px] space-y-1 font-mono leading-relaxed text-lacivert">
                  <Row
                    label={
                      isSheetMode && previewResult.sheets_used
                        ? `Base (${previewResult.sheets_used} tabaka)`
                        : "Base (m²×alan×adet)"
                    }
                    value={fmtMoney2(previewResult.base)}
                  />
                  <Row
                    label={`Tier × ${previewResult.tier.multiplier}`}
                    value={fmtMoney2(previewResult.tiered)}
                  />
                  <Row
                    label={`+ % toplam ${previewResult.options_pct_total}`}
                    value={fmtMoney2(previewResult.with_options)}
                  />
                  <Row
                    label="+ Operasyon"
                    value={`+${fmtMoney2(previewResult.operation_cost)}`}
                  />
                  <Row label="Toplam maliyet" value={fmtMoney2(previewResult.cost_total)} />
                  <Row
                    label={`+ Margin %${draft.margin.pct}`}
                    value={fmtMoney2(previewResult.with_margin)}
                  />
                  <Row label="+ Fee gross-up" value={fmtMoney2(previewResult.with_fee)} />
                  <Row
                    label={`+ KDV %${draft.vat.pct}`}
                    value={fmtMoney2(previewResult.final)}
                  />
                  <div className="border-t border-pim-mercan/30 pt-2 mt-2">
                    <div className="font-sans">
                      <div className="text-[10.5px] uppercase tracking-[0.04em] text-pim-mercan font-bold">
                        Müşteri görür
                      </div>
                      <div className="text-[20px] font-bold text-pim-mercan tabular-nums">
                        {fmtMoney(previewResult.final)}
                      </div>
                      <div className="text-[11px] text-gri-700">
                        Birim: {previewResult.unit_price.toFixed(2)} TL/adet
                      </div>
                    </div>
                  </div>
                </div>
              ) : previewResult ? (
                <div className="text-[12px] text-kirmizi">
                  ⚠ {previewResult.reason}
                  {previewResult.hint && (
                    <>
                      <br />
                      {previewResult.hint}
                    </>
                  )}
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function NumField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-[0.04em] font-bold text-gri-700 mb-1">
        {label}
      </label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 h-10 rounded-[10px] bg-white ring-1 ring-gri-200 text-[14px] tabular-nums focus:outline-none focus:ring-pim-mercan"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gri-700">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
