/**
 * Pim Etiket — Baskı onayı bekleniyor maili.
 *
 * Sefa 19 May v68 (Migration 059):
 * Ödeme tamamlandı, orders.status='paid' → DB trigger
 * `trg_auto_advance_to_proof_pending` ile otomatik 'proof_pending'e
 * geçer. Bu mail callback'inden hemen sonra fire-and-forget tetiklenir.
 *
 * Müşteri /onay/[orderId] sayfasına yönlendirilir; her order_item için
 * "Onayla / Düzenle / Yardım iste" akışı vardır. Tüm itemler approved
 * olunca fn_finalize_proof → orders.status='proof_approved'.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface OrderProofRequiredProps {
  customerName: string;
  orderId: string;
  itemCount: number;
  /** Ortalama hatırlatma süresi — şimdilik sabit metin */
  totalLabel?: string;
}

export function OrderProofRequiredEmail({
  customerName,
  orderId,
  itemCount,
  totalLabel,
}: OrderProofRequiredProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const proofUrl = `${SITE}/onay/${orderId}`;

  return (
    <BaseLayout preview={`Baskı önizlemen hazır — ${orderId}`}>
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        {firstName}, baskı önizlemen hazır 👀
      </Text>
      <Text style={mailStyles.p}>
        Ödemeni aldık (
        {totalLabel ? <strong>{totalLabel}</strong> : <em>teşekkürler</em>}
        ). Üretime geçmeden önce baskı önizlemelerini onaylaman gerekiyor.{" "}
        {itemCount === 1
          ? "1 ürünün baskı önizlemesi seni bekliyor."
          : `${itemCount} ürünün baskı önizlemesi seni bekliyor.`}
      </Text>

      <Section
        style={{
          background: COLORS.krem,
          borderRadius: 12,
          padding: "18px 20px",
          margin: "20px 0",
        }}
      >
        <Text style={{ ...mailStyles.label, marginTop: 0 }}>
          ⏱️ NE YAPMAN GEREKIYOR?
        </Text>
        <ol
          style={{
            margin: "8px 0 0 18px",
            padding: 0,
            color: COLORS.lacivert,
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          <li>Onay sayfasını aç, her ürünün önizlemesine bak</li>
          <li>
            <strong>Onayla</strong> → matbaaya hazır demektir, sıradakine geçilir
          </li>
          <li>
            <strong>Düzenle</strong> → bıçak çizgisini kendin ayarlarsın
          </li>
          <li>
            <strong>Yardım iste</strong> → operatörümüz seninle iletişime
            geçsin
          </li>
        </ol>
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
          Baskı önizlemesine git →
        </a>
      </Section>

      <Text style={{ ...mailStyles.p, color: COLORS.muted, fontSize: 13 }}>
        💡 <strong>İpucu:</strong> Onayın matbaaya gönderilen son halini
        belirler. Renk, kesim çizgisi, yazı boyutu — hepsini gözden geçir.
        Onayladıktan sonra değişiklik için operatörden talep gerekir.
      </Text>

      <Text
        style={{
          ...mailStyles.p,
          color: COLORS.muted,
          fontSize: 12,
          marginTop: 24,
        }}
      >
        48 saat içinde onay vermezsen otomatik hatırlatma maili göndereceğiz.
        7 gün sonunda hâlâ yanıt yoksa sipariş otomatik iptal + ücret iadesi
        başlatılır (Mesafeli Sözleşme m.5).
      </Text>
    </BaseLayout>
  );
}
