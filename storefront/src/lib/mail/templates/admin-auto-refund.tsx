/**
 * Otomatik iade bildirimi (20) — admin iç bildirim.
 * Tür: İç bildirim · Tetik: Prova onaysız doldu → sistem otomatik iade başlattı.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, SITE } from "./base";

export interface AdminAutoRefundProps {
  orderId: string;
  refundAmount: string;
  customerName: string;
}

export function AdminAutoRefundEmail({
  orderId,
  refundAmount,
  customerName,
}: AdminAutoRefundProps) {
  return (
    <BaseLayout preview={`Otomatik iade — ${orderId}`}>
      <Eyebrow>Otomatik iade</Eyebrow>
      <Text style={mailStyles.h1}>Otomatik iade yapıldı</Text>
      <Text style={mailStyles.p}>
        Bilgi: {orderId} numaralı sipariş için prova süresi onaysız doldu ve
        sistem otomatik iade başlattı.
      </Text>
      <Section style={mailStyles.card}>
        <Text
          style={{ ...mailStyles.p, margin: 0, fontSize: 14, lineHeight: 1.8 }}
        >
          <strong>No:</strong> {orderId}
          <br />
          <strong>Tutar:</strong> {refundAmount}
          <br />
          <strong>Müşteri:</strong> {customerName}
        </Text>
      </Section>
      <Text style={mailStyles.pSecondary}>
        Müşteriye iade bildirimi otomatik gönderildi. Gerekirse manuel
        inceleyebilirsin.
      </Text>
      <Button href={`${SITE}/admin/siparisler`} label="Siparişi incele" />
    </BaseLayout>
  );
}
