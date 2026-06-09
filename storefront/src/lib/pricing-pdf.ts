/**
 * İş Emri PDF üretimi — fasoncu için 3 sayfalık profesyonel çıktı.
 *
 * Kaynak: docs/PRICING_SPEC.md §9
 * Modül: sticker-fiyatlama.html v0.3 — generateWorkOrderPDF()
 *
 * Sayfa yapısı:
 *   1. İş Künyesi & Teknik Özellikler
 *   2. Üretim Planı (rulo + tabaka SVG'leri programatik çiz)
 *   3. Maliyet Detayı + Operatör İmza Alanı
 */

import jsPDF from "jspdf";
import type {
  CostResult,
  GeometryResult,
  ProductionMode,
} from "./pricing-engine";
import { ROLL_L, ROLL_MARGIN_X, ROLL_START_MARGIN, ROLL_END_MARGIN } from "./pricing-engine";
import {
  computeSheetDistribution,
} from "@/components/pricing/layout-helpers";

// ============================================================
// Helpers
// ============================================================

const fmt = (n: number, decimals = 0) =>
  n.toLocaleString("tr-TR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

// A4: 210 × 297 mm
const A4_W = 210;
const A4_H = 297;
const M = 15; // margin

// ============================================================
// Public API
// ============================================================

export type WorkOrderProduct = "sticker" | "etiket";

export interface WorkOrderInput {
  lot: string;
  geometry: GeometryResult;
  cost: CostResult;
  requestedQty: number;
  cut: "tabaka" | "diecut";
  mode: ProductionMode;
  /** Ürün tipi — sticker veya etiket (rulo). Default: "sticker" */
  product?: WorkOrderProduct;
  /** Etiket için: malzeme + kaplama + özelleştirme bilgisi (gösterim için) */
  etiketDetails?: {
    material?: string;
    coating?: string;
    customization?: string;
  };
  customerName?: string;
  customerNotes?: string;
  termin?: string;
  pricingVersion?: string;
}

/**
 * 3-sayfa A4 PDF üretir, otomatik download tetikler.
 * PDF dosya adı: pim-etiket-{lot}.pdf
 */
export function generateWorkOrderPDF(input: WorkOrderInput): void {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });

  drawPage1Header(pdf, input);
  pdf.addPage();
  drawPage2Production(pdf, input);
  pdf.addPage();
  drawPage3Cost(pdf, input);

  pdf.save(`pim-etiket-${input.lot}.pdf`);
}

// ============================================================
// Page 1: İş Künyesi + Teknik Özellikler
// ============================================================

