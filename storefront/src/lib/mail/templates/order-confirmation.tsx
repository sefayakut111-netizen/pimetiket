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
  estimatedDelivery?: string; // "8 Mayıs 2026"
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
    <BaseLayout
      preview={`Siparişin alındı 🎉 — ${orderId}`}
    >
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>Teşekkürler {firstName}, siparişin alındı! 🎉</Text>
      <Text style={mailStyles.p}>
        Ödemen başarıyla tahsil edildi. Şimdi tasarım dosyalarını yüklemen
        gerekiyor — Pim AI saniyeler içinde DPI/CMYK/boşluk kontrolü yapacak.
      </Text>

      {/* Order summary card */}
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
          📦 Tahmini teslim tarihi:{" "}
          <strong style={{ color: COLORS.lacivert }}>
            {estimatedDelivery}
          </strong>
        </Text>
      )}

      {/* CTA */}
      <Section style={{ margin: "28px 0 8px" }}>
        <Link
          href={`${SITE}/siparis/${orderId}`}
          style={mailStyles.buttonPrimary}
        >
          Tasarım dosyamı yükle →
        </Link>
      </Section>

      <Text style={mailStyles.pSecondary}>
        3 gün içinde dosya yüklemen gerekiyor. Yüklemediğin sürece sipariş
        bekler — Pim seni bunaltmaz, sen hazır olunca devam ederiz.
      </Text>

      <Text style={{ ...mailStyles.pSecondary, marginTop: 24 }}>
        Sorun olursa yanıtla, Pim ekibinden biri 1 saat içinde döner. 🙋‍♂️
      </Text>
    </BaseLayout>
  );
}
