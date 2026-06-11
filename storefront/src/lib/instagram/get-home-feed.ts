import { getSiteImages } from "@/lib/site-images";
import { fetchInstagramMedia, mediaToFeedPost } from "./fetch-media";
import type { InstagramFeedPost, InstagramFeedResponse } from "./types";
import { INSTAGRAM_HANDLE } from "./types";
import { getInstagramToken } from "./token";

const INSTAGRAM_SLOTS = [
  "home_instagram_1",
  "home_instagram_2",
  "home_instagram_3",
  "home_instagram_4",
  "home_instagram_5",
  "home_instagram_6",
] as const;

/** Gerçek IG gönderisi linki mi? (profil URL'si değil) */
function isInstagramPostUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /instagram\.com\/(p|reel|tv)\//i.test(url);
}

/** Cron sync veya admin'in IG postu olarak işaretlediği slot mu? */
function isSyncedInstagramSlot(storagePath: string, linkUrl: string | null): boolean {
  if (!storagePath.startsWith("site-images/home_instagram_")) return false;
  return isInstagramPostUrl(linkUrl);
}

function postsFromSyncedSlots(
  images: Record<string, { publicUrl: string; altText: string | null; linkUrl: string | null; storagePath: string }>
): InstagramFeedPost[] {
  return INSTAGRAM_SLOTS.flatMap((slot, index) => {
    const image = images[slot];
    if (!image || !isSyncedInstagramSlot(image.storagePath, image.linkUrl)) return [];
    return [
      {
        id: slot,
        imageUrl: image.publicUrl,
        permalink: image.linkUrl!,
        altText: image.altText ?? `Pim Etiket Instagram ${index + 1}`,
        caption: image.altText,
      },
    ];
  });
}

export async function getInstagramHomeFeed(
  limit = 6
): Promise<InstagramFeedResponse> {
  const token = await getInstagramToken();

  if (token) {
    try {
      const media = await fetchInstagramMedia(token, limit);
      const posts = media
        .map(mediaToFeedPost)
        .filter((post): post is NonNullable<typeof post> => post !== null)
        .slice(0, limit);

      if (posts.length > 0) {
        return { posts, source: "api", handle: INSTAGRAM_HANDLE };
      }
    } catch (err) {
      console.error("[instagram] API fetch failed:", err);
    }
  }

  const slotImages = await getSiteImages([...INSTAGRAM_SLOTS]);
  const slotPosts = postsFromSyncedSlots(slotImages);
  if (slotPosts.length > 0) {
    return { posts: slotPosts.slice(0, limit), source: "slots", handle: INSTAGRAM_HANDLE };
  }

  return { posts: [], source: "empty", handle: INSTAGRAM_HANDLE };
}
