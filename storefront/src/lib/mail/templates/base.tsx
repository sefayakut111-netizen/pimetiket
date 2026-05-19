/**
 * Base mail layout — Pim Etiket marka kimliği.
 *
 * React Email components ile pixel-perfect, dark-mode-tolerant.
 * Tüm transactional template'ler bunu wrap eder.
 */

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";

// Sefa 19 May v68: COLORS export edildi (yeni template'ler için)
export const COLORS = {
  lacivert: "#1A2335",
  pimMercan: "#FF6B5B",
  brand: "#FF6B5B", // alias
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
};

interface BaseLayoutProps {
  preview: string;
  children: React.ReactNode;
  /** Mail footer'da unsubscribe link — opsiyonel kategori (marketing/blog) */
  unsubscribeCategory?: "marketing" | "blog";
}

export function BaseLayout({
  preview,
  children,
  unsubscribeCategory,
}: BaseLayoutProps) {
  return (
    <Html lang="tr">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#F8FAFC",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          margin: 0,
          padding: "32px 16px",
          color: COLORS.lacivert,
        }}
      >
        <Container
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 16,
            maxWidth: 600,
            margin: "0 auto",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          {/* Header — sadece logo */}
          <Section style={{ padding: "24px 28px 0" }}>
            <Link href={SITE_URL}>
              <Img
                src={`${SITE_URL}/icon.svg`}
                width={36}
                height={36}
                alt="Pim Etiket"
                style={{ display: "block" }}
              />
            </Link>
          </Section>

          {/* Body content */}
          <Section style={{ padding: "8px 28px 32px" }}>{children}</Section>

          <Hr
            style={{
              borderColor: COLORS.gri200,
              margin: 0,
            }}
          />

          {/* Footer */}
          <Section
            style={{
              padding: "20px 28px",
              fontSize: 12,
              color: COLORS.gri700,
              lineHeight: 1.6,
            }}
          >
            <Text style={{ margin: 0 }}>
              <strong style={{ color: COLORS.lacivert }}>Pim Etiket</strong>
              {" — "}AI destekli dijital baskı atölyesi.
            </Text>
            <Text style={{ margin: "8px 0 0" }}>
              <Link
                href={`${SITE_URL}/iletisim`}
                style={{ color: COLORS.pimMercan, textDecoration: "none" }}
              >
                İletişim
              </Link>
              {" · "}
              <Link
                href={`${SITE_URL}/sss`}
                style={{ color: COLORS.pimMercan, textDecoration: "none" }}
              >
                SSS
              </Link>
              {" · "}
              <Link
                href={`${SITE_URL}/kvkk`}
                style={{ color: COLORS.pimMercan, textDecoration: "none" }}
              >
                KVKK
              </Link>
            </Text>
            {unsubscribeCategory && (
              <Text
                style={{
                  margin: "12px 0 0",
                  fontSize: 11,
                  color: COLORS.gri700,
                }}
              >
                Bu maili almak istemiyorsan{" "}
                <Link
                  href={`${SITE_URL}/bildirim-tercihleri`}
                  style={{
                    color: COLORS.pimMercan,
                    textDecoration: "underline",
                  }}
                >
                  bildirim tercihlerinden
                </Link>{" "}
                kapatabilirsin.
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Re-export commonly used styles for templates
export const mailStyles = {
  h1: {
    color: COLORS.lacivert,
    fontSize: 24,
    fontWeight: 600,
    margin: "16px 0 8px",
    lineHeight: 1.2,
    letterSpacing: "-0.01em",
  } as React.CSSProperties,
  h2: {
    color: COLORS.lacivert,
    fontSize: 18,
    fontWeight: 600,
    margin: "24px 0 8px",
  } as React.CSSProperties,
  p: {
    color: COLORS.lacivert,
    fontSize: 15,
    lineHeight: 1.6,
    margin: "12px 0",
  } as React.CSSProperties,
  pSecondary: {
    color: COLORS.gri700,
    fontSize: 14,
    lineHeight: 1.6,
    margin: "8px 0",
  } as React.CSSProperties,
  buttonPrimary: {
    backgroundColor: COLORS.pimMercan,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: 600,
    padding: "12px 24px",
    borderRadius: 999,
    textDecoration: "none",
    display: "inline-block",
  } as React.CSSProperties,
  buttonSecondary: {
    backgroundColor: "#FFFFFF",
    color: COLORS.lacivert,
    fontSize: 14,
    fontWeight: 600,
    padding: "10px 20px",
    borderRadius: 999,
    textDecoration: "none",
    border: `1px solid ${COLORS.gri200}`,
    display: "inline-block",
  } as React.CSSProperties,
  card: {
    backgroundColor: COLORS.krem,
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
