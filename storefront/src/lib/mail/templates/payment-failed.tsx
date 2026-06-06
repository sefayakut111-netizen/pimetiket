/**
 * Ödeme başarısız — sipariş oluşmadı, sepet korundu.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface PaymentFailedProps {
  customerName: string;
  /** Sepet tutarı (₺) — bilgi amaçlı */
  amount?: number;
  /** PayTR / banka mesajı (sadeleştirilmiş) */
  failureHint?: string;
}

export function PaymentFailedEmail({
  customerName,
  amount,
  failureHint,
}: PaymentFailedProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const cartUrl = `${SITE}/sepet`;

  return (
    <BaseLayout preview="Ödeme alınamadı — sepetin duruyor">
      <Text style={mailStyles.h1}>{firstName}, ödeme tamamlanmadı</Text>
      <Text style={mailStyles.p}>
        Kartından tahsilat alınamadı; sipariş oluşturulmadı. Sepetindeki
        ürünler duruyor — istersen tekrar deneyebilirsin.
      </Text>

      {amount != null && amount > 0 && (
        <Text style={{ ...mailStyles.pSecondary, fontWeight: 600 }}>
          Sepet tutarı: {amount.toLocaleString("tr-TR")} ₺
        </Text>
      )}

      {failureHint && (
        <Section
          style={{
            background: COLORS.errorBg,
            border: `1px solid ${COLORS.errorBorder}`,
            borderRadius: 12,
            padding: "14px 18px",
            margin: "20px 0",
          }}
        >
          <Text
            style={{
              ...mailStyles.p,
              color: COLORS.errorText,
              margin: 0,
              fontSize: 13,
            }}
          >
            Banka/kart yanıtı: {failureHint}
          </Text>
        </Section>
      )}

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <a href={cartUrl} style={mailStyles.buttonPrimary}>
          Sepete dön, tekrar dene →
        </a>
      </Section>

      <Text style={{ ...mailStyles.pSecondary, fontSize: 13 }}>
        Kart limiti, 3D Secure iptali veya banka reddi olabilir. Farklı kart
        veya havale/EFT seçeneği için{" "}
        <a href={`${SITE}/iletisim`} style={{ color: COLORS.brand }}>
          bize yaz
        </a>
        .
      </Text>
    </BaseLayout>
  );
}
