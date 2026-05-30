import "server-only";

import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const MM = 2.834645669;
const mm = (v: number) => v * MM;
const KDV_RATE = 0.2;

export interface MonthlyAccountingData {
  year: number;
  month: number;
  monthLabel: string;
  collectedTotal: number;
  refundedTotal: number;
  grossOrderTotal: number;
  netRevenue: number;
  kdvAmount: number;
  orderCount: number;
  paymentCount: number;
}

function formatTry(amount: number): string {
  return `${amount.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;
}

export async function generateMonthlyAccountingPdf(
  data: MonthlyAccountingData
): Promise<Uint8Array> {
  const W = mm(210);
  const H = mm(297);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle(`Aylık Muhasebe Özeti — ${data.monthLabel}`);
  pdfDoc.setProducer("Pim Etiket");

  const { NOTOSANS_REGULAR_BASE64, NOTOSANS_BOLD_BASE64 } = await import(
    "@/lib/shipping/fonts/noto-sans-base64"
  );
  const regular = await pdfDoc.embedFont(
    Uint8Array.from(Buffer.from(NOTOSANS_REGULAR_BASE64, "base64")),
    { subset: true }
  );
  const bold = await pdfDoc.embedFont(
    Uint8Array.from(Buffer.from(NOTOSANS_BOLD_BASE64, "base64")),
    { subset: true }
  );

  const page = pdfDoc.addPage([W, H]);
  const yT = (fromTopMm: number) => H - mm(fromTopMm);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.45, 0.45, 0.45);
  const mercan = rgb(0.89, 0.36, 0.28);

  let y = 18;

  page.drawText("PIM ETİKET — AYLIK MUHASEBE ÖZETİ", {
    x: mm(20),
    y: yT(y),
    size: 14,
    font: bold,
    color: mercan,
  });
  y += 8;
  page.drawText(data.monthLabel, {
    x: mm(20),
    y: yT(y),
    size: 11,
    font: regular,
    color: gray,
  });
  y += 6;
  page.drawText(
    `Oluşturulma: ${new Date().toLocaleString("tr-TR")}`,
    { x: mm(20), y: yT(y), size: 9, font: regular, color: gray }
  );
  y += 14;

  const rows: Array<[string, string]> = [
    ["Sipariş sayısı", String(data.orderCount)],
    ["Başarılı tahsilat adedi", String(data.paymentCount)],
    ["Brüt sipariş cirosu (KDV dahil)", formatTry(data.grossOrderTotal)],
    ["Tahsilat toplamı", formatTry(data.collectedTotal)],
    ["İade toplamı", formatTry(data.refundedTotal)],
    ["Net ciro (KDV hariç, %20)", formatTry(data.netRevenue)],
    ["KDV tutarı (%20)", formatTry(data.kdvAmount)],
  ];

  const tableTop = y;
  page.drawText("Kalem", {
    x: mm(20),
    y: yT(tableTop),
    size: 10,
    font: bold,
    color: black,
  });
  page.drawText("Tutar", {
    x: mm(120),
    y: yT(tableTop),
    size: 10,
    font: bold,
    color: black,
  });
  y += 7;
  page.drawLine({
    start: { x: mm(20), y: yT(y) },
    end: { x: mm(190), y: yT(y) },
    thickness: 0.5,
    color: gray,
  });
  y += 6;

  for (const [label, value] of rows) {
    page.drawText(label, {
      x: mm(20),
      y: yT(y),
      size: 10,
      font: regular,
      color: black,
    });
    page.drawText(value, {
      x: mm(120),
      y: yT(y),
      size: 10,
      font: bold,
      color: black,
    });
    y += 7;
  }

  y += 8;
  page.drawLine({
    start: { x: mm(20), y: yT(y) },
    end: { x: mm(190), y: yT(y) },
    thickness: 0.5,
    color: gray,
  });
  y += 8;

  page.drawText("KDV özeti", {
    x: mm(20),
    y: yT(y),
    size: 11,
    font: bold,
    color: black,
  });
  y += 7;
  page.drawText(
    `Standart oran %20 — Net: ${formatTry(data.netRevenue)} · KDV: ${formatTry(data.kdvAmount)} · Brüt: ${formatTry(data.grossOrderTotal)}`,
    { x: mm(20), y: yT(y), size: 9, font: regular, color: gray, maxWidth: mm(170) }
  );
  y += 12;

  page.drawText(
    "Bu belge muhasebeci için özet tablodur. Resmi e-fatura yerine geçmez.",
    { x: mm(20), y: yT(y), size: 8, font: regular, color: gray, maxWidth: mm(170) }
  );

  return pdfDoc.save();
}

export function monthlyAccountingToCsv(data: MonthlyAccountingData): string {
  const lines = [
    "Kalem,Deger",
    `Donem,${data.monthLabel}`,
    `Siparis sayisi,${data.orderCount}`,
    `Tahsilat adedi,${data.paymentCount}`,
    `Brut ciro (KDV dahil),${data.grossOrderTotal.toFixed(2)}`,
    `Tahsilat toplami,${data.collectedTotal.toFixed(2)}`,
    `Iade toplami,${data.refundedTotal.toFixed(2)}`,
    `Net ciro (KDV haric),${data.netRevenue.toFixed(2)}`,
    `KDV tutari (%20),${data.kdvAmount.toFixed(2)}`,
  ];
  return lines.join("\n");
}

export function parseMonthParam(
  monthParam: string | null
): { year: number; month: number } | null {
  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) return null;
  const [y, m] = monthParam.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  return { year: y, month: m };
}

export function monthWindow(year: number, month: number) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}
