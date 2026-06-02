"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { Button, Eyebrow } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/types";
import { createClient } from "@/lib/supabase/client";

const HOME_GALLERY_MAX = 20;
const CAROUSEL_INTERVAL_MS = 3000;

interface GalleryItem {
  id: string;
  image_path: string;
  title: string;
}

function publicUrlOf(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/public-assets/${path}`;
}

function useVisibleCount(): number {
  const [count, setCount] = useState(2);

  useEffect(() => {
    const update = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setCount(6);
      } else if (window.matchMedia("(min-width: 768px)").matches) {
        setCount(3);
      } else {
        setCount(2);
      }
    };
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

interface HomeGalleryProps {
  locale: Locale;
}

export function HomeGallery({ locale }: HomeGalleryProps) {
  const { t } = useT();
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const visibleCount = useVisibleCount();
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

  const carouselEnabled =
    items !== null &&
    items.length > visibleCount &&
    !prefersReducedMotion;

  useEffect(() => {
    setActiveIndex(0);
  }, [visibleCount, items?.length]);

  useEffect(() => {
    if (!carouselEnabled || paused || !items?.length) return;
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % items.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [carouselEnabled, paused, items?.length]);

  if (items === null || items.length === 0) {
    return null;
  }

  const showCarousel = items.length > visibleCount;

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="text-center">
          <Eyebrow>{t.home.galleryEyebrow}</Eyebrow>
          <h2 className="mt-4 text-[28px] md:text-[40px] font-semibold tracking-tight leading-tight">
            {t.home.galleryTitle}
          </h2>
        </div>

        {showCarousel ? (
          <div
            className="mt-10 overflow-hidden"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{
                width: `${(items.length * 100) / visibleCount}%`,
                transform: `translateX(-${(activeIndex * 100) / items.length}%)`,
              }}
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex-shrink-0 box-border px-2"
                  style={{ width: `${100 / items.length}%` }}
                >
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden ring-1 ring-black/[0.04] shadow-1 hover:scale-[1.03] transition-transform">
                    <Image
                      src={publicUrlOf(item.image_path)}
                      alt={item.title}
                      fill
                      loading="lazy"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                      className="object-cover"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-10">
            {items.map((item) => (
              <div
                key={item.id}
                className="relative aspect-[4/3] rounded-lg overflow-hidden ring-1 ring-black/[0.04] shadow-1 hover:scale-[1.03] transition-transform"
              >
                <Image
                  src={publicUrlOf(item.image_path)}
                  alt={item.title}
                  fill
                  loading="lazy"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
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
