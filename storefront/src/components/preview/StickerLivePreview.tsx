/**
 * StickerLivePreview — Sticker konfigüratörünün ÜRÜN simülasyonu.
 *
 * Sefa kuralı (18 May v67): Cut mode + şekil + malzeme + laminasyon
 * seçimleri canlı yansır. Karga maskotu default placeholder.
 *
 * Cut mode mantığı:
 *   - diecut:  TEK sticker, etrafında 2.5mm BEYAZ KONTUR (cut path)
 *              + havada duruyor drop-shadow (Sticker Mule mantığı)
 *   - tabaka:  Tabaka grid içinde sticker'lar (kesim YOK,
 *              henüz makasa girmemiş — TabakaPreview ile aynı)
 *
 * Şekil:
 *   - square      → dikdörtgen (boyut oranlı)
 *   - circle      → daire/elips (boyut oranlı)
 *   - ozel        → yumuşak köşeli dikdörtgen (pill-leaning)
 *   - die         → custom kontur (karga silüetini takip eder)
 *
 * Malzeme zemin:
 *   - vinil       → opakpp.svg (beyaz parlak)
 *   - transparan  → transparan.svg (frosted/cam)
 *   - holo        → holografik.svg (gökkuşağı iridescence)
 *   - simli       → simli.svg (multi-spark glitter)
 *
 * Laminasyon:
 *   - parlak      → glossy sheen overlay (yansıma)
 *   - mat         → düz, parlama yok
 *   - yok         → düz
 */

"use client";

import { MaterialSwatch, type SurfaceId } from "@/components/ui";
import { MaskotPlaceholder } from "./MaskotPlaceholder";
import type { PreviewView } from "./ProductPreviewShell";
import type {
  StickerMaterial,
  StickerFinish,
} from "@/lib/sticker-customer-pricing";
import {
  CUT_SET_META,
} from "@/lib/templates/die-cut-templates";
import {
  KARTLI_CARD_RADIUS_MM,
  KARTLI_MARGIN_MM,
} from "@/lib/editor/cutline/export-svg";

// Sefa 21 May v68 (konfigüratör denetim #5): preview ShapeId genişletildi
// — oval, rectangle, bumper için özel render (önceden hepsi "ozel" olarak
// mapleniyor ve tek görselle gösteriliyordu). "diecut" sticker
// yapilandir'daki alias (== "die") — TS uyumluluğu için burada da kabul.
type ShapeId =
  | "square"
  | "circle"
  | "ozel"
  | "die"
  | "diecut"
  | "rectangle"
  | "oval"
  | "bumper";

const STICKER_SURFACE: Record<StickerMaterial, SurfaceId> = {
  vinil: "opakpp",
  transparan: "transparan",
  holo: "holografik",
  simli: "simli",
};

const FINISH_SHEEN: Record<StickerFinish, number> = {
  parlak: 0.5,
  mat: 0.04,
  yok: 0.16,
};

interface StickerLivePreviewProps {
  // Sefa 21 May v68 (konfigüratör denetim #5): kisscut artık preview'da
  // ayrı render — taşıyıcı kağıt outline ile gösterilir.
  cutMode: "diecut" | "tabaka" | "kisscut" | "kartli";
  shape: ShapeId;
  softCorners: boolean;
  material: StickerMaterial;
  finish: StickerFinish;
  width: number;
  height: number;
  qty?: number;
  view: PreviewView;
  designUrl?: string | null;
  /** Sefa 18 May v67: gerçek pricing geometrisi — tabaka grid'i
   *  bu cols × rows üzerinden çizilir. */
  geometryCols?: number;
  geometryRows?: number;
  geometryPerSheet?: number;
  geometrySheetsNeeded?: number;
  /** Sefa 18 May v68: tabaka boyutu (mm) — preview üstünde
   *  "230×310 mm" şeklinde gösterilir. */
  geometrySheetW?: number;
  geometrySheetH?: number;
}

