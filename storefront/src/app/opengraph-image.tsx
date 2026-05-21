/**
 * Anasayfa Open Graph + Twitter Card görseli (Next 16 file convention).
 *
 * Sefa 21 May v68 — SEO Sprint:
 *   site_images.og_default boşken sosyal medya paylaşımlarında beyaz
 *   kart çıkıyordu. Bu dosya ImageResponse ile dinamik 1200×630 PNG
 *   üretir — Pim Etiket marka renkleri + tagline.
 *
 *   Admin sonradan DB'ye özel görsel yüklerse (`/admin/gorseller` →
 *   slot=og_default), layout.tsx generateMetadata o görseli explicit
 *   set eder ve file convention'ı override eder. Yani: zero-config
 *   fallback + opsiyonel admin override.
 *
 * Next 16 convention:
 *   - Path: src/app/opengraph-image.tsx
 *   - Otomatik `<meta property="og:image">` + `og:image:width/height`
 *   - twitter-image.tsx ayrı eklenebilir; yoksa Next aynı görseli kullanır.
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Pim Etiket — Markanın Etiketi, Fikrinin Stickerı";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Pim Etiket marka renkleri (templates/base.tsx COLORS ile aynı)
const COLORS = {
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
          background: `linear-gradient(135deg, ${COLORS.lacivert} 0%, #2D3A50 100%)`,
          fontFamily: "sans-serif",
          color: COLORS.beyaz,
        }}
      >
        {/* Üst — marka */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: COLORS.mercan,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              fontWeight: 800,
            }}
          >
            P
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                fontSize: 36,
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            >
              Pim Etiket
            </div>
            <div
              style={{
                fontSize: 18,
                color: COLORS.krem,
                marginTop: 4,
                opacity: 0.85,
              }}
            >
              pimetiket.com
            </div>
          </div>
        </div>

        {/* Orta — slogan */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: 920,
            }}
          >
            Markanın Etiketi,{" "}
            <span style={{ color: COLORS.mercan }}>Fikrinin Stickerı</span>
          </div>
          <div
            style={{
              fontSize: 26,
              color: COLORS.krem,
              opacity: 0.9,
              fontWeight: 500,
              maxWidth: 820,
            }}
          >
            AI destekli dijital baskı ekosistemi — Pim ile sohbet et, anında cevap al.
          </div>
        </div>

        {/* Alt — özellikler */}
        <div
          style={{
            display: "flex",
            gap: 32,
            fontSize: 22,
            color: COLORS.krem,
            opacity: 0.85,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: COLORS.mercan, fontSize: 28 }}>✓</span>
            AI dosya kontrolü
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: COLORS.mercan, fontSize: 28 }}>✓</span>
            5 iş günü teslim
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: COLORS.mercan, fontSize: 28 }}>✓</span>
            25 adetten başlar
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
