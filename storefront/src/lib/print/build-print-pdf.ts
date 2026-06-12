import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFOperator,
  type PDFPage,
  pushGraphicsState,
  popGraphicsState,
  moveTo,
  lineTo,
  closePath,
  stroke,
  setLineWidth,
  setGraphicsState,
} from "pdf-lib";
import sharp from "sharp";
import type { PathRing } from "@/lib/editor/cutline/types";
import { computeArtDrawRect } from "@/lib/editor/cutline/svg-coords";

const MM_TO_PT = 72 / 25.4;
const CUT_STROKE_PT = 0.25;
const PLACEMENT_CANVAS_REF_PX = 800;

export interface PrintArtworkInput {
  bytes: Uint8Array;
  mimeType: string;
  fileName?: string;
}

export interface ImagePlacement {
  x: number;
  y: number;
  scale: number;
  /** poc imageMetadata.contentW — canvas px referansı (varsayılan 800) */
  contentRefPx?: number;
}

export interface BuildPrintPdfInput {
  artwork: PrintArtworkInput;
  cutlinePathMm: PathRing[];
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  imagePlacement?: ImagePlacement | null;
}

export function mmToPt(mm: number): number {
  return mm * MM_TO_PT;
}

/** PDF kutuları — MediaBox tam sayfa, TrimBox ortalanmış etiket, BleedBox = MediaBox. */
export function computePrintBoxesMm(args: {
  widthMm: number;
  heightMm: number;
  bleedMm: number;
}) {
  const { widthMm, heightMm, bleedMm } = args;
  const mediaW = widthMm + 2 * bleedMm;
  const mediaH = heightMm + 2 * bleedMm;
  return {
    mediaWPt: mmToPt(mediaW),
    mediaHPt: mmToPt(mediaH),
    trimXPt: mmToPt(bleedMm),
    trimYPt: mmToPt(bleedMm),
    trimWPt: mmToPt(widthMm),
    trimHPt: mmToPt(heightMm),
  };
}

function labelMmToPdfPt(
  xMm: number,
  yMm: number,
  heightMm: number,
  bleedPt: number
): { x: number; y: number } {
  return {
    x: bleedPt + mmToPt(xMm),
    y: bleedPt + mmToPt(heightMm - yMm),
  };
}

function ensureResourcesSubdict(
  resources: PDFDict,
  key: PDFName,
  ctx: PDFDocument["context"]
): PDFDict {
  const existing = resources.get(key);
  if (existing instanceof PDFDict) return existing;
  const dict = ctx.obj({}) as PDFDict;
  resources.set(key, dict);
  return dict;
}

function registerCutContourResources(page: PDFPage, doc: PDFDocument) {
  const ctx = doc.context;

  const separation = ctx.obj([
    PDFName.of("Separation"),
    PDFName.of("CutContour"),
    PDFName.of("DeviceCMYK"),
    ctx.obj({
      C0: ctx.obj([0, 0, 0, 0]),
      C1: ctx.obj([0, 1, 0, 0]),
      N: 1,
    }),
  ]);
  const csRef = ctx.register(separation);

  const extGs = ctx.obj({
    Type: PDFName.of("ExtGState"),
    OP: true,
    op: true,
    OPM: 1,
  });
  const gsRef = ctx.register(extGs);

  let resources = page.node.Resources() as PDFDict | undefined;
  if (!resources) {
    resources = ctx.obj({}) as PDFDict;
    page.node.set(PDFName.of("Resources"), resources);
  }

  const colorSpaces = ensureResourcesSubdict(
    resources,
    PDFName.of("ColorSpace"),
    ctx
  );
  colorSpaces.set(PDFName.of("CS0"), csRef);

  const extStates = ensureResourcesSubdict(
    resources,
    PDFName.of("ExtGState"),
    ctx
  );
  extStates.set(PDFName.of("GS0"), gsRef);
}

function cutContourStrokeOperators(): PDFOperator[] {
  type OpName = Parameters<typeof PDFOperator.of>[0];
  return [
    PDFOperator.of("CS" as OpName, [PDFName.of("CS0")]),
    PDFOperator.of("SCN" as OpName, [PDFNumber.of(1)]),
  ];
}

function ringToStrokeOperators(
  ring: PathRing,
  heightMm: number,
  bleedPt: number
): PDFOperator[] {
  const ops: PDFOperator[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [xMm, yMm] = ring[i]!;
    const { x, y } = labelMmToPdfPt(xMm, yMm, heightMm, bleedPt);
    if (i === 0) ops.push(moveTo(x, y));
    else ops.push(lineTo(x, y));
  }
  ops.push(closePath());
  return ops;
}

