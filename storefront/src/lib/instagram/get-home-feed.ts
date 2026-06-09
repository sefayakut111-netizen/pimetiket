import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteImages } from "@/lib/site-images";
import { fetchInstagramMedia, mediaToFeedPost } from "./fetch-media";
import type { InstagramFeedPost, InstagramFeedResponse } from "./types";
import { INSTAGRAM_HANDLE, INSTAGRAM_PROFILE_URL } from "./types";

const INSTAGRAM_SLOTS = [
  "home_instagram_1",
  "home_instagram_2",
  "home_instagram_3",
  "home_instagram_4",
  "home_instagram_5",
  "home_instagram_6",
] as const;

function postsFromSlots(
  images: Record<string, { publicUrl: string; altText: string | null; linkUrl: string | null }>
): InstagramFeedPost[] {
  return INSTAGRAM_SLOTS.flatMap((slot, index) => {
    const image = images[slot];
    if (!image) return [];
    return [
      {
        id: slot,
        imageUrl: image.publicUrl,
        permalink: image.linkUrl ?? INSTAGRAM_PROFILE_URL,
        altText: image.altText ?? `Pim Etiket Instagram ${index + 1}`,
        caption: image.altText,
      },
    ];
  });
}

async function postsFromGallery(limit = 6): Promise<InstagramFeedPost[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("gallery_items")
      .select("id, image_path, title")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data?.length) return [];

    const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    return data.map((item) => ({
      id: item.id,
      imageUrl: `${base}/storage/v1/object/public/public-assets/${item.image_path}`,
      permalink: INSTAGRAM_PROFILE_URL,
      altText: item.title ?? "Pim Etiket üretim örneği",
      caption: item.title ?? null,
    }));
  } catch {
    return [];
  }
}

export async function getInstagramHomeFeed(
  limit = 6
): Promise<InstagramFeedResponse> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();

  if (token) {
    try {
      const media = await fetchInstagramMedia(token, limit);
      const posts = media
        .map(mediaToFeedPost)
        .filter((post): post is InstagramFeedPost => post !== null)
        .slice(0, limit);

      if (posts.length > 0) {
        return { posts, source: "api", handle: INSTAGRAM_HANDLE };
      }
    } catch (err) {
      console.error("[instagram] API fetch failed:", err);
    }
  }

  const slotImages = await getSiteImages([...INSTAGRAM_SLOTS]);
  const slotPosts = postsFromSlots(slotImages);
  if (slotPosts.length > 0) {
    return { posts: slotPosts.slice(0, limit), source: "slots", handle: INSTAGRAM_HANDLE };
  }

  const galleryPosts = await postsFromGallery(limit);
  if (galleryPosts.length > 0) {
    return { posts: galleryPosts, source: "gallery", handle: INSTAGRAM_HANDLE };
  }

  return { posts: [], source: "empty", handle: INSTAGRAM_HANDLE };
}
