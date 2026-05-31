import { EDITOR_PX_PER_MM } from "@/lib/editor/coords";
import { pathRingToSvgD } from "@/lib/editor/cutline/shapes";
import type { CutlineBundle, PathRing } from "@/lib/editor/cutline/types";
import { lowerLabelWorkspaceToBottom } from "@/lib/editor/pikaso/render-label-workspace";
import type Pikaso from "pikaso";

const OVERLAY_PREFIX = "pim-cutline-";

const STYLES = {
  cut: { stroke: "#E5007E", dash: [8, 4] as number[], width: 2 },
  bleed: { stroke: "#ef4444", dash: [6, 3] as number[], width: 1.5 },
  safe: { stroke: "#3b82f6", dash: [4, 4] as number[], width: 1.5 },
};

function listBoardShapes(editor: Pikaso) {
  const shapes = editor.board.shapes;
  if (!shapes) return [];
  if (Array.isArray(shapes)) return shapes;
  try {
    return [...shapes];
  } catch {
    return Array.from(shapes as ArrayLike<(typeof shapes)[number]>);
  }
}

function removeOverlays(editor: Pikaso) {
  for (const shape of listBoardShapes(editor)) {
    if (shape.name?.startsWith(OVERLAY_PREFIX)) {
      shape.destroy();
    }
  }
}

/** Bıçak seçilmeden overlay temizliği */
export function clearCutlineOverlays(editor: Pikaso) {
  removeOverlays(editor);
  editor.board.draw();
}

/** mm path → px (scaleX ile çarpılınca dash kalınlaşmasın diye) */
function ringMmToPx(ring: PathRing): PathRing {
  const s = EDITOR_PX_PER_MM;
  return ring.map(([x, y]) => [x * s, y * s]);
}

function insertOverlay(
  editor: Pikaso,
  name: string,
  ringMm: PathRing,
  x: number,
  y: number,
  style: (typeof STYLES)["cut"]
) {
  const pathD = pathRingToSvgD(ringMmToPx(ringMm));
  if (!pathD) return;
  const model = editor.shapes.svg.insert({
    data: pathD,
    x,
    y,
    scaleX: 1,
    scaleY: 1,
    stroke: style.stroke,
    strokeWidth: style.width,
    dash: style.dash,
    lineJoin: "round",
    lineCap: "round",
    strokeScaleEnabled: false,
    listening: false,
    draggable: false,
    name,
  });
  model.isSelectable = false;
}

export function renderCutlineOverlays(
  editor: Pikaso,
  bundle: CutlineBundle,
  opts: {
    labelX: number;
    labelY: number;
    layers: { cut: boolean; bleed: boolean; safe: boolean };
  }
) {
  removeOverlays(editor);
  const { labelX, labelY, layers } = opts;

  if (layers.bleed) {
    for (let i = 0; i < bundle.bleed.length; i++) {
      insertOverlay(
        editor,
        `${OVERLAY_PREFIX}bleed-${i}`,
        bundle.bleed[i]!,
        labelX,
        labelY,
        STYLES.bleed
      );
    }
  }
  if (layers.safe) {
    for (let i = 0; i < bundle.safe.length; i++) {
      insertOverlay(
        editor,
        `${OVERLAY_PREFIX}safe-${i}`,
        bundle.safe[i]!,
        labelX,
        labelY,
        STYLES.safe
      );
    }
  }
  if (layers.cut) {
    for (let i = 0; i < bundle.cut.length; i++) {
      insertOverlay(
        editor,
        `${OVERLAY_PREFIX}cut-${i}`,
        bundle.cut[i]!,
        labelX,
        labelY,
        STYLES.cut
      );
    }
  }
  lowerLabelWorkspaceToBottom(editor);
  editor.board.draw();
}
