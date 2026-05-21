/**
 * Anasayfa Open Graph + Twitter Card görseli (Next 16 file convention).
 *
 * Sefa 21 May v68 — SEO Sprint v3:
 *   v1 — linear-gradient + 3-bölüm flex + nested span → Satori render fail (0 byte)
 *   v2 — gradient → solid color → hala 0 byte
 *   v3 — /etiket pattern'ini taklit: tek katman flex, span yok, sade yapı
 *
 *   Diğer 2 OG (/etiket 40KB, /sticker 72KB) çalışıyor — aynı pattern'i
 *   uyguladığımda anasayfa da render etmeli.
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Pim Etiket — Markanın Etiketi, Fikrinin Stickerı";
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
          backgroundColor: C.lacivert,
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
              backgroundColor: C.mercan,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 700,
              color: C.beyaz,
            }}
          >
            P
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.beyaz }}>
            Pim Etiket
          </div>
        </div>

        {/* Orta — başlık */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: C.mercan,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Pim Etiket
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.05,
              color: C.beyaz,
              maxWidth: 1000,
            }}
          >
            Markanın etiketi, fikrinin stickerı
          </div>
          <div
            style={{
              fontSize: 28,
              color: C.krem,
              maxWidth: 920,
              fontWeight: 500,
            }}
          >
            AI destekli dijital baskı — Pim ile sohbet et, fiyat ve teslim sorularına anında cevap al.
          </div>
        </div>

        {/* Alt — özellikler */}
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
              color: C.krem,
              fontWeight: 600,
            }}
          >
            <div>AI dosya kontrolü</div>
            <div>·</div>
            <div>5 iş günü teslim</div>
            <div>·</div>
            <div>25 adetten başlar</div>
          </div>
          <div style={{ fontSize: 22, color: C.mercan, fontWeight: 700 }}>
            pimetiket.com →
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