function drawPage1Header(pdf: jsPDF, input: WorkOrderInput): void {
  const { lot, geometry, cost, requestedQty, cut, mode, customerName } = input;
  const product: WorkOrderProduct = input.product ?? "sticker";
  const isEtiket = product === "etiket";
  const fit = geometry.fit;
  const roll = geometry.roll;

  // Top mercan stripe + lacivert header bar
  pdf.setFillColor(239, 62, 86);
  pdf.rect(0, 0, A4_W, 8, "F");
  pdf.setFillColor(31, 41, 55);
  pdf.rect(0, 8, A4_W, 35, "F");

  // Brand
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("PİM ETİKET", M, 25);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("Dijital Baskı · İş Emri", M, 32);

  // Lot box (sağ üst, mercan)
  pdf.setFillColor(239, 62, 86);
  pdf.roundedRect(A4_W - 60, 16, 45, 14, 2, 2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text(lot, A4_W - 37.5, 25, { align: "center" });
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "normal");
  pdf.text("LOT NO", A4_W - 37.5, 30, { align: "center" });

  // Date
  const now = new Date();
  const dateStr = now.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // İş Künyesi başlığı
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  let y = 60;
  pdf.text("İŞ KÜNYESİ", M, y);
  pdf.setDrawColor(239, 62, 86);
  pdf.setLineWidth(0.6);
  pdf.line(M, y + 2, M + 35, y + 2);

  y += 12;
  const künye: Array<[string, string]> = [
    ["Lot Numarası", lot],
    ["Tarih", `${dateStr}  ${timeStr}`],
    [
      "Ürün Tipi",
      isEtiket
        ? "Etiket (Rulo / Dijital Baskı)"
        : "Sticker (Dijital Baskı)",
    ],
    ["Üretim Modu", mode === "fason" ? "Fason" : "Kendi Üretim"],
  ];

  // Kesim tipi sadece sticker'da anlamlı (etikette her zaman die-cut rulo)
  if (!isEtiket) {
    künye.push([
      "Kesim Tipi",
      cut === "tabaka" ? "Tabaka (Yarım Kesim)" : "Die Cut (Tam Kesim)",
    ]);
  } else {
    künye.push(["Kesim Tipi", "Rulo (Die-Cut)"]);
    // Etiket detayları (varsa)
    if (input.etiketDetails) {
      const ed = input.etiketDetails;
      if (ed.material) künye.push(["Malzeme", ed.material]);
      if (ed.coating) künye.push(["Kaplama", ed.coating]);
      if (ed.customization) künye.push(["Özelleştirme", ed.customization]);
    }
  }

  künye.push(["Müşteri Sipariş Adedi", `${fmt(requestedQty)} adet`]);
  künye.push([
    "Üretilecek Adet",
    `${fmt(fit.producedQty)} adet${
      fit.producedQty > requestedQty
        ? ` (+${fit.producedQty - requestedQty} fire/hediye payı)`
        : ""
    }`,
  ]);
  künye.push(["Termin Süresi", input.termin ?? "5 iş günü (varsayılan)"]);

  if (customerName) {
    künye.unshift(["Müşteri", customerName]);
  }

  pdf.setFontSize(9);
  künye.forEach(([k, v]) => {
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(75, 85, 99);
    pdf.text(k, M, y);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(31, 41, 55);
    pdf.text(v, M + 65, y);
    y += 7;
  });

  // Teknik Özellikler
  y += 8;
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(31, 41, 55);
  pdf.text("TEKNİK ÖZELLİKLER", M, y);
  pdf.line(M, y + 2, M + 50, y + 2);

  y += 12;
  const teknik: Array<[string, string]> = isEtiket
    ? [
        // Etiket — rulo bazlı, tabaka kavramı yok
        [
          "Etiket Boyutu",
          `${fit.stickerW} × ${fit.stickerH} mm`,
        ],
        ["Boşluk (Gap)", `${fit.gap} mm`],
        ["Etiket / Rulo (max)", `${fit.perSheet} adet`],
        [
          "Toplam Rulo",
          `${roll.rollsNeeded} rulo (${roll.rollW} × ${ROLL_L} mm${
            roll.rollW < 600 ? `, ${600 - roll.rollW}mm tasarruf` : ""
          })`,
        ],
        [
          "Son Rulo",
          `${roll.sheetsOnLastRoll}/${roll.sheetsPerRoll} etiket`,
        ],
        ["Toplam Malzeme", `${geometry.totalM2.toFixed(3)} m²`],
        ["Fire Oranı", `%${geometry.wastePct.toFixed(1)}`],
      ]
    : [
        // Sticker — tabaka bazlı
        [
          "Sticker Boyutu",
          `${fit.stickerW} × ${fit.stickerH} mm${fit.rotated ? " (90° döndürülmüş)" : ""}`,
        ],
        ["Boşluk (Gap)", `${fit.gap} mm`],
        ["Tabaka Boyutu", `${fit.sheetW} × ${fit.sheetH} mm`],
        ["Tabaka Başına Adet", `${fit.perSheet} adet`],
        ["Toplam Tabaka", `${fit.sheetsNeeded} adet`],
        [
          "Rulo Sayısı",
          `${roll.rollsNeeded} rulo (${roll.rollW} × ${ROLL_L} mm${
            roll.rollW < 600 ? `, ${600 - roll.rollW}mm tasarruf` : ""
          })`,
        ],
        [
          "Rulo Verimliliği",
          `%${((fit.sheetsNeeded / (roll.rollsNeeded * roll.sheetsPerRoll)) * 100).toFixed(0)}`,
        ],
        ["Toplam Malzeme", `${geometry.totalM2.toFixed(3)} m²`],
        ["Fire Oranı", `%${geometry.wastePct.toFixed(1)}`],
      ];

  pdf.setFontSize(9);
  teknik.forEach(([k, v]) => {
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(75, 85, 99);
    pdf.text(k, M, y);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(31, 41, 55);
    pdf.text(v, M + 65, y);
    y += 7;
  });

  // Müşteri notları (varsa)
  if (input.customerNotes) {
    y += 8;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(31, 41, 55);
    pdf.text("NOTLAR", M, y);
    pdf.line(M, y + 2, M + 22, y + 2);

    y += 8;
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(9);
    pdf.setTextColor(75, 85, 99);
    const splitNotes = pdf.splitTextToSize(input.customerNotes, A4_W - 2 * M);
    pdf.text(splitNotes, M, y);
  }

  // Footer
  drawFooter(pdf, 1, lot);
  // Suppress unused parameter warning — cost retained for future page-1 detail expansion
  void cost;
}

