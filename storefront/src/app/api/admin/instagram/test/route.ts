import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { fetchInstagramMedia, mediaToFeedPost } from "@/lib/instagram/fetch-media";
import { getInstagramToken } from "@/lib/instagram/token";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await assertPermission("settings", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = await getInstagramToken();
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Token yok — önce kaydet veya INSTAGRAM_ACCESS_TOKEN env" },
      { status: 400 }
    );
  }

  try {
    const media = await fetchInstagramMedia(token, 6);
    const posts = media
      .map(mediaToFeedPost)
      .filter((p): p is NonNullable<typeof p> => p !== null);

    return NextResponse.json({
      ok: true,
      mediaCount: media.length,
      postCount: posts.length,
      samplePermalinks: posts.slice(0, 3).map((p) => p.permalink),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "API test başarısız";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
