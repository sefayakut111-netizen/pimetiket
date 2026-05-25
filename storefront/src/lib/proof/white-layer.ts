import { needsWhiteLayer } from "@/lib/design-file-types";

export interface WhiteLayerResult {
  generated: boolean;
  reason?: "not_needed" | "no_alpha" | "generated" | "error";
  whitePngUrl?: string;
  coverage?: number;
  warnings?: string[];
}

export interface WhiteLayerInput {
  designFileUrl: string;
  cutlineSvgPath: string;
  materialKey: string;
  designWidth: number;
  designHeight: number;
}

/**
 * Beyaz katman üretimi — server-side sharp ile tam implementasyon Görev 8
 * orchestrator entegrasyonunda genişletilecek. Şimdilik malzeme kontrolü +
 * interface stub.
 */
export async function generateWhiteLayer(
  input: WhiteLayerInput
): Promise<WhiteLayerResult> {
  if (!needsWhiteLayer(input.materialKey)) {
    return { generated: false, reason: "not_needed" };
  }

  if (!input.cutlineSvgPath.trim()) {
    return {
      generated: false,
      reason: "error",
      warnings: ["Bıçak SVG yok — beyaz katman üretilemedi"],
    };
  }

  // POC v2 iframe akışı şimdilik aktif; server-side render sonraki adımda.
  return {
    generated: false,
    reason: "no_alpha",
    warnings: [
      "Beyaz katman server-side henüz üretilmedi — POC iframe akışı kullanılacak",
    ],
  };
}
