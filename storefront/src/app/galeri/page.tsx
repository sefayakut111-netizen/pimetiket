"use client";

/**
 * Pim Etiket — /galeri
 *
 * Müşteri showcase — admin /admin/galeri'den yüklenen öğeler.
 * Sefa kuralı 11 May (Madde 14):
 *   - DB'den okunur (gallery_items, is_published=true)
 *   - Tıklayınca lightbox modal — büyük resim + detay
 *   - Hangi ürün + hangi özellikler (adet YOK — TKHK m.61)
 *   - Boş durumda "yakında" mesajı
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/context";

interface GalleryItem {
  id: string;
  image_path: string;
  title: string;
  body: string | null;
  product_type: "etiket" | "sticker" | "mixed";
  features: string | null;
}

function publicUrlOf(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/public-assets/${path}`;
}

type FilterId = "all" | "etiket" | "sticker";

export default function GaleriPage() {
  const { locale } = useT();
  const isEn = locale === "en";
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [active, setActive] = useState<GalleryItem | null>(null);

  const fetchItems = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("gallery_items")
      .select("id, image_path, title, body, product_type, features")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[galeri]", error);
      setItems([]);
      return;
    }
    setItems((data as GalleryItem[]) ?? []);
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const filtered =
    !items || filter === "all"
      ? items ?? []
      : items.filter((x) => x.product_type === filter || x.product_type === "mixed");

  const totalCount = items?.length ?? 0;

  return (
    <main className="bg-gri-50 animate-fade-up py-10 md:py-14 pb-20">
      <div className="mx-auto max-w-[1280px] px-6">
        {/* Hero */}
        <div className="text-center mb-10">
          <Eyebrow>{isEn ? "Customer showcase" : "Müşteri showcase"}</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[44px] font-semibold tracking-tight leading-tight">
            {isEn
              ? "Brands that print with us"
              : "Bizden bastıran markalar"}
          </h1>
          <p className="mt-3 text-base text-gri-700 max-w-[560px] mx-auto leading-relaxed">
            {isEn
              ? "A glimpse of work from our workshop — customer projects shared with their permission."
              : "Atölyemizden çıkan işlerin bir kısmı — izniyle paylaştığımız müşteri çalışmaları."}
          </p>
        </div>

        {/* Filter */}
        {items !== null && items.length > 0 && (
          <div className="flex justify-center gap-2 mb-6 flex-wrap">
            {(
              [
                { id: "all" as const, label: "Tümü" },
                { id: "etiket" as const, label: "Etiket" },
                { id: "sticker" as const, label: "Sticker" },
              ]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "px-5 h-10 rounded-full text-[13.5px] font-semibold transition-colors",
                  filter === f.id
                    ? "bg-lacivert text-white"
                    : "bg-white ring-1 ring-gri-200 text-gri-700 hover:bg-white hover:ring-pim-mercan-soft"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {items === null && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="aspect-[4/3] rounded-2xl bg-gri-100 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {items !== null && totalCount === 0 && (
          <Card padding="p-12" className="text-center">
            {/* Sefa 17 May P2-27: pose çeşitlilik — galeri için "excited" */}
            <Pim pose="excited" size={140} />
            <h2 className="mt-4 text-[22px] md:text-[28px] font-semibold tracking-tight">
              {isEn ? "Coming soon" : "Yakında doluyor"}
            </h2>
            <p className="mt-3 text-base text-gri-700 max-w-[440px] mx-auto leading-relaxed">
              {isEn
                ? "Customer photos go up as we get permission to share. Want your brand here?"
                : "Müşteri görselleri yazılı izin alındıkça çıkar. Markan burada görünsün istersen "}
              <Link href="/iletisim" className="text-pim-mercan font-semibold hover:underline">
                {isEn ? "Reach out" : "bize yaz"}
              </Link>
              .
            </p>
            <div className="mt-7 flex gap-3 justify-center flex-wrap">
              <Button variant="primary" size="lg" href="/etiket">
                <Icon.Roll size={16} /> {isEn ? "Print labels" : "Etiket bastır"}
              </Button>
              <Button variant="secondary" size="lg" href="/sticker">
                <Icon.Sticker size={16} /> {isEn ? "Print stickers" : "Sticker bastır"}
              </Button>
            </div>
          </Card>
        )}

        {/* Grid */}
        {items !== null && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item)}
                className="group block text-left rounded-2xl bg-white overflow-hidden ring-1 ring-gri-200 hover:ring-pim-mercan-soft hover:shadow-2 transition-all"
              >
                <div className="relative aspect-[4/3] bg-gri-100 overflow-hidden">
                  <Image
                    src={publicUrlOf(item.image_path)}
                    alt={item.title}
                    fill
                    loading="lazy"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-base text-lacivert leading-tight truncate flex-1 min-w-0">
                      {item.title}
                    </h3>
                    <span className="inline-flex items-center h-[20px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[10.5px] font-semibold capitalize shrink-0">
                      {item.product_type}
                    </span>
                  </div>
                  {item.features && (
                    <p className="text-[12.5px] text-gri-700 leading-relaxed line-clamp-2">
                      {item.features}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Empty for filter */}
        {items !== null && totalCount > 0 && filtered.length === 0 && (
          <Card padding="p-8" className="text-center text-gri-700">
            Bu filtreye uyan görsel yok.
          </Card>
        )}
      </div>

      {/* Lightbox modal */}
      {active && (
        <Modal
          open={true}
          onClose={() => setActive(null)}
          title={active.title}
          maxWidthClassName="max-w-[860px]"
        >
          <div className="relative aspect-[16/10] bg-gri-100 rounded-lg overflow-hidden mb-4">
            <Image
              src={publicUrlOf(active.image_path)}
              alt={active.title}
              fill
              sizes="(max-width: 768px) 100vw, 860px"
              className="object-contain"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-pim-mercan-tint text-pim-mercan text-[11.5px] font-semibold capitalize">
                {active.product_type}
              </span>
              {active.features && (
                <span className="text-[12.5px] text-gri-700">
                  · {active.features}
                </span>
              )}
            </div>
            {active.body && (
              <p className="text-[14px] text-gri-700 leading-relaxed whitespace-pre-line">
                {active.body}
              </p>
            )}
          </div>
        </Modal>
      )}
    </main>
  );
}
