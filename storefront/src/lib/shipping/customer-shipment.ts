/**
 * Pim Etiket — Müşteri tarafı kargo bilgisi okuma.
 *
 * Migration 045 ile gelen fn_get_my_order_shipment RPC'sini wrap eder.
 * RLS: orders.user_id = auth.uid() — sadece kendi siparişlerini görür.
 */

import { createClient } from "@/lib/supabase/client";
import { getCurrentUser } from "@/lib/supabase/auth-bridge";

export interface CustomerShipment {
  hasShipment: boolean;
  carrierCode: string;
  carrierLabel: string;
  trackingNumber: string;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  status: string;
}

interface DbRow {
  has_shipment: boolean;
  carrier_code: string;
  carrier_label: string;
  tracking_number: string;
  tracking_url: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  status: string;
}

/**
 * Sipariş için kargo bilgisini getir.
 * `null` döner:
 *   - Auth yok (guest)
 *   - Sipariş bulunamadı / başkasına ait
 *   - Henüz kargoya verilmemiş
 */
export async function fetchMyOrderShipment(
  orderId: string
): Promise<CustomerShipment | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "fn_get_my_order_shipment" as never,
    { p_order_id: orderId } as never
  );

  if (error) {
    // Sefa: bilinçli sessiz dön — order bulunamadıysa veya RPC yoksa
    // tracking kartını GİZLE, müşteriyi hata mesajıyla rahatsız etme
    console.warn("[shipment] fetch error:", error.message);
    return null;
  }

  const rows = data as DbRow[];
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  if (!r.has_shipment) return null;

  return {
    hasShipment: r.has_shipment,
    carrierCode: r.carrier_code,
    carrierLabel: r.carrier_label,
    trackingNumber: r.tracking_number,
    trackingUrl: r.tracking_url,
    shippedAt: r.shipped_at,
    deliveredAt: r.delivered_at,
    status: r.status,
  };
}
