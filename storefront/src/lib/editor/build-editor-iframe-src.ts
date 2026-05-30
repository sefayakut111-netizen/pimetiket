/** POC iframe src — pre-order standalone editör modu. */

export function buildEditorIframeSrc(args: {
  tempDesignId: string;
  fileName: string;
  mimeType: string;
  widthMm?: number;
  heightMm?: number;
  origin: string;
}): string {
  const designUrl = `${args.origin}/api/editor/design-file/${args.tempDesignId}`;
  const p = new URLSearchParams({
    standalone: "1",
    designUrl,
    designName: args.fileName,
    designMime: args.mimeType,
    mode: "contour",
    hideUpload: "0",
  });
  if (args.widthMm != null && args.widthMm > 0) {
    p.set("orderWidthMm", String(args.widthMm));
  }
  if (args.heightMm != null && args.heightMm > 0) {
    p.set("orderHeightMm", String(args.heightMm));
  }
  return `/poc.html?${p.toString()}`;
}
