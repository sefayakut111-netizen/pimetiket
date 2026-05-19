/**
 * Pim Etiket — AI QC tasarım reddedildi maili.
 *
 * Sefa 19 May v68 (su borusu denetimi):
 * AI QC veya operatör tasarım dosyasını "düzelt" işaretledi → müşteriye
 * sebep + ne yapacağı açık talimat. Mesai dışı destek (Pim sohbet)
 * referansı dahil.
 *
 * Trigger: /api/admin/ai-qc/decide POST endpoint'i decision="reject"
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout, mailStyles, COLORS, SITE } from "./base";

export interface QcRejectedProps {
  customerName: string;
  orderId: string;
  /** Operatör notu (Sefa'nın yazdığı düzeltme talebi) */
  reason: string;
  /** Hangi tasarım dosyası problemli ("etiket-v3.pdf" gibi) */
  fileName?: string;
  /** İlgili problem kategorisi: 'dpi' | 'cmyk' | 'bleed' | 'font' | 'other' */
  issueCategory?: "dpi" | "cmyk" | "bleed" | "font" | "other";
}

const ISSUE_LABELS: Record<NonNullable<QcRejectedProps["issueCategory"]>, string> = {
  dpi: "Çözünürlük düşük",
  cmyk: "Renk profili (RGB → CMYK)",
  bleed: "Taşma payı (bleed) eksik",
  font: "Font outline yapılmamış",
  other: "Genel düzeltme talebi",
};

const ISSUE_HELP: Record<NonNullable<QcRejectedProps["issueCategory"]>, string> = {
  dpi:
    "Tasarımını gerçek baskı boyutunda 300 DPI olacak şekilde yeniden kaydet. " +
    "Canva'da 'Print' kalitesi, Photoshop'ta Image Size → 300 ppi.",
  cmyk:
    "Canva FREE sürümünde CMYK yok — sorun değil. PDF olarak RGB indir, " +
    "biz baskı öncesi otomatik CMYK'ya çeviriyoruz. Canva Pro / Adobe / " +
    "Figma'da CMYK export edebiliyorsan onu tercih et.",
  bleed:
    "Her kenardan 2-3 mm taşma payı ekle. 60×80 mm etiket için tasarım " +
    "dosyası 64×84 mm olmalı; logo + yazılar kesim çizgisinden 3 mm içeride.",
  font:
    "Illustrator: Type → Create Outlines (Cmd/Ctrl+Shift+O). " +
    "Photoshop: katmanı rasterize et. PDF dışa aktarımında 'Embed All Fonts' işaretle.",
  other: "",
};

export function QcRejectedEmail({
  customerName,
  orderId,
  reason,
  fileName,
  issueCategory = "other",
}: QcRejectedProps) {
  const firstName = customerName.split(" ")[0] || customerName;
  const issueLabel = ISSUE_LABELS[issueCategory];
  const issueHelp = ISSUE_HELP[issueCategory];
  const orderUrl = `${SITE}/siparis/${orderId}`;

  return (
    <BaseLayout preview={`Tasarım dosyası düzeltme gerekiyor — ${orderId}`}>
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        {firstName}, tasarımda küçük bir düzeltme lazım 🛠️
      </Text>
      <Text style={mailStyles.p}>
        Yüklediğin tasarım dosyasında baskıya geçmeden önce düzeltilmesi
        gereken bir nokta tespit ettik. Endişelenme — yaygın bir durum,
        2-3 dakikada halledebilirsin.
      </Text>

      {/* Sorun özeti */}
      <Section
        style={{
          background: COLORS.warningBg,
          border: `1px solid ${COLORS.warningBorder}`,
          borderRadius: "10px",
          padding: "16px 18px",
          margin: "20px 0",
        }}
      >
        <Text style={{ ...mailStyles.label, color: COLORS.warningText, marginTop: 0 }}>
          ⚠️ Düzeltme konusu
        </Text>
        <Text
          style={{
            ...mailStyles.p,
            color: COLORS.warningText,
            margin: "4px 0 12px",
            fontWeight: 600,
          }}
        >
          {issueLabel}
        </Text>
        {fileName && (
          <Text style={{ ...mailStyles.p, margin: "0 0 8px", fontSize: "13px" }}>
            Dosya: <code>{fileName}</code>
          </Text>
        )}
        <Text style={{ ...mailStyles.p, margin: 0, fontSize: "13px" }}>
          Operatör notu: <em>{reason}</em>
        </Text>
      </Section>

      {/* Nasıl yapılır */}
      {issueHelp && (
        <Section style={{ margin: "20px 0" }}>
          <Text style={mailStyles.label}>💡 NASIL ÇÖZÜLÜR?</Text>
          <Text style={{ ...mailStyles.p, margin: "6px 0 0" }}>{issueHelp}</Text>
        </Section>
      )}

      {/* CTA — sipariş sayfasında dosya değiştirme */}
      <Section style={{ textAlign: "center", margin: "32px 0 24px" }}>
        <a
          href={orderUrl}
          style={{
            background: COLORS.brand,
            color: "#fff",
            textDecoration: "none",
            padding: "12px 28px",
            borderRadius: "999px",
            fontWeight: 600,
            fontSize: "14px",
            display: "inline-block",
          }}
        >
          Düzeltilmiş dosyayı yükle →
        </a>
      </Section>

      <Text style={{ ...mailStyles.p, fontSize: "13px", color: COLORS.muted }}>
        Yardım gerekirse Pim sohbet asistanına yazabilir (sağ alt köşede)
        veya info@pimetiket.com'a e-posta atabilirsin. Tasarım yüklenince
        otomatik üretim akışına geçer.
      </Text>
    </BaseLayout>
  );
}
