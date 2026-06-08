/**
 * Pim Etiket — Baskı onayı hatırlatma maili.
 */

import { Link, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, COLORS, SITE } from "./base";

export interface OrderProofReminderProps {
  customerName: string;
  orderId: string;
  pendingCount: number;
  hoursSincePaid: number;
}

export function OrderProofReminderEmail({
  orderId,
  pendingCount,
}: OrderProofReminderProps) {
  const proofUrl = `${SITE}/onay/${orderId}`;

  return (
    <BaseLayout preview="Onaylamadan baskıya geçmiyoruz.">
      <Eyebrow>Sipariş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>
        Provan onayını bekliyor
      </Text>
      <Text style={mailStyles.p}>
        {orderId} numaralı siparişinin provası onayını bekliyor. Sen
        onaylamadan baskıya geçmiyoruz — siparişin beklemede kalmasın diye
        hatırlatmak istedik.
        {pendingCount > 1 && (
          <>
            {" "}
            <strong>{pendingCount} ürün</strong> onay bekliyor.
          </>
        )}
      </Text>

      <Button href={proofUrl} label="Provamı onayla" />

      <Text style={mailStyles.pSecondary}>
        Bir sorun ya da değişiklik varsa aynı sayfadan iletebilir, istersen{" "}
        <Link href={`${SITE}/destek`} style={{ color: COLORS.pimMercan }}>
          destek
        </Link>{" "}
        üzerinden bize yazabilirsin.
      </Text>
    </BaseLayout>
  );
}
