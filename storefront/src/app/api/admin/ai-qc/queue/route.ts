/**
 * GET /api/admin/ai-qc/queue
 *
 * Sefa kuralı (16 May v3 baskı onay akışı):
 *   Bu endpoint admin/staff'a Design QC agent'in flag'lediği siparişleri
 *   sunar. order.status IN ('human_review','human_review_failed','proof_generating')
 *   olan siparişler + son design_quality_checks satırı.
 *
 * Response:
 *   {
 *     ok: true,
 *     queue: Array<{
 *       orderId, status, createdAt, totalKurus, customerName,
 *       items: [{ product, title, width, height, qty }],
 *       qcRuns: [{ runId, verdict, score, fileType, findings, fileId, fileName }]
 *     }>
 *   }
 */

import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/supabase/assert-permission";
import { createAdminClient } from "@/lib/supabase/admin";

interface OrderRow {
  id: string;
  status: string;
  created_at: string;
  total: number;
  address: Record<string, unknown> | null;
  user_id: string | null;
}

interface ItemRow {
  id: string;
  order_id: string;
  product: string;
  title: string;
  width: number;
  height: number;
  qty: number;
}

interface QCRow {
  id: string;
  order_id: string | null;
  design_file_id: string | null;
  verdict: string;
  score: number | null;
  analysis: Record<string, unknown> | null;
  findings: unknown;
  created_at: string;
}

interface FileRow {
  id: string;
  original_name: string;
  storage_path: string;
  mime_type: string;
}

export async function GET() {
  const auth = await assertPermission("ai_qc", "view");
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // 1) Sıradaki siparişler
  const { data: ordersData, error: ordersErr } = await admin
    .from("orders")
    .select("id, status, created_at, total, address, user_id")
    .in("status", [
      "human_review",
      "human_review_failed",
      "proof_generating",
      "operator_review", // P1 #7 — qc_attempt limit aşıldı, AI atlandı
    ] as never)
    .order("created_at", { ascending: false })
    .limit(50);

  if (ordersErr) {
    return NextResponse.json(
      { error: "queue_query_failed", detail: ordersErr.message },
      { status: 500 }
    );
  }

  const orders = (ordersData ?? []) as unknown as OrderRow[];

  if (orders.length === 0) {
    return NextResponse.json({ ok: true, queue: [] });
  }

  const orderIds = orders.map((o) => o.id);

  // 2) Order items
  const { data: itemsData } = await admin
    .from("order_items")
    .select("id, order_id, product, title, width, height, qty")
    .in("order_id", orderIds as never);

  const items = (itemsData ?? []) as unknown as ItemRow[];

  // 3) QC results
  const { data: qcData } = await admin
    .from("design_quality_checks")
    .select("id, order_id, design_file_id, verdict, score, analysis, findings, created_at")
    .in("order_id", orderIds as never)
    .order("created_at", { ascending: false });

  const qcRuns = (qcData ?? []) as unknown as QCRow[];

  // 4) Design files (latest per order)
  const fileIds = Array.from(
    new Set(qcRuns.map((q) => q.design_file_id).filter(Boolean) as string[])
  );

  let filesMap: Map<string, FileRow> = new Map();
  if (fileIds.length > 0) {
    const { data: filesData } = await admin
      .from("design_files")
      .select("id, original_name, storage_path, mime_type")
      .in("id", fileIds as never);
    filesMap = new Map(
      ((filesData ?? []) as unknown as FileRow[]).map((f) => [f.id, f])
    );
  }

  // 5) Aggregate
  const queue = orders.map((o) => {
    const addr = o.address as { name?: string } | null;
    const customerName = addr?.name ?? "—";
    return {
      orderId: o.id,
      status: o.status,
      createdAt: o.created_at,
      total: Number(o.total),
      customerName,
      items: items
        .filter((i) => i.order_id === o.id)
        .map((i) => ({
          product: i.product,
          title: i.title,
          width: i.width,
          height: i.height,
          qty: i.qty,
        })),
      qcRuns: qcRuns
        .filter((q) => q.order_id === o.id)
        .map((q) => {
          const file = q.design_file_id ? filesMap.get(q.design_file_id) : null;
          return {
            runId: q.id,
            verdict: q.verdict,
            score: q.score,
            fileType:
              (q.analysis as { fileType?: string } | null)?.fileType ?? null,
            effectiveDpi:
              (q.analysis as { effectiveDpi?: number | null } | null)
                ?.effectiveDpi ?? null,
            findings: q.findings,
            fileId: q.design_file_id,
            fileName: file?.original_name ?? null,
            createdAt: q.created_at,
          };
        }),
    };
  });

  return NextResponse.json({ ok: true, queue });
}
