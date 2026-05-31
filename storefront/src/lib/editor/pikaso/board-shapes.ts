import type Pikaso from "pikaso";

export const LABEL_PREFIX = "pim-label-";
export const CUTLINE_PREFIX = "pim-cutline-";
export const CUTLINE_GROUP_NAME = "pim-cutline-group";
export const USER_IMAGE_NAME = "pim-user-image";

type BoardShape = Pikaso["board"]["shapes"][number];

/** Pikaso shapesList kopyası — destroy sırasında canlı dizi mutasyona uğramasın */
export function listBoardShapes(editor: Pikaso): BoardShape[] {
  const shapes = editor.board.shapes;
  if (!shapes?.length) return [];
  return [...shapes];
}

/** Önce topla sonra sil — aksi halde destroy shapesList'i değiştirirken döngü eleman atlar */
export function destroyShapesByPrefix(editor: Pikaso, prefix: string): void {
  const victims = listBoardShapes(editor).filter((s) =>
    (s.name ?? "").startsWith(prefix)
  );
  for (const shape of victims) {
    try {
      shape.destroy();
    } catch {
      /* zaten silinmiş */
    }
  }
}

/** Z-order: kareli zemin en altta, görsel ortada, bıçak en üstte */
export function syncEditorZOrder(editor: Pikaso): void {
  const shapes = listBoardShapes(editor);
  const labels = shapes.filter((s) => (s.name ?? "").startsWith(LABEL_PREFIX));
  const images = shapes.filter((s) => (s.name ?? "") === USER_IMAGE_NAME);
  const cutlines = shapes.filter((s) =>
    (s.name ?? "").startsWith(CUTLINE_PREFIX)
  );

  for (const s of labels) {
    try {
      s.node.moveToBottom();
    } catch {
      /* z-order */
    }
  }
  for (const s of images) {
    try {
      s.node.moveToTop();
    } catch {
      /* z-order */
    }
  }
  for (const s of cutlines) {
    try {
      s.node.moveToTop();
    } catch {
      /* z-order */
    }
  }

  const cutGroup = editor.board.layer.findOne(`.${CUTLINE_GROUP_NAME}`);
  if (cutGroup) {
    try {
      cutGroup.moveToTop();
    } catch {
      /* z-order */
    }
  }
}
