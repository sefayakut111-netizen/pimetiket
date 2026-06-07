/**
 * Pim Etiket — Sipariş teslim edildi maili.
 *
 * Sefa 19 May v68: Cron poll-shipments tracking_delivered_at set
 * ettiğinde trigger.
 */

import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface OrderDeliveredProps {
  customerName: string;
  orderId: string;
  deliveredAt: string;
  carrierLabel?: string;
}

export function OrderDeliveredEmail({
  customerName,
  orderId,
  deliveredAt,
  carrierLabel,
}: OrderDeliveredProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const orderUrl = `${SITE}/siparis/${orderId}`;

  return (
    <BaseLayout preview="Eline ulaştı mı? Bir şey olursa buradayız.">
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        Siparişin teslim edildi
      </Text>
      <Text style={mailStyles.p}>
        Merhaba {firstName}, {orderId} numaralı siparişin teslim edildi
        {carrierLabel ? ` (${carrierLabel}, ${deliveredAt})` : ` (${deliveredAt})`}
        . Umarız beğenirsin.
      </Text>
      <Text style={mailStyles.p}>
        Hasar, eksik veya baskı hatası görürsen lütfen vakit kaybetmeden bize
        ulaş; hızlıca çözelim.
      </Text>

      <Section style={{ margin: "28px 0 8px" }}>
        <Link href={orderUrl} style={mailStyles.buttonPrimary}>
          Siparişimi gör →
        </Link>
      </Section>

      <Text style={mailStyles.pSecondary}>
        Sorun bildirmek için{" "}
        <Link href={`${SITE}/destek`} style={{ color: COLORS.pimMercan }}>
          destek
        </Link>{" "}
        sayfasını kullanabilirsin.
      </Text>
    </BaseLayout>
  );
}
