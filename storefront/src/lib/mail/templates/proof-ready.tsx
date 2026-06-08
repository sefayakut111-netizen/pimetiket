/**
 * Prova hazır maili — operatör onayından sonra gönderilir.
 * Müşteri prova'yı incelemeli + onay/değişiklik istemeli.
 *
 * Trigger: order_events 'proof_generated' event'i.
 */

import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, COLORS, SITE } from "./base";

export interface ProofReadyProps {
  customerName: string;
  orderId: string;
  productTitle: string;
}

export function ProofReadyEmail({
  orderId,
  productTitle,
}: ProofReadyProps) {
  const proofUrl = `${SITE}/onay/${orderId}`;

  return (
    <BaseLayout preview="Baskıdan önce son söz sende.">
      <Eyebrow>Sipariş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>
        Provan hazır — onayını bekliyoruz
      </Text>
      <Text style={mailStyles.p}>
        {orderId} numaralı siparişinin baskı provası hazır.{" "}
        <strong>{productTitle}</strong> için operatörümüz baktı, AI ön
        kontrolden geçti — şimdi sıra sende. Aşağıdan provanı incele; her şey
        yolundaysa onayla, biz de baskıya geçelim.
      </Text>

      <Section
        style={{
          background: COLORS.krem,
          border: `2px solid ${COLORS.pimMercan}`,
          borderRadius: 12,
          padding: "20px",
          margin: "24px 0",
          textAlign: "center" as const,
        }}
      >
        <Text
          style={{
            margin: "0 0 8px",
            fontSize: 12,
            color: COLORS.gri700,
            fontWeight: 600,
            textTransform: "uppercase" as const,
            letterSpacing: "0.04em",
          }}
        >
          Baskı provası önizlemesi
        </Text>
        <Text style={{ ...mailStyles.p, margin: "0 0 16px", fontSize: 14 }}>
          Prova görselini onay sayfasında yakınlaştırarak inceleyebilirsin.
          Onayladığın hâliyle basılır.
        </Text>
        <Button href={proofUrl} label="Provamı incele ve onayla" />
      </Section>

      <Text style={mailStyles.pSecondary}>
        Değişiklik istersen aynı sayfadan iletebilirsin. Sorun olursa{" "}
        <Link href={`${SITE}/destek`} style={{ color: COLORS.pimMercan }}>
          destek
        </Link>{" "}
        üzerinden bize yaz.
      </Text>
    </BaseLayout>
  );
}
