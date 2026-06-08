/**
 * Pim Etiket — Kargo durum güncelleme maili (yolda / dağıtımda).
 *
 * Trigger: Cron poll-shipments yeni status event'i tespit ettiğinde
 * (delivered değilse ara bildirim).
 */

import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, COLORS, SITE } from "./base";

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
  location?: string | null;
  trackingNumber: string;
  trackingUrl?: string | null;
}

const STATUS_TEXT: Record<ShipmentStatusKind, string> = {
  in_transit: "kargo yolda",
  out_for_delivery: "bugün dağıtımda",
  failed: "teslimat başarısız",
  returned: "kargo iade ediliyor",
};

const STATUS_BODY: Record<ShipmentStatusKind, string> = {
  in_transit:
    "Siparişin taşıyıcı sisteminde transfer ediliyor; ilerledikçe seni bilgilendireceğiz.",
  out_for_delivery:
    "Kargo bugün teslim için yola çıktı.",
  failed:
    "Kurye teslimat yapamadı (adres veya ulaşılamama). Takip numarasıyla taşıyıcıya ulaş veya bize yaz.",
  returned:
    "Kargo gönderici olarak bize iade ediliyor. Durumu netleştirip seninle iletişime geçeceğiz.",
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
  const statusText = STATUS_TEXT[status];
  const body = STATUS_BODY[status];
  const orderUrl = `${SITE}/siparis/${orderId}`;

  return (
    <BaseLayout preview="Kargo aşamasındaki son durum.">
      <Eyebrow>Sipariş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>
        Siparişin yolda ilerliyor
      </Text>
      <Text style={mailStyles.p}>
        Merhaba {firstName}, {orderId} numaralı siparişinde güncelleme var:{" "}
        <strong>{statusText}</strong>. {body}
      </Text>

      <Section
        style={{
          background: COLORS.krem,
          borderRadius: 12,
          padding: "16px 20px",
          margin: "20px 0",
        }}
      >
        <Text style={{ ...mailStyles.label, marginTop: 0 }}>
          Taşıyıcı açıklaması
        </Text>
        <Text style={{ ...mailStyles.p, margin: "4px 0", fontWeight: 600 }}>
          {description}
          {location && (
            <span style={{ color: COLORS.muted, fontWeight: 400 }}>
              {" "}
              · {location}
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

      <Button
        href={trackingUrl ?? orderUrl}
        label={trackingUrl ? "Kargomu takip et" : "Siparişimi takip et"}
      />

      <Text style={mailStyles.pSecondary}>
        Sorun olursa{" "}
        <Link href={`${SITE}/destek`} style={{ color: COLORS.pimMercan }}>
          destek
        </Link>{" "}
        üzerinden bize yaz.
      </Text>
    </BaseLayout>
  );
}
