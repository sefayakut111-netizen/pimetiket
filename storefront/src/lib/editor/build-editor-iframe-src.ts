/** POC iframe src — pre-order standalone editör (upload iframe içinde). */

export function buildEditorIframeSrc(args?: {
  material?: string;
  mode?: "contour" | "hull" | "rect" | "circle";
}): string {
  const p = new URLSearchParams({
    embed: "1",
    standalone: "1",
    mode: args?.mode ?? "contour",
  });
  if (args?.material) {
    p.set("material", args.material);
  }
  return `/poc.html?${p.toString()}`;
}
