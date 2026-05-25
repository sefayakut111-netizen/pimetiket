export const PROCESSABLE_TYPES = [
  "image/png",
  "application/pdf",
  "image/svg+xml",
] as const;
export const PROCESSABLE_EXTENSIONS = [
  ".png",
  ".ai",
  ".psd",
  ".pdf",
  ".svg",
] as const;

export const QC_ONLY_TYPES = ["image/jpeg"] as const;
export const QC_ONLY_EXTENSIONS = [".jpg", ".jpeg"] as const;

export const BLOCKED_EXTENSIONS = [".eps"] as const;

export type DesignFileCategory = "processable" | "qc_only" | "blocked";

export function categorizeFile(
  fileName: string,
  mimeType?: string
): DesignFileCategory {
  void mimeType;
  const dot = fileName.lastIndexOf(".");
  const ext = dot === -1 ? "" : fileName.toLowerCase().slice(dot);
  if ((BLOCKED_EXTENSIONS as readonly string[]).includes(ext)) return "blocked";
  if ((QC_ONLY_EXTENSIONS as readonly string[]).includes(ext)) return "qc_only";
  if ((PROCESSABLE_EXTENSIONS as readonly string[]).includes(ext))
    return "processable";
  // AI ve PSD'nin MIME'ı güvenilmez, extension'a bak
  if (ext === ".ai" || ext === ".psd") return "processable";
  return "blocked"; // bilinmeyen → engelle
}

export function canGenerateCutline(category: DesignFileCategory): boolean {
  return category === "processable";
}

export function canGenerateWhiteLayer(category: DesignFileCategory): boolean {
  return category === "processable";
}

export const WHITE_LAYER_MATERIALS = [
  "transparan",
  "seffaf",
  "ultra",
  "ultraclear",
  "metalik",
  "metalize",
  "holo",
  "holografik",
  "simli",
] as const;

export function needsWhiteLayer(materialKey: string): boolean {
  return (WHITE_LAYER_MATERIALS as readonly string[]).includes(
    materialKey.toLowerCase()
  );
}

export const BLOCKED_FILE_MESSAGE =
  "Bu dosya formatı desteklenmiyor. PNG, AI, PSD, PDF, SVG veya JPG yükleyin.";
