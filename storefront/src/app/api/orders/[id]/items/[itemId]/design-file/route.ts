/**
 * GET /api/orders/[id]/items/[itemId]/design-file
 * Tasarım dosyası — same-origin proxy (POC iframe auto-load için).
 * Uzun Supabase signed URL query string'de kesilmesin diye.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";
import {
  parseDesignFileIdQuery,
  resolveOrderDesignFile,
} from "@/lib/proof/resolve-order-design-file";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: orderId, itemId } = await params;
  if (!orderId || !itemId) {
    return NextResponse.json({ error: "ID eksik" }, { status: 400 });
  }

  const url = new URL(req.url);
  const designFileId = parseDesignFileIdQuery(
    url.searchParams.get("design_file_id")
  );

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const resolved = await resolveOrderDesignFile(
    admin,
    orderId,
    itemId,
    user?.id,
    designFileId
  );
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }

  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .download(resolved.file.storage_path);

  if (error || !data) {
    return NextResponse.json(
      { error: "Dosya indirilemedi", detail: error?.message },
      { status: 500 }
    );
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const safeName = resolved.file.original_name.replace(/[^\w.\-()+ ]/g, "_");
  const asDownload = url.searchParams.get("download") === "1";
  const mime = resolved.file.mime_type || "application/octet-stream";
  const isSvg =
    mime.includes("svg") || safeName.toLowerCase().endsWith(".svg");

  if (isSvg) {
    const text = buffer.toString("utf-8");
    if (/<script[\s>]/i.test(text) || /\bon[a-z]+\s*=/i.test(text)) {
      return NextResponse.json(
        { error: "SVG güvenlik kontrolünden geçemedi" },
        { status: 400 }
      );
    }
  }

  const contentType = isSvg ? "application/octet-stream" : mime;
  const disposition =
    isSvg || asDownload ? "attachment" : "inline";

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Cache-Control": "private, no-cache, max-age=0",
      ...(isSvg ? { "X-Content-Type-Options": "nosniff" } : {}),
    },
  });
}
