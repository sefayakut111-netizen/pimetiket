import sharp from "sharp";
import { needsWhiteLayer } from "@/lib/design-file-types";
import { uploadProofArtifact } from "@/lib/proof/proof-artifacts";

export interface WhiteLayerResult {
  generated: boolean;
  reason?: "not_needed" | "no_alpha" | "generated" | "error";
  whitePngUrl?: string;
  whitePngStoragePath?: string;
  coverage?: number;
  warnings?: string[];
}

export interface WhiteLayerInput {
  designFileUrl: string;
  cutlineSvgPath: string;
  materialKey: string;
  designWidth: number;
  designHeight: number;
  /** Storage upload için — verilirse PNG kaydedilir */
  orderId?: string;
  itemId?: string;
  /** Alpha eşiği (0–255). Varsayılan 128; auto-fix için 64 kullanılır */
  alphaThreshold?: number;
}

const DPI = 300;

function mmToPx(mm: number): number {
  return Math.max(1, Math.round((mm / 25.4) * DPI));
}

function buildCutlineMaskSvg(
  cutlineSvgPath: string,
  widthMm: number,
  heightMm: number
): string {
  if (cutlineSvgPath.includes("<svg")) {
    return cutlineSvgPath.replace(
      /<svg([^>]*)>/i,
      `<svg$1 width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}">`
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}"><path d="${cutlineSvgPath}" fill="white"/></svg>`;
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("design_fetch_failed");
  return Buffer.from(await res.arrayBuffer());
}

async function buildWhiteFromAlpha(
  designBuf: Buffer,
  widthPx: number,
  heightPx: number,
  threshold: number
): Promise<Buffer> {
  const { data, info } = await sharp(designBuf)
    .resize(widthPx, heightPx, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const out = Buffer.alloc(widthPx * heightPx * 4);

  for (let i = 0; i < widthPx * heightPx; i++) {
    const alpha = data[i * channels + (channels - 1)] ?? 0;
    const white = alpha >= threshold ? 255 : 0;
    const o = i * 4;
    out[o] = white;
    out[o + 1] = white;
    out[o + 2] = white;
    out[o + 3] = white > 0 ? 255 : 0;
  }

  let white = await sharp(out, {
    raw: { width: widthPx, height: heightPx, channels: 4 },
  })
    .png()
    .toBuffer();

  white = await sharp(white).blur(0.6).threshold(200).png().toBuffer();
  return white;
}

async function applyCutlineMask(
  whiteBuf: Buffer,
  cutlineSvgPath: string,
  widthMm: number,
  heightMm: number,
  widthPx: number,
  heightPx: number
): Promise<Buffer> {
  const maskSvg = buildCutlineMaskSvg(cutlineSvgPath, widthMm, heightMm);
  const maskBuf = await sharp(Buffer.from(maskSvg))
    .resize(widthPx, heightPx, { fit: "fill" })
    .greyscale()
    .threshold(128)
    .png()
    .toBuffer();

  return sharp(whiteBuf)
    .composite([{ input: maskBuf, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function computeCoverage(whiteBuf: Buffer): Promise<number> {
  const { data, info } = await sharp(whiteBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let whitePixels = 0;
  const total = info.width * info.height;
  for (let i = 0; i < total; i++) {
    const alpha = data[i * info.channels + (info.channels - 1)] ?? 0;
    if (alpha > 128) whitePixels++;
  }
  return total > 0 ? Math.round((whitePixels / total) * 1000) / 10 : 0;
}

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

  const threshold = input.alphaThreshold ?? 128;
  const widthPx = mmToPx(input.designWidth);
  const heightPx = mmToPx(input.designHeight);

  try {
    const designBuf = await fetchBuffer(input.designFileUrl);
    const meta = await sharp(designBuf).metadata();
    if (!meta.hasAlpha) {
      return {
        generated: false,
        reason: "no_alpha",
        warnings: ["Tasarımda alpha kanalı yok — beyaz katman atlandı"],
      };
    }

    let whiteBuf = await buildWhiteFromAlpha(
      designBuf,
      widthPx,
      heightPx,
      threshold
    );
    whiteBuf = await applyCutlineMask(
      whiteBuf,
      input.cutlineSvgPath,
      input.designWidth,
      input.designHeight,
      widthPx,
      heightPx
    );

    const coverage = await computeCoverage(whiteBuf);

    if (coverage < 0.5) {
      return {
        generated: false,
        reason: "no_alpha",
        warnings: ["Beyaz katman kapsamı çok düşük (%0.5 altı)"],
        coverage,
      };
    }

    let whitePngUrl: string | undefined;
    let whitePngStoragePath: string | undefined;

    if (input.orderId && input.itemId) {
      const uploaded = await uploadProofArtifact(
        input.orderId,
        input.itemId,
        "white-layer",
        whiteBuf,
        "image/png"
      );
      whitePngUrl = uploaded.signedUrl ?? undefined;
      whitePngStoragePath = uploaded.storagePath;
    }

    return {
      generated: true,
      reason: "generated",
      whitePngUrl,
      whitePngStoragePath,
      coverage,
    };
  } catch (err) {
    return {
      generated: false,
      reason: "error",
      warnings: [
        err instanceof Error ? err.message : "Beyaz katman üretimi başarısız",
      ],
    };
  }
}

/** Auto-fix F4: beyaz katmanı bıçak maskesi ile kırp */
export async function clipWhiteLayerToCutline(args: {
  whitePngUrl: string;
  cutlineSvgPath: string;
  designWidth: number;
  designHeight: number;
  orderId?: string;
  itemId?: string;
}): Promise<{ pngUrl?: string; storagePath?: string } | null> {
  try {
    const buf = await fetchBuffer(args.whitePngUrl);
    const widthPx = mmToPx(args.designWidth);
    const heightPx = mmToPx(args.designHeight);
    const clipped = await applyCutlineMask(
      buf,
      args.cutlineSvgPath,
      args.designWidth,
      args.designHeight,
      widthPx,
      heightPx
    );
    if (args.orderId && args.itemId) {
      const uploaded = await uploadProofArtifact(
        args.orderId,
        args.itemId,
        "white-layer-fixed",
        clipped,
        "image/png"
      );
      return {
        pngUrl: uploaded.signedUrl ?? undefined,
        storagePath: uploaded.storagePath,
      };
    }
    return null;
  } catch {
    return null;
  }
}
