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
  carrierName: string;
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
  const preheader = estimatedDelivery
    ? `${carrierName} · tahmini teslim ${estimatedDelivery}`
    : `${carrierName} · takip numaran e-postada`;

  return (
    <BaseLayout preview={preheader}>
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        {firstName}, siparişin kargoda
      </Text>
      <Text style={mailStyles.p}>
        {orderId} numaralı siparişin kargoya verildi.
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
        <Link
          href={trackingUrl ?? `${SITE}/siparis/${orderId}`}
          style={mailStyles.buttonPrimary}
        >
          Kargomu takip et →
        </Link>
      </Section>

      <Text style={mailStyles.pSecondary}>
        Teslimde bir sorun olursa bize hemen yaz —{" "}
        <Link href={`${SITE}/destek`} style={{ color: COLORS.pimMercan }}>
          destek
        </Link>
        .
      </Text>
    </BaseLayout>
  );
}
