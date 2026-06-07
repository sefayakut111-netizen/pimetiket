/**
 * Pim Etiket — Baskı onayı bekleniyor maili.
 */

import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface OrderProofRequiredProps {
  customerName: string;
  orderId: string;
  itemCount: number;
  totalLabel?: string;
}

export function OrderProofRequiredEmail({
  customerName,
  orderId,
  itemCount,
  totalLabel,
}: OrderProofRequiredProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const proofUrl = `${SITE}/onay/${orderId}`;

  return (
    <BaseLayout preview="Baskıdan önce son söz sende.">
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        Baskı provan hazır
      </Text>
      <Text style={mailStyles.p}>
        Merhaba {firstName}, {orderId} numaralı siparişin için baskı provası
        hazır
        {totalLabel ? ` (${totalLabel})` : ""}. Üretime geçmeden önce{" "}
        {itemCount === 1
          ? "1 ürünün provasını"
          : `${itemCount} ürünün provasını`}{" "}
        onaylaman gerekiyor.
      </Text>

      <Section
        style={{
          background: COLORS.krem,
          borderRadius: 12,
          padding: "18px 20px",
          margin: "20px 0",
        }}
      >
        <Text style={{ ...mailStyles.label, marginTop: 0 }}>
          Ne yapman gerekiyor?
        </Text>
        <Text style={{ ...mailStyles.p, margin: "8px 0 0", fontSize: 14, lineHeight: 1.7 }}>
          Onay sayfasını aç, provayı incele. Onayladığın hâliyle basılır.
          Değişiklik istersen aynı sayfadan iletebilirsin.
        </Text>
      </Section>

      <Section style={{ margin: "28px 0 8px" }}>
        <Link href={proofUrl} style={mailStyles.buttonPrimary}>
          Provamı incele ve onayla →
        </Link>
      </Section>

      <Text style={mailStyles.pSecondary}>
        Onay vermezsen sipariş beklemede kalır; 36 saat içinde yanıt
        gelmezse otomatik iptal ve iade süreci başlar. Soruların için{" "}
        <Link href={`${SITE}/destek`} style={{ color: COLORS.pimMercan }}>
          destek
        </Link>
        .
      </Text>
    </BaseLayout>
  );
}
