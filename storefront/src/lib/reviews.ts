/**
 * Pim Etiket — Reviews API client
 *
 * Yorum sistemi için Supabase wrapper. Aşağıdaki akışı destekler:
 *   1. Anasayfa için onaylı yorumları çek (4-5 yıldız + show_on_homepage)
 *   2. Ürün sayfası için kategori bazlı yorum çek
 *   3. Kullanıcı yorum gönder (form submit)
 *   4. Kullanıcının pending review_request'ini al (banner için)
 *   5. Banner dismiss et
 *   6. Token-based yorum yazma (mailden gelen kullanıcı için)
 */

import { createClient } from "@/lib/supabase/client";

// ============================================================
// Types
// ============================================================

export type ReviewStatus = "pending" | "published" | "rejected" | "hidden";
export type ProductType = "etiket" | "sticker";

export interface ReviewPhoto {
  /** Storage path: review-photos/<order_id>/<uuid>.jpg */
  path: string;
  /** Public URL (cached, computed on read) */
  url?: string;
}

export interface Review {
  id: string;
  rating: number;
  body: string;
  display_name: string;
  product_type: ProductType | null;
  photos: ReviewPhoto[];
  featured: boolean;
  created_at: string;
}

export interface ReviewRequest {
  id: string;
  order_id: string;
  user_id: string;
  delivered_at: string;
  email_sent_at: string | null;
  email_opened_at: string | null;
  email_clicked_at: string | null;
  in_app_shown_count: number;
  last_in_app_shown_at: string | null;
  in_app_dismissed_until: string | null;
  in_app_dismissed_permanently: boolean;
  review_id: string | null;
  completed_at: string | null;
  status: "pending" | "completed" | "expired" | "dismissed";
  expires_at: string;
  request_token: string;
  created_at: string;
}

export interface SubmitReviewInput {
  order_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  body: string;
  display_name?: string; // örn "Sefa Y."
  show_on_homepage: boolean;
  photos: ReviewPhoto[]; // max 2
  product_type: ProductType;
  request_token?: string; // mail link'inden gelirse
}

// ============================================================
// Public read APIs (anasayfa + ürün sayfası — anonymous OK)
// ============================================================

/**
 * Anasayfa için son onaylı yorumlar (4-5 yıldız, show_on_homepage=true).
 * RPC: public.get_homepage_reviews(limit)
 */
export async function getHomepageReviews(
  limit: number = 9
): Promise<Review[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_homepage_reviews", {
    p_limit: limit,
  } as never);
  if (error) {
    console.error("[reviews] getHomepageReviews error:", error.message);
    return [];
  }
  return ((data as unknown as Record<string, unknown>[]) ?? []).map((r) =>
    normalize(r)
  );
}

/**
 * Ürün sayfası için yorumlar (etiket veya sticker, status=published).
 * RPC: public.get_product_reviews(type, limit)
 */
export async function getProductReviews(
  productType: ProductType,
  limit: number = 20
): Promise<Review[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_product_reviews", {
    p_product_type: productType,
    p_limit: limit,
  } as never);
  if (error) {
    console.error("[reviews] getProductReviews error:", error.message);
    return [];
  }
  return ((data as unknown as Record<string, unknown>[]) ?? []).map((r) =>
    normalize(r)
  );
}

// ============================================================
// Authenticated user APIs (banner + yorum yazma)
// ============================================================

/**
 * Kullanıcının pending review_request'i varsa döndürür (banner için).
 * In-app banner gösterilecek mi kararı için.
 */
export async function getMyPendingReviewRequest(): Promise<ReviewRequest | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("review_requests")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .or(
      `in_app_dismissed_until.is.null,in_app_dismissed_until.lt.${new Date().toISOString()}`
    )
    .eq("in_app_dismissed_permanently", false)
    .order("delivered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "[reviews] getMyPendingReviewRequest error:",
      error.message
    );
    return null;
  }
  return data as ReviewRequest | null;
}

/**
 * Banner gösterilince çağır — sayım + son gösterim zamanı kaydet.
 */
export async function recordBannerShown(
  reviewRequestId: string
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // RPC kullanmadan, direkt update + raw SQL increment
  const { data: current } = await supabase
    .from("review_requests")
    .select("in_app_shown_count")
    .eq("id", reviewRequestId)
    .single();

  const next = ((current as { in_app_shown_count?: number } | null)?.in_app_shown_count ?? 0) + 1;
  await supabase
    .from("review_requests")
    .update({
      in_app_shown_count: next,
      last_in_app_shown_at: new Date().toISOString(),
    } as never)
    .eq("id", reviewRequestId);
}

/**
 * Kullanıcı banner'ı kapatır — "daha sonra" (3 gün) veya kalıcı.
 */
