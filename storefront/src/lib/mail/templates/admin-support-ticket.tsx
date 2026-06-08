/**
 * Destek talebi (17) — admin iç bildirim.
 * Tür: İç bildirim · Tetik: Yeni destek talebi · Görsel: Yok.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, SITE } from "./base";

export interface AdminSupportTicketProps {
  ticketId: string;
  customerName: string;
  subject: string;
  messagePreview: string;
}

export function AdminSupportTicketEmail({
  ticketId,
  customerName,
  subject,
  messagePreview,
}: AdminSupportTicketProps) {
  return (
    <BaseLayout preview={`Yeni destek talebi — ${ticketId}`}>
      <Eyebrow>Destek</Eyebrow>
      <Text style={mailStyles.h1}>Yeni destek talebi açıldı</Text>
      <Section style={mailStyles.card}>
        <Text
          style={{ ...mailStyles.p, margin: 0, fontSize: 14, lineHeight: 1.7 }}
        >
          <strong>Talep:</strong> {ticketId}
          <br />
          <strong>Müşteri:</strong> {customerName}
          <br />
          <strong>Konu:</strong> {subject}
        </Text>
        <Text
          style={{
            ...mailStyles.pSecondary,
            margin: "10px 0 0",
            whiteSpace: "pre-wrap",
          }}
        >
          {messagePreview}
        </Text>
      </Section>
      <Button href={`${SITE}/admin/destek`} label="Talebi yanıtla" />
    </BaseLayout>
  );
}
