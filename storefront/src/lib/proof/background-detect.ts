import sharp from "sharp";
import { needsWhiteLayer } from "@/lib/design-file-types";

export interface BgDetectResult {
  hasBackground: boolean;
  bgType: "none" | "solid_white" | "solid_color" | "complex" | "unknown";
  bgColor?: string;
  bgCoverage?: number;
  transparentPixelRatio?: number;
  needsRemoval: boolean;
  confidence: number;
}

export async function detectBackground(
  fileUrl: string,
  fileName: string,
  materialKey: string
): Promise<BgDetectResult> {
  const dot = fileName.toLowerCase().lastIndexOf(".");
  const ext = dot >= 0 ? fileName.toLowerCase().slice(dot) : "";

  if (ext === ".jpg" || ext === ".jpeg") {
    return {
      hasBackground: true,
      bgType: "unknown",
      transparentPixelRatio: 0,
      needsRemoval: needsWhiteLayer(materialKey),
      confidence: 1.0,
    };
  }

  if ([".svg", ".pdf", ".ai"].includes(ext)) {
    return {
      hasBackground: false,
      bgType: "none",
      needsRemoval: false,
      confidence: 0.5,
    };
  }

  const res = await fetch(fileUrl);
  if (!res.ok) {
    return {
      hasBackground: false,
      bgType: "unknown",
      needsRemoval: false,
      confidence: 0,
    };
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const metadata = await sharp(buffer).metadata();

  if (!metadata.hasAlpha) {
    return {
      hasBackground: true,
      bgType: "unknown",
      transparentPixelRatio: 0,
      needsRemoval: needsWhiteLayer(materialKey),
      confidence: 1.0,
    };
  }

  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalPixels = info.width * info.height;
  let transparentPixels = 0;
  let whiteOpaquePixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 10) {
      transparentPixels++;
    } else if (a > 245 && r > 240 && g > 240 && b > 240) {
      whiteOpaquePixels++;
    }
  }

  const transparentRatio = transparentPixels / totalPixels;
  const whiteRatio = whiteOpaquePixels / totalPixels;

  if (transparentRatio > 0.2) {
    return {
      hasBackground: false,
      bgType: "none",
      transparentPixelRatio: transparentRatio,
      needsRemoval: false,
      confidence: 0.9,
    };
  }

  if (whiteRatio > 0.3 && transparentRatio < 0.05) {
    return {
      hasBackground: true,
      bgType: "solid_white",
      bgColor: "#FFFFFF",
      bgCoverage: whiteRatio * 100,
      transparentPixelRatio: transparentRatio,
      needsRemoval: needsWhiteLayer(materialKey),
      confidence: 0.85,
    };
  }

  return {
    hasBackground: transparentRatio < 0.1,
    bgType: transparentRatio < 0.1 ? "complex" : "none",
    transparentPixelRatio: transparentRatio,
    needsRemoval: transparentRatio < 0.1 && needsWhiteLayer(materialKey),
    confidence: 0.6,
  };
}
