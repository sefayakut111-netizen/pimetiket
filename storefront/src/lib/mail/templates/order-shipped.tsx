/**
 * Kargoya verildi — admin tracking POST (ilk takip no) tetikler.
 */

import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, COLORS, SITE } from "./base";

export interface OrderShippedProps {
  customerName: string;
  orderId: string;
  carrierName: string;
  trackingNumber: string;
  trackingUrl?: string;
  deliveryWindow: string;
}

export function OrderShippedEmail({
  customerName,
  orderId,
  carrierName,
  trackingNumber,
  trackingUrl,
  deliveryWindow,
}: OrderShippedProps) {
  const firstName = customerName.split(" ")[0] || customerName;

  return (
    <BaseLayout preview={`${carrierName} · takip no ${trackingNumber}`}>
      <Eyebrow>Sipariş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>{firstName}, siparişin kargoda</Text>
      <Text style={mailStyles.p}>
        {orderId} numaralı siparişin kargoya verildi. Tahmini teslim aralığı:{" "}
        <strong>{deliveryWindow}</strong> (kargo süresi hariç).
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
      </Section>

      <Button
        href={trackingUrl ?? `${SITE}/siparis/${orderId}`}
        label="Kargomu takip et"
      />

      <Text style={mailStyles.pSecondary}>
        Teslimde sorun olursa{" "}
        <Link href={`${SITE}/destek`} style={{ color: COLORS.pimMercan }}>
          destek
        </Link>{" "}
        sayfasından yazabilirsin.
      </Text>
    </BaseLayout>
  );
}
