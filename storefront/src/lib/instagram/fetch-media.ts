import type { InstagramMediaItem } from "./types";

const GRAPH_VERSION = "v21.0";
const FIELDS = [
  "id",
  "caption",
  "media_type",
  "media_url",
  "thumbnail_url",
  "permalink",
  "timestamp",
].join(",");

export async function fetchInstagramMedia(
  accessToken: string,
  limit = 6
): Promise<InstagramMediaItem[]> {
  const url = new URL(`https://graph.instagram.com/${GRAPH_VERSION}/me/media`);
  url.searchParams.set("fields", FIELDS);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Instagram API ${res.status}: ${detail.slice(0, 200)}`);
  }

  const json = (await res.json()) as { data?: InstagramMediaItem[] };
  return (json.data ?? []).filter((item) => Boolean(item.permalink));
}

export function mediaToFeedPost(item: InstagramMediaItem) {
  const imageUrl =
    item.media_type === "VIDEO"
      ? item.thumbnail_url ?? item.media_url
      : item.media_url ?? item.thumbnail_url;

  if (!imageUrl) return null;

  const caption = item.caption?.trim() ?? null;
  return {
    id: item.id,
    imageUrl,
    permalink: item.permalink,
    altText: caption ? caption.slice(0, 120) : "Pim Etiket Instagram gönderisi",
    caption,
  };
}
