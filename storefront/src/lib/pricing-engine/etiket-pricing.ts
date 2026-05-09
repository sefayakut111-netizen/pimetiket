/**
 * Etiket pricing — rulo etiket için ayrı geometri + cost wrapper.
 *
 * Sticker'dan farkları:
 *   - Tabaka YOK — etiketler doğrudan rulo halinde teslim
 *   - Min 1000 adet (sticker 25)
 *   - Max 50000 adet (sticker 1000)
 *   - Tier'lar: 1K/2K/5K/10K/20K/50K (ETIKET_TIERS)
 *   - Malzeme + Kaplama + Özelleştirme: % multiplier'lar fason
 *     rate'e bindirilir (Sefa: özelleştirme % olarak ana ürüne ek)
 *   - Big mode YOK (her zaman rulo, die-cut)
 *
 * Cost engine'i (computeCost) reuse edilir — synthetic GeometryResult
 * adapter ile besleme yapılır.
 */

import {
  ROLL_L,
  ROLL_MARGIN_X,
  ROLL_MARGIN_Y,
  ROLL_W_MAX,
  ROLL_W_MIN,
  ETIKET_GAP_DEFAULT,
  ETIKET_TIERS,
  ETIKET_MATERIALS,
  ETIKET_COATINGS,
  ETIKET_CUSTOMIZATIONS,
  type EtiketTier,
} from "./constants";
import type { GeometryResult, CutType } from "./geometry";
import {
  computeCost,
  type CostResult,
  type ProductionRates,
  type OperationRates,
  type MarginConfig,
} from "./cost";
import type { StickerTier } from "./constants";

// ============================================================
// Types
// ============================================================

export interface EtiketGeometry {
  /** Rulo enine yan yana etiket sayısı */
  cols: number;
  /** Tek rulonun max etiket adedi (cols × rows) */
  perRoll: number;
  /** Tek rulonun max satır sayısı (boyutsal sınır) */
  rowsPerRoll: number;
  /** Gereken toplam rulo sayısı */
  rollsNeeded: number;
  /** Son rulodaki etiket sayısı */
  etiketsOnLastRoll: number;
  /** Son rulodaki kullanılan satır sayısı */
  lastRowsCount: number;
  /** Son rulonun kullanılan boyu (mm) */
  lastRollLengthMm: number;
  /** Tüm ruloların toplam uzunluğu (mm) */
  totalLengthMm: number;
  /** Algoritmanın seçtiği dinamik rulo eni (mm) */
  rollW: number;
  /** Toplam alan m² (fire dahil) */
  totalM2: number;
  /** Etiketlerin kapladığı net alan m² */
  etiketArea: number;
  /** Fire % */
  wastePct: number;
  /** Kullanılan gap (mm) */
  gap: number;
  /** Etiket boyutu (input) */
  width: number;
  height: number;
  /** Talep edilen adet */
  qty: number;
}

export interface EtiketQuoteInput {
  width: number; // mm
  height: number; // mm
  qty: number;
  /** Malzeme id (ETIKET_MATERIALS'tan) */
  materialId: string;
  /** Kaplama id */
  coatingId: string;
  /** Özelleştirme id */
  customizationId: string;
  /** Üretim modu — fason ya da kendi üretim */
  production: ProductionRates;
  operation: OperationRates;
  margin: MarginConfig;
  gap?: number;
}

export type EtiketQuoteResult =
  | {
      ok: true;
      geometry: EtiketGeometry;
      cost: CostResult;
      effectiveRate: number;
      multipliers: {
        material: number;
        coating: number;
        customization: number;
      };
    }
  | {
      ok: false;
      reason: string;
    };

// ============================================================
// Geometry
// ============================================================

/**
 * Etiket rulo geometrisi — tabaka YOK, doğrudan rulo planı.
 *
 * Algoritma:
 *   - cols=1..maxCols için her seçenek dener
 *   - rolloW = cols × etiketW + 80mm (margin)
 *   - rolloMin'in altına düşmesin (250mm)
 *   - Her rulonun maxRowsPerRoll = floor((1470 + gap) / (height + gap))
 *   - perRoll = cols × maxRowsPerRoll
 *   - Toplam alan minimize → fire min
 */
