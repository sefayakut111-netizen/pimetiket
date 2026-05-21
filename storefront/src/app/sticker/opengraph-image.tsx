/**
 * /sticker Open Graph görseli — özel kesim, holografik, şeffaf sticker.
 * Sefa 21 May v68 SEO Sprint.
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Sticker bastır — özel kesim, holografik, simli ve şeffaf · Pim Etiket";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const C = {
  lacivert: "#1A2335",
  mercan: "#FF6B5B",
  krem: "#FFF5EB",
  beyaz: "#FFFFFF",
};

export default async function OpengraphImage() {
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
          background: `linear-gradient(135deg, ${C.mercan} 0%, #FF8E7E 100%)`,
          fontFamily: "sans-serif",
          color: C.beyaz,
        }}
      >
        {/* Üst — marka */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: C.beyaz,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 800,
              color: C.mercan,
            }}
          >
            P
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>Pim Etiket</div>
        </div>

        {/* Orta — başlık */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              opacity: 0.9,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Sticker
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: "-0.02em",
              maxWidth: 950,
            }}
          >
            Özel kesim · holografik · şeffaf
          </div>
          <div
            style={{
              fontSize: 28,
              opacity: 0.9,
              maxWidth: 880,
              fontWeight: 500,
            }}
          >
            25 adetten başlayan vinil sticker — marka, laptop, hediye için.
          </div>
        </div>

        {/* Alt */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 24,
              fontSize: 22,
              fontWeight: 600,
              opacity: 0.9,
            }}
          >
            <div>25 adetten</div>
            <div>·</div>
            <div>5 iş günü</div>
            <div>·</div>
            <div>AI dosya kontrolü</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            pimetiket.com/sticker →
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
