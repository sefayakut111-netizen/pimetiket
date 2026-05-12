/**
 * GET /api/admin/subscribers
 *
 * Email abone listesi — admin/staff için. Source bazlı filtre + CSV export.
 *
 * Query:
 *   ?source=sablonlar     → sadece şablon signup'ları
 *   ?format=csv           → CSV export (Resend toplu import için)
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/supabase/assert-admin";

export interface SubscriberRow {
  id: string;
  email: string;
  source: string;
  interests: string[];
  subscribed: boolean;
  welcomeSentAt: string | null;
  consentAt: string;
  createdAt: string;
}

export async function GET(req: Request) {
  const auth = await assertAdmin();
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  const format = searchParams.get("format");

  const admin = createAdminClient();
  let query = admin
    .from("email_subscribers")
    .select(
      "id, email, source, interests, subscribed, welcome_sent_at, consent_at, created_at"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (source) query = query.eq("source", source);

  const { data, error } = await query;
  if (error) {
    console.error("[admin/subscribers] error:", error);
    return NextResponse.json(
      { error: "list_failed", detail: error.message },
      { status: 500 }
    );
  }

  type Row = {
    id: string;
    email: string;
    source: string;
    interests: string[] | null;
    subscribed: boolean;
    welcome_sent_at: string | null;
    consent_at: string;
    created_at: string;
  };

  const rows = (data ?? []) as Row[];
  const subscribers: SubscriberRow[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    source: r.source,
    interests: r.interests ?? [],
    subscribed: r.subscribed,
    welcomeSentAt: r.welcome_sent_at,
    consentAt: r.consent_at,
    createdAt: r.created_at,
  }));

  if (format === "csv") {
    const header =
      "email,source,interests,subscribed,welcome_sent_at,consent_at,created_at";
    const lines = subscribers.map((s) =>
      [
        s.email,
        s.source,
        `"${s.interests.join("|")}"`,
        s.subscribed ? "1" : "0",
        s.welcomeSentAt ?? "",
        s.consentAt,
        s.createdAt,
      ].join(",")
    );
    const csv = [header, ...lines].join("\n");
    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="aboneler-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    subscribers,
    total: subscribers.length,
  });
}
