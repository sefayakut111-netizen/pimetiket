import sharp from "sharp";
import {
  uploadProofArtifact,
  signedProofArtifactUrl,
} from "@/lib/proof/proof-artifacts";

export type ColorShiftLevel = "none" | "minor" | "noticeable" | "significant";

export interface CmykSimResult {
  simulatedPngUrl: string;
  storagePath: string;
  colorShift: ColorShiftLevel;
  affectedAreas: string;
}

function classifyColorShift(meanDelta: number): ColorShiftLevel {
  if (meanDelta < 8) return "none";
  if (meanDelta < 15) return "minor";
  if (meanDelta < 25) return "noticeable";
  return "significant";
}

export async function generateCmykSimulation(
  fileUrl: string,
  orderId: string,
  itemId: string,
  cachedPath?: string | null
): Promise<CmykSimResult> {
  if (cachedPath) {
    const signed = await signedProofArtifactUrl(cachedPath);
    if (signed) {
      return {
        simulatedPngUrl: signed,
        storagePath: cachedPath,
        colorShift: "noticeable",
        affectedAreas: "Canlı yeşil ve mavi tonlarda fark olabilir",
      };
    }
  }

  const res = await fetch(fileUrl);
  if (!res.ok) {
    throw new Error("design_fetch_failed");
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const original = await sharp(buffer).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  const simulatedBuf = await sharp(buffer)
    .modulate({ saturation: 0.82, brightness: 0.95 })
    .png()
    .toBuffer();

  const simulatedRaw = await sharp(simulatedBuf).raw().toBuffer({
    resolveWithObject: true,
  });

  let deltaSum = 0;
  const sampleStep = 16;
  const len = Math.min(original.data.length, simulatedRaw.data.length);
  let samples = 0;
  for (let i = 0; i < len; i += 4 * sampleStep) {
    const dr = Math.abs(original.data[i] - simulatedRaw.data[i]);
    const dg = Math.abs(original.data[i + 1] - simulatedRaw.data[i + 1]);
    const db = Math.abs(original.data[i + 2] - simulatedRaw.data[i + 2]);
    deltaSum += (dr + dg + db) / 3;
    samples++;
  }

  const meanDelta = samples > 0 ? deltaSum / samples : 0;
  const colorShift = classifyColorShift(meanDelta);

  const { storagePath, signedUrl } = await uploadProofArtifact(
    orderId,
    itemId,
    "cmyk-sim",
    simulatedBuf
  );

  return {
    simulatedPngUrl: signedUrl ?? "",
    storagePath,
    colorShift,
    affectedAreas:
      colorShift === "significant" || colorShift === "noticeable"
        ? "Canlı yeşil ve mavi tonlarda fark olabilir"
        : "Renk farkı minimal görünüyor",
  };
}
