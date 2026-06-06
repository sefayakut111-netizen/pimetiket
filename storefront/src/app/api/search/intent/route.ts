/**
 * POST /api/search/intent — doğal dil arama niyeti (brief → ürün yönlendirme)
 */

import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  MAX_SEARCH_QUERY_CHARS,
  parseSearchIntent,
} from "@/lib/search/parse-search-intent";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limit = await rateLimit({
    key: `search-intent:ip:${getClientIp(req)}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!limit.success) {
    return NextResponse.json(
      { ok: false, error: "rate_limit_exceeded" },
      {
        status: 429,
        headers: { "retry-after": String(limit.retryAfter) },
      }
    );
  }

  let body: { query?: string };
  try {
    body = (await req.json()) as { query?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const query = body.query?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json(
      { ok: false, error: "query_too_short" },
      { status: 400 }
    );
  }
  if (query.length > MAX_SEARCH_QUERY_CHARS) {
    return NextResponse.json(
      { ok: false, error: "query_too_long" },
      { status: 400 }
    );
  }

  const result = await parseSearchIntent(query);

  return NextResponse.json({
    ok: true,
    query,
    intent: result.intent,
    action: result.action,
    fallback: result.fallback,
  });
}
