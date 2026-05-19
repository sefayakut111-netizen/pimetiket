/**
 * Pim Etiket — Tasarım yükleme hatırlatma maili.
 *
 * Sefa 19 May v68 (Migration 061 — awaiting_upload):
 * Müşteri ödeme yaptı ama tasarımını yüklemedi. Cron
 * `/api/cron/upload-reminders` (günde 1) tarafından tetiklenir.
 * Kriter: orders.status='awaiting_upload' + 24+ saat önce paid.
 *
 * 2. hatırlatma (48 saat) ve 3. (5 gün) farklı tonda olabilir;
 * şimdilik tek mail yeterli — Faz 2'de eskalasyon eklenecek.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface OrderUploadReminderProps {
  customerName: string;
  orderId: string;
  pendingCount: number;
  /** Ödeme üzerinden geçen saat sayısı (bilgi için) */
  hoursSincePaid: number;
}

export function OrderUploadReminderEmail({
  customerName,
  orderId,
  pendingCount,
  hoursSincePaid,
}: OrderUploadReminderProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const uploadUrl = `${SITE}/siparis/${orderId}/tasarim-yukle`;
  const daysLabel = Math.floor(hoursSincePaid / 24);

  return (
    <BaseLayout preview={`Tasarımını bekliyoruz — ${orderId}`}>
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        {firstName}, tasarımını yüklemen lazım 📎
      </Text>
      <Text style={mailStyles.p}>
        {daysLabel >= 1
          ? `${daysLabel} gündür `
          : `${hoursSincePaid} saattir `}
        bekliyoruz. Ödeme aldık, sipariş hazır — sadece{" "}
        <strong>
          {pendingCount === 1 ? "1 ürün için tasarım" : `${pendingCount} ürün için tasarım`}
        </strong>{" "}
        bekliyoruz. Yükledikten sonra otomasyon 5 dakika içinde bıçak çizgilerini
        hazırlar.
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
          ⚠️ <strong>Tasarım yüklemezsen ne olur?</strong>
          <br />
          • Üretime başlayamayız, sipariş bekleyişte kalır
          <br />
          • 14 takvim günü sonunda sipariş otomatik iptal + ücret iadesi
        </Text>
      </Section>

      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <a
          href={uploadUrl}
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
          Tasarımı yükle →
        </a>
      </Section>

      <Text style={{ ...mailStyles.p, color: COLORS.muted, fontSize: 13 }}>
        Tasarım hazırlamayı bilmiyorsan{" "}
        <a
          href={`${SITE}/sablonlar`}
          style={{ color: COLORS.brand, textDecoration: "underline" }}
        >
          ücretsiz şablon paketimizi
        </a>{" "}
        indirebilirsin — 60+ etiket şablonu, Canva/Illustrator uyumlu. Hazır
        şablonu kişiselleştir, yükle, biz baskıyı yapalım.
      </Text>
    </BaseLayout>
  );
}
