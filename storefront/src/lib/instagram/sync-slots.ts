import { createAdminClient } from "@/lib/supabase/admin";
import { detectMimeFromMagicBytes } from "@/lib/storage/magic-bytes";
import { fetchInstagramMedia, mediaToFeedPost } from "./fetch-media";

const BUCKET = "public-assets";
const SLOTS = [
  "home_instagram_1",
  "home_instagram_2",
  "home_instagram_3",
  "home_instagram_4",
  "home_instagram_5",
  "home_instagram_6",
] as const;

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function syncInstagramToSiteImageSlots(limit = 6) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  if (!token) {
    return { ok: false as const, reason: "missing_token" as const, synced: 0 };
  }

  const media = await fetchInstagramMedia(token, limit);
  const posts = media
    .map(mediaToFeedPost)
    .filter((post): post is NonNullable<typeof post> => post !== null)
    .slice(0, limit);

  if (posts.length === 0) {
    return { ok: false as const, reason: "no_posts" as const, synced: 0 };
  }

  const admin = createAdminClient();
  let synced = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const slot = SLOTS[i];
    if (!slot) break;

    const imageRes = await fetch(post.imageUrl);
    if (!imageRes.ok) continue;

    const bytes = Buffer.from(await imageRes.arrayBuffer());
    const mime = detectMimeFromMagicBytes(bytes) ?? "image/jpeg";
    const ext = extForMime(mime);
    const storagePath = `site-images/${slot}/${post.id}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: mime, upsert: true });

    if (uploadError) {
      console.error(`[instagram-sync] upload ${slot}:`, uploadError);
      continue;
    }

    const { error: upsertError } = await admin.from("site_images").upsert(
      {
        slot,
        storage_path: storagePath,
        alt_text: post.altText,
        title: post.caption?.slice(0, 80) ?? null,
        link_url: post.permalink,
        is_active: true,
        mime_type: mime,
        size_bytes: bytes.length,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slot" }
    );

    if (upsertError) {
      console.error(`[instagram-sync] upsert ${slot}:`, upsertError);
      continue;
    }

    synced += 1;
  }

  return { ok: synced > 0, reason: synced > 0 ? ("synced" as const) : ("no_posts" as const), synced };
}
