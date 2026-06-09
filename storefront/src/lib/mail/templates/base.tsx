/**
 * Base mail layout — Pim Etiket marka kimliği.
 *
 * EPOSTA-MIMARI §1-3'e göre güncellendi (6 Haz 2026 — 29 e-posta sistemi, Aşama 1).
 * React Email components ile pixel-perfect, dark-mode-tolerant, mobil responsive.
 *
 * GERİYE UYUM: BaseLayout / COLORS / mailStyles / SITE export imzaları korunur
 * (13 mevcut transactional şablon bunları kullanıyor). Yeni özellikler EKLENEREK
 * getirildi: emailType koşullu footer + Button/DetailBox/ProductThumb/Eyebrow.
 */

import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";

// Sefa 19 May v68: COLORS export edildi (yeni template'ler için)
// 6 Haz 2026: EPOSTA-MIMARI §1 token'ları eklendi (mevcut anahtarlar korundu).
export const COLORS = {
  // --- Mevcut (KORUNUR — 13 şablon referans alıyor) ---
  lacivert: "#1A2335",
  pimMercan: "#ef3e56",
  brand: "#ef3e56", // alias
  krem: "#FFF5EB",
  gri700: "#5C6877",
  gri200: "#E5E7EB",
  muted: "#5C6877", // alias
  yesil: "#22C55E",
  success: "#22C55E", // alias
  warningBg: "#FFF7E6",
  warningBorder: "#FFD591",
  warningText: "#AD6800",
  errorBg: "#FFF1F0",
  errorBorder: "#FFA39E",
  errorText: "#A8071A",
  // --- Yeni (EPOSTA-MIMARI §1 — base render + 16 yeni şablon) ---
  ink: "#1F1B2D", // ana metin / başlık
  govde: "#3A3530", // gövde paragraf
  griMetin: "#8A8578", // ikincil/gri metin
  kremKart: "#FAF4E8", // header şeridi + detay kutusu
  footerLacivert: "#1A2335", // dark footer zemini
  zemin: "#ECE8E0", // sayfa arka planı
  gradientStart: "#f46d82", // buton gradient üst (mercan türevi)
  gradientEnd: "#ef3e56", // buton gradient alt
};

/** E-posta türü — footer koşullu satırını belirler (EPOSTA-MIMARI §3). */
export type EmailType = "transactional" | "commercial";

// ============================================================
// Paylaşılan bileşenler (EPOSTA-MIMARI §2)
// ============================================================

/** Mercan üst-başlık (opsiyonel eyebrow). */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: "0 0 6px",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: COLORS.pimMercan,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * Birincil CTA — dolu mercan gradient, fiille başlar.
 * `fallbackNote` true ise altına ham bağlantı yedeği basar (image-off / buton açılmazsa).
 */
export function Button({
  href,
  label,
  fallbackNote,
}: {
  href: string;
  label: string;
  fallbackNote?: boolean;
}) {
  return (
    <>
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        style={{ margin: "20px 0 8px" }}
      >
        <tbody>
          <tr>
            <td
              style={{
                borderRadius: 26,
                background: `linear-gradient(180deg, ${COLORS.gradientStart} 0%, ${COLORS.gradientEnd} 100%)`,
              }}
            >
              <Link
                href={href}
                style={{
                  display: "inline-block",
                  padding: "13px 30px",
                  fontSize: 15.5,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  textDecoration: "none",
                  borderRadius: 26,
                }}
              >
                {label}
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
      {fallbackNote && (
        <Text
          style={{
            margin: "0 0 8px",
            fontSize: 12,
            color: COLORS.griMetin,
            lineHeight: 1.5,
          }}
        >
          Buton açılmazsa bu bağlantıyı tarayıcına yapıştırabilirsin:{" "}
          <Link href={href} style={{ color: COLORS.pimMercan }}>
            {href}
          </Link>
        </Text>
      )}
    </>
  );
}

/** Krem detay kutusu (sipariş özeti, kargo bilgisi vb.). */
export function DetailBox({ children }: { children: React.ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: COLORS.kremKart,
        borderRadius: 12,
        padding: "16px 20px",
        margin: "16px 0",
      }}
    >
      {children}
    </Section>
  );
}

/** Dinamik ürün / prova önizleme görseli (alt zorunlu, max-width 100%). */
export function ProductThumb({ src, alt }: { src: string; alt: string }) {
  return (
    <Img
      src={src}
      alt={alt}
      style={{
        maxWidth: "100%",
        height: "auto",
        borderRadius: 10,
        margin: "16px 0",
        display: "block",
      }}
    />
  );
}

// ============================================================
// Base layout
// ============================================================

interface BaseLayoutProps {
  preview: string;
  children: React.ReactNode;
  /**
   * E-posta türü — footer koşullu satırını belirler (EPOSTA-MIMARI §3).
   * Default "transactional": "işlemsel bildirim" satırı, unsubscribe YOK.
   * "commercial": abonelikten çık satırı + token'lı URL (10/11/14).
   */
  emailType?: EmailType;
  /** Geriye uyum (mevcut şablonlar) — verilirse commercial gibi davranır. */
  unsubscribeCategory?: "marketing" | "blog";
  /**
   * Ticari ileti için token'lı çıkış URL'i. `lib/mail/unsubscribe.ts` →
   * `buildUnsubscribeUrl(email, cat)` ile üretilip enqueue sırasında geçilir.
   */
  unsubscribeUrl?: string;
}

