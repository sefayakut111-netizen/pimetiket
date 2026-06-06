import sharp from "sharp";
import { REPLICATE_UPSCALE_TIMEOUT_MS } from "@/lib/http/external-timeouts";

/** Replicate nightmareai/real-esrgan — super-resolution */
export const REAL_ESRGAN_VERSION =
  "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa";

/** Görsel başı tahmini maliyet (USD) — ai_usage_logs */
export const IMAGE_UPSCALE_COST_USD = 0.008;

const RASTER_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function isUpscalableMime(mime: string): boolean {
  return RASTER_MIMES.has(mime.toLowerCase());
}

export interface UpscaleResult {
  success: boolean;
  outputBuffer?: Buffer;
  originalWidth?: number;
  originalHeight?: number;
  enhancedWidth?: number;
  enhancedHeight?: number;
  scale?: number;
  error?: string;
}

function pickScale(width: number, height: number): number {
  const maxDim = Math.max(width, height);
  if (maxDim > 2000) return 2;
  if (maxDim > 1200) return 2;
  return 4;
}

export async function upscaleImageFromUrl(
  fileUrl: string
): Promise<UpscaleResult> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return { success: false, error: "no_replicate_token" };
  }

  try {
    const res = await fetch(fileUrl, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      return { success: false, error: "fetch_failed" };
    }

    const inputBuffer = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(inputBuffer).metadata();
    if (!meta.width || !meta.height) {
      return { success: false, error: "invalid_image" };
    }

    const scale = pickScale(meta.width, meta.height);

    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=60",
      },
      body: JSON.stringify({
        version: REAL_ESRGAN_VERSION,
        input: {
          image: fileUrl,
          scale,
          face_enhance: false,
        },
      }),
      signal: AbortSignal.timeout(REPLICATE_UPSCALE_TIMEOUT_MS),
    });

    if (!createRes.ok) {
      return {
        success: false,
        error: `replicate_${createRes.status}`,
      };
    }

    let prediction = (await createRes.json()) as {
      id?: string;
      status?: string;
      output?: string | string[];
      error?: string;
      urls?: { get?: string };
    };

    const pollUrl = prediction.urls?.get;
    if (
      prediction.status !== "succeeded" &&
      prediction.id &&
      pollUrl
    ) {
      const deadline = Date.now() + REPLICATE_UPSCALE_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await fetch(pollUrl, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15_000),
        });
        if (!pollRes.ok) break;
        prediction = (await pollRes.json()) as typeof prediction;
        if (
          prediction.status === "succeeded" ||
          prediction.status === "failed" ||
          prediction.status === "canceled"
        ) {
          break;
        }
      }
    }

    if (prediction.status !== "succeeded" || !prediction.output) {
      return {
        success: false,
        error: prediction.error ?? "replicate_not_ready",
      };
    }

    const outputUrl = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;
    const imgRes = await fetch(outputUrl, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!imgRes.ok) {
      return { success: false, error: "output_fetch_failed" };
    }

    const outputBuffer = Buffer.from(await imgRes.arrayBuffer());
    const outMeta = await sharp(outputBuffer).metadata();

    return {
      success: true,
      outputBuffer,
      originalWidth: meta.width,
      originalHeight: meta.height,
      enhancedWidth: outMeta.width ?? meta.width * scale,
      enhancedHeight: outMeta.height ?? meta.height * scale,
      scale,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "upscale_failed",
    };
  }
}
