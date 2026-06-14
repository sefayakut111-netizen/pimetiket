import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { maskInstagramToken } from "@/lib/instagram/exchange-token";
import { getInstagramToken, getInstagramTokenStatus } from "@/lib/instagram/token";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertPermission("settings", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = await getInstagramTokenStatus();
  const token = status.hasToken ? await getInstagramToken() : null;
  const admin = createAdminClient();

  let integrationTableReady = false;
  try {
    const { error } = await admin.from("integration_secrets").select("key").limit(1);
    integrationTableReady = !error;
  } catch {
    integrationTableReady = false;
  }

  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const hasAppSecret = Boolean(process.env.INSTAGRAM_APP_SECRET?.trim());

  return NextResponse.json({
    ok: true,
    status: {
      ...status,
      tokenPreview: token ? maskInstagramToken(token) : null,
      envFallbackConfigured: Boolean(envToken),
      appSecretConfigured: hasAppSecret,
      integrationTableReady,
      handle: "pimetiket",
    },
  });
}
