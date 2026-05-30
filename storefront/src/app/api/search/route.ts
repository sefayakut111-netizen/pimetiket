/**
 * GET /api/search?q=
 * Site geneli akıllı arama — sayfalar, blog, (üye ise) sipariş no.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublishedPosts } from "@/lib/blog-posts";
import { searchSitePages } from "@/lib/search/site-pages";
import { matchesQuery } from "@/lib/search/strip-diacritics";

export const dynamic = "force-dynamic";

const LIMIT = 12;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const results = searchSitePages(q, {
    member: Boolean(user),
    limit: 6,
  });

  const posts = await getPublishedPosts();
  for (const post of posts) {
    if (results.length >= LIMIT) break;
    if (
      matchesQuery(q, post.title, post.excerpt, post.category, post.slug)
    ) {
      results.push({
        href: `/blog/${post.slug}`,
        label: post.title,
        subtitle: post.category,
        group: "Blog",
      });
    }
  }

  if (user && q.length >= 4 && /\d/.test(q)) {
    try {
      const admin = createAdminClient();
      const safe = q.replace(/"/g, '""');
      const { data: orders } = await admin
        .from("orders")
        .select("id, status, created_at")
        .eq("user_id", user.id)
        .ilike("id", `%${safe}%`)
        .order("created_at", { ascending: false })
        .limit(3);

      for (const row of orders ?? []) {
        const order = row as { id: string; status: string };
        results.push({
          href: `/siparislerim?order=${encodeURIComponent(order.id)}`,
          label: `Sipariş ${order.id}`,
          subtitle: order.status,
          group: "Siparişlerim",
        });
      }
    } catch {
      /* sessiz */
    }
  }

  return NextResponse.json({ results: results.slice(0, LIMIT) });
}
