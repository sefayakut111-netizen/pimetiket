import "server-only";

import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const MM = 2.834645669;
const mm = (v: number) => v * MM;

export interface InvoiceLineItem {
  title: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceData {
  orderId: string;
  createdAt: Date;
  invoice: {
    type: "individual" | "corporate";
    tc?: string;
    vkn?: string;
    companyName?: string;
    taxOffice?: string;
  };
  address: {
    name: string;
    addr: string;
    city: string;
    phone: string;
  };
  payment: {
    method: "card" | "transfer";
    masked?: string;
  };
  items: InvoiceLineItem[];
  subtotal: number;
  shipping: number;
  total: number;
}

function formatTry(amount: number): string {
  return `${amount.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₺`;
}

function maskTc(tc?: string): string {
  if (!tc || tc.length < 5) return tc ?? "—";
  return `${tc.slice(0, 3)}******${tc.slice(-2)}`;
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const W = mm(210);
  const H = mm(297);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle(`Fatura Özeti — ${data.orderId}`);
  pdfDoc.setProducer("Pim Etiket");
  pdfDoc.setKeywords(["fatura", "sipariş", data.orderId]);

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

  page.drawText("PIM ETİKET", {
    x: mm(20),
    y: yT(y),
    size: 18,
    font: bold,
    color: mercan,
  });
  y += 8;
  page.drawText("Sefa Yakut Kırtasiye Baskı Ticaret Ltd. Şti.", {
    x: mm(20),
    y: yT(y),
    size: 9,
    font: regular,
    color: gray,
  });
  y += 5;
  page.drawText("Çankaya / Ankara · info@pimetiket.com", {
    x: mm(20),
    y: yT(y),
    size: 9,
    font: regular,
    color: gray,
  });

  page.drawText("SİPARİŞ FATURASI ÖZETİ", {
    x: mm(120),
    y: yT(18),
    size: 12,
    font: bold,
    color: black,
  });
  page.drawText(`Sipariş No: ${data.orderId}`, {
    x: mm(120),
    y: yT(26),
    size: 10,
    font: regular,
    color: black,
  });
  page.drawText(
    `Tarih: ${data.createdAt.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })}`,
    {
      x: mm(120),
      y: yT(32),
      size: 10,
      font: regular,
      color: black,
    }
  );

  y = 48;
  page.drawLine({
    start: { x: mm(20), y: yT(y) },
    end: { x: mm(190), y: yT(y) },
    thickness: 0.5,
    color: gray,
  });
  y += 10;

  page.drawText("Fatura bilgileri", {
    x: mm(20),
    y: yT(y),
    size: 11,
    font: bold,
    color: black,
  });
  y += 7;

  if (data.invoice.type === "corporate") {
    page.drawText(data.invoice.companyName ?? "—", {
      x: mm(20),
      y: yT(y),
      size: 10,
      font: regular,
      color: black,
    });
    y += 5;
    page.drawText(`VKN: ${data.invoice.vkn ?? "—"}`, {
      x: mm(20),
      y: yT(y),
      size: 10,
      font: regular,
      color: black,
    });
    y += 5;
    page.drawText(`Vergi Dairesi: ${data.invoice.taxOffice ?? "—"}`, {
      x: mm(20),
      y: yT(y),
      size: 10,
      font: regular,
      color: black,
    });
  } else {
    page.drawText(data.address.name, {
      x: mm(20),
      y: yT(y),
      size: 10,
      font: regular,
      color: black,
    });
    y += 5;
    page.drawText(`TC: ${maskTc(data.invoice.tc)}`, {
      x: mm(20),
      y: yT(y),
      size: 10,
      font: regular,
      color: black,
    });
  }

  y += 5;
  page.drawText(`${data.address.addr}, ${data.address.city}`, {
    x: mm(20),
    y: yT(y),
    size: 9,
    font: regular,
    color: gray,
  });
  y += 5;
  page.drawText(data.address.phone, {
    x: mm(20),
    y: yT(y),
    size: 9,
    font: regular,
    color: gray,
  });

  y += 14;
  page.drawText("Kalemler", {
    x: mm(20),
    y: yT(y),
    size: 11,
    font: bold,
    color: black,
  });
  y += 8;

  page.drawText("Ürün", { x: mm(20), y: yT(y), size: 9, font: bold, color: gray });
  page.drawText("Adet", { x: mm(120), y: yT(y), size: 9, font: bold, color: gray });
  page.drawText("Birim", { x: mm(140), y: yT(y), size: 9, font: bold, color: gray });
  page.drawText("Tutar", { x: mm(165), y: yT(y), size: 9, font: bold, color: gray });
  y += 6;

  for (const item of data.items) {
    const title =
      item.title.length > 42 ? `${item.title.slice(0, 39)}…` : item.title;
    page.drawText(title, {
      x: mm(20),
      y: yT(y),
      size: 9,
      font: regular,
      color: black,
    });
    page.drawText(String(item.qty), {
      x: mm(120),
      y: yT(y),
      size: 9,
      font: regular,
      color: black,
    });
    page.drawText(formatTry(item.unitPrice), {
      x: mm(140),
      y: yT(y),
      size: 9,
      font: regular,
      color: black,
    });
    page.drawText(formatTry(item.lineTotal), {
      x: mm(165),
      y: yT(y),
      size: 9,
      font: regular,
      color: black,
    });
    y += 6;
  }

  y += 6;
  page.drawLine({
    start: { x: mm(120), y: yT(y) },
    end: { x: mm(190), y: yT(y) },
    thickness: 0.3,
    color: gray,
  });
  y += 8;

  const kdvBase = data.total / 1.2;
  const kdvAmount = data.total - kdvBase;

  const totals: Array<[string, string, boolean]> = [
    ["Ara toplam", formatTry(data.subtotal), false],
    ["Kargo", formatTry(data.shipping), false],
    ["KDV matrahı (%20 dahil)", formatTry(kdvBase), false],
    ["KDV (%20)", formatTry(kdvAmount), false],
    ["Genel toplam", formatTry(data.total), true],
  ];

  for (const [label, value, isBold] of totals) {
    page.drawText(label, {
      x: mm(120),
      y: yT(y),
      size: isBold ? 11 : 9,
      font: isBold ? bold : regular,
      color: black,
    });
    page.drawText(value, {
      x: mm(165),
      y: yT(y),
      size: isBold ? 11 : 9,
      font: isBold ? bold : regular,
      color: isBold ? mercan : black,
    });
    y += isBold ? 8 : 6;
  }

  y += 10;
  const payLabel =
    data.payment.method === "card"
      ? `Kredi kartı${data.payment.masked ? ` (${data.payment.masked})` : ""}`
      : "Havale / EFT";
  page.drawText(`Ödeme: ${payLabel}`, {
    x: mm(20),
    y: yT(y),
    size: 9,
    font: regular,
    color: gray,
  });

  y += 12;
  page.drawText(
    "Bu belge sipariş özeti niteliğindedir. Resmi e-fatura / e-arşiv faturanız GİB sistemine ayrıca iletilir.",
    {
      x: mm(20),
      y: yT(y),
      size: 8,
      font: regular,
      color: gray,
      maxWidth: mm(170),
      lineHeight: mm(4),
    }
  );

  return pdfDoc.save();
}
