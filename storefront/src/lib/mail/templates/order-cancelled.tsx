/**
 * Sipariş iptal bildirimi — müşteri / admin / SLA iptali.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export type OrderCancelSource =
  | "customer"
  | "stale_proof"
  | "admin"
  | "system";

export interface OrderCancelledProps {
  customerName: string;
  orderId: string;
  /** Müşteriye gösterilecek iptal açıklaması */
  reason: string;
  cancelSource: OrderCancelSource;
  refundAmount?: number | null;
  refundInitiated?: boolean;
}

export function OrderCancelledEmail({
  customerName,
  orderId,
  reason,
  cancelSource,
  refundAmount,
  refundInitiated,
}: OrderCancelledProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const ordersUrl = `${SITE}/siparislerim`;

  const headline =
    cancelSource === "customer"
      ? `${firstName}, siparişin iptal edildi`
      : `${firstName}, siparişin iptal edildi`;

  return (
    <BaseLayout preview={`Sipariş iptal — ${orderId}`}>
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>{headline}</Text>
      <Text style={mailStyles.p}>{reason}</Text>

      {(refundInitiated || (refundAmount != null && refundAmount > 0)) && (
        <Section
          style={{
            background: COLORS.krem,
            borderRadius: 12,
            padding: "16px 20px",
            margin: "20px 0",
          }}
        >
          <Text style={{ ...mailStyles.label, marginTop: 0 }}>İADE BİLGİSİ</Text>
          {refundAmount != null && refundAmount > 0 && (
            <Text style={{ ...mailStyles.p, margin: "8px 0 4px", fontWeight: 600 }}>
              Tutar: {refundAmount.toLocaleString("tr-TR")} ₺
            </Text>
          )}
          <Text style={{ ...mailStyles.pSecondary, margin: 0, fontSize: 13 }}>
            Ödeme kartına iade banka tarafından işlenir; genelde 3–10 iş
            günü içinde hesabında görünür. Ayrı bir &quot;iade tamamlandı&quot;
            maili de gönderebiliriz.
          </Text>
        </Section>
      )}

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <a href={ordersUrl} style={mailStyles.buttonPrimary}>
          Siparişlerime git →
        </a>
      </Section>

      <Text style={{ ...mailStyles.pSecondary, fontSize: 13 }}>
        Sorun varsa{" "}
        <a href={`${SITE}/iletisim`} style={{ color: COLORS.brand }}>
          iletişim
        </a>{" "}
        sayfasından yazabilirsin.
      </Text>
    </BaseLayout>
  );
}
