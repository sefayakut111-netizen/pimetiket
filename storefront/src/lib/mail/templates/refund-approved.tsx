/**
 * İade talebi onaylandı — ürün geri gönderimi bekleniyor.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, COLORS, SITE } from "./base";

export interface RefundApprovedProps {
  customerName: string;
  orderId: string;
  returnId: string;
  adminNote: string;
}

export function RefundApprovedEmail({
  customerName,
  orderId,
  returnId,
  adminNote,
}: RefundApprovedProps) {
  const firstName = customerName.split(" ")[0] || customerName;

  return (
    <BaseLayout preview={`İade talebin onaylandı — ${orderId}`}>
      <Eyebrow>Sipariş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>
        {firstName}, iade talebin onaylandı
      </Text>
      <Text style={mailStyles.p}>{adminNote}</Text>

      <Section
        style={{
          background: COLORS.krem,
          borderRadius: 12,
          padding: "16px 20px",
          margin: "20px 0",
        }}
      >
        <Text style={{ ...mailStyles.label, marginTop: 0 }}>SONRAKİ ADIM</Text>
        <Text style={{ ...mailStyles.p, margin: "8px 0 0", fontSize: 14 }}>
          Ürünü kargoyla geri gönder. Paket bize ulaşınca para iadesi
          başlatılır; tamamlandığında ayrı mail gelir.
        </Text>
        <Text style={{ ...mailStyles.pSecondary, margin: "8px 0 0", fontSize: 12 }}>
          Talep: {returnId.slice(0, 8)}…
        </Text>
      </Section>

      <Button href={`${SITE}/iadelerim`} label="İade detayları" />
    </BaseLayout>
  );
}
