/**
 * Partner Price Book — pure interpolation helpers.
 */

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface AxisBracket {
  low: number;
  high: number;
  t: number;
  clamped_low: boolean;
  clamped_high: boolean;
}

/**
 * value icin [low, high] bracket + t bul.
 * Grid disi alt: low=high=min, t=0, clamped_low.
 * Grid disi ust: low=high=max, t=0, clamped_high.
 */
export function findAxisBracket(
  value: number,
  axis: number[],
  options?: { clamp_low?: boolean; clamp_high?: boolean }
): AxisBracket | null {
  if (axis.length === 0) return null;
  const sorted = [...axis].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const clampLow = options?.clamp_low ?? true;
  const clampHigh = options?.clamp_high ?? false;

  if (value <= min) {
    return {
      low: min,
      high: min,
      t: 0,
      clamped_low: value < min || clampLow,
      clamped_high: false,
    };
  }
  if (value >= max) {
    return {
      low: max,
      high: max,
      t: 0,
      clamped_low: false,
      clamped_high: value > max || clampHigh,
    };
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const low = sorted[i];
    const high = sorted[i + 1];
    if (value >= low && value <= high) {
      const t = high === low ? 0 : (value - low) / (high - low);
      return { low, high, t, clamped_low: false, clamped_high: false };
    }
  }

  return { low: max, high: max, t: 0, clamped_low: false, clamped_high: true };
}

/** W x H duzleminde bilinear interpolasyon */
export function bilinearWH(
  w: number,
  h: number,
  w0: number,
  w1: number,
  h0: number,
  h1: number,
  c00: number,
  c10: number,
  c01: number,
  c11: number
): { value: number; t_w: number; t_h: number } {
  const t_w = w1 === w0 ? 0 : (w - w0) / (w1 - w0);
  const t_h = h1 === h0 ? 0 : (h - h0) / (h1 - h0);
  const top = lerp(c00, c10, t_w);
  const bottom = lerp(c01, c11, t_w);
  return { value: lerp(top, bottom, t_h), t_w, t_h };
}
