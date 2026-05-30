/** Türkçe karakter toleranslı arama normalizasyonu */
export function stripDiacritics(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

export function matchesQuery(
  query: string,
  ...parts: (string | undefined | null)[]
): boolean {
  const q = stripDiacritics(query.trim());
  if (!q) return false;
  const haystack = stripDiacritics(parts.filter(Boolean).join(" "));
  return haystack.includes(q);
}