export function StickerLivePreview({
  cutMode,
  shape,
  softCorners,
  material,
  finish,
  width,
  height,
  qty = 50,
  view,
  designUrl,
  geometryCols,
  geometryRows,
  geometryPerSheet,
  geometrySheetsNeeded,
  geometrySheetW,
  geometrySheetH,
}: StickerLivePreviewProps) {
  const surface = STICKER_SURFACE[material];
  const sheen = FINISH_SHEEN[finish];
  const isTransparent = material === "transparan";

  // Boyut normalizasyon (maks 280px hedef)
  const maxDim = Math.max(width, height);
  const scale = Math.min(280 / maxDim, 4);
  const stickerWidthPx = width * scale;
  const stickerHeightPx = height * scale;

  // Şekil → border-radius
  // Sefa 21 May v68 (konfigüratör denetim #5): oval/bumper/rectangle için
  // ayrı render (eski "ozel" mapping tüm farklı şekilleri aynı görselle
  // gösteriyordu).
  const radius: string | number =
    shape === "circle" || shape === "oval"
      ? "50%" // oval ellipse — width × height farkı korunur, radius 50%
      : shape === "square"
        ? softCorners
          ? 16
          : 0
        : shape === "rectangle"
          ? softCorners
            ? 12
            : 0
          : shape === "bumper"
            ? softCorners
              ? 24
              : 6 // bumper yatay, hafif radius görsel hissi
            : shape === "ozel"
              ? softCorners
                ? 36
                : 0
              : 0;

  // Sefa 18 May v68 (5): View modları
  // - "3d"     → perspective + rotation (gerçekçi sunum)
  // - "sketch" → düz, no perspective (eskiz/diyagram netliği)
  const isSketch = view === "sketch";
  const view3dWrap: React.CSSProperties = isSketch
    ? {}
    : { perspective: "2000px" };
  const view3dInner: React.CSSProperties = isSketch
    ? {
        transform: "rotateZ(0deg)",
        transition: "transform 280ms cubic-bezier(.2,.8,.2,1)",
      }
    : {
        transform: "rotateZ(-4deg) rotateX(6deg)",
        transformStyle: "preserve-3d",
        transformOrigin: "center center",
        transition: "transform 280ms cubic-bezier(.2,.8,.2,1)",
      };

  // Beyaz kontur kalınlığı (die-cut için cut path simülasyonu)
  const CUT_PATH_WIDTH = 8; // px, ekranda ~2.5mm karşılığı

  // ─────────────────────────────────────────────────────────────
  // Tek sticker render helper
  // ─────────────────────────────────────────────────────────────
  const renderSingleSticker = (
    key: string | number,
    {
      withCutPath = false,
      withShadow = false,
    }: { withCutPath?: boolean; withShadow?: boolean } = {}
  ) => {
    const padPx = withCutPath ? CUT_PATH_WIDTH : 0;
    return (
      <div
        key={key}
        className="relative"
        style={{
          padding: padPx,
          background: withCutPath ? "white" : "transparent",
          borderRadius: typeof radius === "number" ? radius + padPx : radius,
          boxShadow: withShadow
            ? "0 12px 28px rgba(31,41,55,0.22), 0 4px 10px rgba(31,41,55,0.12)"
            : "none",
        }}
      >
        <div
          className={
            isSketch ? "relative overflow-hidden ring-1 ring-pim-mercan" : "relative overflow-hidden"
          }
          style={{
            width: stickerWidthPx,
            height: stickerHeightPx,
            borderRadius: radius,
            background: isSketch ? "rgba(255, 107, 91, 0.18)" : undefined,
          }}
        >
          {/* Layer 1 — 3D: Material zemin · Sketch: mercan dolgu (yukarıda) */}
          {!isSketch && (
            <MaterialSwatch
              surface={surface}
              className="absolute inset-0 w-full h-full"
              rounded="md"
              style={{
                borderRadius:
                  typeof radius === "number" ? `${radius}px` : radius,
              }}
            />
          )}

          {/* Layer 2 — Şeffaf checker (3D + transparan) */}
          {!isSketch && isTransparent && (
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, rgba(200,210,220,0.5) 25%, transparent 25%), linear-gradient(-45deg, rgba(200,210,220,0.5) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(200,210,220,0.5) 75%), linear-gradient(-45deg, transparent 75%, rgba(200,210,220,0.5) 75%)",
                backgroundSize: "10px 10px",
                backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0px",
                opacity: 0.45,
              }}
            />
          )}

          {/* Layer 3 — Tasarım veya karga (her iki modda) */}
          {designUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={designUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <MaskotPlaceholder sizePct={70} />
          )}

          {/* Layer 4 — Finish sheen (sadece 3D) */}
          {!isSketch && sheen > 0.08 && (
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(80% 60% at 30% 20%, rgba(255,255,255,${sheen}) 0%, transparent 60%)`,
                mixBlendMode: "screen",
              }}
            />
          )}
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // KARTLI MODE — dış ThruCut kart (mavi) + iç KissCut silüet (magenta)
  // ─────────────────────────────────────────────────────────────
  if (cutMode === "kartli") {
    const cardW = width + 2 * KARTLI_MARGIN_MM;
    const cardH = height + 2 * KARTLI_MARGIN_MM;
    const marginPxX = stickerWidthPx * (KARTLI_MARGIN_MM / width);
    const marginPxY = stickerHeightPx * (KARTLI_MARGIN_MM / height);
    const cardRadiusPx = Math.min(
      (KARTLI_CARD_RADIUS_MM / cardW) * (stickerWidthPx + marginPxX * 2),
      (KARTLI_CARD_RADIUS_MM / cardH) * (stickerHeightPx + marginPxY * 2)
    );
    const thrucutColor = CUT_SET_META.thrucut.color;
    const kisscutColor = CUT_SET_META.kisscut.color;

    return (
      <div style={view3dWrap} className="relative">
        <div style={view3dInner} className="flex flex-col items-center gap-3">
          <div
            className="relative bg-krem-soft"
            style={{
              padding: `${marginPxY}px ${marginPxX}px`,
              borderRadius: cardRadiusPx,
              border: `3px solid ${thrucutColor}`,
              boxShadow: "0 10px 24px rgba(0,71,255,0.12)",
            }}
            title="Die-cut kart — tam kesim dış kenar"
          >
            <div
              className="relative"
              style={{
                outline: `3px solid ${kisscutColor}`,
                outlineOffset: 2,
                borderRadius: radius,
              }}
            >
              {renderSingleSticker("kartli-inner", {
                withCutPath: false,
                withShadow: false,
              })}
            </div>
          </div>
          <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gri-700">
            Kartlı · Sticker {Math.round(width)}×{Math.round(height)} · Kart{" "}
            {Math.round(cardW)}×{Math.round(cardH)} mm
          </span>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // DIE-CUT MODE — TEK sticker, BEYAZ KONTUR (cut path) belirgin.
  // Sefa 18 May v68: shape === "die" için ÖZEL render → karga silüeti
  // dış kontur olarak görünür (Sticker Mule pattern). Diğer şekillerde
  // (kare/yuvarlak/özel oran) renderSingleSticker normal akış.
  // ─────────────────────────────────────────────────────────────
  if (cutMode === "diecut" || cutMode === "kisscut") {
    // ÖZEL: shape === "die" + tasarım yok → karga silüetine göre kesim
    // (kontur tasarımın alfa kanalını takip eder).
    // Sefa 18 May v68 (2): Tüm kargalar lacivert (dark mark) — auto-contrast yok.
    if (shape === "die" || shape === "diecut") {
      const maskotSrc = "/pim/pim-etiket-mark-dark.svg";
      // Sefa 18 May v68: NET kalın beyaz kontur (diğer şekillerle aynı).
      // Eski drop-shadow blur'lu halo veriyordu → bulanık.
      // Yeni: 8 yönde 0-blur multi-drop-shadow → uniform solid stroke etkisi.
      // 3px her yön = ~2.5mm cut path eşdeğeri. + tek soft shadow havada.
      const S = 3; // stroke kalınlığı (px)
      const dieCutFilter = `
        drop-shadow(${S}px 0 0 white)
        drop-shadow(-${S}px 0 0 white)
        drop-shadow(0 ${S}px 0 white)
        drop-shadow(0 -${S}px 0 white)
        drop-shadow(${S * 0.75}px ${S * 0.75}px 0 white)
        drop-shadow(-${S * 0.75}px ${S * 0.75}px 0 white)
        drop-shadow(${S * 0.75}px -${S * 0.75}px 0 white)
        drop-shadow(-${S * 0.75}px -${S * 0.75}px 0 white)
        drop-shadow(0 12px 24px rgba(31,41,55,0.25))
        drop-shadow(0 4px 8px rgba(31,41,55,0.12))
      `;
      // Sefa 18 May v68 (2): Container artık gerçek sticker aspect'inde
      // (bumper için 100×40, kare için 75×75). Eski Math.min kare zorluyordu
      // → bumper'da karga sol köşede kalıyordu. Şimdi container bumper aspect
      // + karga w/h %100 → preserveAspectRatio meet ile tam ortalı.
      // Sefa 21 May v68 (konfigüratör denetim #5 takip): bumper gibi çok
      // yatay sticker'larda Pim mark SVG'si alt sınırdan taşıyordu —
      // padding'i yatay/dikey ayrı ayarla (bumper için %15 vertical inset).
      const isBumperAspect = width > height * 2;
      const maskotPadding = isBumperAspect
        ? `${Math.round(stickerHeightPx * 0.18)}px ${Math.round(stickerWidthPx * 0.05)}px`
        : "4px";
      // Şeffaf sticker → arka plana checker pattern (transparency hint)
      const showTransparentBg = isTransparent;
      return (
        <div style={view3dWrap} className="relative">
          <div style={view3dInner} className="flex flex-col items-center gap-3">
            {showTransparentBg && (
              <div
                aria-hidden
                className="absolute"
                style={{
                  width: stickerWidthPx,
                  height: stickerHeightPx,
                  backgroundImage:
                    "linear-gradient(45deg, rgba(200,210,220,0.55) 25%, transparent 25%), linear-gradient(-45deg, rgba(200,210,220,0.55) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(200,210,220,0.55) 75%), linear-gradient(-45deg, transparent 75%, rgba(200,210,220,0.55) 75%)",
                  backgroundSize: "10px 10px",
                  backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0px",
                  borderRadius: 4,
                  zIndex: 0,
                }}
              />
            )}
            <div
              className="relative grid place-items-center"
              style={{
                width: stickerWidthPx,
                height: stickerHeightPx,
                overflow: "hidden",
                filter: dieCutFilter,
              }}
            >
              {designUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={designUrl}
                  alt=""
                  aria-hidden="true"
                  className="w-full h-full object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={maskotSrc}
                  alt=""
                  aria-hidden="true"
                  className="w-full h-full object-contain"
                  style={{ padding: maskotPadding }}
                />
              )}
            </div>
            {/* shape die/diecut branch'i — yuvarlak ihtimali yok.
                Sefa 21 May v68 (sistem denetim #6): cutMode kissCut iken
                "Yarı kesim" göster (eski hep "Kontur kesim" diyordu). */}
            <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gri-700">
              {cutMode === "kisscut" ? "Yarı kesim" : "Kontur kesim"} ·{" "}
              {Math.round(width)}×{Math.round(height)} mm
            </span>
          </div>
        </div>
      );
    }

    // Sefa 21 May v68 (konfigüratör denetim #5): kiss-cut için sticker'ın
    // etrafında taşıyıcı kağıt outline. cutMode==="kisscut" iken görsel
    // farklı: backing kağıt dikdörtgen + içinde sticker (cut path).
    const isKissCut = cutMode === "kisscut";
    const cutLabel = isKissCut ? "Yarı kesim" : "Kontur kesim";

    // Yuvarlak/kare/oval/bumper/dikdörtgen — normal sticker + cut path
    const stickerBlock = renderSingleSticker("die-single", {
      withCutPath: true,
      withShadow: !isKissCut, // kisscut backing zaten kağıt hissi verir
    });

    return (
      <div style={view3dWrap} className="relative">
        <div style={view3dInner} className="flex flex-col items-center gap-3">
          {isKissCut ? (
            <div
              className="relative bg-krem-soft ring-1 ring-gri-300 rounded-md"
              style={{
                padding: 18,
                boxShadow: "0 8px 20px rgba(0,0,0,0.10)",
              }}
              title="Taşıyıcı kağıt — sticker tek tek soyulur"
            >
              {stickerBlock}
            </div>
          ) : (
            stickerBlock
          )}
          <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gri-700">
            {cutLabel} ·{" "}
            {shape === "circle"
              ? `Ø ${Math.round(width)} mm`
              : `${Math.round(width)}×${Math.round(height)} mm`}
          </span>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // TABAKA MODE — Gerçek pricing geometrisi üzerinden grid
  // Sefa 18 May v67: tabaka kaç sticker sığacağını fiyat motorundan al,
  // temsili 1 tabakayı çiz. Çok büyükse 6×5 cap.
  // ─────────────────────────────────────────────────────────────
  const rawCols = geometryCols ?? 2;
  const rawRows = geometryRows ?? 2;
  const realPerSheet = geometryPerSheet ?? rawCols * rawRows;
  const displayCols = Math.min(rawCols, 6);
  const displayRows = Math.min(rawRows, 5);
  const isCapped = displayCols < rawCols || displayRows < rawRows;
  const PREVIEW_MAX_W = 280;
  const PREVIEW_MAX_H = 260;
  const GAP_PX = 4;
  const aspect = width / height;
  const cellByCols =
    (PREVIEW_MAX_W - GAP_PX * (displayCols - 1)) / displayCols;
  const cellByRows =
    (PREVIEW_MAX_H - GAP_PX * (displayRows - 1)) / displayRows;
  const cellW = Math.min(cellByCols, cellByRows * aspect);
  const cellH = cellW / aspect;
  // Sefa 18 May v68 (3): tüm cells'e karga (centerCellIdx kullanılmıyor artık)
  const totalDisplayCells = displayCols * displayRows;
  const cells = Array.from({ length: totalDisplayCells }, (_, i) => i);

  // Sefa 18 May v68 (4): Outer form TabakaPreview pattern korunur
  // (solid white kağıt + üst sol köşe boyut etiketi + inner dashed),
  // AMA içerdeki cell'lerde MATERIAL ZEMİN + FINISH SHEEN + KARGA korunur
  // (referans sadece görsel form için, efektler kalıcı).
  return (
    <div style={view3dWrap} className="relative">
      <div style={view3dInner} className="flex flex-col items-center gap-2">
        {/* Tabaka kağıdı: solid white + soft shadow (TabakaPreview pattern) */}
        <div
          className="relative rounded-lg bg-white p-3 ring-1 ring-gri-200"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        >
          {/* Üst sol köşe: tabaka boyutu etiketi */}
          <span className="absolute -top-2 left-3 px-1.5 text-[9px] font-bold uppercase tracking-[0.06em] text-gri-500 bg-krem tabular-nums">
            {geometrySheetW && geometrySheetH
              ? `${Math.round(geometrySheetW)}×${Math.round(geometrySheetH)} mm`
              : "Tabaka"}
          </span>
          {/* Inner dashed border (tabaka usable area) */}
          <div className="rounded ring-1 ring-dashed ring-gri-400 p-2">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${displayCols}, ${cellW}px)`,
                gridTemplateRows: `repeat(${displayRows}, ${cellH}px)`,
                gap: GAP_PX * 1.5,
              }}
            >
              {cells.map((i) => (
                <div
                  key={i}
                  className={
                    isSketch
                      ? "relative overflow-hidden ring-1 ring-pim-mercan"
                      : "relative overflow-hidden ring-1 ring-black/[0.08]"
                  }
                  style={{
                    borderRadius: radius,
                    boxShadow: isSketch
                      ? "none"
                      : "0 1px 3px rgba(0,0,0,0.08)",
                    background: isSketch
                      ? "rgba(255, 107, 91, 0.18)"
                      : undefined,
                  }}
                >
                  {/* Layer 1 — Sketch: mercan dolgu (yukarıda) /
                                3D: Material zemin SVG */}
                  {!isSketch && (
                    <MaterialSwatch
                      surface={surface}
                      className="absolute inset-0 w-full h-full"
                      rounded="md"
                    />
                  )}

                  {/* Layer 2 — Şeffaf checker (sadece 3D + transparan) */}
                  {!isSketch && isTransparent && (
                    <div
                      aria-hidden
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        backgroundImage:
                          "linear-gradient(45deg, rgba(200,210,220,0.5) 25%, transparent 25%), linear-gradient(-45deg, rgba(200,210,220,0.5) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(200,210,220,0.5) 75%), linear-gradient(-45deg, transparent 75%, rgba(200,210,220,0.5) 75%)",
                        backgroundSize: "8px 8px",
                        backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                        opacity: 0.35,
                      }}
                    />
                  )}

                  {/* Layer 3 — Tasarım veya karga (her iki modda) */}
                  {designUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={designUrl}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <MaskotPlaceholder sizePct={60} />
                  )}

                  {/* Layer 4 — Finish sheen (sadece 3D) */}
                  {!isSketch && sheen > 0.08 && (
                    <div
                      aria-hidden
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: `radial-gradient(80% 60% at 30% 20%, rgba(255,255,255,${sheen}) 0%, transparent 60%)`,
                        mixBlendMode: "screen",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Alt yazı: format standardı.
            Sefa 21 May v68 (sistem denetim #5): "ad/tabaka" rakamına
            tooltip — kullanıcı "230×310'a 12 sığması lazım, 6 nasıl?"
            diye düşünebilir. Margin + gap açıklaması net olsun. */}
        <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gri-700">
          Tabaka · {Math.round(width)}×{Math.round(height)} mm ·{" "}
          {isCapped ? "≈" : ""}
          <span
            className="text-pim-mercan cursor-help"
            title="Tabaka 230×310 mm, kenar boşluğu 10 mm + sticker arası boşluk 3 mm hesaba dahil. Üretim toleransı için zorunlu."
          >
            {realPerSheet}
          </span>{" "}
          ad/tabaka
        </span>
      </div>
    </div>
  );
}
