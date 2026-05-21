/**
 * HomeReviews — Anasayfa müşteri yorumları section.
 *
 * Son 9 onaylanmış yorum (4-5 yıldız, show_on_homepage=true).
 * Featured olanlar önce, sonra tarihe göre.
 *
 * Boş state: "Henüz yorum yok, sıradaki sen ol".
 */

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getHomepageReviews, type Review } from "@/lib/reviews";
import { Eyebrow } from "@/components/ui";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { PhotoLightbox } from "@/components/reviews/PhotoLightbox";

interface Props {
  /** Default 9 — anasayfada 3-3-3 grid */
  limit?: number;
}

// FALLBACK_REVIEWS kaldırıldı (TKHK m.61 — yanıltıcı reklam riski).
// Önceden Defne K./Ezgi K./Burak A. fallback'i vardı, gerçek yorum
// gelene kadar boş state gösteriliyor şimdi.

export function HomeReviews({ limit = 9 }: Props) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  // Sefa 17 May v37: photo lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    void getHomepageReviews(limit).then((real) => {
      setReviews(real);
    });
  }, [limit]);

  // Yükleniyor — skeleton
  if (reviews === null) {
    return (
      <section className="py-16 md:py-20 bg-gri-50">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="text-center mb-10">
            <div className="h-3 w-24 bg-gri-200 rounded mx-auto mb-3 animate-pulse" />
            <div className="h-7 w-72 bg-gri-200 rounded mx-auto animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 ring-1 ring-gri-200 h-44 animate-pulse"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Yorum yok — empty state
  if (reviews.length === 0) {
    return (
      <section className="py-16 md:py-20 bg-gri-50">
        <div className="mx-auto max-w-[800px] px-4 md:px-8 text-center">
          <Pim pose="wave" size={120} />
          <Eyebrow>Müşteri yorumları</Eyebrow>
          <h2 className="mt-3 text-[24px] md:text-[32px] font-semibold tracking-tight">
            İlk yorumu sen yaz.
          </h2>
          <p className="mt-3 text-[14px] md:text-base text-gri-700 leading-relaxed max-w-[480px] mx-auto">
            Sipariş ettiğin etiket veya sticker eline ulaştıktan sonra
            deneyiminden bahset — burada sergileyelim.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-20 bg-gri-50">
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="text-center mb-10 md:mb-12">
          <Eyebrow>Müşteri yorumları</Eyebrow>
          <h2 className="mt-3 text-[24px] md:text-[36px] font-semibold tracking-tight leading-tight">
            Pim Etiket&rsquo;i Tercih Edenler Ne Diyor?
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              onPhotoClick={(src) => setLightboxSrc(src)}
            />
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/yorumlar"
            className="inline-flex items-center gap-1.5 text-pim-mercan font-semibold hover:underline"
          >
            Tüm yorumlar <Icon.ArrowR size={14} />
          </Link>
        </div>
      </div>
      {/* Sefa 17 May v37: Lightbox — photo'ya tıklayınca açılır */}
      <PhotoLightbox
        src={lightboxSrc}
        onClose={() => setLightboxSrc(null)}
      />
    </section>
  );
}

// ============================================================
// ReviewCard — internal
// ============================================================

interface ReviewCardProps {
  review: Review;
  onPhotoClick?: (src: string) => void;
}

function ReviewCard({ review, onPhotoClick }: ReviewCardProps) {
  const date = new Date(review.created_at);
  const dateStr = date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <article className="bg-white rounded-2xl p-6 ring-1 ring-gri-200 shadow-1 hover:shadow-2 transition-shadow flex flex-col">
      {/* Star rating + featured badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-0.5" aria-label={`${review.rating} yıldız`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Icon.Star
              key={i}
              size={14}
              className={i < review.rating ? "text-sari" : "text-gri-200"}
            />
          ))}
        </div>
        {review.featured && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-pim-mercan">
            <Icon.Sparkle size={11} /> Öne çıkan
          </span>
        )}
      </div>

      {/* Body */}
      <p className="text-[14px] md:text-[15px] text-lacivert leading-relaxed flex-1 line-clamp-6">
        {review.body}
      </p>

      {/* Photos (max 2) — Sefa 17 May v37:
          · Button olarak render → tıklayınca lightbox açılır (yeni link YOK)
          · alt="" decorative
          · onError → broken url ise tüm buton gizlenir */}
      {review.photos.length > 0 && (
        <div className="flex gap-1.5 mt-3">
          {review.photos.slice(0, 2).map((photo, i) =>
            photo.url ? (
              <button
                key={i}
                type="button"
                onClick={() => onPhotoClick?.(photo.url!)}
                aria-label="Fotoğrafı büyüt"
                className="w-12 h-12 rounded-lg overflow-hidden ring-1 ring-gri-200 hover:ring-pim-mercan bg-gri-100 transition-all cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    const wrap = (e.currentTarget as HTMLImageElement)
                      .parentElement;
                    if (wrap) (wrap as HTMLElement).style.display = "none";
                  }}
                />
              </button>
            ) : null
          )}
        </div>
      )}

      {/* Footer: name + product + date */}
      <div className="mt-4 pt-4 border-t border-gri-100 flex items-center justify-between text-[12px] text-gri-500">
        <div>
          <strong className="text-lacivert font-semibold">
            {review.display_name}
          </strong>
          {review.product_type && (
            <span className="ml-1.5 capitalize">· {review.product_type}</span>
          )}
        </div>
        <span>{dateStr}</span>
      </div>
    </article>
  );
}