// ============================================================
// Page 2: Üretim Planı (rulo + tabaka)
// ============================================================

function drawPage2Production(pdf: jsPDF, input: WorkOrderInput): void {
  const { lot, geometry } = input;
  const product: WorkOrderProduct = input.product ?? "sticker";
  const isEtiket = product === "etiket";
  const { fit, roll } = geometry;
  const dist = computeSheetDistribution(geometry);

  // Header
  pdf.setFillColor(31, 41, 55);
  pdf.rect(0, 0, A4_W, 25, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("ÜRETİM PLANI", M, 16);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text(`LOT ${lot}`, A4_W - M, 16, { align: "right" });

  // Rulo plan (proportional, 1 örnek)
  let y = 35;
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("RULO PLANI", M, y);
  pdf.setDrawColor(239, 62, 86);
  pdf.setLineWidth(0.6);
  pdf.line(M, y + 2, M + 30, y + 2);

  y += 8;
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(75, 85, 99);
  pdf.text(
    isEtiket
      ? `${roll.rollsNeeded} rulo · ${roll.rollW} × ${ROLL_L} mm · ${geometry.totalM2.toFixed(3)} m² · %${geometry.wastePct.toFixed(1)} fire`
      : `${roll.rollsNeeded} rulo · ${roll.rollW} × ${ROLL_L} mm · ${fit.sheetsNeeded} tabaka · ${geometry.totalM2.toFixed(3)} m² · %${geometry.wastePct.toFixed(1)} fire`,
    M,
    y
  );

  // Rulo görseli (proportional A4 width'e ölçekle)
  y += 4;
  const drawableW = A4_W - 2 * M;
  const scaleX = drawableW / ROLL_L;
  const rollPxW = drawableW;
  const rollPxH = roll.rollW * scaleX;

  // Outer rect
  pdf.setDrawColor(31, 41, 55);
  pdf.setLineWidth(0.5);
  pdf.setFillColor(255, 255, 255);
  pdf.rect(M, y, rollPxW, rollPxH, "FD");

  // Cut mark bands (top + bottom 40mm)
  const cutH = ROLL_MARGIN_X * scaleX;
  pdf.setFillColor(254, 243, 242);
  pdf.rect(M, y, rollPxW, cutH, "F");
  pdf.rect(M, y + rollPxH - cutH, rollPxW, cutH, "F");
  pdf.setTextColor(139, 123, 92);
  pdf.setFontSize(6);
  pdf.text(`${ROLL_MARGIN_X}mm KESİM MARKASI`, M + rollPxW / 2, y + cutH / 2 + 1, {
    align: "center",
  });

  // Start area (left)
  const startW = ROLL_START_MARGIN * scaleX;
  const sidePad = (roll.rollW - roll.cols * fit.sheetW) / 2;
  const sidePadPx = sidePad * scaleX;
  pdf.setFillColor(255, 252, 236);
  pdf.rect(M, y + sidePadPx, startW, rollPxH - 2 * sidePadPx, "F");

  // Sheets (column-major fill — ilk rulo dolu varsayım, son rulo varsa)
  const sheetXmm = fit.sheetH;
  const sheetYmm = fit.sheetW;
  const sheetXpx = sheetXmm * scaleX;
  const sheetYpx = sheetYmm * scaleX;
  const sheetsThisRoll = Math.min(fit.sheetsNeeded, roll.sheetsPerRoll);

  pdf.setFontSize(7);
  let localIdx = 0;
  for (let yy = 0; yy < roll.cols && localIdx < sheetsThisRoll; yy++) {
    for (let xx = 0; xx < roll.rows && localIdx < sheetsThisRoll; xx++) {
      const sx = M + ROLL_START_MARGIN * scaleX + xx * sheetXpx;
      const sy = y + sidePadPx + yy * sheetYpx;
      pdf.setFillColor(255, 248, 242);
      pdf.setDrawColor(239, 62, 86);
      pdf.setLineWidth(0.4);
      pdf.rect(sx + 0.5, sy + 0.5, sheetXpx - 1, sheetYpx - 1, "FD");
      pdf.setTextColor(31, 41, 55);
      pdf.setFont("helvetica", "bold");
      const isLast =
        roll.rollsNeeded === 1 && localIdx === sheetsThisRoll - 1;
      const qtyHere = isLast ? dist.lastSheetCount : dist.balancedPerSheet;
      pdf.text(
        `T${localIdx + 1}`,
        sx + 1.5,
        sy + 3,
        { align: "left" }
      );
      pdf.setFontSize(10);
      pdf.text(`${qtyHere}`, sx + sheetXpx / 2, sy + sheetYpx / 2, {
        align: "center",
      });
      pdf.setFontSize(6);
      pdf.text("adet", sx + sheetXpx / 2, sy + sheetYpx / 2 + 3, {
        align: "center",
      });
      pdf.setFontSize(7);
      localIdx++;
    }
  }

  y += rollPxH + 4;

  if (roll.rollsNeeded > 1) {
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "italic");
    pdf.setTextColor(120, 113, 108);
    pdf.text(
      isEtiket
        ? `+ ${roll.rollsNeeded - 1} rulo aynı plan ile (son rulo: ${roll.sheetsOnLastRoll}/${roll.sheetsPerRoll} etiket)`
        : `+ ${roll.rollsNeeded - 1} rulo aynı plan ile (son rulo: ${roll.sheetsOnLastRoll}/${roll.sheetsPerRoll} tabaka)`,
      M,
      y
    );
    y += 8;
  }

  // Tabaka/etiket detayı
  y += 6;
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text(isEtiket ? "ETİKET GRİDİ (Rulo İçinden)" : "TABAKA DETAYI", M, y);
  pdf.line(M, y + 2, M + (isEtiket ? 60 : 35), y + 2);

  y += 10;
  // Sheet outline (mm bazında, 80mm yükseklik için ölçekle)
  const sheetDetailH = 100;
  const sheetScale = Math.min(sheetDetailH / fit.sheetH, drawableW / fit.sheetW);
  const detW = fit.sheetW * sheetScale;
  const detH = fit.sheetH * sheetScale;
  const detX = M;
  const detY = y;

  pdf.setDrawColor(31, 41, 55);
  pdf.setLineWidth(0.4);
  pdf.setFillColor(255, 255, 255);
  pdf.rect(detX, detY, detW, detH, "FD");

  // Sticker grid
  const usedW = fit.cols * fit.stickerW + (fit.cols - 1) * fit.gap;
  const usedH = fit.rows * fit.stickerH + (fit.rows - 1) * fit.gap;
  const offsetX = (fit.sheetW - usedW) / 2;
  const offsetY = (fit.sheetH - usedH) / 2;

  let pos = 0;
  const stickersOnSheet =
    fit.sheetsNeeded === 1 ? fit.producedQty : dist.balancedPerSheet;

  for (let row = 0; row < fit.rows; row++) {
    for (let col = 0; col < fit.cols; col++) {
      const filled = pos < stickersOnSheet;
      const sxMm = offsetX + col * (fit.stickerW + fit.gap);
      const syMm = offsetY + row * (fit.stickerH + fit.gap);
      const sx = detX + sxMm * sheetScale;
      const sy = detY + syMm * sheetScale;
      const sw = fit.stickerW * sheetScale;
      const sh = fit.stickerH * sheetScale;

      if (filled) {
        const accent = (row + col) % 2 === 0;
        if (accent) {
          pdf.setFillColor(239, 62, 86);
        } else {
          pdf.setFillColor(255, 168, 158);
        }
        pdf.rect(sx, sy, sw, sh, "F");
      } else {
        pdf.setDrawColor(196, 176, 145);
        pdf.setLineDashPattern([1, 1], 0);
        pdf.rect(sx, sy, sw, sh, "S");
        pdf.setLineDashPattern([], 0);
      }
      pos++;
    }
  }

  // Sheet info under
  y = detY + detH + 6;
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(75, 85, 99);
  pdf.text(
    isEtiket
      ? `Rulo eni ${fit.sheetW}mm · ${fit.cols}×${fit.rows} grid · ${fit.perSheet} etiket/rulo · gap ${fit.gap}mm`
      : `${fit.sheetW}×${fit.sheetH}mm tabaka · ${fit.cols}×${fit.rows} grid · ${fit.perSheet} ad/tabaka · gap ${fit.gap}mm`,
    M,
    y
  );

  drawFooter(pdf, 2, lot);
}

