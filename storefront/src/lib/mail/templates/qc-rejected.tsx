/**
 * Pim Etiket — AI QC tasarım reddedildi maili.
 *
 * Trigger: /api/admin/ai-qc/decide POST endpoint'i decision="reject"
 */

import { Link, Section, Text } from "@react-email/components";
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
  const qcReason =
    reason.trim() ||
    "Dosyan mevcut hâliyle baskıya uygun değil; düzeltmek için bize ulaş.";

  return (
    <BaseLayout preview="Düzeltmek için ne gerektiğini açıkladık.">
      <Text style={mailStyles.meta}>SİPARİŞ #{orderId}</Text>
      <Text style={mailStyles.h1}>
        Dosyan baskıya hazır değil — birlikte çözelim
      </Text>
      <Text style={mailStyles.p}>
        Merhaba {firstName}, {orderId} numaralı siparişinin dosyasını baskıya
        hazırlarken şu nedenle olduğu gibi basamayacağımızı gördük:
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
        <Text
          style={{
            ...mailStyles.p,
            color: COLORS.warningText,
            margin: 0,
            fontWeight: 600,
            lineHeight: 1.6,
          }}
        >
          {issueCategory !== "other" ? `${issueLabel}. ` : ""}
          {qcReason}
        </Text>
        {fileName && (
          <Text style={{ ...mailStyles.p, margin: "12px 0 0", fontSize: 13 }}>
            Dosya: <code>{fileName}</code>
          </Text>
        )}
      </Section>

      {issueHelp && (
        <Section style={{ margin: "20px 0" }}>
          <Text style={mailStyles.label}>Nasıl çözülür?</Text>
          <Text style={{ ...mailStyles.p, margin: "6px 0 0" }}>{issueHelp}</Text>
        </Section>
      )}

      <Text style={mailStyles.p}>
        Çoğu durum kolayca çözülür. Düzeltilmiş dosyanı yükleyebilirsin; nasıl
        hazırlayacağından emin değilsen adım adım yardımcı oluruz.
      </Text>

      <Section style={{ margin: "28px 0 8px" }}>
        <Link href={orderUrl} style={mailStyles.buttonPrimary}>
          Yeni dosya yükle →
        </Link>
      </Section>

      <Text style={mailStyles.pSecondary}>
        Takılırsan{" "}
        <Link href={`${SITE}/destek`} style={{ color: COLORS.pimMercan }}>
          destek
        </Link>{" "}
        üzerinden bize yaz — birlikte hallederiz.
      </Text>
    </BaseLayout>
  );
}
