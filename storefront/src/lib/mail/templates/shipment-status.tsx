/**
 * Pim Etiket — Kargo durum güncelleme maili (yolda / dağıtımda).
 *
 * Sefa 19 May v68: Cron poll-shipments yeni status event'i tespit
 * ettiğinde, eğer "delivered" değilse ara bildirim gönderir.
 *
 * Durum kategorileri:
 *   - in_transit / picked_up → "Kargon yola çıktı"
 *   - out_for_delivery → "Kargon bugün teslim için yolda"
 *   - failed → "Teslimat başarısız oldu"
 *   - returned → "Kargon iade edildi"
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export type ShipmentStatusKind =
  | "in_transit"
  | "out_for_delivery"
  | "failed"
  | "returned";

export interface ShipmentStatusProps {
  customerName: string;
  orderId: string;
  status: ShipmentStatusKind;
  /** Yurtiçi'den gelen açıklama "Şubeye geldi" gibi */
  description: string;
  location?: string | null; // "Üsküdar Şubesi"
  trackingNumber: string;
  trackingUrl?: string | null;
}

const STATUS_TITLE: Record<ShipmentStatusKind, string> = {
  in_transit: "🚚 Kargon yola çıktı",
  out_for_delivery: "🛵 Kargon bugün dağıtımda",
  failed: "⚠️ Teslimat başarısız oldu",
  returned: "↩️ Kargo iade edildi",
};

const STATUS_BODY: Record<ShipmentStatusKind, string> = {
  in_transit:
    "Siparişin Yurtiçi Kargo sistemine giriş yaptı ve transfer ediliyor. " +
    "Tahmini 1-3 iş günü içinde elinde olacak.",
  out_for_delivery:
    "Kargo bugün senin için yola çıktı. Kurye 09:00-18:00 arası teslim eder. " +
    "Evde olamayacaksan kargo şubesinden alabilirsin.",
  failed:
    "Kurye seni evde bulamadı (3 deneme veya adres sorunu olabilir). " +
    "Lütfen kargo şubesinden ne kadar süre saklanacağını öğrenmek için " +
    "takip numarasıyla Yurtiçi'ne ulaş veya bize WhatsApp'tan haber ver.",
  returned:
    "Kargo gönderici olarak bize iade ediliyor. Sorun ne kaynaklıydı " +
    "tespit edip seninle iletişime geçeceğiz; ya yeniden gönderim ya " +
    "ücret iadesi planlayacağız.",
};

const STATUS_COLOR: Record<ShipmentStatusKind, string> = {
  in_transit: COLORS.lacivert,
  out_for_delivery: "#AD6800",
  failed: COLORS.errorText,
  returned: COLORS.errorText,
};

export function ShipmentStatusEmail({
  customerName,
  orderId,
  status,
  description,
  location,
  trackingNumber,
  trackingUrl,
}: ShipmentStatusProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const title = STATUS_TITLE[status];
  const body = STATUS_BODY[status];
  const orderUrl = `${SITE}/siparis/${orderId}`;

  return (
    <BaseLayout preview={`${title} — ${orderId}`}>
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={{ ...mailStyles.h1, color: STATUS_COLOR[status] }}>
        {firstName}, {title}
      </Text>
      <Text style={mailStyles.p}>{body}</Text>

      <Section
        style={{
          background: COLORS.krem,
          borderRadius: 12,
          padding: "16px 20px",
          margin: "20px 0",
        }}
      >
        <Text style={{ ...mailStyles.label, marginTop: 0 }}>
          Yurtiçi açıklaması
        </Text>
        <Text style={{ ...mailStyles.p, margin: "4px 0", fontWeight: 600 }}>
          {description}
          {location && (
            <span style={{ color: COLORS.muted, fontWeight: 400 }}>
              {" "}· {location}
            </span>
          )}
        </Text>
        <Text style={{ ...mailStyles.p, margin: "8px 0 0", fontSize: 13 }}>
          Takip no:{" "}
          <code style={{ background: "#fff", padding: "2px 6px", borderRadius: 4 }}>
            {trackingNumber}
          </code>
        </Text>
      </Section>

      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        {trackingUrl && (
          <a
            href={trackingUrl}
            style={{
              background: COLORS.brand,
              color: "#fff",
              textDecoration: "none",
              padding: "12px 28px",
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 14,
              display: "inline-block",
              marginRight: 8,
            }}
          >
            Yurtiçi'de takip et →
          </a>
        )}
        <a
          href={orderUrl}
          style={{
            background: "#fff",
            color: COLORS.lacivert,
            textDecoration: "none",
            padding: "12px 28px",
            borderRadius: 999,
            fontWeight: 600,
            fontSize: 14,
            display: "inline-block",
            border: `1px solid ${COLORS.gri200}`,
          }}
        >
          Sipariş detayı
        </a>
      </Section>
    </BaseLayout>
  );
}
