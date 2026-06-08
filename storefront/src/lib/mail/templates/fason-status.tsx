/**
 * Fason iş durumu (18) — fason partner bildirimi.
 * Tür: İç bildirim (partner) · Dil: "siz" · Token'lı güvenli portal.
 */

import { Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, SITE } from "./base";

export interface FasonStatusProps {
  orderId: string;
  statusText: string;
  /** Token'lı güvenli portal bağlantısı. */
  token: string;
}

export function FasonStatusEmail({
  orderId,
  statusText,
  token,
}: FasonStatusProps) {
  return (
    <BaseLayout preview={`İş güncellemesi — ${orderId}`}>
      <Eyebrow>İş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>İş güncellemesi</Text>
      <Text style={mailStyles.p}>
        Merhaba, size atanan {orderId} numaralı iş için güncel durum:{" "}
        <strong>{statusText}</strong>. Detayları ve baskı dosyalarını güvenli
        portal bağlantınızdan görebilirsiniz.
      </Text>

      <Button href={`${SITE}/fason/${token}`} label="İşi görüntüle" />

      <Text style={mailStyles.pSecondary}>
        Sorularınız için bizimle iletişime geçebilirsiniz.
      </Text>
    </BaseLayout>
  );
}
