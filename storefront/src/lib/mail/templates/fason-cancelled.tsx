/**
 * Fason iş iptali (19) — fason partner bildirimi.
 * Tür: İç bildirim (partner) · Dil: "siz".
 */

import { Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, SITE } from "./base";

export interface FasonCancelledProps {
  orderId: string;
  /** Token'lı güvenli portal bağlantısı. */
  token: string;
}

export function FasonCancelledEmail({ orderId, token }: FasonCancelledProps) {
  return (
    <BaseLayout preview={`İş ataması iptal edildi — ${orderId}`}>
      <Eyebrow>İş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>İş ataması iptal edildi</Text>
      <Text style={mailStyles.p}>
        Merhaba, {orderId} numaralı işin atamasının iptal edildiğini bildirmek
        isteriz. Bu iş için herhangi bir işlem yapmanıza gerek yok.
      </Text>
      <Text style={mailStyles.p}>
        İlginiz için teşekkür ederiz; yeni işlerde tekrar birlikte çalışmayı
        dileriz.
      </Text>

      <Button href={`${SITE}/fason/${token}`} label="Panelimi aç" />
    </BaseLayout>
  );
}
