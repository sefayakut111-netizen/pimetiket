/**
 * Müşteri tasarım kütüphanesi — design_files'tan list + signed URL.
 *
 * Hibrit:
 *   - Auth varsa  → Supabase design_files (RLS user_id)
 *   - Auth yoksa  → boş list (login CTA göster)
 *
 * Kullanım:
 *   /tasarımlarım sayfası — kullanıcının yüklediği tüm tasarımlar.
 *   Her satır için: thumbnail (signed URL 1h), original_name, sipariş
 *   bağlantısı, "yeniden bastır" butonu.
 */

import { createClient } from "./supabase/client";
import { getCurrentUser } from "./supabase/auth-bridge";
import { STORAGE_BUCKET } from "./storage/design-files";

export type DesignStatus =
  | "uploaded"
  | "analyzing"
  | "qc_passed"
  | "qc_warned"
  | "qc_failed"
  | "approved"
  | "superseded";

export interface CustomerDesign {
  id: string;
  orderId: string;
  orderItemId: string | null;
  storagePath: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  version: number;
  status: DesignStatus;
  /** AI ön-kontrol flag'leri */
  aiCheckFlags: Array<{
    kind: "ok" | "warning" | "error";
    message: string;
  }>;
  /** Preview için signed URL (1 saat geçerli) */
  previewUrl: string | null;
  uploadedAt: string;
  /** Bu tasarım hangi üründe kullanıldı (order_items.product) */
  product: "sticker" | "etiket" | null;
  /** Ürün başlığı (order_items.title) */
  productTitle: string | null;
  /** Konfig özeti */
  productConfig: string | null;
}

interface DesignFileDbRow {
  id: string;
  order_id: string;
  order_item_id: string | null;
  storage_path: string;
  original_name: string;
  size_bytes: number;
  mime_type: string;
  version: number;
  status: DesignStatus;
  ai_check: {
    flags?: Array<{ kind: string; message: string }>;
  } | null;
  uploaded_at: string;
}

interface OrderItemDbRow {
  id: string;
  product: "sticker" | "etiket";
  title: string;
  config: string;
}

/**
 * Kullanıcının tüm aktif tasarımlarını listele (superseded hariç).
 *
 * @returns Sadece status != 'superseded' olanlar, en yeni başta
 */
export async function listMyDesigns(): Promise<CustomerDesign[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = createClient();

  // 1) design_files çek
  const { data: files, error } = await supabase
    .from("design_files")
    .select("*")
    .eq("user_id", user.id)
    .neq("status", "superseded")
    .order("uploaded_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[customer-designs] list error:", error);
    return [];
  }
  if (!files || files.length === 0) return [];

  const dbFiles = files as unknown as DesignFileDbRow[];

  // 2) İlişkili order_items çek (varsa)
  const orderItemIds = dbFiles
    .map((f) => f.order_item_id)
    .filter((id): id is string => Boolean(id));

  let orderItemMap = new Map<string, OrderItemDbRow>();
  if (orderItemIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("id, product, title, config")
      .in("id", orderItemIds);
    if (items) {
      orderItemMap = new Map(
        (items as unknown as OrderItemDbRow[]).map((i) => [i.id, i])
      );
    }
  }

  // 3) Signed URL'ler — paralel
  const signed = await Promise.all(
    dbFiles.map(async (f) => {
      const { data, error: signErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(f.storage_path, 3600);
      return signErr ? null : data?.signedUrl ?? null;
    })
  );

  return dbFiles.map((f, idx) => {
    const orderItem = f.order_item_id
      ? orderItemMap.get(f.order_item_id)
      : undefined;
    const flags = (f.ai_check?.flags ?? []).map((fl) => ({
      kind: (fl.kind === "warning"
        ? "warning"
        : fl.kind === "error"
          ? "error"
          : "ok") as "ok" | "warning" | "error",
      message: fl.message,
    }));
    return {
      id: f.id,
      orderId: f.order_id,
      orderItemId: f.order_item_id,
      storagePath: f.storage_path,
      originalName: f.original_name,
      sizeBytes: f.size_bytes,
      mimeType: f.mime_type,
      version: f.version,
      status: f.status,
      aiCheckFlags: flags,
      previewUrl: signed[idx],
      uploadedAt: f.uploaded_at,
      product: orderItem?.product ?? null,
      productTitle: orderItem?.title ?? null,
      productConfig: orderItem?.config ?? null,
    };
  });
}

/**
 * Bir siparişin TÜM versiyonlarını listele (superseded dahil).
 * `/siparis/[id]` sayfasında "Tasarımın geçmişi" accordion'da kullanılır.
 *
 * @returns Versiyona göre artan sıra (V1, V2, V3...)
 */
export async function listOrderDesignHistory(
  orderId: string
): Promise<CustomerDesign[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = createClient();

  const { data: files, error } = await supabase
    .from("design_files")
    .select("*")
    .eq("user_id", user.id)
    .eq("order_id", orderId)
    .order("version", { ascending: true })
    .order("uploaded_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("[customer-designs] history error:", error);
    return [];
  }
  if (!files || files.length === 0) return [];

  const dbFiles = files as unknown as DesignFileDbRow[];

  // Signed URL'ler — preview için 1 saat
  const signed = await Promise.all(
    dbFiles.map(async (f) => {
      const { data } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(f.storage_path, 3600);
      return data?.signedUrl ?? null;
    })
  );

  return dbFiles.map((f, idx) => {
    const flags = (f.ai_check?.flags ?? []).map((fl) => ({
      kind: (fl.kind === "warning"
        ? "warning"
        : fl.kind === "error"
          ? "error"
          : "ok") as "ok" | "warning" | "error",
      message: fl.message,
    }));
    return {
      id: f.id,
      orderId: f.order_id,
      orderItemId: f.order_item_id,
      storagePath: f.storage_path,
      originalName: f.original_name,
      sizeBytes: f.size_bytes,
      mimeType: f.mime_type,
      version: f.version,
      status: f.status,
      aiCheckFlags: flags,
      previewUrl: signed[idx],
      uploadedAt: f.uploaded_at,
      product: null,
      productTitle: null,
      productConfig: null,
    };
  });
}
