/**
 * Thumbnail PNG — max ~1 MB, max kenar 600px (sepet/panel önizleme).
 */

const MAX_EDGE = 600;
const MAX_BYTES = 1024 * 1024;
const MIN_QUALITY = 0.5;

export async function compressPreviewBlob(input: Blob): Promise<Blob> {
  if (typeof document === "undefined") return input;
  if (input.size <= MAX_BYTES && input.type.startsWith("image/")) {
    try {
      const bmp = await createImageBitmap(input);
      if (Math.max(bmp.width, bmp.height) <= MAX_EDGE) {
        bmp.close();
        return input;
      }
      bmp.close();
    } catch {
      return input;
    }
  }

  const bitmap = await createImageBitmap(input);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return input;
  }
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let quality = 0.92;
  let blob = await canvasToPng(canvas, quality);
  while (blob.size > MAX_BYTES && quality > MIN_QUALITY) {
    quality -= 0.08;
    blob = await canvasToPng(canvas, quality);
  }

  if (blob.size > MAX_BYTES) {
    const scale2 = 0.65;
    const w2 = Math.max(1, Math.round(w * scale2));
    const h2 = Math.max(1, Math.round(h * scale2));
    const c2 = document.createElement("canvas");
    c2.width = w2;
    c2.height = h2;
    const ctx2 = c2.getContext("2d")!;
    ctx2.drawImage(canvas, 0, 0, w2, h2);
    blob = await canvasToPng(c2, 0.82);
  }
  return blob;
}

function canvasToPng(canvas: HTMLCanvasElement, _q: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png"
    );
  });
}