export function BaseLayout({
  preview,
  children,
  emailType = "transactional",
  unsubscribeCategory,
  unsubscribeUrl,
}: BaseLayoutProps) {
  const isCommercial =
    emailType === "commercial" || Boolean(unsubscribeCategory);
  const year = new Date().getFullYear();

  return (
    <Html lang="tr">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: COLORS.zemin,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          margin: 0,
          padding: "24px 12px",
          color: COLORS.ink,
        }}
      >
        <Container
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 16,
            maxWidth: 600,
            margin: "0 auto",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          {/* Header — krem şerit + logo + wordmark (≥12px boşluk) */}
          <Section
            style={{ backgroundColor: COLORS.kremKart, padding: "18px 28px" }}
          >
            <Row>
              <Column style={{ width: 34, verticalAlign: "middle" }}>
                <Link href={SITE_URL}>
                  <Img
                    src={`${SITE_URL}/icon.svg`}
                    width={34}
                    height={34}
                    alt="Pim Etiket"
                    style={{ display: "block" }}
                  />
                </Link>
              </Column>
              <Column style={{ verticalAlign: "middle", paddingLeft: 12 }}>
                <Text
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 800,
                    color: COLORS.ink,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Pim Etiket
                </Text>
              </Column>
            </Row>
          </Section>

          {/* İçerik slot'u */}
          <Section style={{ padding: "24px 28px 28px" }}>{children}</Section>

          {/* Footer — dark lacivert */}
          <Section
            style={{
              backgroundColor: COLORS.footerLacivert,
              padding: "24px 28px",
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: 12.5,
                color: "#C7CCD6",
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: "#FFFFFF" }}>Pim Etiket</strong>
              {" — "}AI destekli dijital baskı atölyesi.
            </Text>
            <Text style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.7 }}>
              <Link
                href={`${SITE_URL}/sss`}
                style={{ color: "#9FB0C8", textDecoration: "none" }}
              >
                SSS
              </Link>
              {" · "}
              <Link
                href={`${SITE_URL}/iletisim`}
                style={{ color: "#9FB0C8", textDecoration: "none" }}
              >
                İletişim
              </Link>
              {" · "}
              <Link
                href={`${SITE_URL}/kvkk`}
                style={{ color: "#9FB0C8", textDecoration: "none" }}
              >
                KVKK
              </Link>
              {" · "}
              <Link
                href={`${SITE_URL}/bildirim-tercihleri`}
                style={{ color: "#9FB0C8", textDecoration: "none" }}
              >
                Bildirim tercihleri
              </Link>
            </Text>
            <Text style={{ margin: "10px 0 0", fontSize: 11, color: "#7C879B" }}>
              © {year} Pim Etiket. Tüm hakları saklıdır.
            </Text>

            {/* Koşullu satır (EPOSTA-MIMARI §3) */}
            {isCommercial ? (
              <Text
                style={{
                  margin: "10px 0 0",
                  fontSize: 11,
                  color: "#7C879B",
                  lineHeight: 1.6,
                }}
              >
                Bu e-postaları almak istemiyorsan{" "}
                <Link
                  href={unsubscribeUrl ?? `${SITE_URL}/bildirim-tercihleri`}
                  style={{ color: "#9FB0C8", textDecoration: "underline" }}
                >
                  abonelikten çıkabilirsin
                </Link>
                .
              </Text>
            ) : (
              <Text
                style={{
                  margin: "10px 0 0",
                  fontSize: 11,
                  color: "#7C879B",
                  lineHeight: 1.6,
                }}
              >
                Bu, siparişinle ilgili işlemsel bir bildirimdir.
              </Text>
            )}

            {/* Mini güven */}
            <Text
              style={{
                margin: "12px 0 0",
                fontSize: 10.5,
                color: "#6B7588",
                letterSpacing: "0.02em",
              }}
            >
              3D Secure · SSL · KVKK uyumlu
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ============================================================
// Re-export commonly used styles for templates
// (mevcut anahtarlar KORUNUR — değerler EPOSTA-MIMARI'ye yaklaştırıldı)
// ============================================================
export const mailStyles = {
  h1: {
    color: COLORS.ink,
    fontSize: 26,
    fontWeight: 800,
    margin: "4px 0 12px",
    lineHeight: 1.2,
    letterSpacing: "-0.01em",
  } as React.CSSProperties,
  h2: {
    color: COLORS.ink,
    fontSize: 18,
    fontWeight: 700,
    margin: "24px 0 8px",
  } as React.CSSProperties,
  p: {
    color: COLORS.govde,
    fontSize: 15.5,
    lineHeight: 1.65,
    margin: "12px 0",
  } as React.CSSProperties,
  pSecondary: {
    color: COLORS.griMetin,
    fontSize: 14,
    lineHeight: 1.6,
    margin: "8px 0",
  } as React.CSSProperties,
  buttonPrimary: {
    backgroundColor: COLORS.pimMercan,
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: 700,
    padding: "13px 28px",
    borderRadius: 26,
    textDecoration: "none",
    display: "inline-block",
  } as React.CSSProperties,
  buttonSecondary: {
    backgroundColor: "#FFFFFF",
    color: COLORS.ink,
    fontSize: 14,
    fontWeight: 600,
    padding: "10px 20px",
    borderRadius: 26,
    textDecoration: "none",
    border: `1px solid ${COLORS.gri200}`,
    display: "inline-block",
  } as React.CSSProperties,
  card: {
    backgroundColor: COLORS.kremKart,
    borderRadius: 12,
    padding: "16px 20px",
    margin: "16px 0",
  } as React.CSSProperties,
  meta: {
    fontSize: 12,
    color: COLORS.gri700,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  } as React.CSSProperties,
  // Sefa 19 May v68: label alias for new templates
  label: {
    fontSize: 12,
    color: COLORS.gri700,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  } as React.CSSProperties,
};

export const SITE = SITE_URL;
