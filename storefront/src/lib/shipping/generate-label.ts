/**
 * Pim Etiket — Kargo Etiketi PDF Üretici (100 × 150 mm termal).
 *
 * Sefa 19 May v68:
 *   - Faz A: jsPDF + Latin1 (Türkçe karakterler ASCII'ye düşüyordu)
 *   - Madde 4 (refactor): pdf-lib + fontkit + Noto Sans TR TTF embed
 *     → Ş, ğ, İ, ç gerçek render edilir, asciiFold() artık yok.
 *
 * Format: 100 × 150 mm — Yurtici standart termal etiket boyutu.
 * Engine: pdf-lib (Unicode native) + bwip-js Code128 barkod.
 * Font: Noto Sans Regular + Bold (OFL, ticari kullanım serbest).
 *
 * pdf-lib coordinate sistemi BOTTOM-UP — y=0 sayfa altında.
 * mm cinsinden layout için yMm() helper'ı kullanılır.
 */

import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import bwipjs from "bwip-js/node";
// Sefa 20 May v68 (DevOps agent P2): noto-sans-base64.ts ~1.6MB.
// Static import → her cold-start'ta parse cezası. Dynamic import ile
// font sadece generateShippingLabel çağrılınca yüklenir.

// ============================================================
// Tipler
// ============================================================
export interface LabelData {
  /** Sipariş ID (örn. "00000123") — etiket üzerinde gösterilir */
  orderCode: string;
  /** Yurtici'den gelen tracking number. Yoksa cargoKey kullanılır. */
  trackingNumber: string | null;
  /** Manuel/geçici cargoKey (tracking yokken barkod için). */
  cargoKey: string;
  /** Sipariş tarihi */
  createdAt: Date;
  /** Toplam paket sayısı */
  cargoCount: number;
  /** Toplam kg (tahmini) */
  totalKg: number;
  sender: {
    name: string;
    address: string;
    city: string;
    phone: string;
  };
  receiver: {
    name: string;
    phone: string;
    address: string;
    city: string;
  };
  /** Etiket üzerinde içerik açıklaması */
  description?: string;
}

// ============================================================
// Helpers
// ============================================================

/** mm → pt (PDF point). 1 mm = 2.834645669 pt. */
const MM = 2.834645669;
const mm = (v: number) => v * MM;

