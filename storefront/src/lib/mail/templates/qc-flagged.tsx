/**
 * Pim Etiket — AI QC uyarı maili (dosyada düzeltilmesi gereken nokta).
 *
 * Trigger: orders.status = 'qc_pending' → 'qc_flagged' geçişinde.
 */

import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, Button, Eyebrow, mailStyles, COLORS, SITE } from "./base";

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
  const fallbackIssue =
    "Dosyanda baskı kalitesini etkileyebilecek bir nokta var; birlikte bakalım.";

  return (
    <BaseLayout preview="Baskı kalitesi için kısa bir kontrol.">
      <Eyebrow>Sipariş #{orderId}</Eyebrow>
      <Text style={mailStyles.h1}>
        Dosyanda düzeltilmesi gereken bir nokta var
      </Text>
      <Text style={mailStyles.p}>
        Merhaba {firstName}, {orderId} numaralı siparişinin dosyasını baskı
        öncesi kontrol ettik ve baskı kalitesini etkileyebilecek bir nokta
        fark ettik:
      </Text>

      <Section
        style={{
          background: COLORS.warningBg,
          border: `1px solid ${COLORS.warningBorder}`,
          borderRadius: 10,
          padding: "16px 18px",
          margin: "20px 0",
        }}
      >
        {warnings.length > 0 ? (
          <ul style={{ margin: 0, padding: "0 0 0 18px" }}>
            {warnings.map((w, i) => (
              <li
                key={i}
                style={{
                  color: COLORS.warningText,
                  fontSize: 14,
                  marginBottom: i < warnings.length - 1 ? 6 : 0,
                  lineHeight: 1.6,
                  fontWeight: 600,
                }}
              >
                {w}
              </li>
            ))}
          </ul>
        ) : (
          <Text
            style={{
              ...mailStyles.p,
              color: COLORS.warningText,
              margin: 0,
              fontWeight: 600,
            }}
          >
            {fallbackIssue}
          </Text>
        )}
      </Section>

      <Text style={mailStyles.p}>
        Düzeltilmiş dosyanı yükleyebilir ya da mevcut hâliyle devam etmek
        istersen bize bildirebilirsin — kararı sen ver.
      </Text>

      <Button href={orderUrl} label="Dosyamı güncelle" />

      <Text style={mailStyles.pSecondary}>
        Emin değilsen yardımcı olalım —{" "}
        <Link href={`${SITE}/destek`} style={{ color: COLORS.pimMercan }}>
          destek
        </Link>{" "}
        üzerinden yaz yeter.
      </Text>
    </BaseLayout>
  );
}
