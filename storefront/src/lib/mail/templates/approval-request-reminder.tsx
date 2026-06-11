/**
 * Onay görseli hatırlatma — cron (3+ gün pending, istek başına max 1).
 */

import { Link, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, COLORS, SITE } from "./base";

export interface ApprovalRequestReminderProps {
  orderId: string;
  title: string;
  daysPending: number;
}

export function ApprovalRequestReminderEmail({
  orderId,
  title,
  daysPending,
}: ApprovalRequestReminderProps) {
  const approvalUrl = `${SITE}/onay/${orderId}`;

  return (
    <BaseLayout preview="Onay görseli yanıtını bekliyoruz.">
      <Eyebrow>Sipariş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>Onay görseli yanıtını bekliyoruz</Text>
      <Text style={mailStyles.p}>
        {orderId} numaralı siparişinde <strong>{title}</strong> isteği{" "}
        {daysPending} günden uzun süredir yanıt bekliyor. Üretim planına
        geçmek için kısa bir bakış yeter.
      </Text>

      <Button href={approvalUrl} label="Görselleri incele ve yanıtla" />

      <Text style={mailStyles.pSecondary}>
        Değişiklik istersen aynı sayfadan iletebilirsin.{" "}
        <Link href={`${SITE}/destek`} style={{ color: COLORS.pimMercan }}>
          Destek
        </Link>{" "}
        de açık.
      </Text>
    </BaseLayout>
  );
}
