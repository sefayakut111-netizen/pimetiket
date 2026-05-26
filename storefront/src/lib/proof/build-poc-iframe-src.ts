/** POC iframe src — same-origin design-file proxy (signed URL query truncation fix). */

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
    mode: "contour",
    autoSave: args.autoSave ? "1" : "0",
    orderId: args.orderId,
    itemId: args.itemId,
  });
  if (args.designFileId) params.set("designFileId", args.designFileId);
  return `/poc.html?${params.toString()}`;
}
