/**
 * EtiketLivePreview — Etiket konfigüratörünün ÜRÜN simülasyonu.
 *
 * Sefa kuralı (18 May v67): Müşteri ne seçtiyse, ortada o ürün
 * görselleşir. Karga maskotu default placeholder (tasarım yokken).
 *
 * Form factor mantığı:
 *   - rulo:    tek etiket merkezde + alt-üst kenarlarda kesim hint
 *              (rulo şeritinden kopmuş gibi)
 *   - tabaka:  4 veya 6 etiketlik grid, aralarında kesim çizgileri
 *
 * State yansıması:
 *   - Boyut       → gerçek oranlı (60×80 mm vs 30×150 mm farklı görünür)
 *   - Malzeme     → zemin SVG (kuşe → kuse.svg, kraft → kraft.svg, vb.)
 *   - Kaplama     → glossy/mat sheen overlay
 *   - Özelleştirme → yaldız/emboss/spotuv katmanı (overlay)
 *   - Tasarım     → varsa: tasarım göster; yoksa: karga maskot placeholder
 *   - View 3D     → perspective(1200px) rotateX(8deg) hafif öne yatık
 *   - View Flat   → düz, hiç eğim yok
 *
 * Çoklu özellik desteği: customs array — yaldız + spot UV birlikte gibi
 * kombinasyonlar overlay sırasıyla render edilir.
 */

"use client";

import { MaterialSwatch, type SurfaceId } from "@/components/ui";
import { MaskotPlaceholder } from "./MaskotPlaceholder";
import type { PreviewView } from "./ProductPreviewShell";
import type {
  EtiketMaterialId,
  EtiketCoatingId,
  EtiketCustomId,
} from "@/lib/etiket-customer-pricing";

/** Etiket malzeme → SVG surface mapping */
const ETIKET_SURFACE: Record<EtiketMaterialId, SurfaceId> = {
  kuse: "kuse",
  kraft: "kraft",
  beyaz: "opakpp",
  seffaf: "transparan",
  ultra: "ultraclear",
  metalik: "metalik",
};

/** Kaplama → glossy sheen yoğunluğu (0..1) */
const COATING_SHEEN: Record<EtiketCoatingId, number> = {
  parlak: 0.42,
  mat: 0.04,
  soft: 0.08,
  yok: 0.16,
};

/** Hangi malzemede karga "light" tema (krem mark) ister, hangileri "dark" */
const MATERIAL_IS_DARK: Partial<Record<EtiketMaterialId, boolean>> = {
  kraft: true, // kraft zemin koyu → açık mark gerek
};

/** Yaldız renk gradient'leri (overlay için) */
const YALDIZ_OVERLAY: Record<string, string> = {
  altin: "linear-gradient(135deg,#FFE08A 0%, #C99A3D 100%)",
  gulkurusu: "linear-gradient(135deg,#FFD3CB 0%, #C97862 100%)",
  gumus: "linear-gradient(135deg,#E5E9EE 0%, #9BA4AD 100%)",
  bakir: "linear-gradient(135deg,#F0B17A 0%, #A65A2C 100%)",
  siyahkrom: "linear-gradient(135deg,#4A4F55 0%, #11141A 100%)",
  yesil: "linear-gradient(135deg,#D6F0D0 0%, #2F6B2F 100%)",
  lacivert: "linear-gradient(135deg,#7B92C6 0%, #1F2A4D 100%)",
  holo: "linear-gradient(135deg,#FFB7E5 0%, #B7E8FF 50%, #FFE8B7 100%)",
};

/** Sefa 21 May v68 (konfigüratör denetim #5): etiket şekli — render'da
 *  yuvarlak/oval/özel kesim için clip-path veya borderRadius uygulanır. */
type EtiketShape =
  | "diecut"
  | "clear"
  | "circle"
  | "square"
  | "rectangle"
  | "oval"
  | "sheet";

