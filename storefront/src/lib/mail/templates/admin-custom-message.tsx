/**
 * Pim Etiket — Admin operatör custom müşteri mesajı.
 */

import { Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Eyebrow, mailStyles } from "./base";

export interface AdminCustomMessageProps {
  recipientName?: string;
  subject: string;
  bodyText: string;
  senderEmail?: string;
}

export function AdminCustomMessageEmail({
  recipientName,
  subject,
  bodyText,
  senderEmail,
}: AdminCustomMessageProps) {
  const firstName = recipientName?.split(" ")[0] || recipientName;

  return (
    <BaseLayout preview={subject}>
      <Eyebrow>Pim Etiket</Eyebrow>
      <Text style={mailStyles.h1}>{subject}</Text>
      {firstName ? (
        <Text style={mailStyles.p}>Merhaba {firstName},</Text>
      ) : null}
      <Text
        style={{
          ...mailStyles.p,
          whiteSpace: "pre-wrap" as const,
          lineHeight: 1.7,
        }}
      >
        {bodyText}
      </Text>
      {senderEmail ? (
        <Text style={mailStyles.pSecondary}>
          Bu mesaj {senderEmail} üzerinden gönderildi.
        </Text>
      ) : null}
    </BaseLayout>
  );
}
