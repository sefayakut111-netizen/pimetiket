/**
 * Pim Etiket — /yorumlar
 *
 * Tüm onaylanmış yorumların listesi. Filtre: ?kategori=etiket|sticker
 *
 * - Header: ortalama puan + toplam yorum
 * - Filtreler: hepsi / etiket / sticker
 * - Grid: 3 col masaüstü, 1 col mobil
 * - Pagination veya "daha fazla yükle" (şimdilik basit, son 50 adet)
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  getProductReviews,
  getHomepageReviews,
  type Review,
  type ProductType,
} from "@/lib/reviews";
import { Pim } from "@/components/Pim";
import { Eyebrow } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";

export default function YorumlarPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-64px)]" />}>
      <YorumlarInner />
    </Suspense>
  );
}

function YorumlarInner() {
  const sp = useSearchParams();
  const kategori = sp.get("kategori") as ProductType | null;
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [filter, setFilter] = useState<"all" | ProductType>(
    kategori ?? "all"
  );

  useEffect(() => {
    setReviews(null);
    if (filter === "all") {
      void getHomepageReviews(50).then(setReviews);
    } else {
      void getProductReviews(filter, 50).then(setReviews);
    }
  }, [filter]);

  const avgRating =
    reviews && reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  const filterPills: { v: "all" | ProductType; label: string }[] = [
    { v: "all", label: "Hepsi" },
    { v: "etiket", label: "Etiket" },
    { v: "sticker", label: "Sticker" },
  ];

  return (
    <main className="bg-gri-50 animate-fade-up min-h-[calc(100vh-64px)]">
      {/* Hero */}
      <section className="bg-white py-12 md:py-16 border-b border-gri-100">
        <div className="mx-auto max-w-[1100px] px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-end">
            <div>
              <Eyebrow>Müşteri yorumları</Eyebrow>
              <h1 className="mt-3 text-[28px] md:text-[40px] font-semibold tracking-tight leading-tight">
                Bastırdı, kullandı, yazdı.
              </h1>
              <p className="mt-3 text-[14px] md:text-base text-gri-700 max-w-[520px] leading-relaxed">
                Sipariş ettiği etiket veya sticker eline ulaşan müşterilerimizin
                gerçek deneyimi. Sadece teslim alan kullanıcı yorum yazabilir —
                uydurma yok.
              </p>
            </div>
            <Pim pose="happy" size={140} className="hidden md:inline-block" />
          </div>

          {reviews && reviews.length > 0 && (
            <div className="mt-6 flex items-center gap-4 text-[14px]">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Icon.Star
                    key={i}
                    size={18}
                    className={
                      i < Math.round(avgRating) ? "text-sari" : "text-gri-200"
                    }
                  />
                ))}
              </div>
              <span className="font-semibold text-lacivert">
                {avgRating.toFixed(1)} / 5
              </span>
              <span className="text-gri-500">·</span>
              <span className="text-gri-700">{reviews.length} yorum</span>
            </div>
          )}
        </div>
      </section>

      {/* Filter pills */}
      <section className="py-6 sticky top-16 bg-gri-50/95 backdrop-blur z-20 border-b border-gri-100">
        <div className="mx-auto max-w-[1100px] px-4 md:px-8 flex gap-2 flex-wrap">
          {filterPills.map((p) => (
            <button
              key={p.v}
              type="button"
              onClick={() => setFilter(p.v)}
              className={cn(
                "h-9 px-4 rounded-full text-[13px] font-semibold transition-colors",
                filter === p.v
                  ? "bg-lacivert text-white"
                  : "bg-white text-gri-700 ring-1 ring-gri-200 hover:ring-pim-mercan hover:text-pim-mercan"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* Yorum listesi */}
      <section className="py-10 md:py-12">
        <div className="mx-auto max-w-[1100px] px-4 md:px-8">
          {reviews === null && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-6 ring-1 ring-gri-200 h-44 animate-pulse"
                />
              ))}
            </div>
          )}

          {reviews !== null && reviews.length === 0 && (
            <div className="text-center py-12">
              <Pim pose="think" size={120} />
              <h2 className="mt-3 text-[20px] font-semibold tracking-tight">
                Henüz yorum yok
              </h2>
              <p className="mt-2 text-[14px] text-gri-700 max-w-[400px] mx-auto">
                {filter === "all"
                  ? "İlk siparişler henüz teslim alınmadı veya yorum yazma süreci yeni."
                  : `Henüz ${filter} kategorisinde onaylanmış yorum yok.`}
              </p>
              <div className="mt-5">
                <Link
                  href={filter === "sticker" ? "/sticker" : "/etiket"}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-pim-mercan text-white text-[13px] font-semibold"
                >
                  {filter === "sticker" ? "Sticker bastır" : "Etiket bastır"}{" "}
                  <Icon.ArrowR size={14} />
                </Link>
              </div>
            </div>
          )}

          {reviews && reviews.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const dateStr = new Date(review.created_at).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <article className="bg-white rounded-2xl p-6 ring-1 ring-gri-200 shadow-1 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Icon.Star
              key={i}
              size={14}
              className={i < review.rating ? "text-sari" : "text-gri-200"}
            />
          ))}
        </div>
        {review.featured && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-pim-mercan">
            ✨ Öne çıkan
          </span>
        )}
      </div>
      <p className="text-[14px] text-lacivert leading-relaxed flex-1">
        {review.body}
      </p>
      {review.photos.length > 0 && (
        <div className="flex gap-2 mt-3">
          {review.photos.slice(0, 2).map((photo, i) => (
            <a
              key={i}
              href={photo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-16 h-16 rounded-lg overflow-hidden ring-1 ring-gri-200 bg-gri-100 hover:ring-pim-mercan transition-all"
            >
              {photo.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.url}
                  alt={`Yorum fotoğrafı ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
            </a>
          ))}
        </div>
      )}
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
