/** Editör dosya yükleme limitleri — poc.html ile senkron tut. */
export const EDITOR_MAX_FILE_BYTES = 30 * 1024 * 1024;
export const EDITOR_MAX_MEGAPIXELS = 40_000_000;

export const EDITOR_FILE_LIMIT_HINT =
  "En fazla 30 MB · raster için en fazla 40 megapiksel";

export function formatFileSizeMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function fileSizeLimitMessage(bytes: number): string {
  return `Dosyan çok büyük (${formatFileSizeMb(bytes)} MB). 30 MB altına sıkıştırıp tekrar dene.`;
}

export function rejectFileBySize(file: File): string | null {
  if (file.size > EDITOR_MAX_FILE_BYTES) {
    return fileSizeLimitMessage(file.size);
  }
  return null;
}

export function megapixelLimitMessage(width: number, height: number): string {
  const mp = (width * height) / 1_000_000;
  return `Görsel çözünürlüğü çok yüksek (${mp.toFixed(1)} MP). En fazla 40 megapiksel destekleniyor — küçültüp tekrar dene.`;
}

export function rejectRasterByMegapixels(
  width: number,
  height: number
): string | null {
  if (width * height > EDITOR_MAX_MEGAPIXELS) {
    return megapixelLimitMessage(width, height);
  }
  return null;
}

export function isRasterImageFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "psd" || ext === "ai" || ext === "pdf") return false;
  return file.type.startsWith("image/") && file.type !== "image/svg+xml";
}

export function decodeImageDimensions(
  file: File
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export async function validateEditorUploadFile(
  file: File
): Promise<string | null> {
  const sizeErr = rejectFileBySize(file);
  if (sizeErr) return sizeErr;

  if (!isRasterImageFile(file)) return null;

  const dims = await decodeImageDimensions(file);
  if (!dims) return null;

  return rejectRasterByMegapixels(dims.width, dims.height);
}
