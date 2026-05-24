/**
 * GET /api/public/pricebook — musteri tarafi price book snapshot (read-only).
 */

import { NextResponse } from "next/server";
import { fetchPricebookSnapshot } from "@/lib/pricing-pricebook-db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await fetchPricebookSnapshot();
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    console.error("[public/pricebook]", err);
    return NextResponse.json(
      { ok: false, error: "fetch_failed" },
      { status: 500 }
    );
  }
}
