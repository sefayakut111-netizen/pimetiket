import sharp from "sharp";
import type { BgDetectResult } from "@/lib/proof/background-detect";

export interface BgRemoveResult {
  success: boolean;
  outputBuffer?: Buffer;
  method: "sharp_threshold" | "rembg_api" | "skipped";
  error?: string;
}

export async function removeBackground(
  fileUrl: string,
  bgDetect: BgDetectResult
): Promise<BgRemoveResult> {
  if (bgDetect.bgType === "solid_white" && bgDetect.confidence > 0.8) {
    return removeWhiteBgWithSharp(fileUrl);
  }

  if (bgDetect.bgType === "complex") {
    const rembg = await removeWithRembg(fileUrl);
    if (rembg.success) return rembg;
    return removeWhiteBgWithSharp(fileUrl);
  }

  if (bgDetect.hasBackground) {
    return removeWhiteBgWithSharp(fileUrl);
  }

  return { success: false, method: "skipped", error: "no_removable_background" };
}

async function removeWhiteBgWithSharp(fileUrl: string): Promise<BgRemoveResult> {
  try {
    const res = await fetch(fileUrl);
    if (!res.ok) {
      return { success: false, method: "sharp_threshold", error: "fetch_failed" };
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const out = Buffer.from(data);
    for (let i = 0; i < out.length; i += 4) {
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      if (r > 240 && g > 240 && b > 240) {
        out[i + 3] = 0;
      }
    }

    const outputBuffer = await sharp(out, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toBuffer();

    return { success: true, outputBuffer, method: "sharp_threshold" };
  } catch (err) {
    return {
      success: false,
      method: "sharp_threshold",
      error: err instanceof Error ? err.message : "sharp_failed",
    };
  }
}

async function removeWithRembg(fileUrl: string): Promise<BgRemoveResult> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return { success: false, method: "rembg_api", error: "no_replicate_token" };
  }

  try {
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=30",
      },
      body: JSON.stringify({
        version:
          "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
        input: { image: fileUrl },
      }),
    });

    if (!createRes.ok) {
      return {
        success: false,
        method: "rembg_api",
        error: `replicate_${createRes.status}`,
      };
    }

    const prediction = (await createRes.json()) as {
      status?: string;
      output?: string | string[];
      error?: string;
    };

    if (prediction.status !== "succeeded" || !prediction.output) {
      return {
        success: false,
        method: "rembg_api",
        error: prediction.error ?? "replicate_not_ready",
      };
    }

    const outputUrl = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;
    const imgRes = await fetch(outputUrl);
    if (!imgRes.ok) {
      return { success: false, method: "rembg_api", error: "output_fetch_failed" };
    }

    const outputBuffer = Buffer.from(await imgRes.arrayBuffer());
    return { success: true, outputBuffer, method: "rembg_api" };
  } catch (err) {
    return {
      success: false,
      method: "rembg_api",
      error: err instanceof Error ? err.message : "replicate_failed",
    };
  }
}
