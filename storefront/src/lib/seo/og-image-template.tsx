/**
 * Paylaşılan OG görsel şablonu — hub, malzeme, tür landing route'ları.
 */

import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const C = {
  lacivert: "#141524",
  mercan: "#ef3e56",
  mercanSoft: "#f58a96",
  krem: "#faf4e8",
  beyaz: "#FFFFFF",
};

export function seoOgImageResponse(input: {
  eyebrow: string;
  title: string;
  subtitle: string;
  accent?: "mercan" | "krem" | "mercan-gradient";
  footer?: string;
}) {
  const accent = input.accent ?? "mercan";
  const footer = input.footer ?? "pimetiket.com →";

  const isGradient = accent === "mercan-gradient";
  const isKrem = accent === "krem";

  const bg = isGradient
    ? `linear-gradient(135deg, ${C.mercan} 0%, ${C.mercanSoft} 100%)`
    : isKrem
      ? C.krem
      : C.lacivert;

  const titleColor = isGradient ? C.beyaz : isKrem ? C.lacivert : C.beyaz;
  const subColor = isGradient ? C.beyaz : isKrem ? "#4A5568" : C.krem;
  const brandTextColor = isGradient ? C.beyaz : isKrem ? C.lacivert : C.beyaz;
  const logoBg = isGradient ? C.beyaz : C.mercan;
  const logoTextColor = isGradient ? C.mercan : C.beyaz;
  const footerColor = isGradient ? C.beyaz : C.mercan;
  const eyebrowColor = isGradient ? C.beyaz : C.mercan;
  const subOpacity = isGradient ? 0.9 : 1;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: bg,
          fontFamily: "sans-serif",
          color: isGradient ? C.beyaz : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: logoBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 700,
              color: logoTextColor,
            }}
          >
            P
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: brandTextColor,
            }}
          >
            Pim Etiket
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: eyebrowColor,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              opacity: isGradient ? 0.9 : 1,
            }}
          >
            {input.eyebrow}
          </div>
          <div
            style={{
              fontSize: 58,
              fontWeight: 700,
              lineHeight: 1.05,
              color: titleColor,
              maxWidth: 1000,
            }}
          >
            {input.title}
          </div>
          <div
            style={{
              fontSize: 26,
              color: subColor,
              maxWidth: 920,
              fontWeight: 500,
              opacity: subOpacity,
            }}
          >
            {input.subtitle}
          </div>
        </div>

        <div style={{ fontSize: 22, color: footerColor, fontWeight: 700 }}>
          {footer}
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}
