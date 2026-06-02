/**
 * Sticker pricing — geometri optimizasyon (saf fonksiyon).
 *
 * İki ayrı akış (Sefa onaylı):
 *   - tabaka (kiss-cut): esnek iç tabaka 23×31 cm max, kullanılabilir 21×29, gap 3mm
 *   - diecut: sticker doğrudan plotter rulosuna, gap 20mm, iç tabaka yok
 *
 * Saf fonksiyon. DB / I/O yok.
 */

import {
  GAP_DIECUT,
  GAP_TABAKA,
  OVERAGE_TARGET_MAX,
  ROLL_L,
  ROLL_MARGIN_X,
  ROLL_START_MARGIN,
  ROLL_END_MARGIN,
  ROLL_W_MAX,
  ROLL_W_MIN,
  TABAKA_EDGE_MARGIN,
  TABAKA_OUTER_MAX_H,
  TABAKA_OUTER_MAX_W,
  TABAKA_USABLE_H,
  TABAKA_USABLE_W,
  snapSizeUp,
} from "./constants";

// ============================================================
// Types
// ============================================================

export type CutType = "tabaka" | "diecut";
export type SheetMode = "tabaka" | "diecut";

export interface SheetFit {
  mode: SheetMode;
  rotated: boolean;
  stickerW: number;
  stickerH: number;
  cols: number;
  rows: number;
  perSheet: number;
  /** Dış tabaka boyutu (tabaka akışı) veya sticker grid birimi (die-cut viz) */
  sheetW: number;
  sheetH: number;
  usedW: number;
  usedH: number;
  gap: number;
  /** Tabaka sığmadığında die-cut'a düşüldü */
  forcedDieCut: boolean;
  sheetsNeeded: number;
  producedQty: number;
  overrun: number;
}

export interface RollPlan {
  rollW: number;
  cols: number;
  rows: number;
  sheetsPerRoll: number;
  rollsNeeded: number;
  sheetsOnLastRoll: number;
  lastRowsCount: number;
  lastRollLengthMm: number;
  totalLengthMm: number;
  totalArea: number;
  usableW: number;
  usableL: number;
  extraSidePad: number;
}

export interface GeometryResult {
  fit: SheetFit;
  roll: RollPlan;
  totalM2: number;
  sheetAreaM2: number;
  stickerArea: number;
  wastePct: number;
  effectiveCut: CutType;
}

interface LayoutCandidate {
  fit: SheetFit;
  roll: RollPlan;
  totalM2: number;
  overage: number;
}

// ============================================================
// Yardımcılar
// ============================================================

function overageRatio(producedQty: number, targetQty: number): number {
  if (targetQty <= 0) return 0;
  return producedQty / targetQty - 1;
}

/** Geçerli adaylar içinde min alan; overage ≤ hedef olanlar öncelikli. */
function pickBestCandidate(candidates: LayoutCandidate[]): LayoutCandidate | null {
  if (candidates.length === 0) return null;

  const withinTarget = candidates.filter(
    (c) => c.overage <= OVERAGE_TARGET_MAX + 1e-9
  );
  const pool = withinTarget.length > 0 ? withinTarget : candidates;

  return pool.reduce<LayoutCandidate | null>((best, c) => {
    if (!best) return c;
    if (withinTarget.length > 0) {
      if (c.totalM2 < best.totalM2 - 1e-9) return c;
      if (
        Math.abs(c.totalM2 - best.totalM2) <= 1e-9 &&
        c.overage < best.overage - 1e-9
      ) {
        return c;
      }
      return best;
    }
    if (c.overage < best.overage - 1e-9) return c;
    if (
      Math.abs(c.overage - best.overage) <= 1e-9 &&
      c.totalM2 < best.totalM2 - 1e-9
    ) {
      return c;
    }
    return best;
  }, null);
}