async function embedArtworkImage(
  pdfDoc: PDFDocument,
  artwork: PrintArtworkInput
) {
  const mime = artwork.mimeType.toLowerCase();
  const buf = Buffer.from(artwork.bytes);

  if (mime.includes("jpeg") || mime.includes("jpg")) {
    return pdfDoc.embedJpg(buf);
  }
  if (mime.includes("png")) {
    return pdfDoc.embedPng(buf);
  }
  if (mime.includes("pdf") || artwork.fileName?.toLowerCase().endsWith(".ai")) {
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const [embedded] = await pdfDoc.embedPdf(src, [0]);
    return embedded;
  }
  if (mime.includes("svg") || artwork.fileName?.toLowerCase().endsWith(".svg")) {
    const pngBuf = await sharp(buf, { density: 300 }).png().toBuffer();
    return pdfDoc.embedPng(pngBuf);
  }

  try {
    return await pdfDoc.embedPng(buf);
  } catch {
    const pngBuf = await sharp(buf).png().toBuffer();
    return pdfDoc.embedPng(pngBuf);
  }
}

function resolveArtDrawRectMm(
  widthMm: number,
  heightMm: number,
  placement?: ImagePlacement | null
) {
  const refPx =
    placement?.contentRefPx != null &&
    Number.isFinite(placement.contentRefPx) &&
    placement.contentRefPx > 0
      ? placement.contentRefPx
      : PLACEMENT_CANVAS_REF_PX;
  const pxToMm = widthMm / refPx;
  const transform = {
    x: (placement?.x ?? 0) * pxToMm,
    y: (placement?.y ?? 0) * pxToMm,
    scale: placement?.scale ?? 1,
  };
  return computeArtDrawRect({
    contentOffsetX: 0,
    contentOffsetY: 0,
    contentW: widthMm,
    contentH: heightMm,
    transform,
  });
}

function drawArtworkLayer(
  page: PDFPage,
  args: {
    widthMm: number;
    heightMm: number;
    bleedMm: number;
    imagePlacement?: ImagePlacement | null;
    embedded:
      | Awaited<ReturnType<PDFDocument["embedPng"]>>
      | Awaited<ReturnType<PDFDocument["embedPdf"]>>[number];
    isPdfPage: boolean;
  }
) {
  const bleedPt = mmToPt(args.bleedMm);
  const draw = resolveArtDrawRectMm(
    args.widthMm,
    args.heightMm,
    args.imagePlacement
  );

  const xPt = bleedPt + mmToPt(draw.x);
  const wPt = mmToPt(draw.w);
  const hPt = mmToPt(draw.h);
  const yPt = bleedPt + mmToPt(args.heightMm - draw.y - draw.h);

  if (args.isPdfPage) {
    const embeddedPage = args.embedded as Awaited<
      ReturnType<PDFDocument["embedPdf"]>
    >[number];
    const size = embeddedPage.size();
    const scale = Math.min(wPt / size.width, hPt / size.height);
    page.drawPage(embeddedPage, {
      x: xPt,
      y: yPt,
      width: size.width * scale,
      height: size.height * scale,
    });
    return;
  }

  const img = args.embedded as Awaited<ReturnType<PDFDocument["embedPng"]>>;
  page.drawImage(img, {
    x: xPt,
    y: yPt,
    width: wPt,
    height: hPt,
  });
}

function drawCutlineSpotLayer(
  page: PDFPage,
  doc: PDFDocument,
  rings: PathRing[],
  heightMm: number,
  bleedPt: number
) {
  if (rings.length === 0) return;
  registerCutContourResources(page, doc);

  for (const ring of rings) {
    page.pushOperators(
      pushGraphicsState(),
      setGraphicsState(PDFName.of("GS0")),
      setLineWidth(CUT_STROKE_PT),
      ...cutContourStrokeOperators(),
      ...ringToStrokeOperators(ring, heightMm, bleedPt),
      stroke(),
      popGraphicsState()
    );
  }
}

export async function buildPrintReadyPdf(
  input: BuildPrintPdfInput
): Promise<Uint8Array> {
  const { widthMm, heightMm, bleedMm, cutlinePathMm, artwork, imagePlacement } =
    input;
  const boxes = computePrintBoxesMm({ widthMm, heightMm, bleedMm });
  const bleedPt = mmToPt(bleedMm);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([boxes.mediaWPt, boxes.mediaHPt]);

  page.setMediaBox(0, 0, boxes.mediaWPt, boxes.mediaHPt);
  page.setBleedBox(0, 0, boxes.mediaWPt, boxes.mediaHPt);
  page.setTrimBox(
    boxes.trimXPt,
    boxes.trimYPt,
    boxes.trimWPt,
    boxes.trimHPt
  );

  const mime = artwork.mimeType.toLowerCase();
  const isPdfSource =
    mime.includes("pdf") ||
    (artwork.fileName?.toLowerCase().endsWith(".ai") ?? false);
  const embedded = await embedArtworkImage(pdfDoc, artwork);

  drawArtworkLayer(page, {
    widthMm,
    heightMm,
    bleedMm,
    imagePlacement,
    embedded,
    isPdfPage: isPdfSource,
  });

  drawCutlineSpotLayer(page, pdfDoc, cutlinePathMm, heightMm, bleedPt);

  pdfDoc.setTitle("Pim Etiket Print-Ready");
  pdfDoc.setProducer("Pim Etiket Print System");
  pdfDoc.setKeywords(["CutContour", "print-ready"]);
  pdfDoc.setCreationDate(new Date());

  return pdfDoc.save({ useObjectStreams: false });
}
