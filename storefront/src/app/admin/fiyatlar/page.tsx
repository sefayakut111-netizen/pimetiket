/**
 * Pim Etiket — /admin/fiyatlar
 *
 * Sefa 17 May: "fiyat girebileceiğim bir alan yok".
 *
 * 3 tab: Sticker · Etiket · (Global ileride)
 * Her tab:
 *   - Production (fason rate VEYA 6 üretim kalemi)
 *   - Operation (setup / packaging / cargo / fee%)
 *   - Margin (margin% / KDV% / minMarkup)
 *   - Tier matrix (qty + multiplier + label)
 *   - Material/Coating/Customization multiplier'ları (etiket için)
 *
 * Akış:
 *   1. Sayfa açılınca GET /api/admin/pricing?scope=X → draft + live
 *   2. Sefa formu doldurur → "💾 Draft kaydet" (PUT)
 *   3. Tatmin olunca → "🚀 Canlıya yayınla" (POST publish)
 *   4. Sorun olursa → History panelinden "↩ Bu noktaya dön"
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { Pim } from "@/components/Pim";
import { Card, Eyebrow, Button, Input, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type {
  StickerScopeConfig,
  EtiketScopeConfig,
  PricingHistoryRow,
  ScopeName,
  MultiplierItem,
  TierConfig,
} from "@/lib/pricing-config";

type Scope = "sticker" | "etiket";

interface ApiResponse {
  ok?: boolean;
  scope?: ScopeName;
  draft?: StickerScopeConfig | EtiketScopeConfig;
  live?: StickerScopeConfig | EtiketScopeConfig;
  draft_updated_at?: string | null;
  draft_updated_by_email?: string | null;
  live_updated_at?: string | null;
  live_updated_by_email?: string | null;
  history?: PricingHistoryRow[];
  error?: string;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
  const [scope, setScope] = useState<Scope>("etiket");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [draft, setDraft] = useState<StickerScopeConfig | EtiketScopeConfig | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

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
      // Draft'ı initial value olarak set et (deep clone)
      setDraft(JSON.parse(JSON.stringify(j.draft)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "network");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isDirty = data && draft && !deepEqual(draft, data.draft);
  const isLiveBehindDraft = data && !deepEqual(data.draft, data.live);

  const handleSaveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/pricing?scope=${scope}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (j.ok) {
        toast.success("💾 Draft kaydedildi");
        await refresh();
      } else {
        toast.error(j.error ?? "Kaydedilemedi");
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (
      !confirm(
        "Draft canlıya yayınlanacak. Müşteri tarafı yeni fiyatları anında görecek. Devam?"
      )
    )
      return;
    setPublishing(true);
    try {
      const r = await fetch(
        `/api/admin/pricing/publish?scope=${scope}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (j.ok) {
        toast.success("🚀 Canlıya yayınlandı");
        await refresh();
      } else {
        toast.error(j.error ?? "Yayınlama başarısız");
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleRevert = async (historyId: string) => {
    if (!confirm("Bu noktaya geri dönülecek (live config). Devam?")) return;
    const r = await fetch(`/api/admin/pricing/revert?scope=${scope}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ history_id: historyId }),
    });
    const j = (await r.json()) as { ok?: boolean; error?: string };
    if (j.ok) {
      toast.success("↩ Geri alındı");
      await refresh();
    } else {
      toast.error(j.error ?? "Hata");
    }
  };

  // Form helpers ===============================================================

  const updateDraft = (
    updater: (
      d: StickerScopeConfig | EtiketScopeConfig
    ) => StickerScopeConfig | EtiketScopeConfig
  ) => {
    if (!draft) return;
    setDraft(updater(JSON.parse(JSON.stringify(draft))));
  };

  const updateNumber = (path: string[], value: number) => {
    if (!draft) return;
    const next = JSON.parse(JSON.stringify(draft));
    let cursor: Record<string, unknown> = next;
    for (let i = 0; i < path.length - 1; i++) {
      cursor = cursor[path[i]] as Record<string, unknown>;
    }
    cursor[path[path.length - 1]] = value;
    setDraft(next);
  };

  if (loading && !data) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="h-8 bg-gri-100 rounded animate-pulse w-1/3 mb-4" />
          <div className="h-[500px] bg-gri-100 rounded-2xl animate-pulse" />
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

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Eyebrow>Yönetim</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              Fiyat Yönetimi
            </h1>
            <p className="mt-1.5 text-base text-gri-700 leading-relaxed max-w-[640px]">
              Üretim maliyetlerini, kâr marjını, tier indirimlerini ve malzeme
              çarpanlarını buradan yönet. Önce <strong>draft</strong> olarak
              kaydet, tatmin olunca <strong>"Canlıya yayınla"</strong> ile
              müşteri sayfalarına aktar.
            </p>
          </div>
        </div>

        {/* Status banner */}
        <Card
          padding="p-4"
          className={cn(
            "mb-5",
            isDirty
              ? "!bg-saman/10 ring-saman/30"
              : isLiveBehindDraft
                ? "!bg-pim-mercan-tint ring-pim-mercan-soft"
                : "!bg-yesil-soft/30 ring-yesil/30"
          )}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[24px]">
              {isDirty ? "📝" : isLiveBehindDraft ? "📤" : "✓"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[13.5px] text-lacivert">
                {isDirty
                  ? "Kaydedilmemiş değişikliklerin var"
                  : isLiveBehindDraft
                    ? "Draft canlıdan farklı — yayınlanmayı bekliyor"
                    : "Her şey güncel: Draft = Live"}
              </div>
              <div className="text-[11.5px] text-gri-700 mt-0.5">
                Draft: {timeAgo(data.draft_updated_at ?? null)}
                {data.draft_updated_by_email && (
                  <> · {data.draft_updated_by_email}</>
                )}
                {" · "}
                Live: {timeAgo(data.live_updated_at ?? null)}
                {data.live_updated_by_email && (
                  <> · {data.live_updated_by_email}</>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory((s) => !s)}
              >
                {showHistory ? "Geçmişi gizle" : "📋 Geçmiş"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Scope tabs */}
        <div className="mb-5 flex gap-2 flex-wrap">
          {(["sticker", "etiket"] as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                if (isDirty) {
                  if (
                    !confirm(
                      "Kaydedilmemiş değişikliklerin var, yine de geçeyim mi?"
                    )
                  )
                    return;
                }
                setScope(s);
              }}
              className={cn(
                "px-5 py-2.5 rounded-full text-[13.5px] font-semibold transition-colors",
                scope === s
                  ? "bg-lacivert text-white"
                  : "bg-gri-100 text-gri-700 hover:bg-gri-200"
              )}
            >
              {s === "sticker" ? "🏷 Sticker" : "📋 Etiket"}
            </button>
          ))}
        </div>

        {/* History panel */}
        {showHistory && (
          <Card padding="p-5" className="mb-5">
            <h3 className="font-semibold text-[15px] mb-3">
              📋 Son 30 değişiklik
            </h3>
            {!data.history || data.history.length === 0 ? (
              <div className="text-[13px] text-gri-500 italic">
                Henüz değişiklik yok
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {data.history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-gri-50 ring-1 ring-gri-200 text-[12.5px]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={cn(
                            "inline-flex items-center h-[20px] px-2 rounded-full text-[10.5px] font-bold uppercase tracking-[0.04em]",
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
                        <span className="text-lacivert font-mono text-[11px]">
                          {fmtDateTime(h.changed_at)}
                        </span>
                      </div>
                      <div className="text-gri-700">
                        {h.changed_by_email ?? "—"}
                        {h.note && <> · {h.note}</>}
                      </div>
                    </div>
                    {h.action !== "revert" && (
                      <button
                        type="button"
                        onClick={() => void handleRevert(h.id)}
                        className="text-[11.5px] font-semibold text-pim-mercan hover:underline"
                      >
                        Bu noktaya dön ↩
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ============ FORM ============ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          <div className="space-y-5">
            {/* Production */}
            <Card padding="p-5">
              <h2 className="font-semibold text-[16px] mb-3 flex items-center gap-2">
                🏭 <span>Üretim maliyeti</span>
              </h2>
              <div className="text-[12.5px] text-gri-700 mb-3 leading-relaxed">
                Fason atölyeye ödediğin birim fiyat. Sticker için adet başına,
                etiket için adet başına. Mevcut tek mod: fason.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Fason rate (TL/adet)"
                  value={draft.production.fasonRate}
                  step={0.05}
                  onChange={(v) => updateNumber(["production", "fasonRate"], v)}
                />
              </div>
            </Card>

            {/* Operation */}
            <Card padding="p-5">
              <h2 className="font-semibold text-[16px] mb-3 flex items-center gap-2">
                📦 <span>Operasyon</span>
              </h2>
              <div className="text-[12.5px] text-gri-700 mb-3 leading-relaxed">
                Setup (kurulum sabit), paketleme (adet başı), kargo (sabit),
                ödeme komisyonu (% — PayTR + Vergi).
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <NumberField
                  label="Setup (TL)"
                  value={draft.operation.setup}
                  step={5}
                  onChange={(v) => updateNumber(["operation", "setup"], v)}
                />
                <NumberField
                  label="Paketleme (TL/adet)"
                  value={draft.operation.packaging}
                  step={0.005}
                  onChange={(v) => updateNumber(["operation", "packaging"], v)}
                />
                <NumberField
                  label="Kargo (TL)"
                  value={draft.operation.cargo}
                  step={5}
                  onChange={(v) => updateNumber(["operation", "cargo"], v)}
                />
                <NumberField
                  label="Komisyon (%)"
                  value={draft.operation.feePct}
                  step={0.1}
                  onChange={(v) => updateNumber(["operation", "feePct"], v)}
                />
              </div>
            </Card>

            {/* Margin */}
            <Card padding="p-5">
              <h2 className="font-semibold text-[16px] mb-3 flex items-center gap-2">
                💰 <span>Kâr marjı & KDV</span>
              </h2>
              <div className="text-[12.5px] text-gri-700 mb-3 leading-relaxed">
                Markup (cost-plus). Min markup floor (tier sonrası aşağı düşme
                korumasi).
              </div>
              <div className="grid grid-cols-3 gap-3">
                <NumberField
                  label="Kâr marjı (%)"
                  value={draft.margin.marginPct}
                  step={1}
                  onChange={(v) => updateNumber(["margin", "marginPct"], v)}
                />
                <NumberField
                  label="KDV (%)"
                  value={draft.margin.vatPct}
                  step={1}
                  onChange={(v) => updateNumber(["margin", "vatPct"], v)}
                />
                <NumberField
                  label="Min markup (0-1)"
                  value={draft.margin.minMarkupFraction}
                  step={0.01}
                  onChange={(v) =>
                    updateNumber(["margin", "minMarkupFraction"], v)
                  }
                />
              </div>
            </Card>

            {/* Tier matrix */}
            <Card padding="p-5">
              <h2 className="font-semibold text-[16px] mb-3 flex items-center gap-2">
                📊 <span>Adet kademeleri (Tier)</span>
              </h2>
              <div className="text-[12.5px] text-gri-700 mb-3 leading-relaxed">
                Adet × multiplier. "referans" tier = 1.00. Düşük adet zam, yüksek
                adet indirim olur. Çarpan toplam fiyata uygulanır.
              </div>
              <TierEditor
                tiers={draft.tiers}
                onChange={(newTiers) =>
                  updateDraft((d) => ({ ...d, tiers: newTiers }))
                }
              />
            </Card>

            {/* Etiket-specific: Material/Coating/Customization */}
            {scope === "etiket" && (
              <>
                <Card padding="p-5">
                  <h2 className="font-semibold text-[16px] mb-3 flex items-center gap-2">
                    🎨 <span>Malzeme çarpanları</span>
                  </h2>
                  <MultiplierEditor
                    items={(draft as EtiketScopeConfig).materials}
                    onChange={(items) =>
                      setDraft({
                        ...(draft as EtiketScopeConfig),
                        materials: items,
                      })
                    }
                  />
                </Card>
                <Card padding="p-5">
                  <h2 className="font-semibold text-[16px] mb-3 flex items-center gap-2">
                    ✨ <span>Kaplama çarpanları</span>
                  </h2>
                  <MultiplierEditor
                    items={(draft as EtiketScopeConfig).coatings}
                    onChange={(items) =>
                      setDraft({
                        ...(draft as EtiketScopeConfig),
                        coatings: items,
                      })
                    }
                  />
                </Card>
                <Card padding="p-5">
                  <h2 className="font-semibold text-[16px] mb-3 flex items-center gap-2">
                    💎 <span>Özelleştirme çarpanları</span>
                  </h2>
                  <MultiplierEditor
                    items={(draft as EtiketScopeConfig).customizations}
                    onChange={(items) =>
                      setDraft({
                        ...(draft as EtiketScopeConfig),
                        customizations: items,
                      })
                    }
                  />
                </Card>
              </>
            )}
          </div>

          {/* Sağ panel — actions + live preview */}
          <div className="space-y-4 lg:sticky lg:top-4 h-fit">
            <Card padding="p-4">
              <h3 className="font-semibold text-[13.5px] mb-3">⚡ Aksiyon</h3>
              <Button
                variant={isDirty ? "primary" : "ghost"}
                size="md"
                block
                onClick={() => void handleSaveDraft()}
                disabled={!isDirty || saving}
              >
                {saving ? "..." : isDirty ? "💾 Draft kaydet" : "✓ Kayıtlı"}
              </Button>
              <Button
                variant="primary"
                size="md"
                block
                onClick={() => void handlePublish()}
                disabled={!isLiveBehindDraft || publishing}
                className="mt-2 !bg-yesil hover:!bg-yesil/90"
              >
                {publishing
                  ? "..."
                  : isLiveBehindDraft
                    ? "🚀 Canlıya yayınla"
                    : "Yayınlanacak değişiklik yok"}
              </Button>
              <div className="mt-3 text-[11px] text-gri-700 leading-relaxed">
                <strong>Draft</strong> sadece sen görürsün. Test ettikten sonra{" "}
                <strong>Yayınla</strong> ile müşteri tarafına aktar.
              </div>
            </Card>

            <Card padding="p-4" className="!bg-krem">
              <h3 className="font-semibold text-[13.5px] mb-2">
                💡 Örnek fiyat preview
              </h3>
              <div className="text-[11.5px] text-gri-700 leading-relaxed">
                Burada draft'a göre örnek bir siparişin fiyatını canlı
                hesaplayacağız (yakında).
              </div>
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

function NumberField({
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

function TierEditor({
  tiers,
  onChange,
}: {
  tiers: TierConfig[];
  onChange: (next: TierConfig[]) => void;
}) {
  const update = (idx: number, patch: Partial<TierConfig>) => {
    const next = [...tiers];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_2fr] gap-2 text-[10.5px] uppercase tracking-[0.04em] font-bold text-gri-700">
        <span>Adet</span>
        <span>Çarpan</span>
        <span>Label (UI)</span>
      </div>
      {tiers.map((t, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_2fr] gap-2 items-center">
          <input
            type="number"
            value={t.qty}
            step={1}
            onChange={(e) => update(i, { qty: Number(e.target.value) })}
            className="px-3 h-9 rounded-lg bg-white ring-1 ring-gri-200 text-[13px] tabular-nums focus:outline-none focus:ring-pim-mercan"
          />
          <input
            type="number"
            value={t.multiplier}
            step={0.01}
            onChange={(e) =>
              update(i, { multiplier: Number(e.target.value) })
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
            onChange={(e) => update(i, { label: e.target.value })}
            className="px-3 h-9 rounded-lg bg-white ring-1 ring-gri-200 text-[13px] focus:outline-none focus:ring-pim-mercan"
          />
        </div>
      ))}
    </div>
  );
}

function MultiplierEditor({
  items,
  onChange,
}: {
  items: MultiplierItem[];
  onChange: (next: MultiplierItem[]) => void;
}) {
  const update = (idx: number, patch: Partial<MultiplierItem>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[80px_1.2fr_2fr_1fr] gap-2 text-[10.5px] uppercase tracking-[0.04em] font-bold text-gri-700">
        <span>ID</span>
        <span>Ad</span>
        <span>Açıklama</span>
        <span>Çarpan</span>
      </div>
      {items.map((it, i) => (
        <div
          key={it.id}
          className="grid grid-cols-[80px_1.2fr_2fr_1fr] gap-2 items-center"
        >
          <span className="px-2 h-9 rounded bg-gri-100 text-[11px] font-mono text-gri-700 inline-flex items-center">
            {it.id}
          </span>
          <input
            type="text"
            value={it.name}
            onChange={(e) => update(i, { name: e.target.value })}
            className="px-3 h-9 rounded-lg bg-white ring-1 ring-gri-200 text-[13px] focus:outline-none focus:ring-pim-mercan"
          />
          <input
            type="text"
            value={it.desc}
            onChange={(e) => update(i, { desc: e.target.value })}
            className="px-3 h-9 rounded-lg bg-white ring-1 ring-gri-200 text-[12.5px] focus:outline-none focus:ring-pim-mercan"
          />
          <input
            type="number"
            value={it.multiplier}
            step={0.05}
            onChange={(e) =>
              update(i, { multiplier: Number(e.target.value) })
            }
            className={cn(
              "px-3 h-9 rounded-lg bg-white ring-1 ring-gri-200 text-[13px] tabular-nums focus:outline-none focus:ring-pim-mercan",
              it.multiplier === 1 && "ring-yesil bg-yesil-soft/40"
            )}
          />
        </div>
      ))}
    </div>
  );
}
