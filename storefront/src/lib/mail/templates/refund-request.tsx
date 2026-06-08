/**
 * İade talebi alındı — müşteri RMA oluşturdu.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, COLORS, SITE } from "./base";

export interface RefundRequestProps {
  customerName: string;
  orderId: string;
  returnId: string;
  reasonLabel: string;
}

export function RefundRequestEmail({
  customerName,
  orderId,
  returnId,
  reasonLabel,
}: RefundRequestProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const returnsUrl = `${SITE}/iadelerim`;

  return (
    <BaseLayout preview={`İade talebin alındı — ${orderId}`}>
      <Eyebrow>Sipariş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>
        {firstName}, iade talebin kayda geçti
      </Text>
      <Text style={mailStyles.p}>
        Talebin inceleniyor. Ekibimiz fotoğraf ve açıklamayı kontrol edip
        sonucu bu kanaldan bildirecek.
      </Text>

      <Section
        style={{
          background: COLORS.krem,
          borderRadius: 12,
          padding: "16px 20px",
          margin: "20px 0",
        }}
      >
        <Text style={{ ...mailStyles.label, marginTop: 0 }}>TALEP ÖZETİ</Text>
        <Text style={{ ...mailStyles.p, margin: "8px 0 4px" }}>
          Talep no: <code>{returnId.slice(0, 8)}…</code>
        </Text>
        <Text style={{ ...mailStyles.p, margin: "4px 0 0" }}>
          Konu: <strong>{reasonLabel}</strong>
        </Text>
        <Text style={{ ...mailStyles.pSecondary, margin: "12px 0 0", fontSize: 13 }}>
          Durum: <strong>İnceleniyor</strong>
        </Text>
      </Section>

      <Button href={returnsUrl} label="İade talebini takip et" />
    </BaseLayout>
  );
}
