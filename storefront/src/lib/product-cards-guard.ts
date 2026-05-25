/**
 * DB product_cards encoding guard — bozuk UTF-8 / replacement char → fallback.
 */

export function hasBrokenEncoding(s: string): boolean {
  return s.includes("\uFFFD") || s.includes("�");
}

export function guardCards<T extends { titleTr?: string; descTr?: string }>(
  dbCards: T[],
  fallback: T[]
): T[] {
  if (dbCards.length === 0) return fallback;
  const broken = dbCards.some(
    (c) =>
      (c.titleTr && hasBrokenEncoding(c.titleTr)) ||
      (c.descTr && hasBrokenEncoding(c.descTr))
  );
  return broken ? fallback : dbCards;
}