export function computeEtiketGeometry(
  width: number,
  height: number,
  qty: number,
  gap: number = ETIKET_GAP_DEFAULT
): EtiketGeometry | null {
  const usableMaxW = ROLL_W_MAX - 2 * ROLL_MARGIN_X; // 520
  const usableMaxL = ROLL_L - ROLL_MARGIN_Y; // 1470

  if (width > usableMaxW) return null;
  if (height > usableMaxL) return null;
  if (qty < 1) return null;

  // Maksimum yan yana etiket
  const maxCols = Math.floor((usableMaxW + gap) / (width + gap));
  if (maxCols < 1) return null;

  let best: EtiketGeometry | null = null;

  for (let cols = 1; cols <= maxCols; cols++) {
    const usedWidth = cols * width + (cols - 1) * gap;
    let rollW = usedWidth + 2 * ROLL_MARGIN_X;
    if (rollW < ROLL_W_MIN) rollW = ROLL_W_MIN;
    if (rollW > ROLL_W_MAX) continue;

    const maxRowsPerRoll = Math.floor((usableMaxL + gap) / (height + gap));
    if (maxRowsPerRoll < 1) continue;

    const perRoll = cols * maxRowsPerRoll;
    const rollsNeeded = Math.ceil(qty / perRoll);
    const etiketsOnLastRoll = qty - (rollsNeeded - 1) * perRoll;
    const lastRowsCount = Math.ceil(etiketsOnLastRoll / cols);
    const lastRollLengthMm =
      ROLL_MARGIN_Y +
      lastRowsCount * height +
      Math.max(lastRowsCount - 1, 0) * gap;
    const totalLengthMm =
      (rollsNeeded - 1) * ROLL_L + lastRollLengthMm;
    const totalArea = rollW * totalLengthMm;
    const totalM2 = totalArea / 1_000_000;
    const etiketArea = (width * height * qty) / 1_000_000;
    const wastePct =
      totalM2 > 0 ? ((totalM2 - etiketArea) / totalM2) * 100 : 0;

    const candidate: EtiketGeometry = {
      cols,
      perRoll,
      rowsPerRoll: maxRowsPerRoll,
      rollsNeeded,
      etiketsOnLastRoll,
      lastRowsCount,
      lastRollLengthMm,
      totalLengthMm,
      rollW,
      totalM2,
      etiketArea,
      wastePct,
      gap,
      width,
      height,
      qty,
    };

    if (!best || candidate.totalM2 < best.totalM2) {
      best = candidate;
    }
  }

  return best;
}

// ============================================================
// Tier finder
// ============================================================

export function findEtiketTier(qty: number): EtiketTier {
  const exact = ETIKET_TIERS.find((t) => t.qty === qty);
  if (exact) return exact;

  let closest = ETIKET_TIERS[0];
  let minDistance = Math.abs(qty - closest.qty);

  for (const t of ETIKET_TIERS) {
    const d = Math.abs(qty - t.qty);
    if (d < minDistance) {
      minDistance = d;
      closest = t;
    }
  }

  return closest;
}

// ============================================================
// Cost adapter — etiket geometry → cost engine
// ============================================================

/**
 * EtiketGeometry'i sticker engine'in beklediği GeometryResult'a çevirir.
 * Cost engine değiştirilmeden reuse edilir.
 */
export function adaptEtiketToGeometryResult(
  g: EtiketGeometry
): GeometryResult {
  // Etiket için "tabaka" konsepti = "rulo".
  // perSheet = perRoll, sheetsNeeded = rollsNeeded
  return {
    fit: {
      mode: "small", // big-mode davranışı yok (paketleme×2 vs)
      cols: g.cols,
      rows: g.rowsPerRoll,
      perSheet: g.perRoll,
      sheetsNeeded: g.rollsNeeded,
      sheetW: g.rollW,
      sheetH:
        g.rollsNeeded > 0
          ? g.totalLengthMm / g.rollsNeeded
          : g.lastRollLengthMm,
      stickerW: g.width,
      stickerH: g.height,
      usedW: g.cols * g.width + (g.cols - 1) * g.gap,
      usedH: g.rowsPerRoll * g.height + (g.rowsPerRoll - 1) * g.gap,
      gap: g.gap,
      rotated: false,
      forcedDieCut: false,
      producedQty: g.qty,
      overrun: 0, // etikette tolerans politikası farklı — exact qty üretilir
    },
    roll: {
      rollW: g.rollW,
      cols: g.cols,
      rows: g.rowsPerRoll,
      sheetsPerRoll: g.perRoll,
      rollsNeeded: g.rollsNeeded,
      sheetsOnLastRoll: g.etiketsOnLastRoll,
      lastRowsCount: g.lastRowsCount,
      lastRollLengthMm: g.lastRollLengthMm,
      totalLengthMm: g.totalLengthMm,
      totalArea: g.totalM2 * 1_000_000,
      usableW: g.cols * g.width,
      usableL: ROLL_L - ROLL_MARGIN_Y,
      extraSidePad: (g.rollW - g.cols * g.width - 2 * ROLL_MARGIN_X) / 2,
    },
    totalM2: g.totalM2,
    stickerArea: g.etiketArea,
    wastePct: g.wastePct,
    effectiveCut: "diecut" as CutType,
  };
}

