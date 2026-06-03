/** POC iframe src — same-origin design-file proxy (signed URL query truncation fix). */

import type { PocCutlineMode } from "@/lib/proof/shape-to-poc-mode";

export function mapConfiguratorMaterial(m: unknown): string {
  if (typeof m !== "string") return "paper";
  const k = m.toLowerCase();
  if (k === "transparan" || k === "transparent") return "transparent";
  if (k === "holo" || k === "holographic") return "holographic";
  if (k === "simli" || k === "metallic") return "metallic";
  return "paper";
}

export function buildPocIframeSrc(args: {
  orderId: string;
  itemId: string;
  fileName: string;
  mimeType: string;
  material: string;
  designFileId?: string | null;
  autoSave?: boolean;
  /** Müşteri editörü: upload gizle, malzeme kilitle, DPI gizle */
  editorMode?: boolean;
  /** Sipariş satırından satın alınan baskı boyutu (mm) */
  orderWidthMm?: number;
  orderHeightMm?: number;
  /** Partner/üretim: indirme paneli görünür */
  partnerMode?: boolean;
  /** POC bıçak modu — verilmezse contour (silüet) */
  mode?: PocCutlineMode;
  origin: string;
}): string {
  const dfQs = args.designFileId
    ? `?design_file_id=${args.designFileId}`
    : "";
  const designUrl = `${args.origin}/api/orders/${args.orderId}/items/${args.itemId}/design-file${dfQs}`;

  const params = new URLSearchParams({
    embed: "1",
    designUrl,
    designName: args.fileName,
    designMime: args.mimeType,
    material: args.material,
    mode: args.mode ?? "contour",
    autoSave: args.autoSave ? "1" : "0",
    orderId: args.orderId,
    itemId: args.itemId,
  });
  if (args.designFileId) params.set("designFileId", args.designFileId);
  if (args.editorMode) {
    params.set("hideUpload", "1");
    params.set("lockMaterial", "1");
    params.set("hideDpi", "1");
  }
  if (args.orderWidthMm != null && args.orderWidthMm > 0) {
    params.set("orderWidthMm", String(args.orderWidthMm));
  }
  if (args.orderHeightMm != null && args.orderHeightMm > 0) {
    params.set("orderHeightMm", String(args.orderHeightMm));
  }
  if (args.partnerMode) {
    params.set("partnerMode", "1");
  }
  return `/poc.html?${params.toString()}`;
}