export async function dismissBanner(
  reviewRequestId: string,
  permanent: boolean = false
): Promise<void> {
  const supabase = createClient();
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (permanent) {
    updates.in_app_dismissed_permanently = true;
    updates.status = "dismissed";
  } else {
    // 3 gün sonra tekrar göster
    const threeDays = new Date();
    threeDays.setDate(threeDays.getDate() + 3);
    updates.in_app_dismissed_until = threeDays.toISOString();
  }
  await supabase
    .from("review_requests")
    .update(updates as never)
    .eq("id", reviewRequestId);
}

/**
 * Token ile review_request bul (mail linkinden gelen, login olmasa da).
 */
export async function getReviewRequestByToken(
  token: string
): Promise<ReviewRequest | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("review_requests")
    .select("*")
    .eq("request_token", token)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data as ReviewRequest | null;
}

/**
 * Order ID ile review_request bul (login kullanıcı için).
 */
export async function getReviewRequestByOrder(
  orderId: string
): Promise<ReviewRequest | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("review_requests")
    .select("*")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .maybeSingle();
  return data as ReviewRequest | null;
}

/**
 * Yorum gönder.
 *
 * Akış:
 *   1. Reviews tablosuna yeni satır ekle (status=pending)
 *   2. review_request.review_id güncelle, status=completed
 *   3. Admin moderation kuyruğuna düşer
 */
export async function submitReview(
  input: SubmitReviewInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Giriş yapmalısın" };

  // Validate
  if (input.rating < 1 || input.rating > 5) {
    return { ok: false, error: "Yıldız 1-5 arası olmalı" };
  }
  if (!input.body || input.body.trim().length < 30) {
    return { ok: false, error: "Yorum en az 30 karakter olmalı" };
  }
  if (input.body.length > 500) {
    return { ok: false, error: "Yorum en fazla 500 karakter" };
  }
  if (input.photos.length > 2) {
    return { ok: false, error: "En fazla 2 fotoğraf yüklenebilir" };
  }

  // Insert review
  const { data: review, error: insertErr } = await supabase
    .from("reviews")
    .insert({
      user_id: user.id,
      order_id: input.order_id,
      rating: input.rating,
      body: input.body.trim(),
      display_name: input.display_name?.trim() ?? null,
      show_on_homepage: input.show_on_homepage,
      photos: input.photos,
      product_type: input.product_type,
      status: "pending",
    } as never)
    .select("id")
    .single();

  if (insertErr) {
    console.error("[reviews] submitReview insert error:", insertErr.message);
    return { ok: false, error: insertErr.message };
  }
  const newReview = review as { id: string };

  // Update review_request → completed
  await supabase
    .from("review_requests")
    .update({
      review_id: newReview.id,
      completed_at: new Date().toISOString(),
      status: "completed",
    } as never)
    .eq("order_id", input.order_id);

  return { ok: true, id: newReview.id };
}

// ============================================================
// Helpers
// ============================================================

function normalize(raw: Record<string, unknown>): Review {
  const photos = Array.isArray(raw.photos)
    ? (raw.photos as unknown[]).map(normalizePhoto).filter(Boolean) as ReviewPhoto[]
    : [];
  return {
    id: String(raw.id ?? ""),
    rating: typeof raw.rating === "number" ? raw.rating : 5,
    body: typeof raw.body === "string" ? raw.body : "",
    display_name: typeof raw.display_name === "string" ? raw.display_name : "Müşteri",
    product_type: (raw.product_type as ProductType | null) ?? null,
    photos,
    featured: Boolean(raw.featured),
    created_at: String(raw.created_at ?? ""),
  };
}

function normalizePhoto(raw: unknown): ReviewPhoto | null {
  if (typeof raw === "string") {
    return { path: raw, url: buildPhotoUrl(raw) };
  }
  if (raw && typeof raw === "object" && "path" in raw) {
    const o = raw as { path?: unknown; url?: unknown };
    if (typeof o.path === "string") {
      return {
        path: o.path,
        url: typeof o.url === "string" ? o.url : buildPhotoUrl(o.path),
      };
    }
  }
  return null;
}

/**
 * Photo URL builder — 3 path tipi destekler (Sefa 17 May v35):
 * 1. "/reviews/foo.jpg" (slash ile başlar) → yerel public/ direkt
 * 2. "https://..." → tam URL, dokunma (zaten public)
 * 3. "fake-1/foo.jpg" → Supabase Storage review-photos bucket
 */
function buildPhotoUrl(path: string): string {
  if (path.startsWith("/")) return path; // local public/
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return path;
  return `${supabaseUrl}/storage/v1/object/public/review-photos/${path}`;
}

/**
 * Kullanıcı adından "Sefa Y." formatı üret.
 * "Sefa Yakut" → "Sefa Y."
 * "Mehmet Ali Demir" → "Mehmet A."
 * "Ayşe" → "Ayşe"
 */
export function shortenDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Müşteri";
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() ?? "";
  return `${first} ${lastInitial}.`;
}
