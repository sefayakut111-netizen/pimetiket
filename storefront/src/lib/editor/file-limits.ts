/** Editör dosya yükleme limitleri — poc.html ile senkron tut. */
export const EDITOR_MAX_FILE_BYTES = 30 * 1024 * 1024;
export const EDITOR_MAX_MEGAPIXELS = 40_000_000;

export const EDITOR_FILE_LIMIT_HINT =
  "En fazla 30 MB · raster için en fazla 40 megapiksel";

/** Eski PostScript tabanlı .ai — poc.html ile senkron */
export const LEGACY_AI_MESSAGE =
  "Bu .ai dosyası eski formatta — Illustrator'da 'Farklı Kaydet → PDF uyumlu dosya oluştur' işaretleyip yeniden kaydet, ya da PDF olarak dışa aktar.";

/** ag-psd supportedColorModes CMYK içermiyor — poc.html ile senkron */
export const CMYK_PSD_MESSAGE =
  "CMYK PSD desteklenmiyor — PNG ya da PDF olarak dışa aktarıp yükle (renkleri baskıda biz CMYK'ya çeviriyoruz).";

const PSD_COLOR_MODE_CMYK = 4;

export async function readFileHeader(
  file: File,
  length = 8
): Promise<Uint8Array> {
  const buf = await file.slice(0, length).arrayBuffer();
  return new Uint8Array(buf);
}

export function isLegacyPostScriptAi(header: Uint8Array): boolean {
  return (
    header.length >= 4 &&
    header[0] === 0x25 &&
    header[1] === 0x21 &&
    header[2] === 0x50 &&
    header[3] === 0x53
  );
}

/** PSD dosya başlığından colorMode (uint16 LE, offset 24) */
export function psdColorModeFromHeader(header: Uint8Array): number | null {
  if (header.length < 26) return null;
  if (
    header[0] !== 0x38 ||
    header[1] !== 0x42 ||
    header[2] !== 0x50 ||
    header[3] !== 0x53
  ) {
    return null;
  }
  return header[24] | (header[25] << 8);
}

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

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "ai") {
    const header = await readFileHeader(file, 4);
    if (isLegacyPostScriptAi(header)) return LEGACY_AI_MESSAGE;
  }

  if (ext === "psd" || file.type === "image/vnd.adobe.photoshop") {
    const header = await readFileHeader(file, 26);
    if (psdColorModeFromHeader(header) === PSD_COLOR_MODE_CMYK) {
      return CMYK_PSD_MESSAGE;
    }
  }

  if (!isRasterImageFile(file)) return null;

  const dims = await decodeImageDimensions(file);
  if (!dims) return null;

  return rejectRasterByMegapixels(dims.width, dims.height);
}
