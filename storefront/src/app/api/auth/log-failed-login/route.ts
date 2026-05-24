/**
 * POST /api/auth/log-failed-login
 *
 * Auth endpoint'lerinden (login, password reset, vb) başarısız
 * giriş denemelerini auth_failed_logins tablosuna kaydeder.
 *
 * Body:
 *   { email: string, reason?: string }
 *
 * Server-side IP + user-agent extract eder (client gönderemez).
 *
 * RPC: fn_log_failed_login(email, ip, user_agent, reason)
 *
 * Etki:
 *   - SecurityAuditor brute force tespit edebilir
 *   - fn_recent_failed_logins → IP+email × N attempt gruplaması
 *   - 10+/15dk eşiği → pending action: block_ip
 *
 * Fail-open: RPC çağrı hatası kullanıcı akışını bozmaz (silently log).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  email: z.string().email().max(254),
  reason: z.string().max(100).default("password_invalid"),
});

// Cloudflare CF-Connecting-IP > X-Forwarded-For > X-Real-IP
function getClientIp(req: Request): string | null {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return null;
}

export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    const raw = (await req.json()) as unknown;
    body = BodySchema.parse(raw);
  } catch {
    // Geçersiz body — yine de 200 dön ki client akışı bozulmasın
    return NextResponse.json({ ok: false, reason: "invalid_body" });
  }

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  if (!ip) {
    // IP yoksa logging anlamsız (auditor IP grupluyor). Sessiz skip.
    return NextResponse.json({ ok: false, reason: "no_ip" });
  }

  try {
    const admin = createAdminClient();
    await admin.rpc("fn_log_failed_login", {
      p_email: body.email,
      p_ip: ip,
      p_user_agent: userAgent ?? undefined,
      p_reason: body.reason ?? undefined,
    });
    return NextResponse.json({ ok: true });
  } catch {
    // RPC hatası kullanıcı akışını bozmaz, sessiz fail
    return NextResponse.json({ ok: false, reason: "rpc_failed" });
  }
}