/**
 * Material + coating + customization → fason rate multiplier.
 */
function applyEtiketMultipliers(
  baseRate: number,
  materialId: string,
  coatingId: string,
  customizationId: string
): {
  effectiveRate: number;
  multipliers: { material: number; coating: number; customization: number };
} {
  const mat = ETIKET_MATERIALS.find((m) => m.id === materialId);
  const coat = ETIKET_COATINGS.find((c) => c.id === coatingId);
  const cust = ETIKET_CUSTOMIZATIONS.find((c) => c.id === customizationId);

  const matMult = mat?.multiplier ?? 1;
  const coatMult = coat?.multiplier ?? 1;
  const custMult = cust?.multiplier ?? 1;

  return {
    effectiveRate: baseRate * matMult * coatMult * custMult,
    multipliers: {
      material: matMult,
      coating: coatMult,
      customization: custMult,
    },
  };
}

// ============================================================
// Quote
// ============================================================

export function quoteEtiket(input: EtiketQuoteInput): EtiketQuoteResult {
  if (input.qty < 1) {
    return { ok: false, reason: "Geçerli adet gir" };
  }
  if (input.width < 5 || input.height < 5) {
    return { ok: false, reason: "Geçerli boyut gir (min 5×5 mm)" };
  }

  const g = computeEtiketGeometry(
    input.width,
    input.height,
    input.qty,
    input.gap ?? ETIKET_GAP_DEFAULT
  );
  if (!g) {
    return {
      ok: false,
      reason: "Bu boyut rulo planına yerleştirilemedi (max 520×1470 mm)",
    };
  }

  // Multipliers'ı production rate'ine bindir
  let effectiveRate: number;
  let multipliers = { material: 1, coating: 1, customization: 1 };

  let adjustedProduction: ProductionRates = input.production;

  if (input.production.mode === "fason") {
    const applied = applyEtiketMultipliers(
      input.production.rate,
      input.materialId,
      input.coatingId,
      input.customizationId
    );
    effectiveRate = applied.effectiveRate;
    multipliers = applied.multipliers;
    adjustedProduction = { mode: "fason", rate: effectiveRate };
  } else {
    // Üretim mode: multiplier'ı tüm 6 kaleme ortalama uygula
    const applied = applyEtiketMultipliers(
      1,
      input.materialId,
      input.coatingId,
      input.customizationId
    );
    multipliers = applied.multipliers;
    const totalMult = applied.effectiveRate;
    effectiveRate =
      (input.production.paper +
        input.production.ink +
        input.production.coating +
        input.production.labor +
        input.production.overhead +
        input.production.depreciation) *
      totalMult;
    adjustedProduction = {
      mode: "uretim",
      paper: input.production.paper * totalMult,
      ink: input.production.ink * totalMult,
      coating: input.production.coating * totalMult,
      labor: input.production.labor * totalMult,
      overhead: input.production.overhead * totalMult,
      depreciation: input.production.depreciation * totalMult,
    };
  }

  // Synthetic GeometryResult ile cost engine'i çağır
  const geometryAdapter = adaptEtiketToGeometryResult(g);
  const tier = findEtiketTier(input.qty);

  // Etiket tier'ı StickerTier yapısına benzer (qty/multiplier/label)
  const tierAsSticker: StickerTier = {
    qty: tier.qty,
    multiplier: tier.multiplier,
    label: tier.label,
  };

  const cost = computeCost({
    geometry: geometryAdapter,
    requestedQty: input.qty,
    production: adjustedProduction,
    operation: input.operation,
    margin: input.margin,
    tier: tierAsSticker,
  });

  return {
    ok: true,
    geometry: g,
    cost,
    effectiveRate,
    multipliers,
  };
}
