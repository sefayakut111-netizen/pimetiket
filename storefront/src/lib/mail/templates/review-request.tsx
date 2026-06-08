/**
 * Yorum daveti — ticari ileti (email_marketing opt-in gerekir).
 */

import { Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, SITE } from "./base";

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
      <Eyebrow>Sipariş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>Etiketin elinde — şimdi?</Text>
      <Text style={mailStyles.p}>
        {firstName ? `${firstName}, geçen hafta teslim aldığın` : "Geçen hafta teslim aldığın"}{" "}
        <strong>{productName}</strong> ({orderId}) nasıl oldu? Yorumun bir
        sonraki müşterinin kararına yardımcı olur.
      </Text>

      <Button href={reviewLink} label="Yorum yaz" />

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
