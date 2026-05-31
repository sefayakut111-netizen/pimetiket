import { EDITOR_PX_PER_MM } from "@/lib/editor/coords";
import { pathRingToSvgD } from "@/lib/editor/cutline/shapes";
import type { CutlineBundle } from "@/lib/editor/cutline/types";
import type Pikaso from "pikaso";

const OVERLAY_PREFIX = "pim-cutline-";

const STYLES = {
  cut: { stroke: "#E5007E", dash: [8, 4] as number[], width: 2 },
  bleed: { stroke: "#ef4444", dash: [6, 3] as number[], width: 1.5 },
  safe: { stroke: "#3b82f6", dash: [4, 4] as number[], width: 1.5 },
};

function removeOverlays(editor: Pikaso) {
  for (const shape of [...editor.board.shapes]) {
    if (shape.name?.startsWith(OVERLAY_PREFIX)) {
      shape.destroy();
    }
  }
}

function insertOverlay(
  editor: Pikaso,
  name: string,
  pathD: string,
  x: number,
  y: number,
  style: (typeof STYLES)["cut"]
) {
  if (!pathD) return;
  const model = editor.shapes.svg.insert({
    data: pathD,
    x,
    y,
    scaleX: EDITOR_PX_PER_MM,
    scaleY: EDITOR_PX_PER_MM,
    stroke: style.stroke,
    strokeWidth: style.width,
    dash: style.dash,
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
        pathRingToSvgD(bundle.bleed[i]!),
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
        pathRingToSvgD(bundle.safe[i]!),
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
        pathRingToSvgD(bundle.cut[i]!),
        labelX,
        labelY,
        STYLES.cut
      );
    }
  }
  editor.board.draw();
}
