/**
 * Pim Etiket — Yardım talebine operatör cevabı maili.
 */

import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, COLORS, SITE } from "./base";

export interface ProofHelpResolvedProps {
  customerName: string;
  orderId: string;
  itemTitle: string;
  originalMessage: string;
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
  const proofUrl = `${SITE}/onay/${orderId}`;

  return (
    <BaseLayout preview="Prova yardım talebine cevap geldi.">
      <Eyebrow>Sipariş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>
        Yardım talebine cevap geldi
      </Text>
      <Text style={mailStyles.p}>
        Merhaba {firstName}, <strong>{itemTitle}</strong> için sorduğun
        soruya operatörümüz cevap verdi. Notu oku, ardından prova sayfasına
        dönüp tasarımını tekrar incele.
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
          Operatör cevabı
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
          Başlattığın soru
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

      <Button href={proofUrl} label="Provayı tekrar incele" />

      <Text style={mailStyles.pSecondary}>
        Hâlâ net olmayan bir şey varsa{" "}
        <Link href={`${SITE}/destek`} style={{ color: COLORS.pimMercan }}>
          destek
        </Link>{" "}
        üzerinden bize yaz.
      </Text>
    </BaseLayout>
  );
}
