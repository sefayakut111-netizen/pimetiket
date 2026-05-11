"use client";

/**
 * Pim Etiket — /admin/galeri
 *
 * Galeri öğeleri CRUD + sıralama (Sefa Madde 14, 11 May):
 *   - Görsel yükle (public-assets/gallery/)
 *   - Başlık + detay + ürün tipi + özellikler
 *   - Sıralama: ↑↓ butonları (drag-sort yerine basit)
 *   - Yayınla / yayından kaldır toggle
 *   - Sil (DB + Storage)
 *
 * ADET BİLGİSİ YAZMA — TKHK m.61 yanıltıcı reklam riski. Form'da
 * adet alanı yok, body alanı serbest ama UI'da uyarı: "adet yazma".
 */

import { useCallback, useEffect, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, Input, Modal, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

interface GalleryItem {
  id: string;
  image_path: string;
  title: string;
  body: string | null;
  product_type: "etiket" | "sticker" | "mixed";
  features: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

function publicUrlOf(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/public-assets/${path}`;
}

export default function AdminGaleriPage() {
  const toast = useToast();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<GalleryItem | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gallery");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "list_failed");
      setItems(json.items ?? []);
    } catch (err) {
      console.error("[admin/galeri]", err);
      toast.error("Liste alınamadı");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const togglePublish = async (item: GalleryItem) => {
    const res = await fetch(`/api/admin/gallery/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_published: !item.is_published }),
    });
    if (!res.ok) {
      toast.error("Güncellenemedi");
      return;
    }
    setItems((arr) =>
      arr.map((x) =>
        x.id === item.id ? { ...x, is_published: !item.is_published } : x
      )
    );
  };

  const remove = async (item: GalleryItem) => {
    if (!confirm(`"${item.title}" silinsin mi? Geri alınamaz.`)) return;
    const res = await fetch(`/api/admin/gallery/${item.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Silinemedi");
      return;
    }
    toast.success("Silindi");
    setItems((arr) => arr.filter((x) => x.id !== item.id));
  };

  const move = async (item: GalleryItem, dir: -1 | 1) => {
    const idx = items.findIndex((x) => x.id === item.id);
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;

    const newOrder = [...items];
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    setItems(newOrder);

    const res = await fetch("/api/admin/gallery/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order: newOrder.map((x) => x.id) }),
    });
    if (!res.ok) {
      toast.error("Sıralama kaydedilemedi");
      void refresh();
    }
  };

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Eyebrow>İçerik · Galeri</Eyebrow>
            <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
              Galeri yönetimi
            </h1>
            <p className="mt-1.5 text-base text-gri-700">
              {items.length} öğe ·{" "}
              <span className="text-yesil font-semibold">
                {items.filter((x) => x.is_published).length} yayında
              </span>
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            <Icon.Plus size={14} /> Yeni öğe ekle
          </Button>
        </div>

        {/* TKHK uyarı banner */}
        <Card padding="p-4" className="mb-5 !bg-sari-soft !ring-sari/30">
          <div className="flex items-start gap-3">
            <Icon.Info size={16} className="text-sari-koyu shrink-0 mt-0.5" />
            <div className="text-[12.5px] text-gri-700 leading-relaxed">
              <strong>Önemli:</strong> Galeri açıklamalarında adet bilgisi
              yazma (örn &ldquo;1000 sipariş&rdquo;, &ldquo;5000 baskı&rdquo;).
              TKHK m.61 yanıltıcı reklam riski. Hangi ürün + hangi özellikler
              + nasıl kullanıldığı yeterli.
            </div>
          </div>
        </Card>

        {loading && (
          <Card padding="p-8" className="text-center text-gri-700">
            Yükleniyor…
          </Card>
        )}

        {!loading && items.length === 0 && (
          <Card padding="p-12" className="text-center">
            <Pim pose="think" size={120} />
            <h3 className="mt-3 font-semibold text-base">
              Henüz galeri öğesi yok
            </h3>
            <p className="mt-2 text-[13px] text-gri-700 max-w-[420px] mx-auto leading-relaxed">
              İlk öğeyi eklemek için sağ üstteki butonu kullan. Galerideki
              öğeler ana sayfada ve /galeri sayfasında gösterilir.
            </p>
            <Button variant="primary" size="sm" onClick={() => setShowAdd(true)} className="mt-4">
              <Icon.Plus size={14} /> İlk öğeyi ekle
            </Button>
          </Card>
        )}

        {!loading && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item, idx) => (
              <Card
                key={item.id}
                padding="p-0"
                className={cn(
                  "overflow-hidden",
                  !item.is_published && "!ring-gri-200 opacity-70"
                )}
              >
                {/* Thumbnail */}
                <div className="aspect-[4/3] bg-gri-100 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={publicUrlOf(item.image_path)}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {!item.is_published && (
                    <span className="absolute top-2 left-2 inline-flex items-center h-[22px] px-2 rounded-full bg-gri-700 text-white text-[11px] font-semibold">
                      Taslak
                    </span>
                  )}
                  <span className="absolute top-2 right-2 inline-flex items-center h-[22px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[11px] font-semibold capitalize">
                    {item.product_type}
                  </span>
                </div>
                {/* Meta */}
                <div className="p-4">
                  <h3 className="font-semibold text-[14.5px] text-lacivert truncate">
                    {item.title}
                  </h3>
                  {item.features && (
                    <p className="text-[11.5px] text-gri-700 mt-1 truncate">
                      {item.features}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-3">
                    <button
                      type="button"
                      onClick={() => move(item, -1)}
                      disabled={idx === 0}
                      className="grid place-items-center w-7 h-7 rounded-md hover:bg-gri-100 text-gri-700 disabled:opacity-30"
                      aria-label="Yukarı taşı"
                      title="Yukarı"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(item, 1)}
                      disabled={idx === items.length - 1}
                      className="grid place-items-center w-7 h-7 rounded-md hover:bg-gri-100 text-gri-700 disabled:opacity-30"
                      aria-label="Aşağı taşı"
                      title="Aşağı"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePublish(item)}
                      className={cn(
                        "ml-auto inline-flex items-center h-7 px-2.5 rounded-full text-[11px] font-semibold",
                        item.is_published
                          ? "bg-yesil-soft text-yesil hover:bg-yesil hover:text-white"
                          : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                      )}
                    >
                      {item.is_published ? "Yayında" : "Taslak"}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(item)}
                      className="!px-2"
                    >
                      Düzenle
                    </Button>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      className="grid place-items-center w-7 h-7 rounded-md text-gri-500 hover:text-kirmizi hover:bg-kirmizi-soft"
                      aria-label="Sil"
                      title="Sil"
                    >
                      <Icon.X size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <GalleryEditor
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            void refresh();
          }}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <GalleryEditor
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </main>
  );
}

// ============================================================
// GalleryEditor modal (yeni / düzenle)
// ============================================================

function GalleryEditor({
  item,
  onClose,
  onSaved,
}: {
  item?: GalleryItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = !!item;

  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [productType, setProductType] = useState<
    "etiket" | "sticker" | "mixed"
  >(item?.product_type ?? "sticker");
  const [features, setFeatures] = useState(item?.features ?? "");
  const [imagePath, setImagePath] = useState(item?.image_path ?? "");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      // 1. Signed URL al
      const sigRes = await fetch("/api/admin/gallery/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ extension: ext }),
      });
      const sigJson = await sigRes.json();
      if (!sigRes.ok) {
        toast.error(sigJson.error ?? "Upload URL alınamadı");
        return;
      }
      // 2. PUT file
      const putRes = await fetch(sigJson.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "content-type": file.type },
      });
      if (!putRes.ok) {
        toast.error("Dosya yüklenemedi");
        return;
      }
      setImagePath(sigJson.path);
      toast.success("Görsel yüklendi");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Başlık zorunlu");
      return;
    }
    if (!imagePath) {
      toast.error("Görsel yüklenmedi");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        image_path: imagePath,
        title: title.trim(),
        body: body.trim() || null,
        product_type: productType,
        features: features.trim() || null,
      };
      const url = isEdit ? `/api/admin/gallery/${item!.id}` : "/api/admin/gallery";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Kaydedilemedi");
        return;
      }
      toast.success(isEdit ? "Güncellendi" : "Eklendi");
      onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={isEdit ? "Galeri öğesi düzenle" : "Yeni galeri öğesi"}
      maxWidthClassName="max-w-[640px]"
    >
      <div className="space-y-4">
        {/* Görsel */}
        <div>
          <label className="text-[12.5px] font-semibold mb-1 block">
            Görsel *
          </label>
          {imagePath ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicUrlOf(imagePath)}
                alt=""
                className="w-full max-h-[200px] object-cover rounded-lg ring-1 ring-gri-200"
              />
              <button
                type="button"
                onClick={() => setImagePath("")}
                className="absolute top-2 right-2 grid place-items-center w-7 h-7 rounded-full bg-white text-gri-700 shadow-1 hover:text-kirmizi"
              >
                <Icon.X size={14} />
              </button>
            </div>
          ) : (
            <label className="block w-full h-32 rounded-lg ring-1 ring-dashed ring-gri-300 bg-gri-50 hover:bg-white hover:ring-pim-mercan-soft cursor-pointer grid place-items-center text-[13px] text-gri-700">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadFile(f);
                }}
                className="hidden"
              />
              {uploading ? (
                <span>Yükleniyor…</span>
              ) : (
                <span className="text-center">
                  <Icon.Plus size={18} className="mx-auto mb-1" />
                  Görsel seç (JPG, PNG, WebP)
                </span>
              )}
            </label>
          )}
        </div>

        {/* Başlık */}
        <div>
          <label className="text-[12.5px] font-semibold mb-1 block">
            Başlık *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn: Kraft etiket — doğal sabun"
          />
        </div>

        {/* Ürün tipi */}
        <div>
          <label className="text-[12.5px] font-semibold mb-1 block">
            Ürün tipi *
          </label>
          <div className="flex gap-2">
            {(["etiket", "sticker", "mixed"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProductType(p)}
                className={cn(
                  "px-4 h-10 rounded-full text-[13px] font-semibold capitalize transition-colors",
                  productType === p
                    ? "bg-lacivert text-white"
                    : "bg-white ring-1 ring-gri-200 text-gri-700 hover:bg-gri-100"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Özellikler */}
        <div>
          <label className="text-[12.5px] font-semibold mb-1 block">
            Özellikler (kısa)
          </label>
          <Input
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            placeholder="Örn: kraft + soft touch · 40×60 mm"
          />
          <p className="text-[11px] text-gri-700 mt-1 leading-relaxed">
            Malzeme, kaplama, ölçü gibi kısa özet. <strong>Adet
            yazma.</strong>
          </p>
        </div>

        {/* Detay */}
        <div>
          <label className="text-[12.5px] font-semibold mb-1 block">
            Detay (opsiyonel)
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Bu öğenin hikayesi, müşterinin ne için kullandığı, hangi malzemenin seçildiği vb. Adet bilgisi yazma."
            className="w-full px-3 py-2 rounded-lg ring-1 ring-gri-200 focus:ring-2 focus:ring-pim-mercan outline-none text-[13px] resize-y"
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Vazgeç
        </Button>
        <Button
          variant="primary"
          onClick={submit}
          disabled={submitting || uploading}
        >
          {submitting
            ? "Kaydediliyor…"
            : isEdit
              ? "Güncelle"
              : "Ekle"}
        </Button>
      </div>
    </Modal>
  );
}
