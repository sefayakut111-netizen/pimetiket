import { PDFDocument, rgb } from "pdf-lib";
import sharp from "sharp";
import type { Json } from "@/lib/supabase/types";
import { uploadPrintReadyPdf } from "@/lib/proof/proof-artifacts";
import { CUT_SET_META } from "@/lib/templates/die-cut-templates";
import type { CutSet } from "@/lib/templates/die-cut-templates";

export interface PrintReadyResult {
  pdfStoragePath: string;
  pageCount: number;
  includesBleed: boolean;
  includesCutline: boolean;
  includesWhiteLayer: boolean;
  fileSizeBytes: number;
  /** pdf-lib spot kanalı yok — kesim hattı RGB magenta (RIP manuel dönüşüm) */
  cutcontourIsRgbFallback: boolean;
}

export const CUTCONTOUR_RGB_FALLBACK_NOTE =
  "⚠️ Kesim kanalı RGB magenta — RIP'te CutContour spot'a manuel çevir";

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
    const isRight = cx > w / 2;
    const isTop = cy > h / 2;
    page.drawLine({
      start: { x: isRight ? cx : cx - markLen, y: cy },
      end: { x: isRight ? cx + markLen : cx, y: cy },
      thickness: lw,
      color,
    });
    page.drawLine({
      start: { x: cx, y: isTop ? cy : cy - markLen },
      end: { x: cx, y: isTop ? cy + markLen : cy },
      thickness: lw,
      color,
    });
  }
}

/** CutContour — baskı endüstrisi standardı (%100 Magenta). RIP sistemleri bu rengi tanır. */
const CUTCONTOUR_COLOR = rgb(1, 0, 1);

function hexToRgbColor(hex: string) {
  const h = hex.replace("#", "");
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  );
}

function colorForCutSet(cutType: CutSet | undefined, groupId: string) {
  if (cutType && CUT_SET_META[cutType]) {
    return hexToRgbColor(CUT_SET_META[cutType].color);
  }
  if (groupId === CUT_SET_META.thrucut.spot) {
    return hexToRgbColor(CUT_SET_META.thrucut.color);
  }
  if (groupId === CUT_SET_META.kisscut.spot) {
    return hexToRgbColor(CUT_SET_META.kisscut.color);
  }
  return CUTCONTOUR_COLOR;
}

type CutlineDrawGroup = { color: ReturnType<typeof rgb>; pathDs: string[] };

function extractCutlineGroups(svgText: string): CutlineDrawGroup[] {
  const groups: CutlineDrawGroup[] = [];
  const groupRe =
    /<g\b[^>]*\bid=["']([^"']+)["'][^>]*(?:data-pim-cut-type=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/g>/gi;
  let match: RegExpExecArray | null;
  while ((match = groupRe.exec(svgText)) !== null) {
    const groupId = match[1]!;
    const cutType = match[2] as CutSet | undefined;
    const inner = match[3]!;
    const pathDs = extractSvgPathDs(inner);
    if (pathDs.length === 0) continue;
    groups.push({
      color: colorForCutSet(cutType, groupId),
      pathDs,
    });
  }
  if (groups.length === 0) {
    const pathDs = extractSvgPathDs(svgText);
    if (pathDs.length > 0) {
      groups.push({ color: CUTCONTOUR_COLOR, pathDs });
    }
  }
  return groups;
}

type Pt = { x: number; y: number };

function parseSvgPathToPoints(d: string): Pt[] {
  const tokens =
    d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g)?.map((t) => t.trim()) ??
    [];
  const points: Pt[] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let cmd = "";

  const readNum = () => parseFloat(tokens[i++] ?? "0");

  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[a-zA-Z]$/.test(t)) {
      cmd = t;
      i++;
    }

    switch (cmd) {
      case "M":
      case "m": {
        const x = readNum();
        const y = readNum();
        cx = cmd === "m" ? cx + x : x;
        cy = cmd === "m" ? cy + y : y;
        points.push({ x: cx, y: cy });
        cmd = cmd === "m" ? "l" : "L";
        break;
      }
      case "L":
      case "l": {
        const x = readNum();
        const y = readNum();
        cx = cmd === "l" ? cx + x : x;
        cy = cmd === "l" ? cy + y : y;
        points.push({ x: cx, y: cy });
        break;
      }
      case "H":
      case "h": {
        const x = readNum();
        cx = cmd === "h" ? cx + x : x;
        points.push({ x: cx, y: cy });
        break;
      }
      case "V":
      case "v": {
        const y = readNum();
        cy = cmd === "v" ? cy + y : y;
        points.push({ x: cx, y: cy });
        break;
      }
      case "C":
      case "c": {
        readNum();
        readNum();
        readNum();
        readNum();
        const x = readNum();
        const y = readNum();
        cx = cmd === "c" ? cx + x : x;
        cy = cmd === "c" ? cy + y : y;
        points.push({ x: cx, y: cy });
        break;
      }
      case "Z":
      case "z":
        if (points.length > 0) points.push({ ...points[0] });
        break;
      default:
        if (/^-?\d/.test(t)) i++;
        else i++;
    }
  }
  return points;
}

