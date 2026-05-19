/**
 * Pim Etiket — AI QC flagged maili (operatör manuel inceleyecek).
 *
 * Sefa 19 May v68: AI ön denetim "uyarı" verdi ama OPERATÖR henüz karar
 * vermedi → müşteriye "incelemede, beklemede" bilgisi. (Henüz reject
 * değil; sadece flag.)
 *
 * Trigger: orders.status = 'qc_pending' → 'qc_flagged' geçişinde.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface QcFlaggedProps {
  customerName: string;
  orderId: string;
  /** AI'ın işaretlediği warning kategorileri (1-3 madde) */
  warnings: string[];
}

export function QcFlaggedEmail({
  customerName,
  orderId,
  warnings,
}: QcFlaggedProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const orderUrl = `${SITE}/siparis/${orderId}`;

  return (
    <BaseLayout preview={`Tasarım operatör incelemesinde — ${orderId}`}>
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        {firstName}, tasarım operatör incelemesinde 👁️
      </Text>
      <Text style={mailStyles.p}>
        Yüklediğin tasarım dosyasında AI ön kontrolden gelen küçük uyarılar
        var. Endişelenme — operatörümüz inceliyor, çoğu zaman müdahale
        gerekmiyor. 1-3 saat içinde sonuç senin yanına dönecek.
      </Text>

      {warnings.length > 0 && (
        <Section
          style={{
            background: COLORS.warningBg,
            border: `1px solid ${COLORS.warningBorder}`,
            borderRadius: 10,
            padding: "16px 18px",
            margin: "20px 0",
          }}
        >
          <Text
            style={{
              ...mailStyles.label,
              color: COLORS.warningText,
              marginTop: 0,
            }}
          >
            🔍 AI uyarıları
          </Text>
          <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
            {warnings.map((w, i) => (
              <li
                key={i}
                style={{
                  color: COLORS.warningText,
                  fontSize: 14,
                  marginBottom: 4,
                }}
              >
                {w}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section style={{ margin: "20px 0" }}>
        <Text style={mailStyles.label}>SONRA NE OLACAK?</Text>
        <ol style={{ margin: "8px 0 0 18px", padding: 0, color: COLORS.lacivert, fontSize: 14, lineHeight: 1.6 }}>
          <li>Operatör tasarımı inceliyor (1-3 saat)</li>
          <li>
            <strong>Onay verirse:</strong> üretim hattına aktarılır,
            "kargoya verildi" maili alırsın
          </li>
          <li>
            <strong>Düzeltme isterse:</strong> sebep + nasıl çözüleceği ile
            ayrı bir mail gelir, dosyayı tekrar yükleyebilirsin
          </li>
        </ol>
      </Section>

      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <a
          href={orderUrl}
          style={{
            background: COLORS.brand,
            color: "#fff",
            textDecoration: "none",
            padding: "12px 28px",
            borderRadius: 999,
            fontWeight: 600,
            fontSize: 14,
            display: "inline-block",
          }}
        >
          Sipariş durumunu gör →
        </a>
      </Section>
    </BaseLayout>
  );
}
