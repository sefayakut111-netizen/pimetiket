const POC_ERROR_MAP: Record<string, string> = {
  CORS_BLOCKED: "Dosyana ulaşamadık — sayfayı yenile, olmazsa bize yaz.",
  HTTP_404: "Dosyana ulaşamadık — sayfayı yenile, olmazsa bize yaz.",
  HTTP_403: "Dosyana ulaşamadık — sayfayı yenile, olmazsa bize yaz.",
  EMPTY_BLOB: "Dosyana ulaşamadık — sayfayı yenile, olmazsa bize yaz.",
};

/** Ham poc hata kodunu kullanıcı mesajına çevir; eşleşmezse ham metni döndür. */
export function humanizePocError(raw: string): string {
  const code = raw.trim();
  for (const [key, message] of Object.entries(POC_ERROR_MAP)) {
    if (code.includes(key)) return message;
  }
  return code;
}

export function isKnownPocErrorCode(raw: string): boolean {
  const code = raw.trim();
  return Object.keys(POC_ERROR_MAP).some((key) => code.includes(key));
}
