/**
 * /admin/urunler — Ürün kartları yönetimi (Sefa 21 May v68 Mig 074)
 *
 * Etiket (11) + Sticker (11) grid kartları. Tab seçici, her satır:
 *   - Küçük preview (etiket için <img>, sticker için badge)
 *   - title_tr / title_en inline edit
 *   - desc_tr / desc_en modal edit (Düzenle butonu)
 *   - ↑↓ sıra butonları
 *   - Aktif/Pasif toggle
 *   - "Görünür" public switch
 *
 * Ekle/Sil YOK — Sefa kararı (kart adedi sabit, 22).
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, Input, Modal, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ProductCard, ProductCardType } from "@/lib/product-cards";

type EditableField = "title_tr" | "title_en" | "desc_tr" | "desc_en";

export default function AdminUrunlerPage() {
  const toast = useToast();
  const [cards, setCards] = useState<ProductCard[]>([]);
  const [activeTab, setActiveTab] = useState<ProductCardType>("etiket");
  const [loading, setLoading] = useState(true);
  const [editingCard, setEditingCard] = useState<ProductCard | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch all cards
  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/product-cards", { cache: "no-store" });
      const j = await r.json();
      if (r.ok && Array.isArray(j.cards)) {
        setCards(j.cards as ProductCard[]);
      } else {
        toast.error(j.error ?? "Kartlar yüklenemedi");
      }
    } catch {
      toast.error("Ağ hatası — sayfayı yenile");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const tabCards = cards.filter((c) => c.product_type === activeTab);

  // PATCH helper
  const patchCard = async (
    id: string,
    patch: Partial<Record<EditableField | "is_active", string | boolean>>
  ) => {
    const r = await fetch("/api/admin/product-cards", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const j = await r.json();
    if (!r.ok) {
      toast.error(j.error ?? "Güncellenemedi");
      return false;
    }
    // Local state güncelle — patch type'ı union, ProductCard'a cast
    setCards((prev) =>
      prev.map((c) =>
        c.id === id ? ({ ...c, ...patch } as ProductCard) : c
      )
    );
    return true;
  };

  // Reorder helper
  const reorderTab = async (newOrder: ProductCard[]) => {
    // Optimistic local update
    const reordered = newOrder.map((c, idx) => ({ ...c, sort_order: idx + 1 }));
    setCards((prev) => [
      ...prev.filter((c) => c.product_type !== activeTab),
      ...reordered,
    ]);
    // Send to server
    const r = await fetch("/api/admin/product-cards/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        product_type: activeTab,
        order: newOrder.map((c) => c.id),
      }),
    });
    if (!r.ok) {
      const j = await r.json();
      toast.error(j.error ?? "Sıralama kaydedilemedi");
      void loadCards(); // rollback
    }
  };

  const moveCard = (id: string, dir: "up" | "down") => {
    const idx = tabCards.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const targetIdx = dir === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= tabCards.length) return;
    const reordered = [...tabCards];
    [reordered[idx], reordered[targetIdx]] = [
      reordered[targetIdx],
      reordered[idx],
    ];
    void reorderTab(reordered);
  };

  const toggleActive = async (card: ProductCard) => {
    await patchCard(card.id, { is_active: !card.is_active });
    toast.success(
      !card.is_active ? "Kart aktif edildi" : "Kart pasif edildi"
    );
  };

  const saveEdit = async (
    id: string,
    patch: Partial<Record<EditableField, string>>
  ) => {
    setSaving(true);
    const ok = await patchCard(id, patch);
    setSaving(false);
    if (ok) {
      toast.success("Değişiklikler kaydedildi");
      setEditingCard(null);
    }
  };

  return (
    <main className="bg-gri-50 min-h-[calc(100vh-64px)] py-6 md:py-8">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Header */}
        <div className="mb-5 md:mb-7 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <Eyebrow>Admin</Eyebrow>
            <h1 className="mt-3 text-[24px] md:text-[32px] font-semibold tracking-tight">
              Ürün kartları
            </h1>
            <p className="mt-2 text-[13px] text-gri-700 max-w-2xl leading-relaxed">
              /etiket ve /sticker grid sayfalarında görünen kartların başlık,
              alt başlık, sıra ve görünürlüğünü buradan yönet.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex gap-2">
          {(["etiket", "sticker"] as const).map((t) => {
            const count = cards.filter((c) => c.product_type === t).length;
            const isActive = activeTab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex items-center gap-2 h-10 px-4 rounded-full font-semibold text-[13.5px] transition-colors",
                  isActive
                    ? "bg-pim-mercan text-white"
                    : "bg-white text-gri-700 ring-1 ring-gri-200 hover:ring-pim-mercan"
                )}
              >
                {t === "etiket" ? "Etiket" : "Sticker"}
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded-full text-[11px] tabular-nums",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-gri-100 text-gri-700"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* List */}
        <Card padding="p-0" className="overflow-hidden">
          {loading ? (
            // Sefa 21 May v68 (site denetim P1 #7): "Yükleniyor..." metni
            // yerine satır skeleton'ı — algılanan bekleme süresi düşer.
            <ul className="divide-y divide-gri-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="p-4 md:p-5">
                  <div className="grid grid-cols-[64px_1fr_auto] md:grid-cols-[80px_1fr_auto] gap-4 items-start">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-gri-100 animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 w-[60%] rounded bg-gri-100 animate-pulse" />
                      <div className="h-3 w-[80%] rounded bg-gri-100 animate-pulse" />
                    </div>
                    <div className="h-6 w-[80px] rounded bg-gri-100 animate-pulse" />
                  </div>
                </li>
              ))}
            </ul>
          ) : tabCards.length === 0 ? (
            <div className="p-12 text-center text-gri-500">Kart yok</div>
          ) : (
            <ul className="divide-y divide-gri-100">
              {tabCards.map((card, idx) => (
                <li
                  key={card.id}
                  className={cn(
                    "p-4 md:p-5 transition-colors",
                    !card.is_active && "bg-gri-50 opacity-60"
                  )}
                >
                  <div className="grid grid-cols-[64px_1fr_auto] md:grid-cols-[80px_1fr_auto] gap-4 items-start">
                    {/* Preview */}
                    <div className="grid place-items-center w-16 h-16 md:w-20 md:h-20 rounded-lg bg-gri-50 ring-1 ring-gri-200 overflow-hidden shrink-0">
                      {card.image_src ? (
                        <Image
                          src={card.image_src}
                          alt={card.title_tr}
                          width={80}
                          height={80}
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <div className="text-center p-1">
                          <div className="text-[20px]"></div>
                          <div className="text-[9px] text-gri-500 uppercase mt-0.5">
                            {card.svg_id}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Title + meta */}
                    <div className="min-w-0">
                      <div className="font-semibold text-[14.5px] text-lacivert truncate">
                        {card.title_tr}
                      </div>
                      <div className="text-[12px] text-gri-500 truncate">
                        {card.title_en}
                      </div>
                      <div className="text-[12px] text-gri-700 mt-1 leading-snug line-clamp-2">
                        {card.desc_tr}
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px]">
                        <span className="inline-flex items-center px-2 h-[20px] rounded bg-gri-100 text-gri-700 font-mono">
                          {card.key}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center px-2 h-[20px] rounded font-semibold",
                            card.is_active
                              ? "bg-yesil-soft text-yesil"
                              : "bg-gri-200 text-gri-700"
                          )}
                        >
                          {card.is_active ? "Aktif" : "Pasif"}
                        </span>
                        <span className="text-gri-500">
                          Sıra: {card.sort_order}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {/* Sıra ↑↓ */}
                      <div className="inline-flex rounded-lg ring-1 ring-gri-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => moveCard(card.id, "up")}
                          disabled={idx === 0}
                          aria-label="Yukarı taşı"
                          className="w-8 h-8 grid place-items-center text-gri-700 hover:bg-gri-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          ↑
                        </button>
                        <span className="w-px bg-gri-200" />
                        <button
                          type="button"
                          onClick={() => moveCard(card.id, "down")}
                          disabled={idx === tabCards.length - 1}
                          aria-label="Aşağı taşı"
                          className="w-8 h-8 grid place-items-center text-gri-700 hover:bg-gri-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          ↓
                        </button>
                      </div>

                      {/* Edit + Toggle */}
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingCard(card)}
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] font-semibold text-pim-mercan hover:bg-pim-mercan-tint/50 transition-colors"
                        >
                          <Icon.Edit size={12} />
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(card)}
                          className={cn(
                            "inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors",
                            card.is_active
                              ? "text-gri-700 hover:bg-gri-100"
                              : "text-yesil hover:bg-yesil-soft"
                          )}
                          aria-label={
                            card.is_active ? "Pasifle" : "Aktif et"
                          }
                        >
                          {card.is_active ? " Gizle" : " Göster"}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Müşteri sayfası linki */}
        <div className="mt-4 text-[12px] text-gri-700">
          <Link
            href={activeTab === "etiket" ? "/etiket" : "/sticker"}
            target="_blank"
            className="font-semibold text-pim-mercan hover:underline"
          >
            Müşteri /{activeTab} sayfasında nasıl görünüyor? →
          </Link>
        </div>
      </div>

      {/* Edit Modal */}
      {editingCard && (
        <EditModal
          card={editingCard}
          onClose={() => setEditingCard(null)}
          onSave={saveEdit}
          saving={saving}
        />
      )}
    </main>
  );
}

