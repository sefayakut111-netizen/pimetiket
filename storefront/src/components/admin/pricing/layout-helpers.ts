/**
 * Pricing visualization — layout helper'ları.
 *
 * sticker-fiyatlama.html v0.3'ten port:
 *   - Üretilen adetin tabakalara DENGELİ dağıtımı (5×18 + 4×20+1×10 değil)
 *   - Son tabakadaki adet (uneven distribution edge case)
 *   - Mini bar: rulo segmentleri (used vs fire vs empty)
 */

import type { GeometryResult } from "@/lib/pricing-engine";

export interface SheetDistribution {
  /** Her tabakada ortak adet (dengeli) */
  balancedPerSheet: number;
  /** Son tabakadaki adet (genelde balancedPerSheet'tan az) */
  lastSheetCount: number;
  /** Dengeli dağıtım yapıldı mı (perSheet kapasitesinin altında mı) */
  isBalanced: boolean;
}

/** Üretilen adet sayısını tabakalara eşit-yakın dağıt. */
export function computeSheetDistribution(
  geometry: GeometryResult
): SheetDistribution {
  const { fit } = geometry;
  const balancedPerSheet = Math.ceil(fit.producedQty / fit.sheetsNeeded);
  const lastSheetCount =
    fit.producedQty - (fit.sheetsNeeded - 1) * balancedPerSheet;
  const isBalanced = balancedPerSheet < fit.perSheet;
  return { balancedPerSheet, lastSheetCount, isBalanced };
}

export interface MiniBarSegment {
  type: "used" | "fire" | "empty";
  /** Bu segment kaç tabaka temsil ediyor */
  count: number;
}

/**
 * Rulo mini bar segmentleri — toplam rulo kapasitesi üzerinden:
 *   - used: dolu tabakalar (mercan)
 *   - fire: son rulodaki boş slotlar (zigzag)
 *   - empty: yeni rulonun kullanılmayan slotları (gri)
 */
export function computeMiniBarSegments(
  geometry: GeometryResult
): MiniBarSegment[] {
  const { fit, roll } = geometry;

  const totalCapacity = roll.rollsNeeded * roll.sheetsPerRoll;
  const used = fit.sheetsNeeded;
  const lastRollSlots = roll.sheetsPerRoll;
  const lastRollUsed = roll.sheetsOnLastRoll;
  const lastRollFire = lastRollSlots - lastRollUsed;
  const otherEmpty = totalCapacity - used - lastRollFire;

  const segs: MiniBarSegment[] = [];
  if (used > 0) segs.push({ type: "used", count: used });
  if (lastRollFire > 0) segs.push({ type: "fire", count: lastRollFire });
  if (otherEmpty > 0) segs.push({ type: "empty", count: otherEmpty });
  return segs;
}
