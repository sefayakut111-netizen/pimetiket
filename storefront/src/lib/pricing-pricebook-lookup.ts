/**
 * Partner Price Book — snapshot uzerinden lookup (pure, testable).
 */

import {
  type PricebookCellMap,
  type PricebookLookupInput,
  type PricebookLookupResult,
  type PricebookSnapshot,
  PRICEBOOK_MAX_QTY,
  PRICEBOOK_MIN_QTY,
} from "./pricing-pricebook-types";
import {
  bilinearWH,
  findAxisBracket,
  lerp,
} from "./pricing-pricebook-interp";

function getCell(
  cells: PricebookCellMap,
  w: number,
  h: number,
  qty: number
): number | undefined {
  const key = `${w}:${h}:${qty}`;
  const v = cells[key];
  if (v !== undefined && Number.isFinite(v)) return v;
  // Seyrek kare-only matris: capraz hucre yoksa max(w,h) kare hucre
  const side = Math.max(w, h);
  if (side !== w || side !== h) {
    const sq = cells[`${side}:${side}:${qty}`];
    if (sq !== undefined && Number.isFinite(sq)) return sq;
  }
  return undefined;
}

function bilinearAtQty(
  cells: PricebookCellMap,
  width_mm: number,
  height_mm: number,
  w0: number,
  w1: number,
  h0: number,
  h1: number,
  qty: number
): { value: number; t_w: number; t_h: number } | null {
  const c00 = getCell(cells, w0, h0, qty);
  const c10 = getCell(cells, w1, h0, qty);
  const c01 = getCell(cells, w0, h1, qty);
  const c11 = getCell(cells, w1, h1, qty);
  if (
    c00 === undefined ||
    c10 === undefined ||
    c01 === undefined ||
    c11 === undefined
  ) {
    return null;
  }
  return bilinearWH(width_mm, height_mm, w0, w1, h0, h1, c00, c10, c01, c11);
}

export function lookupPricebookFromSnapshot(
  snapshot: PricebookSnapshot,
  input: PricebookLookupInput
): PricebookLookupResult {
  const { width_mm, height_mm, qty, material_key } = input;

  if (width_mm <= 0 || height_mm <= 0 || qty <= 0) {
    return { ok: false, reason: "invalid_input" };
  }

  if (qty < PRICEBOOK_MIN_QTY) {
    return {
      ok: false,
      reason: "qty_below_min",
      hint: "Rulo etiket icin minimum 1.000 adet. Daha az icin Sticker urunune bakin.",
      min_qty: PRICEBOOK_MIN_QTY,
    };
  }

  if (qty > PRICEBOOK_MAX_QTY) {
    return {
      ok: false,
      reason: "qty_above_max",
      hint: "10.000 adet uzeri icin toplu siparis teklifi isteyin.",
      max_qty: PRICEBOOK_MAX_QTY,
    };
  }

  const matrix = snapshot.matrices[material_key];
  if (!matrix) {
    return {
      ok: false,
      reason: "material_not_found",
      hint: `Price book'ta "${material_key}" matrisi yok`,
    };
  }
  if (!matrix.meta.active) {
    return { ok: false, reason: "matrix_inactive" };
  }

  const maxW = Math.max(...snapshot.axes.width);
  const maxH = Math.max(...snapshot.axes.height);
  if (width_mm > maxW || height_mm > maxH) {
    return {
      ok: false,
      reason: "size_above_max",
      hint: `Maksimum ${maxW}x${maxH} mm — ozel teklif isteyin`,
    };
  }

  const wBracket = findAxisBracket(width_mm, snapshot.axes.width, {
    clamp_low: true,
    clamp_high: false,
  });
  const hBracket = findAxisBracket(height_mm, snapshot.axes.height, {
    clamp_low: true,
    clamp_high: false,
  });
  const qBracket = findAxisBracket(qty, snapshot.axes.qty, {
    clamp_low: true,
    clamp_high: true,
  });

  if (!wBracket || !hBracket || !qBracket) {
    return { ok: false, reason: "missing_cells", hint: "Eksen tanimi eksik" };
  }

  const w0 = wBracket.low;
  const w1 = wBracket.high;
  const h0 = hBracket.low;
  const h1 = hBracket.high;
  const q0 = qBracket.low;
  const q1 = qBracket.high;

  let partnerUnit: number;
  let t_w = 0;
  let t_h = 0;
  const t_qty = qBracket.t;

  if (q0 === q1) {
    const plane = bilinearAtQty(
      matrix.cells,
      width_mm,
      height_mm,
      w0,
      w1,
      h0,
      h1,
      q0
    );
    if (!plane) {
      return {
        ok: false,
        reason: "missing_cells",
        hint: `${material_key} ${w0}x${h0} @ ${q0} hucreleri eksik`,
      };
    }
    partnerUnit = plane.value;
    t_w = plane.t_w;
    t_h = plane.t_h;
  } else {
    const lowPlane = bilinearAtQty(
      matrix.cells,
      width_mm,
      height_mm,
      w0,
      w1,
      h0,
      h1,
      q0
    );
    const highPlane = bilinearAtQty(
      matrix.cells,
      width_mm,
      height_mm,
      w0,
      w1,
      h0,
      h1,
      q1
    );
    if (!lowPlane || !highPlane) {
      return {
        ok: false,
        reason: "missing_cells",
        hint: `${material_key} ${w0}-${w1}x${h0}-${h1} @ ${q0}-${q1} hucreleri eksik`,
      };
    }
    partnerUnit = lerp(lowPlane.value, highPlane.value, t_qty);
    t_w = lerp(lowPlane.t_w, highPlane.t_w, t_qty);
    t_h = lerp(lowPlane.t_h, highPlane.t_h, t_qty);
  }

  const corners = [
    {
      width_mm: w0,
      height_mm: h0,
      qty: q0,
      price_per_unit: getCell(matrix.cells, w0, h0, q0) ?? 0,
    },
    {
      width_mm: w1,
      height_mm: h0,
      qty: q0,
      price_per_unit: getCell(matrix.cells, w1, h0, q0) ?? 0,
    },
    {
      width_mm: w0,
      height_mm: h1,
      qty: q0,
      price_per_unit: getCell(matrix.cells, w0, h1, q0) ?? 0,
    },
    {
      width_mm: w1,
      height_mm: h1,
      qty: q0,
      price_per_unit: getCell(matrix.cells, w1, h1, q0) ?? 0,
    },
  ];

  return {
    ok: true,
    partner_unit_per_label: partnerUnit,
    partner_subtotal: partnerUnit * qty,
    matrix_version: matrix.meta.version,
    diagnostics: {
      anchors: {
        width: [w0, w1],
        height: [h0, h1],
        qty: [q0, q1],
      },
      interpolation: { t_w, t_h, t_qty },
      corners,
      partner_unit_raw: partnerUnit,
      clamped: {
        width: wBracket.clamped_low,
        height: hBracket.clamped_low,
        qty: qBracket.clamped_low || qBracket.clamped_high,
      },
    },
  };
}
