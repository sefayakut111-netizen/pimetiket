/**
 * Ödeme başarısız — sipariş oluşmadı, sepet korundu.
 */

import { Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, COLORS, SITE } from "./base";

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
}: PaymentFailedProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const cartUrl = `${SITE}/sepet`;

  return (
    <BaseLayout preview="Ödeme alınamadı — sepetin duruyor">
      <Eyebrow>Ödeme</Eyebrow>
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

      <Button href={cartUrl} label="Sepete dön, tekrar dene" />

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
