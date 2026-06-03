export type PocCutlineMode = "contour" | "rect" | "circle" | "hull";

/** Seçilen şekil → POC bıçak modu. Bilinmeyen/özel → contour (silüet, güvenli default). */
export function shapeToPocMode(
  shape?: string | null,
  _cut?: string | null
): PocCutlineMode {
  switch ((shape ?? "").toLowerCase()) {
    case "circle":
      return "circle";
    case "square":
    case "rectangle":
    case "bumper":
      return "rect";
    default:
      return "contour";
  }
}
