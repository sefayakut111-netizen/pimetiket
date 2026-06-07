/**
 * Terk sepet hatırlatması — ticari ileti (indirim baskısı yok).
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, SITE } from "./base";

export interface AbandonedCartProps {
  customerName: string;
  itemCount: number;
  total: number;
  unsubscribeUrl: string;
}

export function AbandonedCartEmail({
  customerName,
  itemCount,
  total,
  unsubscribeUrl,
}: AbandonedCartProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const totalLabel = total.toLocaleString("tr-TR");

  return (
    <BaseLayout
      preview={
        firstName
          ? `${firstName}, sepetindeki ${itemCount} ürün hâlâ bekliyor`
          : `Sepetindeki ${itemCount} ürün hâlâ bekliyor`
      }
      unsubscribeCategory="marketing"
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={mailStyles.h1}>
        {firstName ? `${firstName}, sepetin` : "Sepetin"} kapanmadı
      </Text>
      <Text style={mailStyles.p}>
        Birkaç gün önce sepete {itemCount} ürün eklemiştin ama ödeme
        tamamlanmadı. Toplam tutarın: <strong>{totalLabel} ₺</strong>.
      </Text>
      <Text style={mailStyles.p}>
        Tasarım hâlâ sepete bağlı. Kaldığın yerden devam edebilirsin.
      </Text>

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <a href={`${SITE}/sepet`} style={mailStyles.buttonPrimary}>
          Sepete dön →
        </a>
      </Section>

      <Text style={mailStyles.pSecondary}>
        Vazgeçtiysen sorun değil — başka bir tasarım için tekrar görüşürüz.
      </Text>
    </BaseLayout>
  );
}
