/**
 * Pim Etiket — Kargo Etiketi PDF Üretici (100 × 150 mm termal).
 *
 * Sefa 19 May v68 (Faz A — sözleşme öncesi):
 *   - Yurtiçi Kargo sözleşmesi henüz yok → tracking_number opsiyonel.
 *   - Tracking var: gerçek barkod (Code128).
 *   - Tracking yok: geçici cargoKey (PIM-{orderId}-{rand4}) — şubeye götür,
 *     şubeden barkod al, AdminTrackingForm'a gir, etiketi yeniden indir.
 *
 * Format: 100 × 150 mm — Yurtiçi standart termal etiket boyutu.
 * Font: jsPDF default Helvetica (Latin1) — Türkçe karakterler için
 *   asciiFold() helper'ı çağrılır.
 *
 * Bağımlılık: jspdf (var) + bwip-js (Mig 19 May v68 install).
 */

import jsPDF from "jspdf";
import bwipjs from "bwip-js/node";

// ============================================================
// Tipler
// ============================================================
export interface LabelData {
  /** Sipariş ID (örn. "00000123") — etiket üzerinde gösterilir */
  orderCode: string;
  /** Yurtiçi'den gelen tracking number. Yoksa cargoKey kullanılır. */
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

/**
 * Türkçe karakterleri ASCII'ye düşür — jsPDF default Helvetica
 * (Latin1/WinAnsi) Ş/Ğ/İ/ç gibi bazı karakterleri render edemiyor.
 *
 * NOT: Sözleşme sonrası TTF embed ile gerçek Türkçe support eklenecek.
 */
function asciiFold(s: string): string {
  if (!s) return "";
  return s
    .replace(/Ş/g, "S")
    .replace(/ş/g, "s")
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "g")
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "o")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "u")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "c");
}

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
 * Dönüş: Uint8Array (NextResponse'a doğrudan stream'lenebilir).
 */
export async function generateShippingLabel(
  data: LabelData
): Promise<Uint8Array> {
  const W = 100;
  const H = 150;

  const doc = new jsPDF({
    unit: "mm",
    format: [W, H],
    orientation: "portrait",
  });

  // ====================================================
  // Header
  // ====================================================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("PIM ETIKET", 6, 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("YURTICI KARGO", W - 6, 6, { align: "right" });
  doc.text(
    data.createdAt.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    W - 6,
    10,
    { align: "right" }
  );

  doc.setLineWidth(0.5);
  doc.line(6, 12, W - 6, 12);

  // ====================================================
  // Gönderen
  // ====================================================
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text("GONDEREN", 6, 17);
  doc.setTextColor(0, 0, 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(asciiFold(data.sender.name), 6, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const senderAddrLines = wrap(asciiFold(data.sender.address), 55);
  let y = 26;
  for (const line of senderAddrLines) {
    doc.text(line, 6, y);
    y += 3.5;
  }
  doc.text(asciiFold(data.sender.city), 6, y);
  y += 3.5;
  doc.text(formatPhone(data.sender.phone), 6, y);

  // ====================================================
  // Alıcı banner (siyah arka plan)
  // ====================================================
  y = 44;
  doc.setFillColor(0, 0, 0);
  doc.rect(6, y, W - 12, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("ALICI", 8, y + 4.2);
  doc.setTextColor(0, 0, 0);

  // ====================================================
  // Alıcı bilgileri
  // ====================================================
  y += 11;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(asciiFold(data.receiver.name), 6, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(formatPhone(data.receiver.phone), 6, y);

  y += 5;
  doc.setFontSize(9);
  const recvAddrLines = wrap(asciiFold(data.receiver.address), 50);
  for (const line of recvAddrLines.slice(0, 3)) {
    doc.text(line, 6, y);
    y += 4;
  }

  y += 1;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(asciiFold(data.receiver.city).toUpperCase(), 6, y);

  // ====================================================
  // Sipariş bilgi şeridi
  // ====================================================
  y = 110;
  doc.setLineWidth(0.3);
  doc.line(6, y, W - 6, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Siparis: ${data.orderCode}`, 6, y);
  doc.text(`${data.cargoCount} koli`, W / 2, y, { align: "center" });
  doc.text(`${data.totalKg.toFixed(1)} kg`, W - 6, y, { align: "right" });

  // ====================================================
  // Barkod
  // ====================================================
  const barcodeValue = data.trackingNumber ?? data.cargoKey;
  const hasRealTracking = !!data.trackingNumber;

  try {
    const png = await buildBarcodePng(barcodeValue);
    const base64 = Buffer.from(png).toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    y += 4;
    const barcodeW = 75;
    const barcodeH = 15;
    const barcodeX = (W - barcodeW) / 2;
    doc.addImage(dataUrl, "PNG", barcodeX, y, barcodeW, barcodeH);

    y += barcodeH + 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(barcodeValue, W / 2, y, { align: "center" });

    if (!hasRealTracking) {
      y += 4;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6.5);
      doc.setTextColor(180, 40, 40);
      doc.text(
        "GECICI - Yurtici subesinden barkod alindiktan sonra yeniden yazdirin",
        W / 2,
        y,
        { align: "center" }
      );
      doc.setTextColor(0, 0, 0);
    }
  } catch (err) {
    // Barkod üretilemese de etiket basılsın (text fallback)
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(barcodeValue, W / 2, y, { align: "center" });
    console.warn("[label] barcode generation failed:", err);
  }

  // ====================================================
  // Footer
  // ====================================================
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    asciiFold(data.description ?? "Icerik: Sticker / Etiket"),
    6,
    H - 4
  );
  doc.text("pimetiket.com", W - 6, H - 4, { align: "right" });

  const arrayBuffer = doc.output("arraybuffer");
  return new Uint8Array(arrayBuffer);
}
