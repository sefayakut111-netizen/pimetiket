/**
 * /etiket Open Graph görseli — özel kesim, rulo, tabaka etiket teması.
 * Sefa 21 May v68 SEO Sprint.
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Etiket bastır — rulo ve tabaka etiket baskı · Pim Etiket";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const C = {
  lacivert: "#1A2335",
  mercan: "#ef3e56",
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
          background: C.krem,
          fontFamily: "sans-serif",
        }}
      >
        {/* Üst — marka */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: C.mercan,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 800,
              color: C.beyaz,
            }}
          >
            P
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: C.lacivert,
            }}
          >
            Pim Etiket
          </div>
        </div>

        {/* Orta — başlık */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: C.mercan,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Etiket
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: "-0.02em",
              color: C.lacivert,
              maxWidth: 950,
            }}
          >
            Rulo ve tabaka etiket baskı
          </div>
          <div
            style={{
              fontSize: 28,
              color: C.lacivert,
              opacity: 0.75,
              maxWidth: 880,
              fontWeight: 500,
            }}
          >
            Vinil, kuşe, şeffaf — Kozmetik, gıda, içecek için AI dosya kontrolü.
          </div>
        </div>

        {/* Alt — özellik */}
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
              color: C.lacivert,
              opacity: 0.75,
              fontWeight: 600,
            }}
          >
            <div>1.000 adetten</div>
            <div>·</div>
            <div>10 iş günü</div>
            <div>·</div>
            <div>Türkiye geneli kargo</div>
          </div>
          <div
            style={{
              fontSize: 22,
              color: C.mercan,
              fontWeight: 700,
            }}
          >
            pimetiket.com/etiket →
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