// ============================================================
// Page 3: Maliyet Detayı + Onay
// ============================================================

function drawPage3Cost(pdf: jsPDF, input: WorkOrderInput): void {
  const { lot, cost, requestedQty } = input;

  // Header
  pdf.setFillColor(31, 41, 55);
  pdf.rect(0, 0, A4_W, 25, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("MALİYET DETAYI & ONAY", M, 16);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text(`LOT ${lot}`, A4_W - M, 16, { align: "right" });

  let y = 38;

  // ① Üretim
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("① ÜRETİM", M, y);
  pdf.setDrawColor(239, 62, 86);
  pdf.setLineWidth(0.6);
  pdf.line(M, y + 2, M + 22, y + 2);

  y += 8;
  pdf.setFontSize(9);
  cost.productionItems.forEach((item) => {
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(75, 85, 99);
    pdf.text(item.name, M, y);
    pdf.setFontSize(7);
    pdf.text(`(${item.formula})`, M + 50, y);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(31, 41, 55);
    pdf.text(`${fmt(item.amount)} ₺`, A4_W - M, y, { align: "right" });
    y += 6;
  });

  // Üretim ara toplam
  pdf.setFillColor(245, 235, 217);
  pdf.rect(M - 2, y - 4, A4_W - 2 * M + 4, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(31, 41, 55);
  pdf.text("Üretim Ara Toplam", M, y);
  pdf.text(`${fmt(cost.productionCost)} ₺`, A4_W - M, y, { align: "right" });
  y += 12;

  // ② Operasyon
  pdf.setFontSize(11);
  pdf.text("② OPERASYON", M, y);
  pdf.setDrawColor(255, 153, 51);
  pdf.line(M, y + 2, M + 30, y + 2);

  y += 8;
  pdf.setFontSize(9);
  cost.operationItems.forEach((item) => {
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(75, 85, 99);
    pdf.text(item.name, M, y);
    pdf.setFontSize(7);
    pdf.text(`(${item.formula})`, M + 50, y);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(31, 41, 55);
    pdf.text(`${fmt(item.amount)} ₺`, A4_W - M, y, { align: "right" });
    y += 6;
  });

  // Operasyon ara toplam
  pdf.setFillColor(245, 235, 217);
  pdf.rect(M - 2, y - 4, A4_W - 2 * M + 4, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.text("Operasyon Ara Toplam", M, y);
  pdf.text(`${fmt(cost.operationCost)} ₺`, A4_W - M, y, { align: "right" });
  y += 12;

  // Toplam Maliyet (lacivert blok)
  pdf.setFillColor(31, 41, 55);
  pdf.rect(M - 2, y - 5, A4_W - 2 * M + 4, 11, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("TOPLAM MALİYET", M, y + 1);
  pdf.text(`${fmt(cost.baseCost)} ₺`, A4_W - M, y + 1, { align: "right" });
  y += 14;

  // ③ Kar + Tier + KDV
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("③ KAR & VERGİ", M, y);
  pdf.setDrawColor(16, 185, 129);
  pdf.line(M, y + 2, M + 30, y + 2);

  y += 8;
  pdf.setFontSize(9);
  const breakdown: Array<[string, string]> = [
    [`Kar Marjı (markup ×${cost.tierMultiplier === 1 ? "1.00" : cost.tierMultiplier.toFixed(2)})`, `${fmt(cost.intendedProfit)} ₺ (intended)`],
    [`Net Kar (Sefa cebine giren)`, `${fmt(cost.actualProfit)} ₺ (actual)`],
    [`PSP Komisyonu (gross-up)`, `${fmt(cost.processingFee)} ₺`],
  ];

  if (Math.abs(cost.tierMultiplier - 1) > 0.001) {
    const sign = cost.tierAdjustment > 0 ? "+" : "−";
    breakdown.push([
      `Tier Ayarı (×${cost.tierMultiplier.toFixed(2)})`,
      `${sign}${fmt(Math.abs(cost.tierAdjustment))} ₺`,
    ]);
  }

  breakdown.push(["KDV (%20)", `${fmt(cost.vatAmount)} ₺`]);

  breakdown.forEach(([k, v]) => {
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(75, 85, 99);
    pdf.text(k, M, y);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(31, 41, 55);
    pdf.text(v, A4_W - M, y, { align: "right" });
    y += 6;
  });

  y += 4;

  // Müşteri Toplam Fiyatı (mercan blok)
  pdf.setFillColor(239, 62, 86);
  pdf.roundedRect(M - 2, y - 6, A4_W - 2 * M + 4, 14, 2, 2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(13);
  pdf.setFont("helvetica", "bold");
  pdf.text("MÜŞTERİ TOPLAM FİYATI (KDV DAHİL)", M, y + 1);
  pdf.text(`${fmt(cost.total)} ₺`, A4_W - M, y + 1, { align: "right" });
  y += 8;
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text(
    `${fmt(requestedQty)} adet × ${fmt(cost.unitPrice, 2)} ₺/adet`,
    M,
    y + 1
  );
  y += 18;

  // Operatör imza alanı
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("OPERATÖR ONAYI", M, y);
  pdf.line(M, y + 2, M + 35, y + 2);

  y += 14;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(75, 85, 99);
  pdf.text("Tarih:", M, y);
  pdf.line(M + 15, y, M + 60, y);
  pdf.text("İmza:", M + 75, y);
  pdf.line(M + 90, y, M + 165, y);

  drawFooter(pdf, 3, lot);
}

// ============================================================
// Footer
// ============================================================

function drawFooter(pdf: jsPDF, pageNum: number, lot: string): void {
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "italic");
  pdf.setTextColor(155, 151, 137);
  pdf.text(
    `pim etiket · ${lot} · sayfa ${pageNum}/3 · pricing-engine v0.4`,
    A4_W / 2,
    A4_H - 8,
    { align: "center" }
  );
}

// ============================================================
// Lot atomik üretici (admin tool için — localStorage)
// ============================================================

const LOT_KEY_PREFIX = "pim_lot_counter_";

export function nextLot(prefix: "A" | "B" = "A"): string {
  if (typeof localStorage === "undefined") {
    return `${prefix}000001`;
  }
  const key = `${LOT_KEY_PREFIX}${prefix}`;
  const current = parseInt(localStorage.getItem(key) ?? "0", 10);
  const next = current + 1;
  localStorage.setItem(key, String(next));
  return prefix + String(next).padStart(6, "0");
}

export function peekNextLot(prefix: "A" | "B" = "A"): string {
  if (typeof localStorage === "undefined") {
    return `${prefix}000001`;
  }
  const key = `${LOT_KEY_PREFIX}${prefix}`;
  const current = parseInt(localStorage.getItem(key) ?? "0", 10);
  return prefix + String(current + 1).padStart(6, "0");
}
