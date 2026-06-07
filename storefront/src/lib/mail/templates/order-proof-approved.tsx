/**
 * Pim Etiket — Tüm baskı onayları alındı maili.
 */

import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface OrderProofApprovedProps {
  customerName: string;
  orderId: string;
  itemCount: number;
  estimatedProductionDays?: number;
  estimatedDelivery?: string | null;
}

export function OrderProofApprovedEmail({
  customerName,
  orderId,
  itemCount,
  estimatedProductionDays = 2,
  estimatedDelivery,
}: OrderProofApprovedProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const orderUrl = `${SITE}/siparis/${orderId}`;

  return (
    <BaseLayout preview="Onayın alındı, üretime geçiyoruz.">
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        Onayın alındı, üretime başlıyoruz
      </Text>
      <Text style={mailStyles.p}>
        Teşekkürler {firstName}. {orderId} numaralı siparişinde{" "}
        {itemCount === 1 ? "1 ürünün" : `${itemCount} ürünün`} baskı
        onayını aldık. Tasarımların üretim hattına aktarıldı.
      </Text>

      <Section
        style={{
          background: "#F0FDF4",
          border: "1px solid #BBF7D0",
          borderRadius: 12,
          padding: "18px 20px",
          margin: "20px 0",
        }}
      >
        <Text
          style={{
            ...mailStyles.p,
            margin: 0,
            color: "#14532D",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Sıradaki adımlar
        </Text>
        <Text
          style={{
            ...mailStyles.p,
            color: "#14532D",
            margin: "8px 0 0",
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          · Operatör son kontrol (1–2 saat)
          <br />
          · Üretim (~{estimatedProductionDays} iş günü)
          <br />
          · Kargoya verildiğinde ayrı e-posta
          <br />
          · Kargo teslimi (3–5 iş günü, taşıyıcıya bağlı)
        </Text>
      </Section>

      {estimatedDelivery && (
        <Section
          style={{
            background: COLORS.krem,
            borderRadius: 10,
            padding: "12px 16px",
            margin: "16px 0",
          }}
        >
          <Text style={{ ...mailStyles.label, marginTop: 0 }}>
            TAHMİNİ TESLİMAT
          </Text>
          <Text style={{ ...mailStyles.p, margin: "4px 0 0", fontWeight: 600 }}>
            {estimatedDelivery}
          </Text>
        </Section>
      )}

      <Section style={{ margin: "28px 0 8px" }}>
        <Link href={orderUrl} style={mailStyles.buttonPrimary}>
          Siparişimi takip et →
        </Link>
      </Section>

      <Text style={mailStyles.pSecondary}>
        Her aşamada e-posta bildirimi alacaksın. Sorun olursa{" "}
        <Link href={`${SITE}/destek`} style={{ color: COLORS.pimMercan }}>
          destek
        </Link>{" "}
        üzerinden bize yaz.
      </Text>
    </BaseLayout>
  );
}
