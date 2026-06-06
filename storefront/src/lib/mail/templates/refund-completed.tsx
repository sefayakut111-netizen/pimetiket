/**
 * Para iadesi tamamlandı — PayTR gerçek iade sonrası.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface RefundCompletedProps {
  customerName: string;
  orderId: string;
  refundAmount: number;
  cardLast4?: string;
}

export function RefundCompletedEmail({
  customerName,
  orderId,
  refundAmount,
  cardLast4,
}: RefundCompletedProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const amountLabel = refundAmount.toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
  });

  return (
    <BaseLayout preview={`İade kartına yansıyacak — ${orderId}`}>
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        {firstName}, iade işlemi başlatıldı
      </Text>
      <Text style={mailStyles.p}>
        PayTR üzerinden iade banka tarafına iletildi. Tutar genelde 3–10 iş
        günü içinde kartında görünür (banka süreleri değişebilir).
      </Text>

      <Section
        style={{
          background: COLORS.krem,
          borderRadius: 12,
          padding: "16px 20px",
          margin: "20px 0",
        }}
      >
        <Text style={{ ...mailStyles.label, marginTop: 0 }}>İADE DETAYI</Text>
        <Text style={{ ...mailStyles.p, margin: "8px 0 4px", fontWeight: 600 }}>
          {amountLabel} ₺
        </Text>
        {cardLast4 && (
          <Text style={{ ...mailStyles.pSecondary, margin: 0, fontSize: 13 }}>
            Kart: **** {cardLast4}
          </Text>
        )}
      </Section>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <a href={`${SITE}/siparis/${orderId}`} style={mailStyles.buttonPrimary}>
          Sipariş detayı →
        </a>
      </Section>

      <Text style={{ ...mailStyles.pSecondary, fontSize: 13 }}>
        Banka ekstende henüz görünmüyorsa birkaç iş günü daha bekle. Sorun
        devam ederse info@pimetiket.com&apos;a yaz.
      </Text>
    </BaseLayout>
  );
}
