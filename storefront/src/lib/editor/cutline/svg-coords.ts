/** Canvas px koordinatında imageTransform uygula (POC getArtDrawRect ile uyumlu) */
export function applyImageTransformCanvasPt(
  px: number,
  py: number,
  args: {
    contentOffsetX: number;
    contentOffsetY: number;
    contentW: number;
    contentH: number;
    transform: { x: number; y: number; scale: number };
  }
): [number, number] {
  const artCx = args.contentOffsetX + args.contentW / 2;
  const artCy = args.contentOffsetY + args.contentH / 2;
  const s = args.transform.scale;
  const tx = args.transform.x;
  const ty = args.transform.y;
  return [artCx + tx + (px - artCx) * s, artCy + ty + (py - artCy) * s];
}

/** Görsel katmanı SVG image attrs — transform canvas'a bake edilmiş */
export function artDrawRectToSvgImageAttrs(args: {
  drawRect: { x: number; y: number; w: number; h: number };
  padding: number;
  inverseScale: number;
}): { x: number; y: number; width: number; height: number } {
  const inv = args.inverseScale;
  const pad = args.padding;
  return {
    x: (args.drawRect.x - pad) * inv,
    y: (args.drawRect.y - pad) * inv,
    width: args.drawRect.w * inv,
    height: args.drawRect.h * inv,
  };
}

/** getArtDrawRect mantığı — saf fonksiyon (regresyon) */
export function computeArtDrawRect(args: {
  contentOffsetX: number;
  contentOffsetY: number;
  contentW: number;
  contentH: number;
  transform: { x: number; y: number; scale: number };
}): { x: number; y: number; w: number; h: number } {
  const w = args.contentW * args.transform.scale;
  const h = args.contentH * args.transform.scale;
  const x =
    args.contentOffsetX +
    args.transform.x -
    (w - args.contentW) / 2;
  const y =
    args.contentOffsetY +
    args.transform.y -
    (h - args.contentH) / 2;
  return { x, y, w, h };
}
