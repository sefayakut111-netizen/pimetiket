/**
 * Pim Etiket — /admin/yorumlar
 *
 * Müşteri yorumları moderasyon: pending → approved/rejected.
 * localStorage demo; backend swap'te `reviews` tablosuna geçer.
 */

"use client";

import { useEffect, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Button, Card, Eyebrow, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";

const STORAGE_KEY = "pim_reviews_v1";

type ReviewStatus = "pending" | "approved" | "rejected";

interface Review {
  id: string;
  customerName: string;
  orderId: string;
  rating: number; // 1-5
  comment: string;
  status: ReviewStatus;
  createdAt: number;
}

const SAMPLE_REVIEWS: Review[] = [
  {
    id: "r1",
    customerName: "Defne Karaca",
    orderId: "PE-2026-3201",
    rating: 5,
    comment:
      "Kraft etiketler harika geldi. Mat selefon pürüzsüz, baskı net. Pim'in AI flag'i bir tipo yakaladı, düzelttim, ekstra puan.",
    status: "pending",
    createdAt: Date.now() - 86400_000,
  },
  {
    id: "r2",
    customerName: "Mert Yılmaz",
    orderId: "PE-2026-3105",
    rating: 4,
    comment:
      "Holografik sticker'lar ışık altında inanılmaz. Kargolama biraz geç oldu ama ürünler tam istediğim gibi.",
    status: "pending",
    createdAt: Date.now() - 2 * 86400_000,
  },
  {
    id: "r3",
    customerName: "Ezgi Kaplan",
    orderId: "PE-2026-2998",
    rating: 5,
    comment: "5 yıldız az gelir.",
    status: "approved",
    createdAt: Date.now() - 5 * 86400_000,
  },
];

function loadReviews(): Review[] {
  if (typeof window === "undefined") return SAMPLE_REVIEWS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_REVIEWS));
      return SAMPLE_REVIEWS;
    }
    return JSON.parse(raw) as Review[];
  } catch {
    return SAMPLE_REVIEWS;
  }
}

function saveReviews(reviews: Review[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
}

export default function AdminYorumlarPage() {
  const toast = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<ReviewStatus | "all">("pending");

  useEffect(() => {
    setReviews(loadReviews());
  }, []);

  const persist = (next: Review[]) => {
    setReviews(next);
    saveReviews(next);
  };

  const updateStatus = (id: string, status: ReviewStatus) => {
    const next = reviews.map((r) => (r.id === id ? { ...r, status } : r));
    persist(next);
    toast.success(
      status === "approved" ? "Yorum onaylandı" : "Yorum reddedildi"
    );
  };

  const filtered =
    filter === "all" ? reviews : reviews.filter((r) => r.status === filter);

  const pending = reviews.filter((r) => r.status === "pending").length;
  const approved = reviews.filter((r) => r.status === "approved").length;
  const avgRating =
    reviews.filter((r) => r.status === "approved").length > 0
      ? reviews
          .filter((r) => r.status === "approved")
          .reduce((s, r) => s + r.rating, 0) / approved
      : 0;

  return (
    <main className="py-8 pb-20">
      <div className="mx-auto max-w-[1080px] px-6">
        <div className="mb-6">
          <Eyebrow>Müşteri sesi</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tight">
            Yorumlar
          </h1>
          <p className="mt-1.5 text-base text-gri-700">
            {pending} beklemede · {approved} onaylı · ortalama{" "}
            {avgRating.toFixed(1)}/5
          </p>
        </div>

        {/* Filter chips */}
        <Card padding="p-4" className="mb-5">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "all", label: `Tümü (${reviews.length})` },
                { id: "pending", label: `Beklemede (${pending})` },
                { id: "approved", label: `Onaylı (${approved})` },
                {
                  id: "rejected",
                  label: `Reddedilen (${reviews.filter((r) => r.status === "rejected").length})`,
                },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-[13px] font-semibold transition-colors",
                  filter === f.id
                    ? "bg-lacivert text-white"
                    : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Card>

        {filtered.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="happy" size={140} />
            <h3 className="mt-4 text-xl font-semibold">Sonuç yok</h3>
            <p className="mt-2 text-base text-gri-700">
              Bu filtrede yorum yok.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((r) => {
              const date = new Date(r.createdAt).toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              return (
                <Card key={r.id} padding="p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                        <span className="font-semibold text-base text-lacivert">
                          {r.customerName}
                        </span>
                        <span className="font-mono text-[11.5px] text-gri-500">
                          · {r.orderId}
                        </span>
                        <span className="text-[11.5px] text-gri-500">
                          · {date}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold",
                            r.status === "approved"
                              ? "bg-yesil-soft text-yesil"
                              : r.status === "rejected"
                                ? "bg-kirmizi/10 text-kirmizi"
                                : "bg-sari-soft text-[#7A560A]"
                          )}
                        >
                          {r.status === "approved"
                            ? "Onaylı"
                            : r.status === "rejected"
                              ? "Reddedildi"
                              : "Beklemede"}
                        </span>
                      </div>
                      <div className="flex gap-px text-sari mb-2">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <Icon.Star
                            key={i}
                            size={16}
                            className={cn(
                              i < r.rating ? "text-sari" : "text-gri-200"
                            )}
                          />
                        ))}
                        <span className="ml-2 text-[13px] font-semibold tabular-nums">
                          {r.rating}/5
                        </span>
                      </div>
                      <p className="text-[14px] text-gri-700 leading-relaxed">
                        &ldquo;{r.comment}&rdquo;
                      </p>
                    </div>
                    {r.status === "pending" && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => updateStatus(r.id, "approved")}
                          className="!bg-yesil hover:!bg-[#22a862]"
                        >
                          <Icon.Check size={12} /> Onayla
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => updateStatus(r.id, "rejected")}
                        >
                          Reddet
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
