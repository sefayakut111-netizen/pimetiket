/**
 * Yorum daveti — ticari ileti (email_marketing opt-in gerekir).
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, SITE } from "./base";

export interface ReviewRequestProps {
  customerName: string;
  orderId: string;
  productName: string;
  unsubscribeUrl: string;
}

export function ReviewRequestEmail({
  customerName,
  orderId,
  productName,
  unsubscribeUrl,
}: ReviewRequestProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const reviewLink = `${SITE}/yorum-yaz/${orderId}`;

  return (
    <BaseLayout
      preview={`${productName} nasıl oldu?`}
      unsubscribeCategory="marketing"
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={mailStyles.h1}>Etiketin elinde — şimdi?</Text>
      <Text style={mailStyles.p}>
        {firstName ? `${firstName}, geçen hafta teslim aldığın` : "Geçen hafta teslim aldığın"}{" "}
        <strong>{productName}</strong> ({orderId}) nasıl oldu? Yorumun bir
        sonraki müşterinin kararına yardımcı olur.
      </Text>

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <a href={reviewLink} style={mailStyles.buttonPrimary}>
          Yorum yaz →
        </a>
      </Section>

      <Text style={mailStyles.pSecondary}>
        Bir sorun varsa{" "}
        <a href="mailto:info@pimetiket.com" style={{ color: "#FF6B5B" }}>
          info@pimetiket.com
        </a>{" "}
        adresine yaz — düzeltmek için elimizden geleni yaparız.
      </Text>
    </BaseLayout>
  );
}
