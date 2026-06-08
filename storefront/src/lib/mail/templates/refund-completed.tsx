/**
 * Para iadesi tamamlandı — PayTR gerçek iade sonrası.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, COLORS, SITE } from "./base";

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
      <Eyebrow>Sipariş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>
        {firstName}, iade işlemi başlatıldı
      </Text>
      <Text style={mailStyles.p}>
        PayTR üzerinden iade banka tarafına iletildi. Tutar bankana bağlı
        olarak birkaç iş günü içinde kartında görünür.
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

      <Button href={`${SITE}/siparis/${orderId}`} label="Sipariş detayı" />

      <Text style={{ ...mailStyles.pSecondary, fontSize: 13 }}>
        Banka ekstende henüz görünmüyorsa birkaç iş günü daha bekle. Sorun
        devam ederse info@pimetiket.com&apos;a yaz.
      </Text>
    </BaseLayout>
  );
}
