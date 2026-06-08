/**
 * İade talebi reddedildi — AI ile yumuşatılmış gerekçe.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Eyebrow, mailStyles, COLORS, SITE } from "./base";

export interface RefundRejectedProps {
  customerName: string;
  orderId: string;
  returnId: string;
  reason: string;
}

export function RefundRejectedEmail({
  customerName,
  orderId,
  returnId,
  reason,
}: RefundRejectedProps) {
  const firstName = customerName.split(" ")[0] || customerName;

  return (
    <BaseLayout preview={`İade talebi sonucu — ${orderId}`}>
      <Eyebrow>Sipariş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>
        {firstName}, iade talebin hakkında
      </Text>
      <Text style={mailStyles.p}>
        Talebin incelendi. Aşağıdaki açıklama mevcut kayıtlara göre
        hazırlandı.
      </Text>

      <Section
        style={{
          background: COLORS.warningBg,
          border: `1px solid ${COLORS.warningBorder}`,
          borderRadius: 12,
          padding: "16px 20px",
          margin: "20px 0",
        }}
      >
        <Text style={{ ...mailStyles.label, color: COLORS.warningText, marginTop: 0 }}>
          SONUÇ
        </Text>
        <Text
          style={{
            ...mailStyles.p,
            color: COLORS.warningText,
            margin: "8px 0 0",
            fontSize: 14,
          }}
        >
          {reason}
        </Text>
        <Text style={{ ...mailStyles.pSecondary, margin: "12px 0 0", fontSize: 12 }}>
          Talep: {returnId.slice(0, 8)}…
        </Text>
      </Section>

      <Text style={{ ...mailStyles.pSecondary, fontSize: 13 }}>
        Ek bilgi veya fotoğraf paylaşmak istersen{" "}
        <a href={`${SITE}/iletisim`} style={{ color: COLORS.brand }}>
          iletişim
        </a>{" "}
        formundan yaz — talebi yeniden değerlendirebiliriz.
      </Text>
    </BaseLayout>
  );
}