function stickerFitsTabakaUsable(sw: number, sh: number): boolean {
  return sw <= TABAKA_USABLE_W && sh <= TABAKA_USABLE_H;
}

// ============================================================
// computeRollPlan — tabakalar plotter rulosuna dizilir
// ============================================================

export function computeRollPlan(
  sheetW: number,
  sheetH: number,
  sheetsNeeded: number
): RollPlan | null {
  const usableMaxW = ROLL_W_MAX - 2 * ROLL_MARGIN_X;
  const usableMaxL = ROLL_L - ROLL_START_MARGIN - ROLL_END_MARGIN;

  if (sheetW > usableMaxW || sheetH > usableMaxL) return null;

  const maxCols = Math.floor(usableMaxW / sheetW);
  if (maxCols < 1) return null;

  let best: RollPlan | null = null;

  for (let cols = 1; cols <= maxCols; cols++) {
    const usedWidth = cols * sheetW;
    let rollW = usedWidth + 2 * ROLL_MARGIN_X;
    if (rollW < ROLL_W_MIN) rollW = ROLL_W_MIN;
    if (rollW > ROLL_W_MAX) continue;

    const maxRowsPerRoll = Math.floor(usableMaxL / sheetH);
    if (maxRowsPerRoll < 1) continue;

    const sheetsPerRoll = cols * maxRowsPerRoll;
    const rollsNeeded = Math.ceil(sheetsNeeded / sheetsPerRoll);
    const sheetsOnLastRoll =
      sheetsNeeded - (rollsNeeded - 1) * sheetsPerRoll;

    const lastRowsCount = Math.ceil(sheetsOnLastRoll / cols);
    const fullRollLengthMm =
      ROLL_START_MARGIN + maxRowsPerRoll * sheetH + ROLL_END_MARGIN;
    const lastRollLengthMm =
      ROLL_START_MARGIN + lastRowsCount * sheetH + ROLL_END_MARGIN;

    const fullRolls = rollsNeeded - 1;
    const totalLengthMm = fullRolls * fullRollLengthMm + lastRollLengthMm;
    const totalArea = rollW * totalLengthMm;

    const candidate: RollPlan = {
      rollW,
      cols,
      rows: maxRowsPerRoll,
      sheetsPerRoll,
      rollsNeeded,
      sheetsOnLastRoll,
      lastRowsCount,
      lastRollLengthMm,
      totalLengthMm,
      totalArea,
      usableW: usedWidth,
      usableL: usableMaxL,
      extraSidePad: (rollW - usedWidth - 2 * ROLL_MARGIN_X) / 2,
    };

    if (!best || candidate.totalArea < best.totalArea) {
      best = candidate;
    }
  }

  return best;
}

// ============================================================
// Tabaka akışı — esnek iç tabaka
// ============================================================

function buildTabakaCandidates(
  W: number,
  H: number,
  targetQty: number
): LayoutCandidate[] {
  const candidates: LayoutCandidate[] = [];
  const gap = GAP_TABAKA;

  for (const rotated of [false, true]) {
    const sw = rotated ? H : W;
    const sh = rotated ? W : H;
    if (!stickerFitsTabakaUsable(sw, sh)) continue;

    const maxCols = Math.floor((TABAKA_USABLE_W + gap) / (sw + gap));
    const maxRows = Math.floor((TABAKA_USABLE_H + gap) / (sh + gap));

    for (let cols = 1; cols <= maxCols; cols++) {
      const usedW = cols * sw + (cols - 1) * gap;
      if (usedW > TABAKA_USABLE_W) break;

      for (let rows = 1; rows <= maxRows; rows++) {
        const usedH = rows * sh + (rows - 1) * gap;
        if (usedH > TABAKA_USABLE_H) break;

        const outerW = usedW + 2 * TABAKA_EDGE_MARGIN;
        const outerH = usedH + 2 * TABAKA_EDGE_MARGIN;
        if (outerW > TABAKA_OUTER_MAX_W || outerH > TABAKA_OUTER_MAX_H) continue;

        const perTabaka = cols * rows;
        const tabakasNeeded = Math.ceil(targetQty / perTabaka);
        const producedQty = tabakasNeeded * perTabaka;

        const roll = computeRollPlan(outerW, outerH, tabakasNeeded);
        if (!roll) continue;

        const totalM2 = roll.totalArea / 1_000_000;
        const fit: SheetFit = {
          mode: "tabaka",
          rotated,
          stickerW: sw,
          stickerH: sh,
          cols,
          rows,
          perSheet: perTabaka,
          sheetW: outerW,
          sheetH: outerH,
          usedW,
          usedH,
          gap,
          forcedDieCut: false,
          sheetsNeeded: tabakasNeeded,
          producedQty,
          overrun: overageRatio(producedQty, targetQty),
        };

        candidates.push({
          fit,
          roll,
          totalM2,
          overage: fit.overrun,
        });
      }
    }
  }

  return candidates;
}

