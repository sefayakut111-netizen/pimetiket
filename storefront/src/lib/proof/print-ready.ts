import { PDFDocument, rgb } from "pdf-lib";
import sharp from "sharp";
import { uploadPrintReadyPdf } from "@/lib/proof/proof-artifacts";

export interface PrintReadyResult {
  pdfStoragePath: string;
  pageCount: number;
  includesBleed: boolean;
  includesCutline: boolean;
  includesWhiteLayer: boolean;
  fileSizeBytes: number;
}

export interface PrintReadyInput {
  orderId: string;
  itemId: string;
  designFileUrl: string;
  cutlineSvgPath?: string;
  whiteLayerPngUrl?: string;
  designWidth: number;
  designHeight: number;
  bleedMm?: number;
  materialKey: string;
}

function mmToPt(mm: number): number {
  return mm * 2.83465;
}

async function embedDesignImage(
  pdfDoc: PDFDocument,
  designBytes: ArrayBuffer,
  mimeHint?: string
) {
  const buf = Buffer.from(designBytes);
  if (mimeHint?.includes("jpeg") || mimeHint?.includes("jpg")) {
    return pdfDoc.embedJpg(buf);
  }
  try {
    return await pdfDoc.embedPng(buf);
  } catch {
    const pngBuf = await sharp(buf).png().toBuffer();
    return pdfDoc.embedPng(pngBuf);
  }
}

function drawCropMarks(
  page: ReturnType<PDFDocument["addPage"]>,
  wMm: number,
  hMm: number,
  bleedMm: number
) {
  const markLen = mmToPt(3);
  const offset = mmToPt(bleedMm);
  const w = mmToPt(wMm + bleedMm * 2);
  const h = mmToPt(hMm + bleedMm * 2);
  const color = rgb(0, 0, 0);
  const lw = 0.25;

  const corners = [
    [offset, h - offset],
    [w - offset, h - offset],
    [offset, offset],
    [w - offset, offset],
  ] as const;

  for (const [cx, cy] of corners) {
    page.drawLine({
      start: { x: cx - markLen, y: cy },
      end: { x: cx, y: cy },
      thickness: lw,
      color,
    });
    page.drawLine({
      start: { x: cx, y: cy },
      end: { x: cx, y: cy + markLen },
      thickness: lw,
      color,
    });
  }
}

function drawCutlinePath(
  page: ReturnType<PDFDocument["addPage"]>,
  svgPath: string,
  bleedMm: number
) {
  const dMatch = svgPath.match(/\bd=["']([^"']+)["']/i);
  const d = dMatch?.[1] ?? svgPath;
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  if (nums.length < 4) return;

  const bleedPt = mmToPt(bleedMm);
  const magenta = rgb(1, 0, 1);

  for (let i = 0; i + 3 < nums.length; i += 2) {
    page.drawLine({
      start: { x: nums[i] + bleedPt, y: nums[i + 1] + bleedPt },
      end: { x: nums[i + 2] + bleedPt, y: nums[i + 3] + bleedPt },
      thickness: 0.5,
      color: magenta,
    });
  }
}

