import { mmToPx } from "@/lib/editor/coords";
import {
  destroyShapesByPrefix,
  LABEL_PREFIX,
  syncEditorZOrder,
} from "@/lib/editor/pikaso/board-shapes";
import type Pikaso from "pikaso";

const LABEL_BG_NAME = `${LABEL_PREFIX}bg`;

/** poc.html .canvas-wrap — sarı/bej kareli zemin */
const GRID_CELL_PX = 20;
const GRID_BASE = "#f3efe6";
const GRID_TILE = "#efe9da";

let gridPatternCanvas: HTMLCanvasElement | null = null;

function getGridPatternCanvas(): HTMLCanvasElement {
  if (gridPatternCanvas) return gridPatternCanvas;
  const cell = GRID_CELL_PX;
  const c = document.createElement("canvas");
  c.width = cell * 2;
  c.height = cell * 2;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.fillStyle = GRID_BASE;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = GRID_TILE;
  ctx.fillRect(0, 0, cell, cell);
  ctx.fillRect(cell, cell, cell, cell);
  gridPatternCanvas = c;
  return c;
}

function removeLabelWorkspace(editor: Pikaso) {
  destroyShapesByPrefix(editor, LABEL_PREFIX);
}

/** Baskı alanı (mm) — grid zemin + referans çerçevesi; cutline/image üstte kalır */
export function renderLabelWorkspace(
  editor: Pikaso,
  opts: {
    labelX: number;
    labelY: number;
    widthMm: number;
    heightMm: number;
  }
): void {
  removeLabelWorkspace(editor);
  const w = mmToPx(opts.widthMm);
  const h = mmToPx(opts.heightMm);
  if (w < 1 || h < 1) return;

  const model = editor.shapes.rect.insert({
    x: opts.labelX,
    y: opts.labelY,
    width: w,
    height: h,
    fill: GRID_BASE,
    fillPatternImage: getGridPatternCanvas(),
    fillPatternRepeat: "repeat",
    stroke: "rgba(217, 119, 6, 0.72)",
    strokeWidth: 2,
    dash: [8, 6],
    listening: false,
    draggable: false,
    name: LABEL_BG_NAME,
  });
  model.isSelectable = false;
  syncEditorZOrder(editor);
  editor.board.draw();
}

/** @deprecated syncEditorZOrder kullan */
export function lowerLabelWorkspaceToBottom(editor: Pikaso): void {
  syncEditorZOrder(editor);
}

export function clearLabelWorkspace(editor: Pikaso): void {
  removeLabelWorkspace(editor);
  editor.board.draw();
}
