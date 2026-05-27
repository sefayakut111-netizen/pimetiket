/**
 * Pim Etiket — /admin/yorumlar
 *
 * Müşteri yorumları moderasyon: pending → published / rejected / hidden.
 * Supabase reviews tablosundan okur (servisrole endpoint).
 *
 * Status mapping:
 *   - pending: müşteri yazdı, admin onay bekliyor
 *   - published: onaylandı, public görünür
 *   - rejected: reddedildi (görünmez, kayıt kalır)
 *   - hidden: yayından kaldırıldı (sonradan)
 */

"use client";

import { useEffect, useState } from "react";
import { Pim } from "@/components/Pim";
import { Icon } from "@/components/Icon";
import { Card, Eyebrow, useToast, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";

type ReviewStatus = "pending" | "published" | "rejected" | "hidden";

interface DbReview {
  id: string;
  user_id: string | null;
  order_id: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  show_on_homepage: boolean | null;
  featured: boolean | null;
  display_name: string | null;
  product_type: string | null;
  helpful_count: number | null;
  created_at: string;
  moderation_note: string | null;
}

const STATUS_LABEL: Record<
  ReviewStatus,
  { label: string; color: string; bg: string }
> = {
  pending: {
    label: "Beklemede",
    color: "text-sari-koyu",
    bg: "bg-sari-soft",
  },
  published: { label: "Yayında", color: "text-yesil", bg: "bg-yesil-soft" },
  rejected: {
    label: "Reddedildi",
    color: "text-kirmizi",
    bg: "bg-kirmizi/10",
  },
  hidden: { label: "Yayından kaldırıldı", color: "text-gri-500", bg: "bg-gri-100" },
};

export default function AdminYorumlarPage() {
  const toast = useToast();
  const [reviews, setReviews] = useState<DbReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReviewStatus | "all">("pending");
  const [updating, setUpdating] = useState<string | null>(null);
  // Sefa 17 May v34: Inline body editor
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    body: string;
    displayName: string;
    rating: number;
    productType: "etiket" | "sticker";
  }>({ body: "", displayName: "", rating: 5, productType: "etiket" });

  const startEdit = (r: DbReview) => {
    setEditingId(r.id);
    setEditForm({
      body: r.body ?? "",
      displayName: r.display_name ?? "",
      rating: r.rating,
      productType:
        r.product_type === "sticker" ? "sticker" : "etiket",
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
  };
  const saveEdit = async (id: string) => {
    await updateReview(id, {
      body: editForm.body,
      displayName: editForm.displayName,
      rating: editForm.rating,
      productType: editForm.productType,
    });
    setEditingId(null);
  };

  const fetchReviews = async () => {
    try {
      const res = await fetch("/api/admin/reviews", { cache: "no-store" });
      if (!res.ok) {
        toast.error("Yorumlar yüklenemedi");
        setReviews([]);
        return;
      }
      const json = (await res.json()) as { reviews: DbReview[] };
      setReviews(json.reviews ?? []);
    } catch (e) {
      console.error("[admin/yorumlar] fetch error:", e);
      toast.error("Bağlantı hatası");
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReviews();
  }, []);

  const updateReview = async (
    id: string,
    patch: {
      status?: ReviewStatus;
      featured?: boolean;
      showOnHomepage?: boolean;
      body?: string;
      displayName?: string;
      rating?: number;
      productType?: "etiket" | "sticker";
    }
  ) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Güncelleme başarısız");
        return;
      }
      const json = (await res.json()) as { review: DbReview };
      setReviews((arr) =>
        arr.map((r) => (r.id === id ? json.review : r))
      );

      // User feedback
      if (patch.status === "published") toast.success("Yorum yayınlandı");
      else if (patch.status === "rejected") toast.success("Yorum reddedildi");
      else if (patch.status === "hidden") toast.success("Yayından kaldırıldı");
      else if (patch.featured !== undefined)
        toast.success(
          patch.featured ? "Öne çıkarıldı" : "Öne çıkarma kaldırıldı"
        );
      else if (patch.showOnHomepage !== undefined)
        toast.success(
          patch.showOnHomepage
            ? "Anasayfada gösterilecek"
            : "Anasayfadan kaldırıldı"
        );
    } catch (e) {
      console.error("[admin/yorumlar] update error:", e);
      toast.error("Bağlantı hatası");
    } finally {
      setUpdating(null);
    }
  };

  const filtered =
    filter === "all" ? reviews : reviews.filter((r) => r.status === filter);

  const pending = reviews.filter((r) => r.status === "pending").length;
  const published = reviews.filter((r) => r.status === "published").length;
  const rejected = reviews.filter((r) => r.status === "rejected").length;
  const hidden = reviews.filter((r) => r.status === "hidden").length;
  const avgRating =
    published > 0
      ? reviews
          .filter((r) => r.status === "published")
          .reduce((s, r) => s + r.rating, 0) / published
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
            {pending} beklemede · {published} yayında · ortalama{" "}
            {avgRating > 0 ? `${avgRating.toFixed(1)}/5` : "—"}
          </p>
        </div>

        {/* Filter chips */}
        <Card padding="p-4" className="mb-5">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "all", label: `Tümü (${reviews.length})` },
                { id: "pending", label: `Beklemede (${pending})` },
                { id: "published", label: `Yayında (${published})` },
                { id: "rejected", label: `Reddedilen (${rejected})` },
                { id: "hidden", label: `Yayından kalktı (${hidden})` },
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

        {loading ? (
          <Skeleton.AdminTable rows={6} />
        ) : filtered.length === 0 ? (
          <Card padding="p-12" className="text-center">
            <Pim pose="happy" size={140} />
            <h3 className="mt-4 text-xl font-semibold">
              {filter === "pending" ? "Bekleyen yorum yok " : "Sonuç yok"}
            </h3>
            <p className="mt-2 text-base text-gri-700">
              {filter === "pending"
                ? "Tüm yorumlar incelendi. Yeni geldikçe burada görünür."
                : "Bu filtrede yorum yok."}
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((r) => {
              const meta = STATUS_LABEL[r.status];
              const date = new Date(r.created_at).toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              const name = r.display_name ?? "Anonim";
              const isUpdating = updating === r.id;
              return (
                <Card key={r.id} padding="p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                        <span className="font-semibold text-base text-lacivert">
                          {name}
                        </span>
                        {r.order_id && (
                          <span className="font-mono text-[11.5px] text-gri-500">
                            · {r.order_id}
                          </span>
                        )}
                        {r.product_type && (
                          <span className="text-[11.5px] text-gri-500">
                            · {r.product_type}
                          </span>
                        )}
                        <span className="text-[11.5px] text-gri-500">
                          · {date}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-semibold",
                            meta.bg,
                            meta.color
                          )}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="flex gap-px text-sari-koyu mb-2 items-center">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <Icon.Star
                            key={i}
                            size={16}
                            className={cn(
                              i < r.rating ? "text-sari-koyu" : "text-gri-200"
                            )}
                          />
                        ))}
                        <span className="ml-2 text-[13px] font-semibold tabular-nums">
                          {r.rating}/5
                        </span>
                      </div>
                      {r.title && (
                        <p className="text-[14px] font-semibold text-lacivert mb-1">
                          {r.title}
                        </p>
                      )}

                      {editingId === r.id ? (
                        /* Sefa 17 May v34: Inline body editor */
                        <div className="mt-2 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editForm.displayName}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  displayName: e.target.value,
                                })
                              }
                              placeholder="Ad (örn. A.K.)"
                              className="px-3 h-9 rounded-lg ring-1 ring-gri-200 text-[13px] focus:outline-none focus:ring-pim-mercan"
                            />
                            <select
                              value={editForm.productType}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  productType: e.target.value as
                                    | "etiket"
                                    | "sticker",
                                })
                              }
                              className="px-3 h-9 rounded-lg ring-1 ring-gri-200 text-[13px] focus:outline-none focus:ring-pim-mercan bg-white"
                            >
                              <option value="etiket">Etiket</option>
                              <option value="sticker">Sticker</option>
                            </select>
                          </div>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() =>
                                  setEditForm({ ...editForm, rating: n })
                                }
                                className="p-0.5"
                              >
                                <Icon.Star
                                  size={20}
                                  className={cn(
                                    n <= editForm.rating
                                      ? "text-sari-koyu"
                                      : "text-gri-200 hover:text-sari-koyu/50"
                                  )}
                                />
                              </button>
                            ))}
                            <span className="ml-2 text-[12px] text-gri-500 self-center">
                              {editForm.rating}/5
                            </span>
                          </div>
                          <textarea
                            value={editForm.body}
                            onChange={(e) =>
                              setEditForm({ ...editForm, body: e.target.value })
                            }
                            rows={4}
                            maxLength={800}
                            placeholder="Yorum metni (10-800 karakter)"
                            className="w-full px-3 py-2 rounded-lg ring-1 ring-gri-200 text-[13.5px] leading-relaxed focus:outline-none focus:ring-pim-mercan resize-y"
                          />
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11.5px] text-gri-500">
                              {editForm.body.length}/800 karakter
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={isUpdating}
                                className="h-9 px-4 rounded-lg text-[12.5px] font-semibold bg-white ring-1 ring-gri-200 hover:ring-gri-500 disabled:opacity-50"
                              >
                                İptal
                              </button>
                              <button
                                type="button"
                                onClick={() => void saveEdit(r.id)}
                                disabled={
                                  isUpdating ||
                                  editForm.body.trim().length < 10 ||
                                  editForm.displayName.trim().length === 0
                                }
                                className="h-9 px-4 rounded-lg text-[12.5px] font-semibold bg-pim-mercan text-white hover:bg-pim-mercan-koyu disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                              >
                                <Icon.Check size={12} />
                                {isUpdating ? "Kaydediliyor..." : "Kaydet"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-[14px] text-gri-700 leading-relaxed">
                            {r.body ? `"${r.body}"` : "(Yazılı yorum yok)"}
                          </p>
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-pim-mercan hover:underline"
                          >
                            <span aria-hidden></span> Düzenle
                          </button>
                        </>
                      )}

                      {r.moderation_note && (
                        <p className="mt-2 text-[12px] text-gri-500 italic">
                          Mod notu: {r.moderation_note}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {r.status === "pending" ? (
                      <div className="flex flex-col gap-2 shrink-0 min-w-[160px]">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            updateReview(r.id, { status: "published" })
                          }
                          className="h-9 px-3 rounded-lg text-[12.5px] font-semibold bg-yesil text-white hover:bg-yesil-koyu flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <Icon.Check size={12} /> Onayla
                        </button>
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            updateReview(r.id, { status: "rejected" })
                          }
                          className="h-9 px-3 rounded-lg text-[12.5px] font-semibold bg-white ring-1 ring-gri-200 hover:ring-kirmizi hover:text-kirmizi flex items-center justify-center disabled:opacity-50"
                        >
                          Reddet
                        </button>
                      </div>
                    ) : r.status === "published" ? (
                      <div className="flex flex-col gap-2 shrink-0 min-w-[200px]">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            updateReview(r.id, { featured: !r.featured })
                          }
                          className={cn(
                            "h-9 px-3 rounded-lg text-[12.5px] font-semibold ring-1 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50",
                            r.featured
                              ? "bg-pim-mercan text-white ring-pim-mercan"
                              : "bg-white text-gri-700 ring-gri-200 hover:ring-pim-mercan hover:text-pim-mercan"
                          )}
                        >
                          <Icon.Sparkle size={12} />
                          {r.featured ? "Öne çıkan " : "Öne çıkar"}
                        </button>
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            updateReview(r.id, {
                              showOnHomepage: !r.show_on_homepage,
                            })
                          }
                          className={cn(
                            "h-9 px-3 rounded-lg text-[12.5px] font-semibold ring-1 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50",
                            r.show_on_homepage
                              ? "bg-yesil-soft text-yesil ring-yesil/30"
                              : "bg-gri-100 text-gri-700 ring-gri-200"
                          )}
                        >
                          <Icon.Home size={12} />
                          {r.show_on_homepage
                            ? "Anasayfada "
                            : "Sadece ürün sayfası"}
                        </button>
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            updateReview(r.id, { status: "hidden" })
                          }
                          className="h-8 text-[11.5px] text-gri-500 hover:text-kirmizi disabled:opacity-50"
                        >
                          Yayından kaldır
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 shrink-0 min-w-[160px]">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            updateReview(r.id, { status: "published" })
                          }
                          className="h-9 px-3 rounded-lg text-[12.5px] font-semibold bg-white ring-1 ring-gri-200 hover:ring-yesil hover:text-yesil flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <Icon.Check size={12} /> Yayına geri al
                        </button>
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
