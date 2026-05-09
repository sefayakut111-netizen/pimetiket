/**
 * Kargo bildirim maili — sipariş kargoya verildiğinde gönderilir.
 * Trigger: order_events 'shipped' event'i.
 */

import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface ShippingUpdateProps {
  customerName: string;
  orderId: string;
  carrierName: string; // "Yurtiçi Kargo", "Aras", "MNG", "PTT"
  trackingNumber: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
}

export function ShippingUpdateEmail({
  customerName,
  orderId,
  carrierName,
  trackingNumber,
  trackingUrl,
  estimatedDelivery,
}: ShippingUpdateProps) {
  const firstName = customerName.split(" ")[0] || customerName;

  return (
    <BaseLayout preview={`Siparişin yola çıktı — ${orderId}`}>
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        {firstName}, siparişin yola çıktı 🚚
      </Text>
      <Text style={mailStyles.p}>
        Üretim tamamlandı, paketlendi ve kargoya verildi. Yakında elinde olur.
      </Text>

      <Section style={mailStyles.card}>
        <Text
          style={{
            margin: 0,
            fontSize: 12,
            color: COLORS.gri700,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Kargo bilgileri
        </Text>
        <Text
          style={{
            margin: "8px 0 0",
            fontSize: 18,
            color: COLORS.lacivert,
            fontWeight: 700,
          }}
        >
          {carrierName}
        </Text>
        <Text
          style={{
            margin: "4px 0 0",
            fontSize: 14,
            color: COLORS.lacivert,
            fontFamily: "monospace",
          }}
        >
          Takip no: <strong>{trackingNumber}</strong>
        </Text>
        {estimatedDelivery && (
          <Text
            style={{
              margin: "12px 0 0",
              fontSize: 13,
              color: COLORS.gri700,
            }}
          >
            Tahmini teslim:{" "}
            <strong style={{ color: COLORS.lacivert }}>
              {estimatedDelivery}
            </strong>
          </Text>
        )}
      </Section>

      <Section style={{ margin: "24px 0 8px" }}>
        {trackingUrl && (
          <Link href={trackingUrl} style={mailStyles.buttonPrimary}>
            Kargo takibi →
          </Link>
        )}
        {!trackingUrl && (
          <Link
            href={`${SITE}/siparis/${orderId}`}
            style={mailStyles.buttonPrimary}
          >
            Sipariş detayları →
          </Link>
        )}
      </Section>

      <Text style={mailStyles.pSecondary}>
        Kargo gelince mutlaka kontrol et — paket hasarlıysa kargocu önünde tutanak
        tut, fotoğrafla, bize ilet. İade gerekirse 14 gün içinde başlatabiliriz.
      </Text>
    </BaseLayout>
  );
}
