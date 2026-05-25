import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { logServerAudit } from "@/lib/audit-log-server";
import { CRON_REGISTRY, cronTriggerPath } from "@/lib/cron-registry";

export const dynamic = "force-dynamic";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: Request) {
  const auth = await assertPermission("settings", "update");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { cronName?: string };
  try {
    body = (await req.json()) as { cronName?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cronName = body.cronName?.trim();
  if (!cronName) {
    return NextResponse.json({ error: "cronName gerekli" }, { status: 400 });
  }

  const known = CRON_REGISTRY.some((c) => c.name === cronName);
  if (!known) {
    return NextResponse.json({ error: "Bilinmeyen cron" }, { status: 400 });
  }

  const path = cronTriggerPath(cronName);
  if (!path) {
    return NextResponse.json(
      { error: "Bu cron manuel tetiklenemez" },
      { status: 400 }
    );
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil" }, { status: 500 });
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(`${origin}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }

  const admin = serviceClient();
  await logServerAudit(admin, {
    actorId: auth.user.id,
    actorEmail: auth.user.email ?? null,
    actorRole: auth.role,
    action: "cron.manual_trigger",
    targetType: "cron",
    targetId: cronName,
    summary: `Cron manuel tetiklendi: ${cronName}`,
    detail: { path, status: res.status, response: json },
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, status: res.status, response: json },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, response: json });
}
