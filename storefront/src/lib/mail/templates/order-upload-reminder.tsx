/**
 * Pim Etiket — Tasarım yükleme hatırlatma maili.
 *
 * Trigger: /api/cron/upload-reminders (günde 1)
 * Kriter: orders.status='awaiting_upload' + 24+ saat önce paid.
 */

import { Link, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, COLORS, SITE } from "./base";

export interface OrderUploadReminderProps {
  customerName: string;
  orderId: string;
  pendingCount: number;
  /** Ödeme üzerinden geçen saat sayısı (bilgi için) */
  hoursSincePaid: number;
}

export function OrderUploadReminderEmail({
  customerName,
  orderId,
  pendingCount,
}: OrderUploadReminderProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const uploadUrl = `${SITE}/siparis/${orderId}`;

  return (
    <BaseLayout preview="Baskıya başlamak için tek eksik dosyan.">
      <Eyebrow>Sipariş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>
        Tasarımını bekliyoruz
      </Text>
      <Text style={mailStyles.p}>
        Merhaba {firstName}, {orderId} numaralı siparişin hazır, ama baskıya
        başlayabilmemiz için tasarım dosyana ihtiyacımız var
        {pendingCount > 1 && (
          <>
            {" "}
            (<strong>{pendingCount} ürün</strong> bekliyor)
          </>
        )}
        . Dosyanı yükler yüklemez sürecini başlatıyoruz.
      </Text>

      <Button href={uploadUrl} label="Tasarımımı yükle" />

      <Text style={mailStyles.pSecondary}>
        Dosya hazırlarken takıldıysan (ölçü, çözünürlük, kesim payı){" "}
        <Link href={`${SITE}/destek`} style={{ color: COLORS.pimMercan }}>
          destek
        </Link>{" "}
        üzerinden bize yazabilirsin.
      </Text>
    </BaseLayout>
  );
}