function findOptimalTabakaLayout(
  W: number,
  H: number,
  targetQty: number
): LayoutCandidate | null {
  return pickBestCandidate(buildTabakaCandidates(W, H, targetQty));
}

// ============================================================
// Die-cut akışı — direkt rulo, iç tabaka yok
// ============================================================

function buildDiecutRollPlan(
  sw: number,
  sh: number,
  cols: number,
  rows: number,
  targetQty: number,
  rollW: number,
  rotated: boolean
): LayoutCandidate | null {
  const gap = GAP_DIECUT;
  const usableW = rollW - 2 * ROLL_MARGIN_X;
  const usableL = ROLL_L - ROLL_START_MARGIN - ROLL_END_MARGIN;

  if (cols < 1 || rows < 1) return null;
  if (cols * sw + (cols - 1) * gap > usableW + 1e-9) return null;
  if (rows * sh + (rows - 1) * gap > usableL + 1e-9) return null;

  const perRoll = cols * rows;
  const rollsNeeded = Math.ceil(targetQty / perRoll);
  const producedQty = rollsNeeded * perRoll;
  const stickersOnLastRoll = producedQty - (rollsNeeded - 1) * perRoll;
  const lastRowsCount = Math.ceil(stickersOnLastRoll / cols);
  const fullRollLengthMm =
    ROLL_START_MARGIN +
    rows * sh +
    (rows - 1) * gap +
    ROLL_END_MARGIN;
  const lastRollLengthMm =
    ROLL_START_MARGIN +
    lastRowsCount * sh +
    (lastRowsCount - 1) * gap +
    ROLL_END_MARGIN;

  const fullRolls = rollsNeeded - 1;
  const totalLengthMm = fullRolls * fullRollLengthMm + lastRollLengthMm;
  const totalArea = rollW * totalLengthMm;
  const usedWidth = cols * sw + (cols - 1) * gap;

  const roll: RollPlan = {
    rollW,
    cols,
    rows,
    sheetsPerRoll: perRoll,
    rollsNeeded,
    sheetsOnLastRoll: stickersOnLastRoll,
    lastRowsCount,
    lastRollLengthMm,
    totalLengthMm,
    totalArea,
    usableW: usedWidth,
    usableL: usableL,
    extraSidePad: Math.max(0, (rollW - usedWidth - 2 * ROLL_MARGIN_X) / 2),
  };

  const fit: SheetFit = {
    mode: "diecut",
    rotated,
    stickerW: sw,
    stickerH: sh,
    cols,
    rows,
    perSheet: perRoll,
    sheetW: sw,
    sheetH: sh,
    usedW: usedWidth,
    usedH: rows * sh + (rows - 1) * gap,
    gap,
    forcedDieCut: false,
    sheetsNeeded: rollsNeeded,
    producedQty,
    overrun: overageRatio(producedQty, targetQty),
  };

  return {
    fit,
    roll,
    totalM2: totalArea / 1_000_000,
    overage: fit.overrun,
  };
}