// ============================================================
// Edit Modal — title_tr/en + desc_tr/en
// ============================================================

function EditModal({
  card,
  onClose,
  onSave,
  saving,
}: {
  card: ProductCard;
  onClose: () => void;
  onSave: (
    id: string,
    patch: Partial<Record<EditableField, string>>
  ) => void | Promise<void>;
  saving: boolean;
}) {
  const [titleTr, setTitleTr] = useState(card.title_tr);
  const [titleEn, setTitleEn] = useState(card.title_en);
  const [descTr, setDescTr] = useState(card.desc_tr);
  const [descEn, setDescEn] = useState(card.desc_en);

  const dirty =
    titleTr !== card.title_tr ||
    titleEn !== card.title_en ||
    descTr !== card.desc_tr ||
    descEn !== card.desc_en;

  const handleSave = () => {
    const patch: Partial<Record<EditableField, string>> = {};
    if (titleTr !== card.title_tr) patch.title_tr = titleTr;
    if (titleEn !== card.title_en) patch.title_en = titleEn;
    if (descTr !== card.desc_tr) patch.desc_tr = descTr;
    if (descEn !== card.desc_en) patch.desc_en = descEn;
    void onSave(card.id, patch);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Düzenle — ${card.title_tr}`}
      maxWidthClassName="max-w-[640px]"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1.5">
              Başlık (TR)
            </span>
            <Input
              value={titleTr}
              onChange={(e) => setTitleTr(e.target.value)}
              maxLength={100}
              placeholder="Özel Kesim Rulo Etiket"
            />
            <span className="block text-[10.5px] text-gri-500 mt-1 tabular-nums">
              {titleTr.length}/100
            </span>
          </label>
          <label className="block">
            <span className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1.5">
              Başlık (EN)
            </span>
            <Input
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              maxLength={100}
              placeholder="Die-Cut Roll Label"
            />
            <span className="block text-[10.5px] text-gri-500 mt-1 tabular-nums">
              {titleEn.length}/100
            </span>
          </label>
        </div>
        <label className="block">
          <span className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1.5">
            Alt başlık (TR)
          </span>
          <textarea
            value={descTr}
            onChange={(e) => setDescTr(e.target.value)}
            maxLength={200}
            rows={2}
            className="block w-full px-3.5 py-2.5 rounded-[10px] bg-white text-[14px] text-lacivert ring-1 ring-gri-200 focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)] transition-all resize-none"
            placeholder="Logo veya tasarımın silüetine kesim"
          />
          <span className="block text-[10.5px] text-gri-500 mt-1 tabular-nums">
            {descTr.length}/200
          </span>
        </label>
        <label className="block">
          <span className="block text-[11.5px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-1.5">
            Alt başlık (EN)
          </span>
          <textarea
            value={descEn}
            onChange={(e) => setDescEn(e.target.value)}
            maxLength={200}
            rows={2}
            className="block w-full px-3.5 py-2.5 rounded-[10px] bg-white text-[14px] text-lacivert ring-1 ring-gri-200 focus:outline-none focus:ring-pim-mercan focus:shadow-[0_0_0_4px_var(--color-pim-mercan-tint)] transition-all resize-none"
            placeholder="Cut to your design's silhouette"
          />
          <span className="block text-[10.5px] text-gri-500 mt-1 tabular-nums">
            {descEn.length}/200
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-2 border-t border-gri-200">
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
