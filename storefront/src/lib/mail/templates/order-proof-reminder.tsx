/**
 * Pim Etiket — Baskı onayı hatırlatma maili.
 *
 * Sefa 19 May v68 (Migration 059):
 * Cron `/api/cron/proof-reminders` (günde 1) tarafından tetiklenir.
 * Kriter: orders.status='proof_pending' + 24+ saat önce paid + henüz
 * tüm itemler approved değil.
 *
 * 2. hatırlatma (48 saat) ve 3. (5 gün) farklı tonda olabilir;
 * şimdilik tek mail yeterli — Faz 2'de eskalasyon eklenecek.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface OrderProofReminderProps {
  customerName: string;
  orderId: string;
  pendingCount: number;
  /** Ödeme üzerinden geçen saat sayısı (bilgi için) */
  hoursSincePaid: number;
}

export function OrderProofReminderEmail({
  customerName,
  orderId,
  pendingCount,
  hoursSincePaid,
}: OrderProofReminderProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const proofUrl = `${SITE}/onay/${orderId}`;
  const daysLabel = Math.floor(hoursSincePaid / 24);

  return (
    <BaseLayout preview={`Baskı onayını bekliyoruz — ${orderId}`}>
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        {firstName}, baskı onayını bekliyoruz ⏱️
      </Text>
      <Text style={mailStyles.p}>
        {daysLabel >= 1
          ? `${daysLabel} gündür `
          : `${hoursSincePaid} saattir `}
        bekliyoruz. Siparişindeki{" "}
        <strong>
          {pendingCount === 1 ? "1 ürün" : `${pendingCount} ürün`}
        </strong>{" "}
        baskıya geçmeden önce onayını bekliyor.
      </Text>

      <Section
        style={{
          background: COLORS.warningBg,
          border: `1px solid ${COLORS.warningBorder}`,
          borderRadius: 12,
          padding: "16px 20px",
          margin: "20px 0",
        }}
      >
        <Text
          style={{
            ...mailStyles.p,
            color: COLORS.warningText,
            margin: 0,
            fontSize: 14,
          }}
        >
          ⚠️ <strong>Onay vermezsen ne olur?</strong>
          <br />
          • Üretim hattına aktarılamaz, kargo gecikmesi başlar
          <br />
          • 7 takvim günü sonunda sipariş otomatik iptal + ücret iadesi
        </Text>
      </Section>

      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <a
          href={proofUrl}
          style={{
            background: COLORS.brand,
            color: "#fff",
            textDecoration: "none",
            padding: "14px 32px",
            borderRadius: 999,
            fontWeight: 600,
            fontSize: 15,
            display: "inline-block",
          }}
        >
          Hemen onayla →
        </a>
      </Section>

      <Text style={{ ...mailStyles.p, color: COLORS.muted, fontSize: 13 }}>
        Yardıma ihtiyacın varsa onay sayfasında <strong>"Yardım iste"</strong>{" "}
        butonuna basabilirsin. Operatörümüz seninle iletişime geçer ve birlikte
        bıçak/kesim/renk ayarlarını netleştirir.
      </Text>
    </BaseLayout>
  );
}
