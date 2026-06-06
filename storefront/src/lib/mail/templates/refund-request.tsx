/**
 * İade talebi alındı — müşteri RMA oluşturdu.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

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
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
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
          Durum: <strong>İnceleniyor</strong> — ortalama 1–3 iş günü
        </Text>
      </Section>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <a href={returnsUrl} style={mailStyles.buttonPrimary}>
          İade talebini takip et →
        </a>
      </Section>
    </BaseLayout>
  );
}
