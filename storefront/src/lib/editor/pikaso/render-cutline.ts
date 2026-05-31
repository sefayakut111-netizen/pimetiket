import { EDITOR_PX_PER_MM, mmToPx } from "@/lib/editor/coords";
import { pathRingToSvgD } from "@/lib/editor/cutline/shapes";
import type { CutlineBundle, PathRing } from "@/lib/editor/cutline/types";
import type { BladeTransformMm } from "@/lib/editor/pikaso/blade-transform";
import {
  CUTLINE_GROUP_NAME,
  CUTLINE_PREFIX,
  destroyShapesByPrefix,
  syncEditorZOrder,
} from "@/lib/editor/pikaso/board-shapes";
import type Pikaso from "pikaso";
import Konva from "konva";

const OVERLAY_PREFIX = CUTLINE_PREFIX;

const STYLES = {
  cut: { stroke: "#E5007E", dash: [8, 4] as number[], width: 2 },
  bleed: { stroke: "#ef4444", dash: [6, 3] as number[], width: 1.5 },
  safe: { stroke: "#3b82f6", dash: [4, 4] as number[], width: 1.5 },
};

function removeCutlineGroup(layer: Konva.Layer) {
  const existing = layer.findOne(`.${CUTLINE_GROUP_NAME}`);
  existing?.destroy();
}

function removeOverlays(editor: Pikaso) {
  destroyShapesByPrefix(editor, OVERLAY_PREFIX);
  removeCutlineGroup(editor.board.layer);
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

function applyGroupTransform(
  group: Konva.Group,
  labelX: number,
  labelY: number,
  labelWidthMm: number,
  labelHeightMm: number,
  transform: BladeTransformMm
) {
  const cx = mmToPx(labelWidthMm / 2);
  const cy = mmToPx(labelHeightMm / 2);
  group.offset({ x: cx, y: cy });
  group.position({
    x: labelX + cx + mmToPx(transform.offsetXmm),
    y: labelY + cy + mmToPx(transform.offsetYmm),
  });
  group.scale({ x: transform.scale, y: transform.scale });
  group.rotation(transform.rotationDeg);
}

export function renderCutlineOverlays(
  editor: Pikaso,
  bundle: CutlineBundle,
  opts: {
    labelX: number;
    labelY: number;
    labelWidthMm: number;
    labelHeightMm: number;
    layers: { cut: boolean; bleed: boolean; safe: boolean };
    bladeTransform?: BladeTransformMm;
    bladeInteractive?: boolean;
  }
) {
  removeOverlays(editor);
  const {
    labelX,
    labelY,
    labelWidthMm,
    labelHeightMm,
    layers,
    bladeTransform,
    bladeInteractive = false,
  } = opts;

  const displayBundle = bundle;

  const group = new Konva.Group({
    name: CUTLINE_GROUP_NAME,
    draggable: bladeInteractive,
    listening: bladeInteractive,
  });

  if (bladeTransform) {
    applyGroupTransform(
      group,
      labelX,
      labelY,
      labelWidthMm,
      labelHeightMm,
      bladeTransform
    );
  } else {
    group.position({ x: labelX, y: labelY });
  }

  const addPath = (
    name: string,
    ringMm: PathRing,
    style: (typeof STYLES)["cut"],
    interactive = false
  ) => {
    const pathD = pathRingToSvgD(ringMmToPx(ringMm));
    if (!pathD) return;
    if (interactive) {
      group.add(
        new Konva.Path({
          name: `${name}-hit`,
          data: pathD,
          fill: "rgba(0,0,0,0.001)",
          strokeEnabled: false,
          listening: true,
        })
      );
    }
    group.add(
      new Konva.Path({
        name,
        data: pathD,
        stroke: style.stroke,
        strokeWidth: style.width,
        dash: style.dash,
        lineJoin: "round",
        lineCap: "round",
        strokeScaleEnabled: false,
        listening: interactive,
        hitStrokeWidth: interactive ? 24 : 0,
      })
    );
  };

  if (layers.bleed) {
    for (let i = 0; i < displayBundle.bleed.length; i++) {
      addPath(`${OVERLAY_PREFIX}bleed-${i}`, displayBundle.bleed[i]!, STYLES.bleed);
    }
  }
  if (layers.safe) {
    for (let i = 0; i < displayBundle.safe.length; i++) {
      addPath(`${OVERLAY_PREFIX}safe-${i}`, displayBundle.safe[i]!, STYLES.safe);
    }
  }
  if (layers.cut) {
    for (let i = 0; i < displayBundle.cut.length; i++) {
      addPath(
        `${OVERLAY_PREFIX}cut-${i}`,
        displayBundle.cut[i]!,
        STYLES.cut,
        bladeInteractive
      );
    }
  }

  editor.board.layer.add(group);
  syncEditorZOrder(editor);
  editor.board.draw();
  return group;
}
