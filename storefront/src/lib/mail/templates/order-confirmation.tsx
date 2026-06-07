/**
 * Sipariş onay maili — ödeme alındıktan hemen sonra gönderilir.
 * Trigger: /api/payment/callback success path.
 */

import { Hr, Link, Row, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface OrderConfirmationProps {
  customerName: string;
  orderId: string;
  items: Array<{
    title: string;
    config: string;
    qty: number;
    total: number;
  }>;
  subtotal: number;
  shipping: number;
  total: number;
  estimatedDelivery?: string;
}

const fmt = (n: number) =>
  Math.round(n).toLocaleString("tr-TR");

export function OrderConfirmationEmail({
  customerName,
  orderId,
  items,
  subtotal,
  shipping,
  total,
  estimatedDelivery,
}: OrderConfirmationProps) {
  const firstName = customerName.split(" ")[0] || customerName;

  return (
    <BaseLayout preview="Ödemeni aldık; sıradaki adımı aşağıda özetledik.">
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        Teşekkürler {firstName}, siparişin alındı
      </Text>
      <Text style={mailStyles.p}>
        {orderId} numaralı siparişin alındı ve ödemen başarıyla tahsil edildi.
        Tasarım dosyanı henüz yüklemediysen yüklemen gerekiyor; yüklediysen
        ekibimiz baskı öncesi kontrole alıyor.
      </Text>

      <Section style={mailStyles.card}>
        {items.map((item, i) => (
          <Row
            key={i}
            style={{
              borderBottom:
                i < items.length - 1 ? `1px solid ${COLORS.gri200}` : "none",
              paddingBottom: i < items.length - 1 ? 8 : 0,
              marginBottom: i < items.length - 1 ? 8 : 0,
            }}
          >
            <td>
              <Text
                style={{
                  margin: 0,
                  fontWeight: 600,
                  fontSize: 14,
                  color: COLORS.lacivert,
                }}
              >
                {item.title}
              </Text>
              <Text
                style={{
                  margin: "2px 0 0",
                  fontSize: 12,
                  color: COLORS.gri700,
                }}
              >
                {item.config} · {item.qty.toLocaleString("tr-TR")} adet
              </Text>
            </td>
            <td
              style={{
                textAlign: "right",
                verticalAlign: "top",
                fontWeight: 600,
                fontSize: 14,
                color: COLORS.lacivert,
              }}
            >
              {fmt(item.total)} ₺
            </td>
          </Row>
        ))}

        <Hr style={{ borderColor: COLORS.gri200, margin: "12px 0" }} />

        <Row>
          <td style={{ fontSize: 13, color: COLORS.gri700 }}>Ara toplam</td>
          <td
            style={{
              textAlign: "right",
              fontSize: 13,
              color: COLORS.lacivert,
              fontWeight: 600,
            }}
          >
            {fmt(subtotal)} ₺
          </td>
        </Row>
        <Row>
          <td style={{ fontSize: 13, color: COLORS.gri700, paddingTop: 4 }}>
            Kargo
          </td>
          <td
            style={{
              textAlign: "right",
              fontSize: 13,
              color: shipping === 0 ? COLORS.yesil : COLORS.lacivert,
              fontWeight: 600,
              paddingTop: 4,
            }}
          >
            {shipping === 0 ? "Ücretsiz" : `${fmt(shipping)} ₺`}
          </td>
        </Row>
        <Hr style={{ borderColor: COLORS.lacivert, margin: "12px 0 8px", borderWidth: 2 }} />
        <Row>
          <td
            style={{
              fontSize: 14,
              color: COLORS.lacivert,
              fontWeight: 700,
            }}
          >
            TOPLAM
          </td>
          <td
            style={{
              textAlign: "right",
              fontSize: 18,
              color: COLORS.lacivert,
              fontWeight: 700,
            }}
          >
            {fmt(total)} ₺
          </td>
        </Row>
      </Section>

      {estimatedDelivery && (
        <Text style={mailStyles.pSecondary}>
          Tahmini teslim:{" "}
          <strong style={{ color: COLORS.lacivert }}>
            {estimatedDelivery}
          </strong>
        </Text>
      )}

      <Section style={{ margin: "28px 0 8px" }}>
        <Link
          href={`${SITE}/siparis/${orderId}`}
          style={mailStyles.buttonPrimary}
        >
          Siparişimi görüntüle →
        </Link>
      </Section>

      <Text style={mailStyles.pSecondary}>
        Her aşamada seni e-posta ile bilgilendireceğiz. Sorun olursa{" "}
        <Link href={`${SITE}/destek`} style={{ color: COLORS.pimMercan }}>
          destek
        </Link>{" "}
        üzerinden bize yazabilirsin.
      </Text>
    </BaseLayout>
  );
}
