/**
 * ProductReviews — Ürün sayfası yorumları (etiket veya sticker).
 *
 * Kategoriye göre son onaylanmış yorumlar.
 * Negatif yorumlar (1-3 yıldız) burada GÖSTERİLİR (anasayfada gizli).
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getProductReviews, type Review, type ProductType } from "@/lib/reviews";
import { Eyebrow } from "@/components/ui";
import { Icon } from "@/components/Icon";

interface Props {
  productType: ProductType;
  /** Default 6 — ürün sayfasında 2-3 satır */
  limit?: number;
}

export function ProductReviews({ productType, limit = 6 }: Props) {
  const [reviews, setReviews] = useState<Review[] | null>(null);

  useEffect(() => {
    void getProductReviews(productType, limit).then(setReviews);
  }, [productType, limit]);

  if (reviews === null || reviews.length === 0) {
    return null; // ürün sayfasında boşsa hiç gösterme (anasayfada empty state var)
  }

  const avgRating =
    reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <section className="py-12 md:py-16 bg-white border-t border-gri-100">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <Eyebrow>Müşteri yorumları</Eyebrow>
            <h2 className="mt-3 text-[22px] md:text-[28px] font-semibold tracking-tight">
              {productType === "etiket"
                ? "Etiket bastıranlar ne diyor?"
                : "Sticker bastıranlar ne diyor?"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex gap-0.5"
              role="img"
              aria-label={`Ortalama ${avgRating.toFixed(1)} yıldız`}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <Icon.Star
                  key={i}
                  size={16}
                  className={i < Math.round(avgRating) ? "text-sari" : "text-gri-200"}
                />
              ))}
            </div>
            <span className="text-[14px] font-semibold text-lacivert">
              {avgRating.toFixed(1)} / 5 · {reviews.length} yorum
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((r) => (
            <ProductReviewCard key={r.id} review={r} />
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            href={`/yorumlar?kategori=${productType}`}
            className="inline-flex items-center gap-1.5 text-pim-mercan-koyu font-semibold hover:underline"
          >
            Tüm {productType} yorumları <Icon.ArrowR size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ProductReviewCard({ review }: { review: Review }) {
  const dateStr = new Date(review.created_at).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <article className="bg-gri-50 rounded-2xl p-5 ring-1 ring-gri-200 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Icon.Star
              key={i}
              size={13}
              className={i < review.rating ? "text-sari" : "text-gri-200"}
            />
          ))}
        </div>
        {review.featured && (
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-pim-mercan-koyu">
            ✨ Öne çıkan
          </span>
        )}
      </div>

      <p className="text-[13.5px] text-lacivert leading-relaxed flex-1 line-clamp-5">
        {review.body}
      </p>

      {review.photos.length > 0 && (
        <div className="flex gap-1.5 mt-3">
          {review.photos.slice(0, 2).map((photo, i) => (
            <div
              key={i}
              className="relative w-10 h-10 rounded-lg overflow-hidden ring-1 ring-gri-200 bg-white"
            >
              {photo.url ? (
                <Image
                  src={photo.url}
                  alt={`Yorum fotoğrafı ${i + 1}`}
                  fill
                  sizes="40px"
                  loading="lazy"
                  className="object-cover"
                />
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gri-200 flex items-center justify-between gap-2">
        {/* Initials avatar — Sefa kuralı (16 May denetim #2): Storage 404
            "Yorum…" placeholder yerine isim baş harfleri */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden
            className="shrink-0 w-7 h-7 rounded-full bg-pim-mercan-tint text-pim-mercan-koyu grid place-items-center text-[11px] font-bold tracking-tight"
          >
            {getInitials(review.display_name)}
          </span>
          <strong className="text-lacivert font-semibold text-[12.5px] truncate">
            {review.display_name}
          </strong>
        </div>
        <span className="text-[11.5px] text-gri-500 shrink-0">{dateStr}</span>
      </div>
    </article>
  );
}

/** İsim → baş harfler. "A.K." → "AK", "Sefa Yakut" → "SY". */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return parts[0].replace(/[^a-zA-ZçğıİöşüÇĞİÖŞÜ]/g, "").slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0])
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}
