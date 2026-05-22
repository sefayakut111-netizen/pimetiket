/**
 * Pim Etiket — Yardım talebine operatör cevabı maili.
 *
 * Sefa 22 May v68 (Faz 4 — Uzman akışı):
 * Müşteri /onay sayfasında "Ekibimizden yardım iste" tıkladı,
 * proof_help_requests'e ticket düştü. Operatör /admin/yardim-talepleri'nden
 * cevap yazıp "Çözüldü" işaretledi → bu mail tetiklenir.
 *
 * Müşteri okumayı sevsin: cevap önde, sipariş context'i altta.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface ProofHelpResolvedProps {
  customerName: string;
  orderId: string;
  itemTitle: string;
  /** Müşterinin başta yazdığı soru (kısa snippet — context için) */
  originalMessage: string;
  /** Operatörün cevabı (10-2000 char) */
  resolutionNote: string;
}

export function ProofHelpResolvedEmail({
  customerName,
  orderId,
  itemTitle,
  originalMessage,
  resolutionNote,
}: ProofHelpResolvedProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const orderUrl = `${SITE}/onay/${orderId}`;

  return (
    <BaseLayout
      preview={`Yardım talebine cevap geldi — ${orderId}`}
    >
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        {firstName}, yardım talebine cevap geldi
      </Text>
      <Text style={mailStyles.p}>
        <strong>{itemTitle}</strong> ürününde sorduğun soruya operatörümüz
        cevap yazdı. Aşağıdaki notu oku, sonra prova sayfasına dönüp tasarımını
        tekrar incele.
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
            ...mailStyles.label,
            color: "#14532D",
            marginTop: 0,
          }}
        >
          ✓ OPERATÖR CEVABI
        </Text>
        <Text
          style={{
            ...mailStyles.p,
            color: "#14532D",
            margin: "8px 0 0",
            whiteSpace: "pre-wrap" as const,
            lineHeight: 1.7,
          }}
        >
          {resolutionNote}
        </Text>
      </Section>

      <Section
        style={{
          background: COLORS.krem,
          borderRadius: 10,
          padding: "12px 16px",
          margin: "16px 0",
        }}
      >
        <Text style={{ ...mailStyles.label, marginTop: 0 }}>
          BAŞLATTIĞIN SORU
        </Text>
        <Text
          style={{
            ...mailStyles.p,
            color: COLORS.muted,
            margin: "4px 0 0",
            fontSize: 13,
            fontStyle: "italic" as const,
            whiteSpace: "pre-wrap" as const,
          }}
        >
          “{originalMessage}”
        </Text>
      </Section>

      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <a
          href={orderUrl}
          style={{
            background: COLORS.brand,
            color: "#fff",
            textDecoration: "none",
            padding: "14px 32px",
            borderRadius: 999,
            fontWeight: 600,
            fontSize: 15,
            display: "inline-block",
          }}
        >
          Provayı tekrar incele →
        </a>
      </Section>

      <Text
        style={{
          ...mailStyles.p,
          color: COLORS.muted,
          fontSize: 12,
          marginTop: 20,
          textAlign: "center" as const,
        }}
      >
        Hala net olmayan bir şey varsa{" "}
        <a
          href="mailto:info@pimetiket.com"
          style={{ color: COLORS.brand, fontWeight: 500 }}
        >
          info@pimetiket.com
        </a>{" "}
        veya Pim sohbet bot'undan ulaş.
      </Text>
    </BaseLayout>
  );
}