/** Adres satırını maksimum karakter sayısına böl (basit word-wrap). */
function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= max) {
      cur = (cur + " " + w).trim();
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Telefonu okunabilir hale getir: 5XXXXXXXXX → 0 5XX XXX XX XX */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  let d = digits;
  if (d.startsWith("90") && d.length === 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  if (d.length !== 10) return raw;
  return `0 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
}

async function buildBarcodePng(text: string): Promise<Uint8Array> {
  const buf = await bwipjs.toBuffer({
    bcid: "code128",
    text,
    scale: 3,
    height: 14,
    includetext: false,
    backgroundcolor: "FFFFFF",
  });
  return new Uint8Array(buf);
}

// ============================================================
// Public API
// ============================================================
/**
 * 100 × 150 mm tek sayfalık kargo etiketi PDF üret.
 * Dönüş: Uint8Array.
 */
export async function generateShippingLabel(
  data: LabelData
): Promise<Uint8Array> {
  const W_MM = 100;
  const H_MM = 150;
  const W = mm(W_MM);
  const H = mm(H_MM);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Noto Sans TR embed (Türkçe karakterler için) — lazy load
  const { NOTOSANS_REGULAR_BASE64, NOTOSANS_BOLD_BASE64 } = await import(
    "./fonts/noto-sans-base64"
  );
  const regularBytes = Uint8Array.from(
    Buffer.from(NOTOSANS_REGULAR_BASE64, "base64")
  );
  const boldBytes = Uint8Array.from(
    Buffer.from(NOTOSANS_BOLD_BASE64, "base64")
  );
  const font = await pdfDoc.embedFont(regularBytes, { subset: true });
  const bold = await pdfDoc.embedFont(boldBytes, { subset: true });

  const page = pdfDoc.addPage([W, H]);

  // y koordinatları pdf-lib'de BOTTOM-UP. Layout üst-aşağı düşünüyoruz
  // — yT mm "üstten aşağı" değerini alıp pt cinsinden tabandan dönüştürür.
  const yT = (yFromTopMm: number) => H - mm(yFromTopMm);
  const BLACK = rgb(0, 0, 0);
  const WHITE = rgb(1, 1, 1);
  const GRAY = rgb(0.47, 0.47, 0.47);
  const RED_WARN = rgb(0.7, 0.16, 0.16);

  // ====================================================
  // Header — "PIM ETIKET" + "YURTİÇİ KARGO" + tarih
  // ====================================================
  page.drawText("PIM ETIKET", {
    x: mm(6),
    y: yT(10),
    size: 14,
    font: bold,
    color: BLACK,
  });

  const dateText = data.createdAt.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const headerRightText = "YURTİÇİ KARGO";
  const headerRightW = font.widthOfTextAtSize(headerRightText, 8);
  page.drawText(headerRightText, {
    x: W - mm(6) - headerRightW,
    y: yT(7),
    size: 8,
    font,
    color: BLACK,
  });
  const dateW = font.widthOfTextAtSize(dateText, 8);
  page.drawText(dateText, {
    x: W - mm(6) - dateW,
    y: yT(11),
    size: 8,
    font,
    color: BLACK,
  });

  // Üst ayraç çizgisi
  page.drawLine({
    start: { x: mm(6), y: yT(14) },
    end: { x: W - mm(6), y: yT(14) },
    thickness: 0.5,
    color: BLACK,
  });

  // ====================================================
  // Gönderen
  // ====================================================
  page.drawText("GÖNDEREN", {
    x: mm(6),
    y: yT(19),
    size: 7,
    font,
    color: GRAY,
  });

  page.drawText(data.sender.name, {
    x: mm(6),
    y: yT(24),
    size: 10,
    font: bold,
    color: BLACK,
  });

  const senderAddrLines = wrap(data.sender.address, 55);
  let y = 28;
  for (const line of senderAddrLines) {
    page.drawText(line, { x: mm(6), y: yT(y), size: 8, font, color: BLACK });
    y += 3.5;
  }
  page.drawText(data.sender.city, {
    x: mm(6),
    y: yT(y),
    size: 8,
    font,
    color: BLACK,
  });
  y += 3.5;
  page.drawText(formatPhone(data.sender.phone), {
    x: mm(6),
    y: yT(y),
    size: 8,
    font,
    color: BLACK,
  });

  // ====================================================
  // Alıcı banner (siyah arka plan)
  // ====================================================
  const bannerYTop = 46;
  page.drawRectangle({
    x: mm(6),
    y: yT(bannerYTop + 6), // bottom-up: y = bannerYTop + height
    width: W - mm(12),
    height: mm(6),
    color: BLACK,
  });
  page.drawText("ALICI", {
    x: mm(8),
    y: yT(bannerYTop + 4.2),
    size: 10,
    font: bold,
    color: WHITE,
  });

  // ====================================================
  // Alıcı bilgileri
  // ====================================================
  page.drawText(data.receiver.name, {
    x: mm(6),
    y: yT(57),
    size: 13,
    font: bold,
    color: BLACK,
  });

  page.drawText(formatPhone(data.receiver.phone), {
    x: mm(6),
    y: yT(63),
    size: 10,
    font,
    color: BLACK,
  });

  const recvAddrLines = wrap(data.receiver.address, 50);
  let ry = 68;
  for (const line of recvAddrLines.slice(0, 3)) {
    page.drawText(line, { x: mm(6), y: yT(ry), size: 9, font, color: BLACK });
    ry += 4;
  }

  ry += 1;
  page.drawText(data.receiver.city.toLocaleUpperCase("tr-TR"), {
    x: mm(6),
    y: yT(ry),
    size: 12,
    font: bold,
    color: BLACK,
  });

  // ====================================================
  // Sipariş bilgi şeridi
  // ====================================================
  const infoY = 110;
  page.drawLine({
    start: { x: mm(6), y: yT(infoY) },
    end: { x: W - mm(6), y: yT(infoY) },
    thickness: 0.3,
    color: BLACK,
  });

  page.drawText(`Sipariş: ${data.orderCode}`, {
    x: mm(6),
    y: yT(infoY + 5),
    size: 8,
    font,
    color: BLACK,
  });
  const middleText = `${data.cargoCount} koli`;
  const middleW = font.widthOfTextAtSize(middleText, 8);
  page.drawText(middleText, {
    x: W / 2 - middleW / 2,
    y: yT(infoY + 5),
    size: 8,
    font,
    color: BLACK,
  });
  const rightText = `${data.totalKg.toFixed(1)} kg`;
  const rightW = font.widthOfTextAtSize(rightText, 8);
  page.drawText(rightText, {
    x: W - mm(6) - rightW,
    y: yT(infoY + 5),
    size: 8,
    font,
    color: BLACK,
  });

  // ====================================================
  // Barkod
  // ====================================================
  const barcodeValue = data.trackingNumber ?? data.cargoKey;
  const hasRealTracking = !!data.trackingNumber;

  try {
    const png = await buildBarcodePng(barcodeValue);
    const barcodeImg = await pdfDoc.embedPng(png);

    const barcodeWMm = 75;
    const barcodeHMm = 15;
    const barcodeXMm = (W_MM - barcodeWMm) / 2;
    const barcodeYTopMm = infoY + 9;

    page.drawImage(barcodeImg, {
      x: mm(barcodeXMm),
      y: yT(barcodeYTopMm + barcodeHMm),
      width: mm(barcodeWMm),
      height: mm(barcodeHMm),
    });

    const barcodeTextY = barcodeYTopMm + barcodeHMm + 4;
    const codeW = bold.widthOfTextAtSize(barcodeValue, 11);
    page.drawText(barcodeValue, {
      x: W / 2 - codeW / 2,
      y: yT(barcodeTextY),
      size: 11,
      font: bold,
      color: BLACK,
    });

    if (!hasRealTracking) {
      const warnText =
        "GEÇİCİ — Yurtiçi şubesinden barkod alındıktan sonra yeniden yazdırın";
      const warnW = font.widthOfTextAtSize(warnText, 6.5);
      page.drawText(warnText, {
        x: W / 2 - warnW / 2,
        y: yT(barcodeTextY + 4),
        size: 6.5,
        font,
        color: RED_WARN,
      });
    }
  } catch (err) {
    // Barkod üretilemese de etiket basılsın (text fallback)
    const fbW = bold.widthOfTextAtSize(barcodeValue, 11);
    page.drawText(barcodeValue, {
      x: W / 2 - fbW / 2,
      y: yT(infoY + 15),
      size: 11,
      font: bold,
      color: BLACK,
    });
    console.warn("[label] barcode generation failed:", err);
  }

  // ====================================================
  // Footer
  // ====================================================
  const footerText = data.description ?? "İçerik: Sticker / Etiket";
  page.drawText(footerText, {
    x: mm(6),
    y: mm(4),
    size: 7,
    font,
    color: GRAY,
  });

  const siteText = "pimetiket.com";
  const siteW = font.widthOfTextAtSize(siteText, 7);
  page.drawText(siteText, {
    x: W - mm(6) - siteW,
    y: mm(4),
    size: 7,
    font,
    color: GRAY,
  });

  return await pdfDoc.save();
}
