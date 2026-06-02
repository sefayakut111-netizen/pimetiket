"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { Button, Eyebrow } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/types";
import { createClient } from "@/lib/supabase/client";

const HOME_GALLERY_MAX = 20;
const CAROUSEL_INTERVAL_MS = 3000;
const COLUMN_GAP_PX = 16; // gap-4

interface GalleryItem {
  id: string;
  image_path: string;
  title: string;
}

type GalleryColumn = [GalleryItem | null, GalleryItem | null];

function publicUrlOf(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/public-assets/${path}`;
}

function chunkIntoColumns(items: GalleryItem[]): GalleryColumn[] {
  const columns: GalleryColumn[] = [];
  for (let i = 0; i < items.length; i += 2) {
    columns.push([items[i] ?? null, items[i + 1] ?? null]);
  }
  return columns;
}

function useVisibleColumns(): number {
  const [count, setCount] = useState(3);

  useEffect(() => {
    const update = () => {
      setCount(window.matchMedia("(min-width: 768px)").matches ? 3 : 2);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return count;
}

function useColumnLayout(visibleCols: number, enabled: boolean) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [colWidth, setColWidth] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setColWidth(0);
      return;
    }

    const el = viewportRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) {
        setColWidth((w - COLUMN_GAP_PX * (visibleCols - 1)) / visibleCols);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [visibleCols, enabled]);

  const stepPx = colWidth > 0 ? colWidth + COLUMN_GAP_PX : 0;
  const colWidthCss = `calc((100% - ${(visibleCols - 1) * COLUMN_GAP_PX}px) / ${visibleCols})`;

  return { viewportRef, colWidth, stepPx, colWidthCss };
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

function GalleryCell({ item }: { item: GalleryItem | null }) {
  if (!item) {
    return <div className="relative aspect-[4/3] rounded-lg bg-gri-50/80" aria-hidden />;
  }

  return (
    <div className="relative aspect-[4/3] rounded-lg overflow-hidden ring-1 ring-black/[0.04] shadow-1 hover:scale-[1.03] transition-transform">
      <Image
        src={publicUrlOf(item.image_path)}
        alt={item.title}
        fill
        loading="lazy"
        sizes="(max-width: 768px) 50vw, 33vw"
        className="object-cover"
      />
    </div>
  );
}

function StaticGrid({
  columns,
  visibleCols,
}: {
  columns: GalleryColumn[];
  visibleCols: number;
}) {
  const visible = columns.slice(0, visibleCols);

  return (
    <div
      className="grid gap-4 mt-10"
      style={{
        gridTemplateColumns: `repeat(${visibleCols}, minmax(0, 1fr))`,
      }}
    >
      {visible.map((col, colIdx) => (
        <div key={colIdx} className="flex flex-col gap-4 min-w-0">
          <GalleryCell item={col[0]} />
          <GalleryCell item={col[1]} />
        </div>
      ))}
    </div>
  );
}

interface HomeGalleryProps {
  locale: Locale;
}

export function HomeGallery({ locale }: HomeGalleryProps) {
  const { t } = useT();
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [activeCol, setActiveCol] = useState(0);
  const [paused, setPaused] = useState(false);
  const visibleCols = useVisibleColumns();
  const prefersReducedMotion = usePrefersReducedMotion();

  const columns = useMemo(
    () => (items ? chunkIntoColumns(items) : []),
    [items]
  );

  const carouselEnabled =
    columns.length > visibleCols && !prefersReducedMotion;

  const { viewportRef, colWidth, stepPx, colWidthCss } = useColumnLayout(
    visibleCols,
    carouselEnabled
  );

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

  useEffect(() => {
    setActiveCol(0);
  }, [visibleCols, columns.length]);

  useEffect(() => {
    if (!carouselEnabled || paused || columns.length === 0) return;
    const id = setInterval(() => {
      setActiveCol((c) => (c + 1) % columns.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [carouselEnabled, paused, columns.length]);

  if (items === null || items.length === 0) {
    return null;
  }

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="text-center">
          <Eyebrow>{t.home.galleryEyebrow}</Eyebrow>
          <h2 className="mt-4 text-[28px] md:text-[40px] font-semibold tracking-tight leading-tight">
            {t.home.galleryTitle}
          </h2>
        </div>

        {carouselEnabled ? (
          <div
            ref={viewportRef}
            className="mt-10 overflow-hidden"
            style={
              {
                "--col-w": colWidthCss,
              } as React.CSSProperties
            }
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
            <div
              className="flex gap-4 transition-transform duration-500 ease-out"
              style={{
                transform:
                  stepPx > 0
                    ? `translateX(-${activeCol * stepPx}px)`
                    : `translateX(calc(-${activeCol} * (var(--col-w) + ${COLUMN_GAP_PX}px)))`,
              }}
            >
              {columns.map((col, colIdx) => (
                <div
                  key={colIdx}
                  className="flex-shrink-0 flex flex-col gap-4 min-w-0"
                  style={{
                    width: colWidth > 0 ? colWidth : "var(--col-w)",
                  }}
                >
                  <GalleryCell item={col[0]} />
                  <GalleryCell item={col[1]} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <StaticGrid columns={columns} visibleCols={visibleCols} />
        )}

        <div className="mt-8 text-center">
          <Button variant="secondary" href="/galeri">
            {locale === "en" ? "View all" : "Tümünü gör"}{" "}
            <Icon.ChevR size={14} />
          </Button>
        </div>
      </div>
    </section>
  );
}
