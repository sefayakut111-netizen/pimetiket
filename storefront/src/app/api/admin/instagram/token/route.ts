import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { logServerAudit } from "@/lib/audit-log-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeInstagramLongLivedToken } from "@/lib/instagram/exchange-token";
import { saveInstagramAccessToken } from "@/lib/instagram/token";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await assertPermission("settings", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { accessToken?: string; exchange?: boolean };
  try {
    body = (await req.json()) as { accessToken?: string; exchange?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawToken = body.accessToken?.trim();
  if (!rawToken || rawToken.length < 20) {
    return NextResponse.json(
      { error: "Geçerli access token gerekli" },
      { status: 400 }
    );
  }

  let accessToken = rawToken;
  let expiresAt: string | null = null;
  let exchanged = false;

  if (body.exchange) {
    const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
    if (!appSecret) {
      return NextResponse.json(
        {
          error:
            "Long-lived çevrim için INSTAGRAM_APP_SECRET Vercel env'de tanımlı olmalı",
        },
        { status: 400 }
      );
    }
    try {
      const result = await exchangeInstagramLongLivedToken(rawToken, appSecret);
      accessToken = result.accessToken;
      expiresAt = result.expiresAt;
      exchanged = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Token exchange başarısız";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  try {
    await saveInstagramAccessToken(accessToken, expiresAt);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Token kaydedilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const admin = createAdminClient();
  await logServerAudit(admin, {
    actorId: auth.user.id,
    actorEmail: auth.user.email ?? null,
    actorRole: auth.role,
    action: "settings.update",
    targetType: "integration",
    targetId: "instagram_access_token",
    summary: exchanged
      ? "Instagram long-lived token kaydedildi"
      : "Instagram access token kaydedildi",
    detail: { exchanged, hasExpiresAt: Boolean(expiresAt) },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({
    ok: true,
    exchanged,
    expiresAt,
  });
}
