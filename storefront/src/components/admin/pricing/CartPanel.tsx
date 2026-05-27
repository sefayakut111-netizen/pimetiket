/**
 * CartPanel — admin tool sepet bileşeni.
 *
 * Hem /admin/fiyat-hesapla (sticker) hem /admin/fiyat-hesapla-etiket
 * sayfalarında full-width section olarak görünür.
 *
 * - Liste: her item satır (boyut, adet, fiyat, sil)
 * - Aynı boyut grubunda olan item'lar grup indirimi alır
 * - Toplam: subtotalAfterDiscount, vatTotal, total (KDV dahil)
 * - "Sepetin PDF'i" — tüm item'lar için toplu iş emri
 * - "Sepeti temizle"
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  listCart,
  removeFromCart,
  clearCart,
  summarizeCart,
  updateCartItemName,
  type CartItem,
} from "@/lib/pricing-cart";

interface CartPanelProps {
  /** PDF üretici callback — kart array verir, üretici toplu PDF yapar */
  onGeneratePDF?: (items: CartItem[]) => void;
}

const fmt = (n: number) =>
  Math.round(n).toLocaleString("tr-TR");
const fmtUnit = (n: number) =>
  n.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function CartPanel({ onGeneratePDF }: CartPanelProps) {
  const toast = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const refresh = useCallback(() => {
    setItems(listCart());
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    if (typeof window !== "undefined") {
      window.addEventListener("pim_cart_updated", handler);
      return () => window.removeEventListener("pim_cart_updated", handler);
    }
  }, [refresh]);

  const summary = summarizeCart();
  const isEmpty = items.length === 0;

  function handleRemove(id: string) {
    removeFromCart(id);
    refresh();
  }

  function handleClear() {
    if (!confirm("Tüm sepet boşaltılacak. Emin misin?")) return;
    clearCart();
    refresh();
    toast.success("Sepet temizlendi");
  }

  function handleStartEdit(item: CartItem) {
    setEditingId(item.id);
    setEditName(item.name);
  }

  function handleSaveEdit() {
    if (editingId) {
      updateCartItemName(editingId, editName);
      setEditingId(null);
      setEditName("");
      refresh();
    }
  }

  function handleGeneratePDF() {
    if (isEmpty) {
      toast.error("Sepet boş");
      return;
    }
    if (!onGeneratePDF) {
      toast.error("PDF üretici tanımlı değil");
      return;
    }
    onGeneratePDF(items);
  }

  return (
    <Card padding="p-0" className="overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gri-200 bg-gri-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[20px]"></span>
          <div>
            <h3 className="text-[16px] font-semibold tracking-tight">Sepet</h3>
            <p className="text-[11px] text-gri-700 tabular-nums">
              {items.length} tasarım
              {items.length > 0 && (
                <>
                  {" · "}
                  {summary.productCounts.sticker > 0 && (
                    <span>{summary.productCounts.sticker} sticker</span>
                  )}
                  {summary.productCounts.sticker > 0 &&
                    summary.productCounts.etiket > 0 &&
                    " · "}
                  {summary.productCounts.etiket > 0 && (
                    <span>{summary.productCounts.etiket} etiket</span>
                  )}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isEmpty && (
            <>
              <Button variant="ghost" size="sm" onClick={handleClear}>
                Temizle
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleGeneratePDF}
                disabled={!onGeneratePDF}
              >
                 Toplu PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      {isEmpty ? (
        <div className="px-5 py-12 text-center">
          <div className="text-[36px] opacity-40 mb-3"></div>
          <p className="text-[14px] text-gri-700 mb-1">
            Sepet boş — bir hesap yap, &ldquo;Sepete Ekle&rdquo; tıkla
          </p>
          <p className="text-[11.5px] text-gri-500">
            Aynı boyutta birden fazla tasarımda ek indirim kazanırsın
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gri-100">
            {summary.result.items.map((line, idx) => {
              const item = items.find((i) => i.id === line.id);
              if (!item) return null;
              const isEditing = editingId === line.id;
              const hasGroupDiscount = line.groupDiscountPct > 0;
              return (
                <div
                  key={line.id}
                  className="px-5 py-3 grid grid-cols-[28px_1fr_auto_auto] gap-4 items-center hover:bg-gri-50 transition-colors"
                >
                  <span className="grid place-items-center w-7 h-7 rounded-full bg-pim-mercan text-white text-[11px] font-bold tabular-nums">
                    {idx + 1}
                  </span>

                  <div className="min-w-0">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") {
                            setEditingId(null);
                            setEditName("");
                          }
                        }}
                        autoFocus
                        className="w-full bg-white ring-1 ring-pim-mercan rounded px-2 py-1 text-[14px] font-bold focus:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="font-bold text-[14px] truncate hover:text-pim-mercan text-left"
                        title="İsim değiştir"
                      >
                        {item.name}
                      </button>
                    )}
                    <div className="text-[11px] text-gri-700 tabular-nums flex flex-wrap gap-2 items-center mt-0.5">
                      <span
                        className={cn(
                          "inline-block px-1.5 rounded text-[10px] font-bold uppercase tracking-[0.04em]",
                          item.product === "sticker"
                            ? "bg-pim-mercan-tint text-pim-mercan-koyu"
                            : "bg-krem text-lacivert"
                        )}
                      >
                        {item.product}
                      </span>
                      <span>
                        {item.width}×{item.height}mm
                      </span>
                      <span>{item.requestedQty.toLocaleString("tr-TR")} ad.</span>
                      {item.cut && (
                        <span className="text-gri-500">{item.cut}</span>
                      )}
                      {item.materialId && (
                        <span className="text-gri-500">{item.materialId}</span>
                      )}
                      {Math.abs(item.tierMultiplier - 1) > 0.001 && (
                        <span
                          className={cn(
                            "px-1.5 rounded text-[10px] font-semibold",
                            item.tierMultiplier > 1
                              ? "bg-pim-mercan-tint text-pim-mercan-koyu"
                              : "bg-yesil-soft text-yesil"
                          )}
                        >
                          Tier{" "}
                          {item.tierMultiplier > 1 ? "+" : "−"}%
                          {Math.abs((item.tierMultiplier - 1) * 100).toFixed(0)}
                        </span>
                      )}
                      {hasGroupDiscount && (
                        <span className="px-1.5 rounded text-[10px] font-semibold bg-yesil-soft text-yesil">
                          Grup −%{(line.groupDiscountPct * 100).toFixed(0)} ({line.groupCount})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right tabular-nums">
                    {hasGroupDiscount && (
                      <div className="text-[11px] text-gri-500 line-through">
                        {fmt(line.preGroupTotal)} ₺
                      </div>
                    )}
                    <div className="font-bold text-[15px] tabular-nums">
                      {fmt(line.finalTotal)} ₺
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemove(line.id)}
                    aria-label={`${item.name} sepetten çıkar`}
                    className="grid place-items-center w-7 h-7 rounded-full bg-white ring-1 ring-gri-200 text-gri-500 hover:ring-kirmizi hover:text-kirmizi hover:bg-kirmizi/5 transition-colors"
                  >
                    <Icon.X size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="px-5 py-4 bg-gradient-to-br from-krem-soft to-krem border-t border-gri-200">
            <div className="space-y-1.5 text-[13px]">
              <div className="flex justify-between items-baseline">
                <span className="text-gri-700">Ara Toplam (KDV hariç)</span>
                <span className="tabular-nums font-medium">
                  {fmt(summary.result.subtotalBeforeDiscount)} ₺
                </span>
              </div>
              {summary.result.groupDiscountTotal > 0 && (
                <div className="flex justify-between items-baseline text-yesil font-semibold">
                  <span>Grup İndirimleri</span>
                  <span className="tabular-nums">
                    −{fmt(summary.result.groupDiscountTotal)} ₺
                  </span>
                </div>
              )}
              <div className="flex justify-between items-baseline">
                <span className="text-gri-700">Matrah</span>
                <span className="tabular-nums font-medium">
                  {fmt(summary.result.subtotalAfterDiscount)} ₺
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-gri-700">KDV</span>
                <span className="tabular-nums font-medium">
                  {fmt(summary.result.vatTotal)} ₺
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-2 mt-2 border-t-2 border-lacivert/20">
                <span className="font-bold text-[14px]">GENEL TOPLAM</span>
                <span className="tabular-nums font-bold text-[24px] text-pim-mercan-koyu">
                  {fmt(summary.result.total)} ₺
                </span>
              </div>
              <div className="text-[11px] text-gri-500 text-center mt-1.5 tabular-nums">
                {summary.result.totalStickers.toLocaleString("tr-TR")} toplam adet
                · KDV dahil
              </div>
            </div>
          </div>

          {/* Discount detail (varsa) */}
          {summary.result.groupDiscountTotal > 0 && (
            <div className="px-5 py-3 bg-yesil-soft/30 border-t border-yesil/20">
              <div className="text-[11px] font-semibold text-yesil mb-1.5">
                 Aktif grup indirimleri
              </div>
              {Object.entries(summary.result.groups)
                .filter(([, g]) => g.discountPct > 0)
                .map(([key, g]) => {
                  const productName = key.startsWith("sticker:")
                    ? "sticker"
                    : "etiket";
                  return (
                    <div
                      key={key}
                      className="text-[11.5px] tabular-nums flex justify-between"
                    >
                      <span>
                        {productName} {g.width}×{g.height}mm — {g.count} tasarım
                      </span>
                      <span className="font-semibold text-yesil">
                        −%{(g.discountPct * 100).toFixed(0)}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
