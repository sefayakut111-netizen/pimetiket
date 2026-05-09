/**
 * Prova hazır maili — operatör onayından sonra gönderilir.
 * Müşteri prova'yı incelemeli + onay/değişiklik istemeli.
 *
 * Trigger: order_events 'proof_generated' event'i.
 */

import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface ProofReadyProps {
  customerName: string;
  orderId: string;
  productTitle: string;
}

export function ProofReadyEmail({
  customerName,
  orderId,
  productTitle,
}: ProofReadyProps) {
  const firstName = customerName.split(" ")[0] || customerName;

  return (
    <BaseLayout preview={`Provan hazır — ${orderId}`}>
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        {firstName}, provan hazır! Bir göz at.
      </Text>
      <Text style={mailStyles.p}>
        <strong>{productTitle}</strong> tasarımının matbaa öncesi nasıl
        görüneceğini hazırladık. AI ön kontrolden geçti, operatörümüz baktı.
        Şimdi sıra sende.
      </Text>

      <Section style={mailStyles.card}>
        <Text
          style={{
            margin: 0,
            fontSize: 14,
            color: COLORS.lacivert,
            fontWeight: 600,
          }}
        >
          Yapman gerekenler
        </Text>
        <Text
          style={{
            margin: "8px 0 0",
            fontSize: 13,
            color: COLORS.gri700,
            lineHeight: 1.7,
          }}
        >
          1. Provayı yakınlaştır, kenarları/yazıları kontrol et<br />
          2. Renkler ekrandakine göre küçük farklarla basılır (CMYK
          kalibrasyonu)<br />
          3. Onayla → üretime gider<br />
          4. Değişiklik iste → operatörle revize ederiz
        </Text>
      </Section>

      <Section style={{ margin: "24px 0 8px" }}>
        <Link
          href={`${SITE}/siparis/${orderId}`}
          style={mailStyles.buttonPrimary}
        >
          Provayı incele →
        </Link>
      </Section>

      <Text style={mailStyles.pSecondary}>
        Onayını verdikten sonra üretim başlar — geri dönüş zor olabilir.
        Acele etme, dikkatli bak.
      </Text>
    </BaseLayout>
  );
}