function buildDiecutCandidates(
  W: number,
  H: number,
  targetQty: number,
  forcedDieCut: boolean
): LayoutCandidate[] {
  const candidates: LayoutCandidate[] = [];
  const gap = GAP_DIECUT;

  for (const rotated of [false, true]) {
    const sw = rotated ? H : W;
    const sh = rotated ? W : H;

    for (let rollW = ROLL_W_MIN; rollW <= ROLL_W_MAX; rollW += 10) {
      const usableW = rollW - 2 * ROLL_MARGIN_X;
      const usableL = ROLL_L - ROLL_START_MARGIN - ROLL_END_MARGIN;

      const maxCols = Math.floor((usableW + gap) / (sw + gap));
      const maxRows = Math.floor((usableL + gap) / (sh + gap));
      if (maxCols < 1 || maxRows < 1) continue;

      for (let cols = 1; cols <= maxCols; cols++) {
        for (let rows = 1; rows <= maxRows; rows++) {
          const candidate = buildDiecutRollPlan(
            sw,
            sh,
            cols,
            rows,
            targetQty,
            rollW,
            rotated
          );
          if (!candidate) continue;
          candidate.fit.forcedDieCut = forcedDieCut;
          candidates.push(candidate);
        }
      }
    }
  }

  return candidates;
}

function findOptimalDiecutLayout(
  W: number,
  H: number,
  targetQty: number,
  forcedDieCut = false
): LayoutCandidate | null {
  return pickBestCandidate(
    buildDiecutCandidates(W, H, targetQty, forcedDieCut)
  );
}

// ============================================================
// findOptimalSheet — geriye uyum export
// ============================================================

interface FindOptimalArgs {
  width: number;
  height: number;
  requestedCut: CutType;
  targetQty: number;
}

export function findOptimalSheet(args: FindOptimalArgs): SheetFit | null {
  const layout = computeLayout({
    width: args.width,
    height: args.height,
    cut: args.requestedCut,
    qty: args.targetQty,
  });
  return layout?.fit ?? null;
}

function computeLayout(args: {
  width: number;
  height: number;
  cut: CutType;
  qty: number;
}): LayoutCandidate | null {
  const { width: W, height: H, cut, qty } = args;

  if (cut === "tabaka") {
    const tabaka = findOptimalTabakaLayout(W, H, qty);
    if (tabaka) return tabaka;

    const canFitUsable =
      stickerFitsTabakaUsable(W, H) || stickerFitsTabakaUsable(H, W);
    if (!canFitUsable) {
      return findOptimalDiecutLayout(W, H, qty, true);
    }
    return null;
  }

  return findOptimalDiecutLayout(W, H, qty, false);
}

// ============================================================
// computeGeometry
// ============================================================

export function computeGeometry(args: {
  width: number;
  height: number;
  cut: CutType;
  qty: number;
}): GeometryResult | null {
  const snapW = snapSizeUp(args.width);
  const snapH = snapSizeUp(args.height);

  const layout = computeLayout({
    width: snapW,
    height: snapH,
    cut: args.cut,
    qty: args.qty,
  });

  if (!layout) return null;

  const { fit, roll, totalM2 } = layout;
  const sheetAreaM2 =
    fit.mode === "tabaka"
      ? (fit.sheetW * fit.sheetH * fit.sheetsNeeded) / 1_000_000
      : 0;
  const stickerArea = (snapW * snapH * fit.producedQty) / 1_000_000;
  const wastePct =
    totalM2 > 0 ? ((totalM2 - stickerArea) / totalM2) * 100 : 0;

  const effectiveCut: CutType =
    fit.mode === "diecut" || fit.forcedDieCut ? "diecut" : args.cut;

  return {
    fit,
    roll,
    totalM2,
    sheetAreaM2,
    stickerArea,
    wastePct,
    effectiveCut,
  };
}
