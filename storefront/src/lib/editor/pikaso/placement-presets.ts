import { mmToPx } from "@/lib/editor/coords";

export type PlacementPreset = "center" | "cover" | "contain";

export interface PlacementFrame {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** Label mm çerçevesi — POC getPlacementFrame */
export function labelPlacementFrame(
  labelX: number,
  labelY: number,
  widthMm: number,
  heightMm: number,
  marginMm = 2
): PlacementFrame {
  const w = Math.max(1, widthMm - marginMm * 2);
  const h = Math.max(1, heightMm - marginMm * 2);
  return {
    cx: labelX + mmToPx(widthMm / 2),
    cy: labelY + mmToPx(heightMm / 2),
    w: mmToPx(w),
    h: mmToPx(h),
  };
}

/** Görsel pikaso attrs — preset sonrası x, y, scaleX, scaleY */
export function imageAttrsForPreset(
  preset: PlacementPreset,
  frame: PlacementFrame,
  natW: number,
  natH: number
): { x: number; y: number; scaleX: number; scaleY: number; rotation: number } {
  if (preset === "center") {
    return {
      x: frame.cx - natW / 2,
      y: frame.cy - natH / 2,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    };
  }

  const scale =
    preset === "cover"
      ? Math.max(frame.w / natW, frame.h / natH)
      : Math.min(frame.w / natW, frame.h / natH);

  const wPx = natW * scale;
  const hPx = natH * scale;
  return {
    x: frame.cx - wPx / 2,
    y: frame.cy - hPx / 2,
    scaleX: scale,
    scaleY: scale,
    rotation: 0,
  };
}
