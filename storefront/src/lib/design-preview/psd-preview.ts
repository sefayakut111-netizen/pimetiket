/**
 * PSD preview generator (client-side, ag-psd)
 *
 * Sefa 20 May v68: PSD dosyaları → composite (merged) preview PNG.
 * ag-psd layer'ları parse eder; çoğu durumda merged image hazır gelir
 * (Photoshop "Maximize Compatibility" flag açıkken). Yoksa compose'u
 * skipCompositeImageData=false ile zorlarız.
 *
 * Dinamik import — bundle'a dahil değil (~80 KB gzip).
 */

const MAX_PREVIEW_WIDTH = 600;

export async function generatePsdPreview(file: File): Promise<Blob> {
  const { readPsd } = await import("ag-psd");

  const arrayBuffer = await file.arrayBuffer();
  const psd = readPsd(arrayBuffer, {
    skipLayerImageData: true, // layer'lar gerek yok, sadece composite
    skipThumbnail: false,
    skipCompositeImageData: false,
    useImageData: false,
  });

  // ag-psd composite'i `canvas` field'ına koyar (HTMLCanvasElement)
  const sourceCanvas = psd.canvas;
  if (!sourceCanvas) {
    throw new Error("PSD composite image yok (Maximize Compatibility kapalı kaydedilmiş olabilir)");
  }

  // Resize → 600 px max
  const scale = Math.min(MAX_PREVIEW_WIDTH / sourceCanvas.width, 1);
  const outCanvas = document.createElement("canvas");
  outCanvas.width = Math.ceil(sourceCanvas.width * scale);
  outCanvas.height = Math.ceil(sourceCanvas.height * scale);
  const ctx = outCanvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context alınamadı");

  // Beyaz arka plan
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
  ctx.drawImage(sourceCanvas, 0, 0, outCanvas.width, outCanvas.height);

  return await new Promise<Blob>((resolve, reject) => {
    outCanvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("PSD canvas → Blob başarısız"));
      },
      "image/png",
      0.85
    );
  });
}
