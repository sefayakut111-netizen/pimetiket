/**
 * Pim Etiket — Baskı onayı hatırlatma maili.
 */

import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface OrderProofReminderProps {
  customerName: string;
  orderId: string;
  pendingCount: number;
  hoursSincePaid: number;
}

export function OrderProofReminderEmail({
  customerName,
  orderId,
  pendingCount,
}: OrderProofReminderProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const proofUrl = `${SITE}/onay/${orderId}`;

  return (
    <BaseLayout preview="Onaylamadan baskıya geçmiyoruz.">
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
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

      <Section style={{ margin: "28px 0 8px" }}>
        <Link href={proofUrl} style={mailStyles.buttonPrimary}>
          Provamı onayla →
        </Link>
      </Section>

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
