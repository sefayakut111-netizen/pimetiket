"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/Icon";
import { Button, Eyebrow } from "@/components/ui";
import { useT } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/types";
import { createClient } from "@/lib/supabase/client";

interface GalleryItem {
  id: string;
  image_path: string;
  title: string;
}

function publicUrlOf(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/public-assets/${path}`;
}

interface HomeGalleryProps {
  locale: Locale;
}

export function HomeGallery({ locale }: HomeGalleryProps) {
  const { t } = useT();
  const [items, setItems] = useState<GalleryItem[] | null>(null);

  const fetchItems = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("gallery_items")
      .select("id, image_path, title")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(8);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
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
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
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