interface EtiketLivePreviewProps {
  formFactor: "rulo" | "tabaka";
  /** Sefa 21 May v68: önizleme şekle göre dinamik render — yuvarlak çap
   *  100% borderRadius, oval ellipse, kare/dikdörtgen düz, "Özel kesim"
   *  dashed outline. URL'den shape geliyorsa burada uygulanır. */
  shape?: EtiketShape;
  cornerStyle?: "sharp" | "rounded";
  material: EtiketMaterialId;
  coating: EtiketCoatingId;
  /** Çoklu özelleştirme — yaldız + spot UV kombinasyonu */
  customs: EtiketCustomId[];
  /** Sıcak yaldız rengi (customs içinde "yaldiz" varsa kullanılır) */
  yaldiz: string;
  /** Etiket gerçek ölçüsü (mm) */
  width: number;
  height: number;
  /** 3D / Flat view */
  view: PreviewView;
  /** Müşteri tasarımı (yoksa karga gösterilir) */
  designUrl?: string | null;
  /** Sefa 18 May v67: gerçek pricing geometrisi — tabaka grid'i
   *  bu cols × rows üzerinden çizilir (yoksa fallback 3×2). */
  geometryCols?: number;
  geometryRows?: number;
  geometryPerSheet?: number;
}

export function EtiketLivePreview({
  formFactor,
  shape,
  cornerStyle,
  material,
  coating,
  customs,
  yaldiz,
  width,
  height,
  view,
  designUrl,
  geometryCols,
  geometryRows,
  geometryPerSheet,
}: EtiketLivePreviewProps) {
  const surface = ETIKET_SURFACE[material];
  const sheen = COATING_SHEEN[coating];
  const isDarkMaterial = MATERIAL_IS_DARK[material] === true;
  const isTransparentMaterial = material === "ultra" || material === "seffaf";

  // Sefa 21 May v68 (konfigüratör denetim #5): şekil → preview render
  //   - circle/square: eş kenar zorlanır (width = height)
  //   - oval: width × height korunur ama radius 50% (ellipse)
  //   - rectangle: cornerStyle sharp → 6, rounded → 14
  //   - diecut: tasarımın silüetine kesim — dashed outline
  //   - clear: dikdörtgen + şeffaf checker zaten var
  const effectiveShape: EtiketShape = shape ?? "rectangle";
  const isCircle = effectiveShape === "circle";
  const isOval = effectiveShape === "oval";
  const isSquare = effectiveShape === "square";
  const isDiecut = effectiveShape === "diecut";
  // Square/circle için eş kenar — width/height farklı geldiyse en küçük al
  const renderW = isCircle || isSquare ? Math.min(width, height) : width;
  const renderH = isCircle || isSquare ? Math.min(width, height) : height;
  // Tek etiket boyutu — px cinsinden hedef ölçek
  // Maks 280px hedef, en uzun kenara göre normalize
  const maxDim = Math.max(renderW, renderH);
  const scale = Math.min(280 / maxDim, 4);
  const labelWidthPx = renderW * scale;
  const labelHeightPx = renderH * scale;
  // Şekle göre borderRadius
  const shapeRadius = isCircle
    ? "50%"
    : isOval
      ? "50%"
      : effectiveShape === "rectangle" && cornerStyle === "rounded"
        ? "14px"
        : isSquare && cornerStyle === "rounded"
          ? "10px"
          : "6px";

  // Sefa 18 May v68 (5): View modları
  // - "3d"     → perspective rotateX (yumuşak, gerçekçi)
  // - "sketch" → düz, eskiz/diyagram netliği
  const isSketch = view === "sketch";
  const view3dWrap: React.CSSProperties = isSketch
    ? {}
    : { perspective: "2000px" };
  const view3dInner: React.CSSProperties = isSketch
    ? { transition: "transform 280ms cubic-bezier(.2,.8,.2,1)" }
    : {
        transform: "rotateX(6deg)",
        transformStyle: "preserve-3d",
        transformOrigin: "center center",
        transition: "transform 280ms cubic-bezier(.2,.8,.2,1)",
      };

  const hasYaldiz = customs.includes("yaldiz");
  const hasEmboss = customs.includes("emboss");
  const hasSpotUv = customs.includes("spotuv");

  // ─────────────────────────────────────────────────────────────
  // Tek etiket render helper (rulo + tabaka grid içinde kullanılır)
  // ─────────────────────────────────────────────────────────────
  const renderSingleLabel = (
    key: string | number,
    extraStyle: React.CSSProperties = {}
  ) => (
    <div
      key={key}
      className={
        isSketch
          ? "relative overflow-hidden ring-1 ring-pim-mercan"
          : isDiecut
            ? "relative overflow-hidden ring-2 ring-dashed ring-pim-mercan/60"
            : "relative overflow-hidden ring-1 ring-black/[0.08]"
      }
      style={{
        width: labelWidthPx,
        height: labelHeightPx,
        borderRadius: shapeRadius,
        boxShadow: isSketch
          ? "none"
          : material === "metalik"
            ? "0 6px 16px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(255,255,255,0.6)"
            : "0 4px 12px rgba(0,0,0,0.12)",
        background: isSketch ? "rgba(255, 107, 91, 0.18)" : undefined,
        ...extraStyle,
      }}
    >
      {/* Layer 1 — 3D: Malzeme SVG · Sketch: mercan dolgu (yukarıda) */}
      {!isSketch && (
        <MaterialSwatch
          surface={surface}
          className="absolute inset-0 w-full h-full"
          rounded="md"
        />
      )}

      {/* Layer 2 — Şeffaf checker (3D + transparan) */}
      {!isSketch && isTransparentMaterial && (
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

      {/* Layer 3 — Tasarım veya karga placeholder.
          Sefa 21 May v68 (konfigüratör denetim #5): Eskiz modunda
          showBrand=false (karga + "Pim Etiket" yazısı küçük etikette
          sığmıyor, "Pim Etike" şeklinde kesiliyordu). Sketch modu sade
          karga, 3D modu ise tam markalı. Yuvarlak/oval şekilde sizePct
          küçültülür (radius içinde kalsın). */}
      {designUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={designUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <MaskotPlaceholder
          theme={isDarkMaterial ? "dark" : "light"}
          sizePct={isCircle || isOval ? 56 : 72}
          showBrand={!isSketch}
        />
      )}

      {/* Sefa 18 May v68 (5): Özelleştirme overlay'leri (yaldız, spotuv,
          emboss) ve kaplama sheen sadece 3D modunda görünür. Sketch modu
          temiz diyagram için bu efektleri atlatır. */}

      {/* Layer 4 — Sıcak yaldız overlay (köşe vurgusu) */}
      {!isSketch && hasYaldiz && (
        <div
          aria-hidden
          className="absolute top-1 right-1 w-6 h-6 rounded-full pointer-events-none"
          style={{
            background: YALDIZ_OVERLAY[yaldiz] ?? YALDIZ_OVERLAY.altin,
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* Layer 5 — Spot UV overlay */}
      {!isSketch && hasSpotUv && (
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            top: "20%",
            left: "20%",
            right: "20%",
            bottom: "20%",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 60%)",
            borderRadius: 4,
            mixBlendMode: "overlay",
          }}
        />
      )}

      {/* Layer 6 — Emboss kabartma */}
      {!isSketch && hasEmboss && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow:
              "inset 2px 2px 4px rgba(255,255,255,0.6), inset -2px -2px 4px rgba(0,0,0,0.18)",
            borderRadius: 6,
          }}
        />
      )}

      {/* Layer 7 — Kaplama sheen */}
      {!isSketch && sheen > 0.08 && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(80% 50% at 30% 0%, rgba(255,255,255,${sheen}) 0%, transparent 70%)`,
            mixBlendMode: "screen",
            borderRadius: 6,
          }}
        />
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // RULO MODE — Sefa 18 May v68: standartlaştırma.
  // Sticker'daki sade tek-ürün-merkez pattern'i uygulandı. Üst/alt yarım
  // etiket "şerit hissi" kaldırıldı (preview görsel ağırlığı sticker ile
  // eşit). Sadece minimal kesim çizgileri kaldı.
  // ─────────────────────────────────────────────────────────────
  if (formFactor === "rulo") {
    const stripWidth = labelWidthPx + 24;
    return (
      <div style={view3dWrap} className="relative">
        <div style={view3dInner} className="flex flex-col items-center gap-2">
          {/* Üst kesim ipucu */}
          <div
            aria-hidden
            className="h-2 border-t-2 border-dashed border-gri-300"
            style={{ width: stripWidth }}
          />

          {renderSingleLabel("rulo-label")}

          {/* Alt kesim ipucu */}
          <div
            aria-hidden
            className="h-2 border-b-2 border-dashed border-gri-300"
            style={{ width: stripWidth }}
          />

          {/* Sefa 21 May v68 (konfigüratör denetim #7): yuvarlak/kare
              için tek-boyut format; oval/dikdörtgen iki boyut. */}
          <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gri-700">
            Rulo ·{" "}
            {isCircle
              ? `Ø ${Math.round(renderW)} mm`
              : isSquare
                ? `${Math.round(renderW)}×${Math.round(renderW)} mm`
                : `${Math.round(renderW)}×${Math.round(renderH)} mm`}
          </span>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // TABAKA MODE — Sefa 18 May v67 v2:
  // Pricing engine etiket için "tabaka = rulo" adapter kullanıyor
  // → o yüzden geometryRows = rowsPerRoll (örn 892), tabaka için ANLAMSIZ.
  // Burada YEREL SRA3 hesabı yapıyoruz: 320×450 mm tabaka, 2 mm gap.
  // En iyi rotation (yatay vs döndürülmüş) seçilir, perSheet maksimize.
  // ─────────────────────────────────────────────────────────────
  const TABAKA_W = 320; // SRA3 usable width (mm)
  const TABAKA_H = 450; // SRA3 usable height (mm)
  const TABAKA_GAP = 2; // gap arası boşluk (mm)
  // Yatay yerleşim
  const fitColsA = Math.max(
    1,
    Math.floor((TABAKA_W + TABAKA_GAP) / (width + TABAKA_GAP))
  );
  const fitRowsA = Math.max(
    1,
    Math.floor((TABAKA_H + TABAKA_GAP) / (height + TABAKA_GAP))
  );
  const fitA = fitColsA * fitRowsA;
  // Döndürülmüş yerleşim (90° rotate)
  const fitColsB = Math.max(
    1,
    Math.floor((TABAKA_W + TABAKA_GAP) / (height + TABAKA_GAP))
  );
  const fitRowsB = Math.max(
    1,
    Math.floor((TABAKA_H + TABAKA_GAP) / (width + TABAKA_GAP))
  );
  const fitB = fitColsB * fitRowsB;
  const rotated = fitB > fitA;
  const rawCols = rotated ? fitColsB : fitColsA;
  const rawRows = rotated ? fitRowsB : fitRowsA;
  const realPerSheet = rawCols * rawRows;
  // Not: geometryCols/Rows/PerSheet rulo modu için kullanılıyor (yukarıda).
  // Tabaka için pricing engine "tabaka = rulo" adapter verdiğinden burada
  // YEREL SRA3 hesabı kullanıyoruz. Tutarsızlığı önlemek için tabaka modu
  // pricing geometrisini IGNORE eder.
  // Preview cap — overflow'u önle. Max 6×8 = 48 hücre.
  const displayCols = Math.min(rawCols, 6);
  const displayRows = Math.min(rawRows, 8);
  const isCapped = displayCols < rawCols || displayRows < rawRows;
  // Hücre boyutu — preview 300×320 container hedefli
  const PREVIEW_MAX_W = 300;
  const PREVIEW_MAX_H = 320;
  const GAP_PX = 3;
  // Rotated mod → hücre aspect ratio'su tersine döner
  const aspect = rotated ? height / width : width / height;
  // En uzun kenar limit'i baz al
  const cellByCols = (PREVIEW_MAX_W - GAP_PX * (displayCols - 1)) / displayCols;
  const cellByRows = (PREVIEW_MAX_H - GAP_PX * (displayRows - 1)) / displayRows;
  const cellW = Math.min(cellByCols, cellByRows * aspect);
  const cellH = cellW / aspect;
  // Sefa 18 May v68 (3): Karga artık TÜM hücrelerde (eski merkez 1 cell yerine)
  const totalDisplayCells = displayCols * displayRows;
  const cells = Array.from({ length: totalDisplayCells }, (_, i) => i);

  // Sefa 18 May v68 (8): Etiket tabaka outer artık sticker ile birebir parity.
  // Outer: solid white kağıt + soft shadow + ring-gri-200
  // Üst sol köşe: SRA3 tabaka boyutu (320×450 mm) — bg-krem ile tabaka temasında
  // Inner: dashed gri border (usable print area)
  return (
    <div style={view3dWrap} className="relative">
      <div style={view3dInner} className="flex flex-col items-center gap-2">
        <div
          className="relative rounded-lg bg-white p-3 ring-1 ring-gri-200"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        >
          {/* Üst sol köşe: SRA3 tabaka boyutu etiketi */}
          <span className="absolute -top-2 left-3 px-1.5 text-[9px] font-bold uppercase tracking-[0.06em] text-gri-500 bg-krem tabular-nums">
            {TABAKA_W}×{TABAKA_H} mm
          </span>
          {/* Inner dashed border (tabaka usable area) */}
          <div className="rounded ring-1 ring-dashed ring-gri-400 p-2">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${displayCols}, ${cellW}px)`,
              gridTemplateRows: `repeat(${displayRows}, ${cellH}px)`,
              gap: GAP_PX,
            }}
          >
            {cells.map((i) => (
              <div
                key={i}
                className={
                  isSketch
                    ? "relative overflow-hidden ring-1 ring-pim-mercan"
                    : isDiecut
                      ? "relative overflow-hidden ring-2 ring-dashed ring-pim-mercan/60"
                      : "relative overflow-hidden ring-1 ring-black/[0.08]"
                }
                style={{
                  borderRadius: shapeRadius,
                  boxShadow: isSketch ? "none" : "0 1px 3px rgba(0,0,0,0.08)",
                  background: isSketch
                    ? "rgba(255, 107, 91, 0.18)"
                    : undefined,
                }}
              >
                {!isSketch && (
                  <MaterialSwatch
                    surface={surface}
                    className="absolute inset-0 w-full h-full"
                    rounded="md"
                  />
                )}
                {designUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={designUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <MaskotPlaceholder
                    theme={isDarkMaterial ? "dark" : "light"}
                    sizePct={60}
                    showBrand
                  />
                )}
                {!isSketch && sheen > 0.08 && (
                  <div
                    aria-hidden
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `radial-gradient(80% 50% at 30% 0%, rgba(255,255,255,${sheen}) 0%, transparent 70%)`,
                      mixBlendMode: "screen",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          </div>{/* /inner dashed border */}
        </div>
        {/* Sefa 18 May v68: alt yazı format standardı —
            "TABAKA · 60×80 MM · 84 AD/TABAKA" 3 parça (sticker tabaka ile aynı) */}
        <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gri-700">
          Tabaka · {Math.round(width)}×{Math.round(height)} mm ·{" "}
          {isCapped ? "≈" : ""}
          <span className="text-pim-mercan">{realPerSheet}</span> ad/tabaka
        </span>
      </div>
    </div>
  );
}
