const POC_ERROR_MAP: Record<string, string> = {
  CORS_BLOCKED: "Dosyana ulaşamadık — sayfayı yenile, olmazsa bize yaz.",
  HTTP_404: "Dosyana ulaşamadık — sayfayı yenile, olmazsa bize yaz.",
  HTTP_403: "Dosyana ulaşamadık — sayfayı yenile, olmazsa bize yaz.",
  EMPTY_BLOB: "Dosyana ulaşamadık — sayfayı yenile, olmazsa bize yaz.",
};

const CUTLINE_FAIL_REASON_MAP: Record<string, string> = {
  "0-path":
    "Görselden bıçak yolu çıkarılamadı — farklı görsel veya kesim şekli dene.",
  no_contours:
    "Görselden bıçak yolu çıkarılamadı — farklı görsel veya kesim şekli dene.",
  no_embedded_cutline: "Dosyada kesim katmanı bulunamadı.",
  svg_build_failed: "Bıçak dosyası üretilemedi — tekrar dene.",
  kontur_uretilemedi:
    "Görselden bıçak yolu çıkarılamadı — farklı görsel veya kesim şekli dene.",
};

const LOAD_FAIL_REASON_MAP: Record<string, string> = {
  opencv_not_ready:
    "Editör motoru hazırlanıyor — dosyan otomatik yüklenecek.",
  pdf_motor_not_ready:
    "PDF motoru yükleniyor — dosyan otomatik yüklenecek.",
  psd_motor_not_ready:
    "PSD motoru yükleniyor — dosyan otomatik yüklenecek.",
  file_too_large:
    "Dosyan çok büyük — 30 MB altına sıkıştırıp tekrar dene.",
  unsupported_format:
    "Bu dosya formatını desteklemiyoruz — PNG veya JPG olarak kaydedip tekrar dene.",
  load_failed: "Dosya yüklenemedi — tekrar dene.",
};

const SAVE_FAIL_REASON_MAP: Record<string, string> = {
  "0-path": "Bıçak yolu henüz hazır değil — kontur hesaplanamadı.",
  no_image: "Önce bir görsel yükle.",
  svg_build_failed: "Bıçak dosyası üretilemedi — tekrar dene.",
  save_failed: "Kayıt başarısız — tekrar dene.",
};

function mapReason(
  raw: string,
  table: Record<string, string>,
  fallback: string
): string {
  const code = raw.trim();
  if (table[code]) return table[code];
  for (const [key, message] of Object.entries(table)) {
    if (code.includes(key)) return message;
  }
  return fallback;
}

/** Ham poc hata kodunu kullanıcı mesajına çevir; eşleşmezse ham metni döndür. */
export function humanizePocError(raw: string): string {
  const code = raw.trim();
  for (const [key, message] of Object.entries(POC_ERROR_MAP)) {
    if (code.includes(key)) return message;
  }
  return code;
}

export function humanizeCutlineFailReason(raw: string): string {
  return mapReason(
    raw,
    CUTLINE_FAIL_REASON_MAP,
    "Bıçak hazırlanamadı — lütfen tekrar dene"
  );
}

export function humanizeLoadFailReason(raw: string): string {
  return mapReason(raw, LOAD_FAIL_REASON_MAP, "Dosya yüklenemedi — tekrar dene.");
}

export function humanizeSaveFailReason(raw: string): string {
  return mapReason(raw, SAVE_FAIL_REASON_MAP, "Kayıt başarısız — tekrar dene.");
}

export function isKnownPocErrorCode(raw: string): boolean {
  const code = raw.trim();
  return Object.keys(POC_ERROR_MAP).some((key) => code.includes(key));
}
