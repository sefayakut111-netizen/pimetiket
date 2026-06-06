/** KDV dahil brüt tutardan kırılım — gösterim satırları toplamı = brüt. */
export function vatBreakdownFromGross(
  subtotal: number,
  rate = 0.2
): { exVat: number; vat: number; gross: number } {
  const gross = Math.round(subtotal);
  const exVat = Math.round(gross / (1 + rate));
  const vat = gross - exVat;
  return { exVat, vat, gross };
}
