import { NextResponse } from "next/server";
import { getInstagramHomeFeed } from "@/lib/instagram/get-home-feed";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  const feed = await getInstagramHomeFeed(4);
  return NextResponse.json(feed, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
