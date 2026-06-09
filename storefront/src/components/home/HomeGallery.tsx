"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/types";
import { createClient } from "@/lib/supabase/client";

const HOME_GALLERY_MAX = 20;
const COLUMN_GAP_PX = 16; // gap-4
const SECONDS_PER_COLUMN = 4; // marquee hızı (sütun başına saniye)

interface GalleryItem {
  id: string;
  image_path: string;
  title: string;
}

type GalleryColumn = [GalleryItem, GalleryItem];

function publicUrlOf(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/public-assets/${path}`;
}

function useVisibleColumns(): number {
  const [count, setCount] = useState(3);
  useEffect(() => {
    const update = () =>
      setCount(window.matchMedia("(min-width: 768px)").matches ? 3 : 2);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return count;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function GalleryCell({
  item,
  onError,
}: {
  item: GalleryItem;
  onError: (id: string) => void;
}) {
  return (
    <div className="relative aspect-[4/3] rounded-lg overflow-hidden ring-1 ring-black/[0.04] shadow-1 hover:scale-[1.03] transition-transform">
      <Image
        src={publicUrlOf(item.image_path)}
        alt={item.title}
        fill
        loading="lazy"
        sizes="(max-width: 768px) 50vw, 33vw"
        className="object-cover"
        onError={() => onError(item.id)}
      />
    </div>
  );
}

interface HomeGalleryProps {
  locale: Locale;
}

export function HomeGallery({ locale }: HomeGalleryProps) {
  const { t } = useT();
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  // Yüklenemeyen (eksik/404) görseller — döngüden çıkarılır
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const visibleCols = useVisibleColumns();
  const prefersReducedMotion = usePrefersReducedMotion();

  const fetchItems = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("gallery_items")
      .select("id, image_path, title")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(HOME_GALLERY_MAX);
    if (error) {
      console.error("[home-gallery]", error);
      setItems([]);
      return;
    }
    setItems((data as GalleryItem[]) ?? []);
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const handleImageError = useCallback((id: string) => {
    setFailed((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Yalnız geçerli (yüklenebilen) görseller
  const valid = useMemo(
    () => (items ?? []).filter((it) => Boolean(it.image_path) && !failed.has(it.id)),
    [items, failed]
  );

  // Tek "tur" (unit) = 2'şerli sütunlar. Boş hücre YOK: tek sayıda görselde
  // baştan tekrarla (null koyma); az görselde viewport'u doldurmak için turu
  // çoğalt — böylece eksik/az görselde bile kesintisiz döngü olur.
  const unitColumns = useMemo<GalleryColumn[]>(() => {
    if (valid.length === 0) return [];
    const arr = valid.length % 2 === 1 ? [...valid, valid[0]] : valid;
    const cols: GalleryColumn[] = [];
    for (let i = 0; i < arr.length; i += 2) cols.push([arr[i], arr[i + 1]]);
    let filled = cols;
    // Kesintisiz döngü için viewport'tan fazla sütun olmalı
    while (filled.length < visibleCols + 1) filled = [...filled, ...cols];
    return filled;
  }, [valid, visibleCols]);

  if (items === null || valid.length === 0) {
    return null;
  }

  const colWidthCss = `calc((100% - ${visibleCols * COLUMN_GAP_PX}px) / ${visibleCols})`;
  const animate = !prefersReducedMotion;
  // Seamless döngü: turu 2x'le, -50% kaydır (her sütun eşit genişlik + marginRight)
  const track = animate
    ? [...unitColumns, ...unitColumns]
    : unitColumns.slice(0, visibleCols);
  const durationS = Math.max(12, unitColumns.length * SECONDS_PER_COLUMN);

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="text-center">
          <h2 className="text-[28px] md:text-[40px] font-semibold tracking-tight leading-tight">
            {t.home.galleryTitle}
          </h2>
        </div>

        <div className="mt-10 overflow-hidden hg-gallery">
          <div
            className={animate ? "flex hg-marquee" : "flex"}
            style={animate ? { animationDuration: `${durationS}s` } : undefined}
          >
            {track.map((col, colIdx) => (
              <div
                key={colIdx}
                className="flex-shrink-0 flex flex-col gap-4 min-w-0"
                style={{ width: colWidthCss, marginRight: COLUMN_GAP_PX }}
              >
                <GalleryCell item={col[0]} onError={handleImageError} />
                <GalleryCell item={col[1]} onError={handleImageError} />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <Button variant="secondary" href="/galeri">
            {locale === "en" ? "View all" : "Tümünü gör"}{" "}
            <Icon.ChevR size={14} />
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes hg-marquee-kf {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .hg-marquee { animation: hg-marquee-kf linear infinite; will-change: transform; }
        .hg-gallery:hover .hg-marquee { animation-play-state: paused; }
      `}</style>
    </section>
  );
}
