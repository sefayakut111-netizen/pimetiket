/**
 * /admin/gorseller — Site Image Management
 *
 * Slot-bazlı görsel yönetim paneli. SITE_IMAGE_SLOTS catalog'undaki
 * her slot için:
 *   - Mevcut görsel önizlemesi (varsa)
 *   - Yükle / Değiştir butonu (drag & drop)
 *   - Alt text + title + link URL meta input'ları
 *   - Aktif / pasif toggle
 *   - Kaldır butonu
 *
 * Kategori bazlı grupla (Anasayfa / Sayfalar / Sosyal medya / Blog).
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import {
  Button,
  Card,
  Eyebrow,
  Input,
  Skeleton,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  SITE_IMAGE_SLOTS,
  CATEGORY_LABEL,
  type SiteImageSlot,
  type SlotCategory,
} from "@/lib/site-image-slots";

interface SiteImageItem {
  slot: string;
  storagePath: string;
  publicUrl: string;
  altText: string | null;
  title: string | null;
  linkUrl: string | null;
  isActive: boolean;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  mimeType: string | null;
  updatedAt: string;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Az önce";
  if (min < 60) return `${min} dk`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa`;
  const day = Math.floor(hr / 24);
  return `${day} gün`;
}

export default function AdminGorsellerPage() {
  const toast = useToast();
  const [items, setItems] = useState<Record<string, SiteImageItem>>({});
  const [loading, setLoading] = useState(true);
  const [busySlot, setBusySlot] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site-images");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: SiteImageItem[] };
      const map: Record<string, SiteImageItem> = {};
      for (const item of data.items) map[item.slot] = item;
      setItems(map);
    } catch (e) {
      toast.error("Liste yüklenemedi");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Gruplama (kategori bazlı)
  const groups: Record<SlotCategory, SiteImageSlot[]> = {
    anasayfa: [],
    sayfalar: [],
    sosyal: [],
    blog: [],
    diger: [],
  };
  for (const slot of SITE_IMAGE_SLOTS) groups[slot.category].push(slot);

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        {/* Header */}
        <div className="mb-6">
          <Eyebrow>Site İçeriği</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Görseller
          </h1>
          <p className="mt-1.5 text-base text-gri-700 max-w-[640px] leading-relaxed">
            Anasayfa hero, sosyal paylaşım görseli, sayfa kapak resimleri —
            her slot için tek görsel atanır. Yeni görsel yüklendiğinde
            eskisi otomatik silinir.
          </p>
        </div>

        {/* Bilgi kartı */}
        <Card padding="p-4" className="mb-6 bg-pim-mercan-tint ring-pim-mercan/15">
          <div className="flex items-start gap-3 text-[13px] text-lacivert">
            <Icon.Info size={16} className="text-pim-mercan shrink-0 mt-0.5" />
            <div>
              <strong>Format ve boyut:</strong> JPEG / PNG / WebP / SVG (max
              5 MB). Her slot için önerilen oran/boyut farklı —{" "}
              <strong>başlığa tıklayıp detayları gör</strong>. Mobilde küçük,
              masaüstünde büyük yükleme için WebP tavsiye edilir.
            </div>
          </div>
        </Card>

        {/* Kategori grupları */}
        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : (
          (Object.keys(groups) as SlotCategory[])
            .filter((cat) => groups[cat].length > 0)
            .map((cat) => (
              <section key={cat} className="mb-8">
                <h2 className="text-[15px] font-semibold uppercase tracking-[0.04em] text-gri-700 mb-3">
                  {CATEGORY_LABEL[cat]}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {groups[cat].map((slot) => (
                    <SlotCard
                      key={slot.id}
                      slot={slot}
                      item={items[slot.id]}
                      busy={busySlot === slot.id}
                      setBusy={(b) => setBusySlot(b ? slot.id : null)}
                      onRefresh={refresh}
                    />
                  ))}
                </div>
              </section>
            ))
        )}

        {!loading && Object.keys(items).length === 0 && (
          <Card padding="p-10" className="text-center mt-4">
            <Pim pose="wait" size={120} />
            <h3 className="mt-4 text-lg font-semibold">
              Henüz görsel yüklenmedi
            </h3>
            <p className="mt-2 text-[13px] text-gri-700 max-w-[480px] mx-auto leading-relaxed">
              Yukarıdaki slot'lardan birine görsel yükleyince burada
              gözükecek. Önce <strong>Anasayfa Hero</strong>'dan başlamak
              iyi fikir — sitenin ilk izlenimi orası.
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}

// ============================================================
// Slot Card — tek slot için yükle/değiştir/sil UI
// ============================================================
function SlotCard({
  slot,
  item,
  busy,
  setBusy,
  onRefresh,
}: {
  slot: SiteImageSlot;
  item: SiteImageItem | undefined;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [altText, setAltText] = useState(item?.altText ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [linkUrl, setLinkUrl] = useState(item?.linkUrl ?? "");

  // Item değişince meta'yı senkronize et
  useEffect(() => {
    setAltText(item?.altText ?? "");
    setTitle(item?.title ?? "");
    setLinkUrl(item?.linkUrl ?? "");
  }, [item?.slot, item?.altText, item?.title, item?.linkUrl]);

  const onFileSelect = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slot", slot.id);
      if (altText) fd.append("alt_text", altText);
      if (title) fd.append("title", title);
      if (linkUrl) fd.append("link_url", linkUrl);

      const res = await fetch("/api/admin/site-images", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.ok) {
        toast.error(data.detail ?? data.error ?? "Yükleme başarısız");
        return;
      }
      toast.success(`${slot.label} güncellendi`);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bağlantı hatası");
    } finally {
      setBusy(false);
    }
  };

  const onMetaSave = async () => {
    if (!item) {
      toast.info("Önce görsel yükle, sonra meta'yı düzenleyebilirsin");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/site-images?slot=${encodeURIComponent(slot.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            alt_text: altText || null,
            title: title || null,
            link_url: linkUrl || null,
          }),
        }
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.ok) {
        toast.error(data.detail ?? data.error ?? "Meta güncellenemedi");
        return;
      }
      toast.success("Meta kaydedildi");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bağlantı hatası");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!item) return;
    if (
      !confirm(`"${slot.label}" görseli silinsin mi? Bu geri alınamaz.`)
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/site-images?slot=${encodeURIComponent(slot.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error("Silinemedi");
        return;
      }
      toast.success("Silindi");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bağlantı hatası");
    } finally {
      setBusy(false);
    }
  };

  const onToggleActive = async () => {
    if (!item) return;
    setBusy(true);
    try {
      await fetch(
        `/api/admin/site-images?slot=${encodeURIComponent(slot.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ is_active: !item.isActive }),
        }
      );
      onRefresh();
    } catch {
      /* silent */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="p-0" className="overflow-hidden">
      {/* Görsel önizleme alanı */}
      <div className="relative aspect-[4/3] bg-gri-50 grid place-items-center overflow-hidden">
        {item?.publicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.publicUrl}
            alt={item.altText ?? slot.label}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-center text-gri-500">
            <Icon.Box size={36} className="mx-auto mb-2" />
            <div className="text-[12.5px] font-semibold">Henüz yok</div>
            <div className="text-[11px] mt-0.5">
              Önerilen: {slot.dimensions.width}×{slot.dimensions.height}
            </div>
          </div>
        )}
        {/* Üst sağ rozet — aktif/pasif */}
        {item && (
          <button
            type="button"
            onClick={onToggleActive}
            disabled={busy}
            className={cn(
              "absolute top-2 right-2 inline-flex items-center h-[22px] px-2 rounded-full text-[10.5px] font-bold cursor-pointer transition-colors",
              item.isActive
                ? "bg-yesil text-white"
                : "bg-gri-200 text-gri-700"
            )}
          >
            {item.isActive ? "AKTİF" : "PASİF"}
          </button>
        )}
      </div>

      {/* Slot bilgisi */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-left w-full"
            >
              <div className="font-semibold text-[14px] text-lacivert">
                {slot.label}
              </div>
              <div className="text-[11.5px] text-gri-500 font-mono mt-0.5">
                {slot.id}
              </div>
            </button>
            {slot.previewPath && (
              <Link
                href={slot.previewPath}
                target="_blank"
                className="text-[11.5px] text-pim-mercan font-semibold hover:underline mt-1 inline-block"
              >
                Sayfayı aç →
              </Link>
            )}
          </div>
          <div className="text-right text-[11px] text-gri-500 shrink-0">
            <div>
              {slot.aspectRatio} · {slot.dimensions.width}×
              {slot.dimensions.height}
            </div>
            {item && (
              <div className="mt-0.5">
                {formatSize(item.sizeBytes)} · {timeAgo(item.updatedAt)}
              </div>
            )}
          </div>
        </div>

        {expanded && (
          <p className="text-[12px] text-gri-700 leading-relaxed bg-gri-50 rounded-lg p-2.5">
            {slot.description}
          </p>
        )}

        {/* Upload buton + dosya input (her zaman görünür) */}
        <label className="block">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileSelect(f);
              e.target.value = "";
            }}
            className="hidden"
          />
          <span
            className={cn(
              "inline-flex items-center justify-center gap-1.5 w-full h-10 px-4 rounded-full font-semibold text-[13px] cursor-pointer transition-colors",
              busy
                ? "bg-gri-200 text-gri-500 cursor-wait"
                : item
                  ? "bg-white ring-1 ring-pim-mercan text-pim-mercan hover:bg-pim-mercan-tint"
                  : "bg-pim-mercan text-white hover:bg-pim-mercan-koyu"
            )}
          >
            {busy ? (
              "İşleniyor…"
            ) : item ? (
              <>
                <Icon.Refresh size={14} /> Değiştir
              </>
            ) : (
              <>
                <Icon.Plus size={14} /> Yükle
              </>
            )}
          </span>
        </label>

        {/* Meta input'ları */}
        {item && (
          <div className="space-y-2 pt-2 border-t border-gri-100">
            <div>
              <label
                htmlFor={`alt-${slot.id}`}
                className="block text-[11px] uppercase tracking-[0.04em] text-gri-700 font-semibold mb-1"
              >
                Alt text (SEO + accessibility)
              </label>
              <Input
                id={`alt-${slot.id}`}
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Pim Etiket sticker örneği"
                className="!h-10 !text-[13px]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor={`title-${slot.id}`}
                  className="block text-[11px] uppercase tracking-[0.04em] text-gri-700 font-semibold mb-1"
                >
                  Title (opsiyonel)
                </label>
                <Input
                  id={`title-${slot.id}`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Hover tooltip"
                  className="!h-10 !text-[13px]"
                />
              </div>
              <div>
                <label
                  htmlFor={`link-${slot.id}`}
                  className="block text-[11px] uppercase tracking-[0.04em] text-gri-700 font-semibold mb-1"
                >
                  Link URL (opsiyonel)
                </label>
                <Input
                  id={`link-${slot.id}`}
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="!h-10 !text-[13px]"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={onMetaSave}
                disabled={busy}
              >
                <Icon.Check size={12} /> Meta kaydet
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={busy}
                className="!text-kirmizi hover:!bg-kirmizi-soft"
              >
                <Icon.X size={12} /> Sil
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
