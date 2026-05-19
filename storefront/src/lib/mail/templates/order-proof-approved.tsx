/**
 * Pim Etiket — Tüm baskı onayları alındı maili.
 *
 * Sefa 19 May v68 (Migration 059):
 * `fn_finalize_proof` RPC orders.status='proof_approved' yaptıktan
 * hemen sonra fire-and-forget tetiklenir.
 *
 * Müşteri teşekkür edilir, üretim aşamaları + tahmini süreler verilir.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface OrderProofApprovedProps {
  customerName: string;
  orderId: string;
  itemCount: number;
  /** Üretim için tahmini iş günü (sabit 2 gün şimdilik) */
  estimatedProductionDays?: number;
  /** Toplam tahmini teslim — sipariş'ten gelir */
  estimatedDelivery?: string | null;
}

export function OrderProofApprovedEmail({
  customerName,
  orderId,
  itemCount,
  estimatedProductionDays = 2,
  estimatedDelivery,
}: OrderProofApprovedProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const orderUrl = `${SITE}/siparis/${orderId}`;

  return (
    <BaseLayout preview={`Onayın alındı — üretim başladı 🎉 — ${orderId}`}>
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        Teşekkürler {firstName}! Üretime başlıyoruz 🎉
      </Text>
      <Text style={mailStyles.p}>
        {itemCount === 1
          ? "1 ürünün baskı önizlemesini"
          : `${itemCount} ürünün baskı önizlemesini`}{" "}
        onayladın. Tasarımların artık matbaa hattına aktarıldı.
      </Text>

      <Section
        style={{
          background: "#F0FDF4",
          border: "1px solid #BBF7D0",
          borderRadius: 12,
          padding: "18px 20px",
          margin: "20px 0",
        }}
      >
        <Text
          style={{
            ...mailStyles.p,
            margin: 0,
            color: "#14532D",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          ✓ Onayın alındı (şimdi)
        </Text>
        <Text
          style={{
            ...mailStyles.p,
            color: "#14532D",
            margin: "8px 0 0",
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          ○ Operatör son göz kontrolü (1-2 saat)
          <br />
          ○ Üretim hattı (~{estimatedProductionDays} iş günü)
          <br />
          ○ Kargoya verildi mailini bekle
          <br />
          ○ Yurtiçi Kargo ile teslimat (3-5 iş günü)
        </Text>
      </Section>

      {estimatedDelivery && (
        <Section
          style={{
            background: COLORS.krem,
            borderRadius: 10,
            padding: "12px 16px",
            margin: "16px 0",
          }}
        >
          <Text style={{ ...mailStyles.label, marginTop: 0 }}>
            🚚 TAHMİNİ TESLİMAT
          </Text>
          <Text style={{ ...mailStyles.p, margin: "4px 0 0", fontWeight: 600 }}>
            {estimatedDelivery}
          </Text>
        </Section>
      )}

      <Section style={{ textAlign: "center" as const, margin: "28px 0" }}>
        <a
          href={orderUrl}
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
          Sipariş takibini aç →
        </a>
      </Section>

      <Text style={{ ...mailStyles.p, color: COLORS.muted, fontSize: 13 }}>
        Her aşamada e-posta bildirimi alacaksın. Tasarımında kritik bir sorun
        çıkarsa (matbaa raporu) operatörümüz seninle iletişime geçer. Sorunsuz
        ilerleme için onayın matbaa standartlarımıza uyduğundan emin olduk.
      </Text>

      <Text
        style={{
          ...mailStyles.p,
          color: COLORS.muted,
          fontSize: 12,
          marginTop: 20,
          textAlign: "center" as const,
        }}
      >
        Sorun yaşadıysan{" "}
        <a
          href="mailto:info@pimetiket.com"
          style={{ color: COLORS.brand, fontWeight: 500 }}
        >
          info@pimetiket.com
        </a>{" "}
        veya Pim sohbet bot'undan ulaşabilirsin.
      </Text>
    </BaseLayout>
  );
}
