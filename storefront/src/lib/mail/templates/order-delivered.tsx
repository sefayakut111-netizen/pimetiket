/**
 * Pim Etiket — Sipariş teslim edildi maili.
 *
 * Sefa 19 May v68: Cron poll-shipments tracking_delivered_at set
 * ettiğinde trigger.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface OrderDeliveredProps {
  customerName: string;
  orderId: string;
  deliveredAt: string; // "19 May 2026 14:32" formatında
  carrierLabel?: string; // "Yurtiçi Kargo"
}

export function OrderDeliveredEmail({
  customerName,
  orderId,
  deliveredAt,
  carrierLabel,
}: OrderDeliveredProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const reviewUrl = `${SITE}/siparis/${orderId}#yorum`;
  const reorderUrl = `${SITE}/siparis/${orderId}`;

  return (
    <BaseLayout preview={`Siparişin teslim edildi ✅ — ${orderId}`}>
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        Tamamdır {firstName}, siparişin elinde! 🎉
      </Text>
      <Text style={mailStyles.p}>
        {carrierLabel ?? "Yurtiçi Kargo"} {deliveredAt} tarihinde teslim etti.
        Sipariş başarıyla tamamlandı.
      </Text>

      <Section
        style={{
          background: COLORS.krem,
          borderRadius: 12,
          padding: "20px",
          margin: "24px 0",
          textAlign: "center" as const,
        }}
      >
        <Text style={{ ...mailStyles.p, margin: "0 0 12px" }}>
          ✨ <strong>Nasıl bir his?</strong> Etiketler/sticker'ların elinde
          mi şimdi, baskı kalitesi beklediğin gibi mi? 30 saniyeni alacak
          küçük bir yorumla bize destek olabilirsin.
        </Text>
        <a
          href={reviewUrl}
          style={{
            background: COLORS.brand,
            color: "#fff",
            textDecoration: "none",
            padding: "10px 24px",
            borderRadius: 999,
            fontWeight: 600,
            fontSize: 14,
            display: "inline-block",
          }}
        >
          Yorum bırak →
        </a>
      </Section>

      <Text style={mailStyles.p}>
        Hatırlatma: Aynı tasarımı tekrar bastırmak istersen{" "}
        <a href={reorderUrl} style={{ color: COLORS.brand }}>
          sipariş detay sayfasından "Tekrar bastır"
        </a>{" "}
        ile tek tıkla başlatabilirsin.
      </Text>

      <Text style={{ ...mailStyles.p, color: COLORS.muted, fontSize: 13 }}>
        Sorun yaşadıysan (kargo hasarı, baskı hatası) teslim tarihinden
        itibaren 7 takvim günü içinde fotoğraflı bildirim yapabilirsin:
        ücretsiz yeniden basım hakkın var (TKHK m.15/b kapsamı + bizim ek
        garantimiz). <a href="mailto:info@pimetiket.com" style={{ color: COLORS.brand }}>
          info@pimetiket.com
        </a>{" "}
        veya Pim sohbet.
      </Text>
    </BaseLayout>
  );
}