export async function generatePrintReadyPdf(
  input: PrintReadyInput
): Promise<PrintReadyResult> {
  const bleedMm = input.bleedMm ?? 2;
  const pdfDoc = await PDFDocument.create();

  const widthPt = mmToPt(input.designWidth + bleedMm * 2);
  const heightPt = mmToPt(input.designHeight + bleedMm * 2);
  const page = pdfDoc.addPage([widthPt, heightPt]);

  const designRes = await fetch(input.designFileUrl);
  if (!designRes.ok) {
    throw new Error("design_fetch_failed");
  }
  const designBytes = await designRes.arrayBuffer();
  const contentType = designRes.headers.get("content-type") ?? "";
  const designImage = await embedDesignImage(pdfDoc, designBytes, contentType);

  page.drawImage(designImage, {
    x: mmToPt(bleedMm),
    y: mmToPt(bleedMm),
    width: mmToPt(input.designWidth),
    height: mmToPt(input.designHeight),
  });

  drawCropMarks(page, input.designWidth, input.designHeight, bleedMm);

  if (input.cutlineSvgPath) {
    drawCutlinePath(page, input.cutlineSvgPath, bleedMm);
  }

  if (input.whiteLayerPngUrl) {
    const whitePage = pdfDoc.addPage([widthPt, heightPt]);
    const whiteRes = await fetch(input.whiteLayerPngUrl);
    if (whiteRes.ok) {
      const whiteBytes = await whiteRes.arrayBuffer();
      const whiteImage = await embedDesignImage(pdfDoc, whiteBytes, "image/png");
      whitePage.drawImage(whiteImage, {
        x: mmToPt(bleedMm),
        y: mmToPt(bleedMm),
        width: mmToPt(input.designWidth),
        height: mmToPt(input.designHeight),
      });
    }
  }

  pdfDoc.setTitle(`Pim Etiket — ${input.orderId} — ${input.itemId}`);
  pdfDoc.setProducer("Pim Etiket Print System");
  pdfDoc.setCreationDate(new Date());

  const pdfBytes = await pdfDoc.save();
  const { storagePath } = await uploadPrintReadyPdf(
    input.orderId,
    input.itemId,
    pdfBytes
  );

  return {
    pdfStoragePath: storagePath,
    pageCount: input.whiteLayerPngUrl ? 2 : 1,
    includesBleed: true,
    includesCutline: !!input.cutlineSvgPath,
    includesWhiteLayer: !!input.whiteLayerPngUrl,
    fileSizeBytes: pdfBytes.length,
  };
}

export async function generatePrintReadyForOrder(
  orderId: string
): Promise<{ generated: number; errors: string[] }> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { STORAGE_BUCKET } = await import("@/lib/storage/design-files");
  const { getSignedDownloadUrl } = await import("@/lib/storage/r2-client");

  const admin = createAdminClient();
  const errors: string[] = [];
  let generated = 0;

  const { data: items } = await admin
    .from("order_items")
    .select("id, width, height, meta")
    .eq("order_id", orderId);

  for (const raw of items ?? []) {
    const item = raw as {
      id: string;
      width: number;
      height: number;
      meta: Record<string, unknown> | null;
    };

    const { data: df } = await admin
      .from("design_files")
      .select("id, storage_path, mime_type")
      .eq("order_id", orderId)
      .eq("order_item_id", item.id)
      .neq("status", "superseded")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const designFile = df as {
      id: string;
      storage_path: string;
      mime_type: string;
    } | null;
    if (!designFile) {
      errors.push(`${item.id}: design_file_missing`);
      continue;
    }

    const { data: signed } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(designFile.storage_path, 600);
    if (!signed?.signedUrl) {
      errors.push(`${item.id}: signed_url_failed`);
      continue;
    }

    const { data: cl } = await admin
      .from("cutline_designs")
      .select("svg_url, preview_png_url")
      .eq("order_id", orderId)
      .eq("order_item_id", item.id)
      .neq("status", "superseded")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const cutline = cl as {
      svg_url: string | null;
      preview_png_url: string | null;
    } | null;

    let cutlineSvgPath: string | undefined;
    if (cutline?.svg_url) {
      try {
        const svgUrl = await getSignedDownloadUrl(cutline.svg_url, 600);
        const svgRes = await fetch(svgUrl);
        if (svgRes.ok) {
          cutlineSvgPath = await svgRes.text();
        }
      } catch {
        /* cutline optional */
      }
    }

    let whiteLayerPngUrl: string | undefined;
    if (cutline?.preview_png_url) {
      try {
        whiteLayerPngUrl = await getSignedDownloadUrl(
          cutline.preview_png_url,
          600
        );
      } catch {
        /* optional */
      }
    }

    const materialKey = String(
      item.meta?.material_type ?? item.meta?.material ?? "paper"
    );

    try {
      const result = await generatePrintReadyPdf({
        orderId,
        itemId: item.id,
        designFileUrl: signed.signedUrl,
        cutlineSvgPath,
        whiteLayerPngUrl,
        designWidth: item.width,
        designHeight: item.height,
        materialKey,
      });

      await admin
        .from("order_items")
        .update({ print_ready_pdf_url: result.pdfStoragePath })
        .eq("id", item.id);

      generated++;
    } catch (err) {
      errors.push(
        `${item.id}: ${err instanceof Error ? err.message : "pdf_failed"}`
      );
    }
  }

  return { generated, errors };
}
