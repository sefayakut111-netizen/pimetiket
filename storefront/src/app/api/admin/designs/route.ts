/**
 * /api/admin/designs — Admin tasarım kütüphanesi listeleyici.
 *
 * design_files tablosundaki tüm tasarımları (superseded hariç) admin/staff
 * için listeler. Müşteri, sipariş ve QC durumu ile birlikte.
 *
 * Yanıt:
 *   { designs: AdminDesignRow[], total: number }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET } from "@/lib/storage/design-files";

export interface AdminDesignRow {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  storagePath: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  version: number;
  status: string;
  product: string | null;
  productTitle: string | null;
  productConfig: string | null;
  previewUrl: string | null;
  uploadedAt: string;
  aiCheckFlags: Array<{ kind: string; message: string }>;
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check — sadece admin/staff
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as { role?: string } | null)?.role;
    if (role !== "admin" && role !== "staff") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);

    let query = supabase
      .from("design_files")
      .select("*")
      .neq("status", "superseded")
      .order("uploaded_at", { ascending: false })
      .limit(limit);

    if (statusFilter) query = query.eq("status", statusFilter);

    const { data: files, error } = await query;

    if (error) {
      console.error("[admin/designs] list error:", error);
      return NextResponse.json(
        { error: "Tasarım listesi alınamadı" },
        { status: 500 }
      );
    }
    if (!files || files.length === 0) {
      return NextResponse.json({ designs: [], total: 0 });
    }

    type FileRow = {
      id: string;
      order_id: string;
      order_item_id: string | null;
      user_id: string;
      storage_path: string;
      original_name: string;
      size_bytes: number;
      mime_type: string;
      version: number;
      status: string;
      ai_check: { flags?: Array<{ kind: string; message: string }> } | null;
      uploaded_at: string;
    };
    const fileRows = files as FileRow[];

    // Order + order_items + address bilgisini topla
    const orderIds = Array.from(new Set(fileRows.map((f) => f.order_id)));
    const { data: orders } = await supabase
      .from("orders")
      .select("id, address")
      .in("id", orderIds);
    const orderMap = new Map<
      string,
      { name?: string; phone?: string }
    >();
    for (const o of (orders ?? []) as Array<{
      id: string;
      address: { name?: string; phone?: string } | null;
    }>) {
      orderMap.set(o.id, {
        name: o.address?.name ?? "—",
        phone: o.address?.phone ?? "",
      });
    }

    const itemIds = fileRows
      .map((f) => f.order_item_id)
      .filter((id): id is string => id !== null);
    const { data: items } =
      itemIds.length > 0
        ? await supabase
            .from("order_items")
            .select("id, product, title, config")
            .in("id", itemIds)
        : { data: [] };
    const itemMap = new Map<
      string,
      { product: string; title: string; config: string }
    >();
    for (const i of (items ?? []) as Array<{
      id: string;
      product: string;
      title: string;
      config: string;
    }>) {
      itemMap.set(i.id, {
        product: i.product,
        title: i.title,
        config: i.config,
      });
    }

    // Signed URL'leri batch oluştur (1 saatlik)
    const paths = fileRows.map((f) => f.storage_path);
    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(paths, 3600);
    const urlMap = new Map<string, string>();
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl);
    }

    const designs: AdminDesignRow[] = fileRows.map((f) => {
      const cust = orderMap.get(f.order_id) ?? {};
      const item = f.order_item_id ? itemMap.get(f.order_item_id) : null;
      return {
        id: f.id,
        orderId: f.order_id,
        customerName: cust.name ?? "—",
        customerPhone: cust.phone ?? "",
        storagePath: f.storage_path,
        originalName: f.original_name,
        sizeBytes: f.size_bytes,
        mimeType: f.mime_type,
        version: f.version,
        status: f.status,
        product: item?.product ?? null,
        productTitle: item?.title ?? null,
        productConfig: item?.config ?? null,
        previewUrl: urlMap.get(f.storage_path) ?? null,
        uploadedAt: f.uploaded_at,
        aiCheckFlags: f.ai_check?.flags ?? [],
      };
    });

    return NextResponse.json({ designs, total: designs.length });
  } catch (e) {
    console.error("[admin/designs] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}