type SvgViewFrame = {
  minX: number;
  minY: number;
  vbW: number;
  vbH: number;
};

function parseSvgDimAttr(raw: string): number | null {
  const n = parseFloat(raw.replace(/mm$/i, "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** viewBox → yoksa width/height → yoksa label mm (1:1 design boyutu). */
function parseSvgViewFrame(
  svgText: string,
  designWidthMm: number,
  designHeightMm: number
): SvgViewFrame {
  const vbMatch = svgText.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (vbMatch) {
    const parts = vbMatch[1]
      .trim()
      .split(/[\s,]+/)
      .map((s) => parseFloat(s));
    if (
      parts.length >= 4 &&
      parts.every((n) => Number.isFinite(n)) &&
      (parts[2] ?? 0) > 0 &&
      (parts[3] ?? 0) > 0
    ) {
      return {
        minX: parts[0]!,
        minY: parts[1]!,
        vbW: parts[2]!,
        vbH: parts[3]!,
      };
    }
  }

  const wMatch = svgText.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
  const hMatch = svgText.match(/\bheight\s*=\s*["']([^"']+)["']/i);
  const w = wMatch ? parseSvgDimAttr(wMatch[1]) : null;
  const h = hMatch ? parseSvgDimAttr(hMatch[1]) : null;
  if (w != null && h != null) {
    return { minX: 0, minY: 0, vbW: w, vbH: h };
  }

  return {
    minX: 0,
    minY: 0,
    vbW: designWidthMm,
    vbH: designHeightMm,
  };
}

function svgPointToLabelMm(
  px: number,
  py: number,
  frame: SvgViewFrame,
  designWidthMm: number,
  designHeightMm: number
): { labelXmm: number; labelYmm: number } {
  return {
    labelXmm: (px - frame.minX) * (designWidthMm / frame.vbW),
    labelYmm: (py - frame.minY) * (designHeightMm / frame.vbH),
  };
}

function labelMmToPdfPt(
  labelXmm: number,
  labelYmm: number,
  designHeightMm: number,
  bleedPt: number
): { x: number; y: number } {
  return {
    x: mmToPt(labelXmm) + bleedPt,
    y: mmToPt(designHeightMm - labelYmm) + bleedPt,
  };
}

function extractSvgPathDs(svgText: string): string[] {
  const matches = [...svgText.matchAll(/\bd=["']([^"']+)["']/gi)];
  if (matches.length > 0) {
    return matches.map((m) => m[1]!);
  }
  if (svgText.includes("M") || svgText.includes("m")) {
    return [svgText];
  }
  return [];
}

/** Cutline: viewBox/width ile label-mm normalize → pdf-lib (alttan-yukarı) + bleed. */
function drawCutlineAsSpotColor(
  page: ReturnType<PDFDocument["addPage"]>,
  svgText: string,
  bleedMm: number,
  designWidthMm: number,
  designHeightMm: number
) {
  const groups = extractCutlineGroups(svgText);
  if (groups.length === 0) return;

  const frame = parseSvgViewFrame(svgText, designWidthMm, designHeightMm);
  const bleedPt = mmToPt(bleedMm);
  const thickness = 0.5;

  for (const group of groups) {
    for (const d of group.pathDs) {
      const points = parseSvgPathToPoints(d);
      if (points.length < 2) continue;

      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]!;
        const b = points[i]!;
        const aLabel = svgPointToLabelMm(
          a.x,
          a.y,
          frame,
          designWidthMm,
          designHeightMm
        );
        const bLabel = svgPointToLabelMm(
          b.x,
          b.y,
          frame,
          designWidthMm,
          designHeightMm
        );
        page.drawLine({
          start: labelMmToPdfPt(
            aLabel.labelXmm,
            aLabel.labelYmm,
            designHeightMm,
            bleedPt
          ),
          end: labelMmToPdfPt(
            bLabel.labelXmm,
            bLabel.labelYmm,
            designHeightMm,
            bleedPt
          ),
          thickness,
          color: group.color,
        });
      }
    }
  }
}

export async function generatePrintReadyPdf(
  input: PrintReadyInput
): Promise<PrintReadyResult> {
  const built = await buildPrintReadyDocument(input);
  const pdfBytes = await built.pdfDoc.save();
  const { storagePath } = await uploadPrintReadyPdf(
    input.orderId,
    input.itemId,
    pdfBytes
  );

  return {
    pdfStoragePath: storagePath,
    pageCount: built.pageCount,
    includesBleed: true,
    includesCutline: built.includesCutline,
    includesWhiteLayer: built.includesWhiteLayer,
    fileSizeBytes: pdfBytes.length,
    cutcontourIsRgbFallback: built.cutcontourIsRgbFallback,
  };
}

async function buildPrintReadyDocument(
  input: PrintReadyInput
): Promise<{
  pdfDoc: PDFDocument;
  pageCount: number;
  includesCutline: boolean;
  includesWhiteLayer: boolean;
  cutcontourIsRgbFallback: boolean;
}> {
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

  const includesCutline = !!input.cutlineSvgPath;
  if (includesCutline) {
    drawCutlineAsSpotColor(
      page,
      input.cutlineSvgPath!,
      bleedMm,
      input.designWidth,
      input.designHeight
    );
  }

  pdfDoc.setKeywords([
    "CutContour",
    "ThruCut",
    "print-ready",
    ...(includesCutline ? ["cutcontour_is_rgb_fallback"] : []),
  ]);
  if (includesCutline) {
    pdfDoc.setSubject("cutcontour_is_rgb_fallback=true");
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

  return {
    pdfDoc,
    pageCount: input.whiteLayerPngUrl ? 2 : 1,
    includesCutline,
    includesWhiteLayer: !!input.whiteLayerPngUrl,
    cutcontourIsRgbFallback: includesCutline,
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

    const { data: allDf } = await admin
      .from("design_files")
      .select("id, storage_path, mime_type")
      .eq("order_id", orderId)
      .eq("order_item_id", item.id)
      .neq("status", "superseded")
      .order("version", { ascending: true });

    const designFiles = (allDf ?? []) as {
      id: string;
      storage_path: string;
      mime_type: string;
    }[];

    if (designFiles.length === 0) {
      errors.push(`${item.id}: design_file_missing`);
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
      let result: PrintReadyResult;

      if (designFiles.length === 1) {
        const designFile = designFiles[0]!;
        const { data: signed } = await admin.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(designFile.storage_path, 600);
        if (!signed?.signedUrl) {
          errors.push(`${item.id}: signed_url_failed`);
          continue;
        }
        result = await generatePrintReadyPdf({
          orderId,
          itemId: item.id,
          designFileUrl: signed.signedUrl,
          cutlineSvgPath,
          whiteLayerPngUrl,
          designWidth: item.width,
          designHeight: item.height,
          materialKey,
        });
      } else {
        const mergedDoc = await PDFDocument.create();
        let pageCountTotal = 0;
        let includesCutline = false;
        let includesWhiteLayer = false;
        let cutcontourFallback = false;

        for (const designFile of designFiles) {
          const { data: signed } = await admin.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(designFile.storage_path, 600);
          if (!signed?.signedUrl) {
            throw new Error(`signed_url_failed:${designFile.id}`);
          }
          const built = await buildPrintReadyDocument({
            orderId,
            itemId: item.id,
            designFileUrl: signed.signedUrl,
            cutlineSvgPath:
              designFile === designFiles[designFiles.length - 1]
                ? cutlineSvgPath
                : undefined,
            whiteLayerPngUrl:
              designFile === designFiles[designFiles.length - 1]
                ? whiteLayerPngUrl
                : undefined,
            designWidth: item.width,
            designHeight: item.height,
            materialKey,
          });
          const pages = await mergedDoc.copyPages(
            built.pdfDoc,
            built.pdfDoc.getPageIndices()
          );
          for (const p of pages) {
            mergedDoc.addPage(p);
          }
          pageCountTotal += built.pageCount;
          includesCutline = includesCutline || built.includesCutline;
          includesWhiteLayer = includesWhiteLayer || built.includesWhiteLayer;
          cutcontourFallback =
            cutcontourFallback || built.cutcontourIsRgbFallback;
        }

        mergedDoc.setTitle(`Pim Etiket — ${orderId} — ${item.id}`);
        mergedDoc.setProducer("Pim Etiket Print System");
        mergedDoc.setCreationDate(new Date());
        const pdfBytes = await mergedDoc.save();
        const { storagePath } = await uploadPrintReadyPdf(
          orderId,
          item.id,
          pdfBytes
        );
        result = {
          pdfStoragePath: storagePath,
          pageCount: pageCountTotal,
          includesBleed: true,
          includesCutline,
          includesWhiteLayer,
          fileSizeBytes: pdfBytes.length,
          cutcontourIsRgbFallback: cutcontourFallback,
        };
      }

      const nextMeta = {
        ...(item.meta ?? {}),
        ...(result.cutcontourIsRgbFallback
          ? { cutcontour_is_rgb_fallback: true }
          : {}),
      };

      await admin
        .from("order_items")
        .update({
          print_ready_pdf_url: result.pdfStoragePath,
          meta: nextMeta,
        })
        .eq("id", item.id);

      if (result.cutcontourIsRgbFallback) {
        await admin.from("order_events").insert({
          order_id: orderId,
          event_type: "note_added",
          actor_role: "system",
          summary: CUTCONTOUR_RGB_FALLBACK_NOTE,
          detail: {
            cutcontour_is_rgb_fallback: true,
            order_item_id: item.id,
            print_ready_pdf_url: result.pdfStoragePath,
          } as Json,
        });
      }

      generated++;
    } catch (err) {
      errors.push(
        `${item.id}: ${err instanceof Error ? err.message : "pdf_failed"}`
      );
    }
  }

  return { generated, errors };
}
