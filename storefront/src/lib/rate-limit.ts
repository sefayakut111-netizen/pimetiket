/**
 * Lightweight rate limiter — single-instance fallback + optional Upstash.
 *
 * Audit P0 (12 May): /api/pim/chat OPENAI_API_KEY ile her isteğe ~$0.002
 * harcayan endpoint. Anonim guest + IP-bazlı rate limit ile bot/spam
 * kötüye kullanım engellenmeli.
 *
 * Strateji:
 *   - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN env varsa Upstash
 *     (multi-instance, cluster-safe)
 *   - Yoksa local in-memory Map (single instance fallback — serverless
 *     soğuk start'ta sıfırlanır, basit ama maliyet kontrolünde yeterli)
 *
 * Kullanım:
 *   const result = await rateLimit({ key: `chat:${ip}`, limit: 10, windowMs: 60_000 });
 *   if (!result.success) {
 *     return new Response("Too many requests", { status: 429,
 *       headers: { "retry-after": String(result.retryAfter) } });
 *   }
 */

import { UPSTASH_HTTP_TIMEOUT_MS } from "@/lib/http/external-timeouts";

interface RateLimitResult {
  /** İstek limit içinde mi? */
  success: boolean;
  /** Kalan istek hakkı */
  remaining: number;
  /** Penceredeki toplam limit */
  limit: number;
  /** Yeniden denemek için bekleme süresi (saniye) — 0 = hemen */
  retryAfter: number;
}

interface RateLimitOptions {
  /** Sayaç anahtarı (örn. `chat:1.2.3.4`) */
  key: string;
  /** Pencerede izin verilen max istek */
  limit: number;
  /** Pencere uzunluğu (ms) */
  windowMs: number;
}

// ============================================================
// In-memory store (single instance fallback)
// ============================================================
interface Bucket {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, Bucket>();

/** Sızıntı önleme — 60 saniyede bir expired key'leri temizle */
let lastCleanup = 0;
function cleanupIfNeeded(): void {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [k, v] of memoryStore) {
    if (v.resetAt < now) memoryStore.delete(k);
  }
  // Sınır: 10k key'den fazla birikirse en eskileri at (oldest first by resetAt)
  if (memoryStore.size > 10_000) {
    const entries = Array.from(memoryStore.entries()).sort(
      (a, b) => a[1].resetAt - b[1].resetAt
    );
    for (const [k] of entries.slice(0, memoryStore.size - 10_000)) {
      memoryStore.delete(k);
    }
  }
}

async function inMemoryCheck(
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  cleanupIfNeeded();
  const now = Date.now();
  const existing = memoryStore.get(opts.key);

  if (!existing || existing.resetAt < now) {
    memoryStore.set(opts.key, {
      count: 1,
      resetAt: now + opts.windowMs,
    });
    return {
      success: true,
      remaining: opts.limit - 1,
      limit: opts.limit,
      retryAfter: 0,
    };
  }

  existing.count += 1;
  const remaining = Math.max(0, opts.limit - existing.count);
  const retryAfter = Math.ceil((existing.resetAt - now) / 1000);

  return {
    success: existing.count <= opts.limit,
    remaining,
    limit: opts.limit,
    retryAfter: existing.count > opts.limit ? retryAfter : 0,
  };
}

// ============================================================
// Upstash REST API (opsiyonel — multi-instance için)
// ============================================================
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function upstashCheck(
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    // Bu yola hiç düşmemeli — caller flag'i kontrol etmiş olmalı
    return inMemoryCheck(opts);
  }
  try {
    // INCR + EXPIRE pipeline
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", opts.key],
        ["PEXPIRE", opts.key, opts.windowMs, "NX"],
        ["PTTL", opts.key],
      ]),
      signal: AbortSignal.timeout(UPSTASH_HTTP_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(
        "[rate-limit] upstash failed, falling back to memory:",
        res.status
      );
      return inMemoryCheck(opts);
    }
    const data = (await res.json()) as Array<{ result: number }>;
    const count = data[0]?.result ?? 1;
    const ttlMs = data[2]?.result ?? opts.windowMs;
    const remaining = Math.max(0, opts.limit - count);
    return {
      success: count <= opts.limit,
      remaining,
      limit: opts.limit,
      retryAfter: count > opts.limit ? Math.ceil(ttlMs / 1000) : 0,
    };
  } catch (e) {
    console.warn("[rate-limit] upstash exception, fallback:", e);
    return inMemoryCheck(opts);
  }
}

/** Public API */
export async function rateLimit(
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    return upstashCheck(opts);
  }
  return inMemoryCheck(opts);
}

/** Header'dan client IP'yi normalize ederek çıkar (Vercel: güvenilir IP sonda) */
export function getClientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const last = xff.split(",").at(-1)?.trim();
    if (last) return last;
  }
  return "unknown";
}
