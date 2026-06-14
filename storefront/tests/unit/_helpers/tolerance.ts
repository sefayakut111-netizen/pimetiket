import { expect } from "vitest";

export function expectWithinPct(
  actual: number,
  expected: number,
  pct: number
): void {
  const delta = Math.abs(expected) * pct;
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(delta);
}

export function expectWithinAbs(
  actual: number,
  expected: number,
  abs: number
): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(abs);
}

/** Runner RECALC_TOLERANCE_PCT=0.02 eşleniği: max(absFloor, expected×pct) */
export function expectWithinBand(
  actual: number,
  expected: number,
  pct: number,
  absFloor = 0.5
): void {
  const band = Math.max(absFloor, Math.abs(expected) * pct);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(band);
}
