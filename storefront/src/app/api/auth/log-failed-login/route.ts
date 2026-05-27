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
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const BodySchema = z.object({
  email: z.string().email().max(254),
  reason: z.string().max(100).default("password_invalid"),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit({
    key: `log-failed-login:${ip ?? "unknown"}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json({ ok: false, reason: "rate_limited" });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const raw = (await req.json()) as unknown;
    body = BodySchema.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_body" });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  if (!ip) {
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
    return NextResponse.json({ ok: false, reason: "rpc_failed" });
  }
}
