/**
 * PDF / AI preview generator (client-side, pdfjs-dist)
 *
 * Sefa 20 May v68: Konfigüratörde kullanıcı PDF veya AI yüklediğinde
 * ilk sayfayı PNG olarak render ediyoruz → sepette gerçek önizleme.
 *
 * AI dosyaları çoğunlukla PDF-compatible kayıtlıdır (CS2 sonrası);
 * pdfjs onları da okur. Eski / PDF-incompatible AI dosyaları için
 * caller fallback logoya düşer (try/catch).
 *
 * Bundle bloat'ı önlemek için pdfjs **dinamik import** ile yüklenir —
 * sadece kullanıcı tasarım yüklediğinde indirilir (~300 KB gzip).
 */

const MAX_PREVIEW_WIDTH = 600; // sepette küçük gösterilecek, 600 px yeter
const PREVIEW_QUALITY = 0.85; // JPEG değil, PNG → quality opsiyonel ama küçük tutar

/**
 * PDF veya AI File'ın ilk sayfasını PNG Blob olarak render eder.
 * @throws Error — render başarısızsa (şifreli PDF, bozuk dosya, eski AI)
 */
export async function generatePdfPreview(file: File): Promise<Blob> {
  // Dinamik import — bundle'a dahil değil, runtime'da yüklenir
  const pdfjs = await import("pdfjs-dist");
  // Worker URL — pdfjs same-origin worker bekler. Next.js public/ veya
  // CDN üzerinden de servis edilebilir. ESM build için worker'ı dahili
  // çözümle.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: arrayBuffer,
    // AI dosyaları için strict mode kapalı — pdfjs daha tolerant okur
    disableAutoFetch: true,
    disableStream: true,
  });

  const pdf = await loadingTask.promise;
  if (pdf.numPages === 0) {
    throw new Error("PDF içinde sayfa yok");
  }

  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(MAX_PREVIEW_WIDTH / baseViewport.width, 2);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context alınamadı");
  }

  // Beyaz arka plan — şeffaf PDF'lerde gri görünmesin
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Sefa 20 May v68: pdfjs 4.x render API — canvas + viewport zorunlu.
  // pdfjs-dist v4 RenderParameters tipi 'canvas' alanını da bekler.
  await page.render({
    canvasContext: ctx,
    canvas,
    viewport,
  } as Parameters<typeof page.render>[0]).promise;

  // Cleanup — pdf doc memory'yi bırak
  await pdf.cleanup();
  await pdf.destroy();

  return await canvasToBlob(canvas);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas → Blob başarısız"));
      },
      "image/png",
      PREVIEW_QUALITY
    );
  });
}
