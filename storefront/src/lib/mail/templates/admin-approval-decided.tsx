/**
 * Onay görseli kararı — admin iç bildirim.
 * Tetik: müşteri decide POST sonrası.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, SITE } from "./base";

export interface AdminApprovalDecidedProps {
  orderId: string;
  title: string;
  decisionLabel: string;
  comment: string | null;
}

export function AdminApprovalDecidedEmail({
  orderId,
  title,
  decisionLabel,
  comment,
}: AdminApprovalDecidedProps) {
  return (
    <BaseLayout preview={`Onay görseli yanıtlandı — ${orderId}`}>
      <Eyebrow>Sipariş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>Onay görseli yanıtlandı</Text>
      <Section style={mailStyles.card}>
        <Text
          style={{ ...mailStyles.p, margin: 0, fontSize: 14, lineHeight: 1.7 }}
        >
          <strong>İstek:</strong> {title}
          <br />
          <strong>Karar:</strong> {decisionLabel}
        </Text>
        {comment ? (
          <Text
            style={{
              ...mailStyles.pSecondary,
              margin: "10px 0 0",
              whiteSpace: "pre-wrap",
            }}
          >
            <strong>Müşteri notu:</strong> {comment}
          </Text>
        ) : null}
      </Section>
      <Button
        href={`${SITE}/admin/siparisler/${orderId}`}
        label="Siparişi aç"
      />
    </BaseLayout>
  );
}
