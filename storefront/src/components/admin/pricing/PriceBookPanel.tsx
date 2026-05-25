"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Button, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ProfileConfig } from "@/lib/pricing-config-types";
import {
  quoteRuloFromPricebook,
  type PricebookSnapshot,
} from "@/lib/pricing-pricebook";
import { comparePricebookVsLegacyArea } from "@/lib/pricing-pricebook-shadow";
import { FALLBACK_PRICEBOOK_SNAPSHOT } from "@/lib/pricing-pricebook-types";
import {
  cloneCellsFromKuse,
  RULO_MATERIAL_PRICE_MULTIPLIERS,
} from "@/lib/pricing-pricebook-seed";

interface Props {
  config: ProfileConfig;
}

function fmt(n: number, dec = 4): string {
  return n.toLocaleString("tr-TR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function exportMatrixCsv(
  snapshot: PricebookSnapshot,
  materialKey: string
): void {
  const matrix = snapshot.matrices[materialKey];
  if (!matrix) {
    return;
  }
  const { width: widthAxis, height: heightAxis, qty: qtyAxis } = snapshot.axes;
  const cells = matrix.cells ?? {};
  let csv = `boyut_mm,${qtyAxis.join(",")}\n`;

  for (const w of widthAxis) {
    for (const h of heightAxis) {
      const sizeLabel = `${w}x${h}`;
      const row = qtyAxis.map((qty) => {
        const price = cells[`${w}:${h}:${qty}`];
        return price !== undefined ? price.toFixed(4) : "";
      });
      csv += `${sizeLabel},${row.join(",")}\n`;
    }
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pricebook-${materialKey}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line: string): string[] {
  return line.split(/[,;\t]/).map((s) => s.trim());
}

export function PriceBookPanel({ config }: Props) {
  const toast = useToast();
  const [snapshot, setSnapshot] = useState<PricebookSnapshot>(
    FALLBACK_PRICEBOOK_SNAPSHOT
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [materialKey, setMaterialKey] = useState("kuse");
  const [qtyTab, setQtyTab] = useState(1000);
  const [markupPct, setMarkupPct] = useState(50);

  const [testW, setTestW] = useState(60);
  const [testH, setTestH] = useState(60);
  const [testQty, setTestQty] = useState(4000);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/pricebook", { cache: "no-store" });
      const j = (await r.json()) as {
        ok?: boolean;
        snapshot?: PricebookSnapshot;
      };
      if (j.ok && j.snapshot) {
        setSnapshot(j.snapshot);
        setMarkupPct(j.snapshot.markup_pct);
      }
    } catch {
      toast.error("Price book yuklenemedi");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const matrix = snapshot.matrices[materialKey];
  const cells = matrix?.cells ?? {};
  const widthAxis = snapshot.axes.width;
  const heightAxis = snapshot.axes.height;

  const gridCells = useMemo(() => {
    const rows: Array<{ w: number; h: number; price: number }> = [];
    for (const w of widthAxis) {
      for (const h of heightAxis) {
        const key = `${w}:${h}:${qtyTab}`;
        const price = cells[key];
        if (price !== undefined) {
          rows.push({ w, h, price });
        }
      }
    }
    return rows;
  }, [cells, widthAxis, heightAxis, qtyTab]);

  const testResult = useMemo(() => {
    return quoteRuloFromPricebook(snapshot, config, {
      width_mm: testW,
      height_mm: testH,
      qty: testQty,
      material_key: materialKey,
      selected_options: { coating: "yok", customization: [] },
    });
  }, [snapshot, config, testW, testH, testQty, materialKey]);

  const shadowResult = useMemo(() => {
    return comparePricebookVsLegacyArea(config, snapshot, {
      width_mm: testW,
      height_mm: testH,
      qty: testQty,
      material_key: materialKey,
      selected_options: { coating: "yok", customization: [] },
    });
  }, [snapshot, config, testW, testH, testQty, materialKey]);

  const updateCell = (w: number, h: number, value: string) => {
    const price = parseFloat(value.replace(",", "."));
    if (!Number.isFinite(price) || price < 0) return;
    const key = `${w}:${h}:${qtyTab}`;
    setSnapshot((prev) => {
      const existing = prev.matrices[materialKey];
      const meta = RULO_MATERIAL_PRICE_MULTIPLIERS[materialKey];
      return {
        ...prev,
        matrices: {
          ...prev.matrices,
          [materialKey]: {
            meta: existing?.meta ?? {
              id: `local-${materialKey}`,
              material_key: materialKey,
              display_name: meta?.display_name ?? materialKey,
              active: true,
              version: 1,
            },
            cells: { ...(existing?.cells ?? {}), [key]: price },
          },
        },
      };
    });
  };

  const handleCloneFromKuse = () => {
    const kuseCells = snapshot.matrices.kuse?.cells;
    if (!kuseCells || Object.keys(kuseCells).length === 0) {
      toast.error("Once kuşe matrisini doldurun");
      return;
    }
    if (materialKey === "kuse") return;
    const meta = RULO_MATERIAL_PRICE_MULTIPLIERS[materialKey];
    const cells = cloneCellsFromKuse(materialKey, kuseCells);
    setSnapshot((prev) => ({
      ...prev,
      matrices: {
        ...prev.matrices,
        [materialKey]: {
          meta: {
            id: prev.matrices[materialKey]?.meta.id ?? `local-${materialKey}`,
            material_key: materialKey,
            display_name: meta?.display_name ?? materialKey,
            active: true,
            version: (prev.matrices[materialKey]?.meta.version ?? 0) + 1,
          },
          cells,
        },
      },
    }));
    toast.success(`${materialKey} matrisi kuşeden kopyalandi`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cells: Array<{
        material_key: string;
        width_mm: number;
        height_mm: number;
        qty: number;
        price_per_unit: number;
      }> = [];

      for (const [matKey, mat] of Object.entries(snapshot.matrices)) {
        for (const [cellKey, price] of Object.entries(mat.cells)) {
          const [w, h, q] = cellKey.split(":").map(Number);
          if (w && h && q) {
            cells.push({
              material_key: matKey,
              width_mm: w,
              height_mm: h,
              qty: q,
              price_per_unit: price,
            });
          }
        }
      }

      const r = await fetch("/api/admin/pricebook", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          markup_pct: markupPct,
          axes: snapshot.axes,
          cells,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (j.ok) {
        toast.success("Price book kaydedildi");
        await refresh();
      } else {
        toast.error(j.error ?? "Kayit basarisiz");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCsvImport = async (file: File) => {
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    const header = parseCsvLine(lines[0] ?? "").map((s) => s.toLowerCase());
    if (!header.length) {
      toast.error("CSV bos veya gecersiz");
      return;
    }

    const isMatrixFormat =
      header[0] === "boyut_mm" ||
      header[0] === "size_mm" ||
      (header.length > 1 && !header.includes("width_mm"));

    if (isMatrixFormat && header[0] !== "width_mm") {
      const qtyAxes = header.slice(1).map((s) => Number(s.replace(/\./g, "")));
      if (qtyAxes.some((q) => !Number.isFinite(q) || q <= 0)) {
        toast.error("CSV: boyut_mm,qty1,qty2,... baslik satiri gerekli");
        return;
      }

      let updated = 0;
      setSnapshot((prev) => {
        const existing = prev.matrices[materialKey];
        const meta = RULO_MATERIAL_PRICE_MULTIPLIERS[materialKey];
        const nextCells = { ...(existing?.cells ?? {}) };

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i] ?? "");
          if (cols.length < 2) continue;
          const sizeParts = cols[0].split(/x/i).map(Number);
          const w = sizeParts[0];
          const h = sizeParts[1];
          if (!w || !h) continue;

          for (let j = 0; j < qtyAxes.length; j++) {
            const raw = cols[j + 1]?.replace(",", ".");
            if (!raw) continue;
            const price = parseFloat(raw);
            if (!Number.isFinite(price) || price <= 0) continue;
            nextCells[`${w}:${h}:${qtyAxes[j]}`] = price;
            updated++;
          }
        }

        return {
          ...prev,
          matrices: {
            ...prev.matrices,
            [materialKey]: {
              meta: existing?.meta ?? {
                id: `local-${materialKey}`,
                material_key: materialKey,
                display_name: meta?.display_name ?? materialKey,
                active: true,
                version: 1,
              },
              cells: nextCells,
            },
          },
        };
      });

      if (updated === 0) {
        toast.error("CSV'den gecerli hucre bulunamadi");
        return;
      }
      toast.success(`${updated} hucre guncellendi (henuz kaydedilmedi)`);
      return;
    }

    const wIdx = header.indexOf("width_mm");
    const hIdx = header.indexOf("height_mm");
    const qIdx = header.indexOf("qty");
    const pIdx = header.indexOf("price_per_unit");
    const mIdx = header.indexOf("material_key");

    if (wIdx < 0 || hIdx < 0 || qIdx < 0 || pIdx < 0) {
      toast.error("CSV: boyut_mm matrisi veya width_mm,height_mm,qty,price_per_unit");
      return;
    }

    const imported: typeof gridCells = [];
    const newCells = { ...snapshot.matrices };

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i] ?? "");
      if (cols.length < 4) continue;
      const mat = mIdx >= 0 ? cols[mIdx] : materialKey;
      const w = Number(cols[wIdx]);
      const h = Number(cols[hIdx]);
      const q = Number(cols[qIdx]);
      const p = Number(cols[pIdx].replace(",", "."));
      if (!mat || !w || !h || !q || !Number.isFinite(p)) continue;

      if (!newCells[mat]) {
        newCells[mat] = {
          meta: {
            id: `import-${mat}`,
            material_key: mat,
            display_name: mat,
            active: true,
            version: 1,
          },
          cells: {},
        };
      }
      newCells[mat].cells[`${w}:${h}:${q}`] = p;
      imported.push({ w, h, price: p });
    }

    setSnapshot((prev) => ({ ...prev, matrices: newCells }));
    toast.success(`${imported.length} hucre import edildi (henuz kaydedilmedi)`);
  };

  if (loading) {
    return (
      <Card padding="p-6" className="mt-6">
        <div className="h-32 animate-pulse bg-gri-100 rounded-lg" />
      </Card>
    );
  }

  return (
    <Card padding="p-6" className="mt-6 ring-1 ring-pim-mercan/20">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h2 className="text-[18px] font-semibold text-lacivert">
            Rulo Price Book
          </h2>
          <p className="text-[13px] text-gri-700 mt-1 max-w-[640px]">
            Partner WxH x adet matrisi. Tier devre disi — adet indirimi qty
            ekseninde. Kaplama/ozellestirme mevcut options % ile eklenir.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => exportMatrixCsv(snapshot, materialKey)}
          >
            📥 CSV İndir
          </Button>
          <label className="cursor-pointer">
            <span className="inline-flex items-center h-9 px-3 rounded-lg bg-gri-100 text-[13px] font-semibold hover:bg-gri-200">
              📤 CSV Yükle
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleCsvImport(f);
                e.target.value = "";
              }}
            />
          </label>
          <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Kaydediliyor…" : "Price book kaydet"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div>
          <label className="text-[11px] font-bold uppercase text-gri-700">
            Global markup %
          </label>
          <input
            type="number"
            value={markupPct}
            onChange={(e) => setMarkupPct(Number(e.target.value))}
            className="mt-1 w-full h-10 px-3 rounded-lg ring-1 ring-gri-200 tabular-nums"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase text-gri-700">
            Malzeme matrisi
          </label>
          <select
            value={materialKey}
            onChange={(e) => setMaterialKey(e.target.value)}
            className="mt-1 w-full h-10 px-3 rounded-lg ring-1 ring-gri-200"
          >
            {Object.keys(RULO_MATERIAL_PRICE_MULTIPLIERS).map((k) => (
              <option key={k} value={k}>
                {RULO_MATERIAL_PRICE_MULTIPLIERS[k].display_name}
                {!snapshot.matrices[k] ? " (yeni)" : ""}
              </option>
            ))}
          </select>
          {materialKey !== "kuse" && !matrix && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={handleCloneFromKuse}
            >
              Kuşeden kopyala (m² orani)
            </Button>
          )}
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase text-gri-700">
            Adet filtresi
          </label>
          <div className="mt-1 flex gap-1 flex-wrap">
            {snapshot.axes.qty.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQtyTab(q)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[12px] font-semibold",
                  qtyTab === q
                    ? "bg-lacivert text-white"
                    : "bg-gri-100 text-gri-700"
                )}
              >
                {q.toLocaleString("tr-TR")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto mb-6">
        <table className="w-full text-[12px] border-collapse min-w-[480px]">
          <thead>
            <tr className="bg-gri-50">
              <th className="p-2 text-left font-semibold">W\H</th>
              {heightAxis.map((h) => (
                <th key={h} className="p-2 font-semibold tabular-nums">
                  {h}mm
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {widthAxis.map((w) => (
              <tr key={w} className="border-t border-gri-100">
                <td className="p-2 font-semibold tabular-nums">{w}mm</td>
                {heightAxis.map((h) => {
                  const key = `${w}:${h}:${qtyTab}`;
                  const val = cells[key];
                  return (
                    <td key={h} className="p-1">
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="—"
                        value={val ?? ""}
                        onChange={(e) => updateCell(w, h, e.target.value)}
                        className="w-full h-8 px-1.5 rounded ring-1 ring-gri-200 tabular-nums text-[11px]"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-gri-500 mt-2">
          {gridCells.length} dolu hucre @ {qtyTab.toLocaleString("tr-TR")} adet
        </p>
      </div>

      <div className="rounded-lg bg-gri-50 p-4 ring-1 ring-gri-200">
        <h3 className="text-[14px] font-semibold mb-3">Diagnostics test</h3>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <input
            type="number"
            value={testW}
            onChange={(e) => setTestW(Number(e.target.value))}
            placeholder="W mm"
            className="h-10 px-3 rounded-lg ring-1 ring-gri-200"
          />
          <input
            type="number"
            value={testH}
            onChange={(e) => setTestH(Number(e.target.value))}
            placeholder="H mm"
            className="h-10 px-3 rounded-lg ring-1 ring-gri-200"
          />
          <input
            type="number"
            value={testQty}
            onChange={(e) => setTestQty(Number(e.target.value))}
            placeholder="Adet"
            className="h-10 px-3 rounded-lg ring-1 ring-gri-200"
          />
        </div>
        {testResult.ok ? (
          <div className="text-[13px] space-y-1">
            <div>
              Partner birim:{" "}
              <strong>{fmt(testResult.partner_unit_per_label)} ₺/adet</strong>
            </div>
            <div>
              Musteri toplam:{" "}
              <strong>{Math.round(testResult.total).toLocaleString("tr-TR")} ₺</strong>
            </div>
            <pre className="mt-2 p-2 bg-white rounded text-[10px] overflow-x-auto">
              {JSON.stringify(testResult.diagnostics, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="text-[13px] text-kirmizi">
            {testResult.reason}: {testResult.hint}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gri-200">
          <h4 className="text-[13px] font-semibold mb-2">
            Shadow diff — eski m² vs price book
          </h4>
          {shadowResult.ok ? (
            <div className="text-[12px] space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded bg-white p-2 ring-1 ring-gri-200">
                  <div className="text-[10px] uppercase text-gri-500 font-bold">
                    Legacy m²
                  </div>
                  {shadowResult.legacy_ok && shadowResult.legacy_total !== null ? (
                    <>
                      <div className="font-semibold tabular-nums">
                        {Math.round(shadowResult.legacy_total).toLocaleString("tr-TR")} ₺
                      </div>
                      <div className="text-gri-600 tabular-nums">
                        {fmt(shadowResult.legacy_unit ?? 0, 2)} ₺/adet
                      </div>
                    </>
                  ) : (
                    <div className="text-kirmizi">{shadowResult.legacy_reason}</div>
                  )}
                </div>
                <div className="rounded bg-white p-2 ring-1 ring-pim-mercan/30">
                  <div className="text-[10px] uppercase text-gri-500 font-bold">
                    Price book
                  </div>
                  {shadowResult.pricebook_ok &&
                  shadowResult.pricebook_total !== null ? (
                    <>
                      <div className="font-semibold tabular-nums">
                        {Math.round(shadowResult.pricebook_total).toLocaleString("tr-TR")}{" "}
                        ₺
                      </div>
                      <div className="text-gri-600 tabular-nums">
                        {fmt(shadowResult.pricebook_unit ?? 0, 2)} ₺/adet
                      </div>
                    </>
                  ) : (
                    <div className="text-kirmizi">{shadowResult.pricebook_reason}</div>
                  )}
                </div>
              </div>
              {shadowResult.delta_total !== null && shadowResult.delta_pct !== null && (
                <div
                  className={cn(
                    "px-2 py-1.5 rounded font-semibold tabular-nums",
                    Math.abs(shadowResult.delta_pct) > 15
                      ? "bg-kirmizi/10 text-kirmizi"
                      : "bg-yesil/10 text-yesil-koyu"
                  )}
                >
                  Fark: {shadowResult.delta_total >= 0 ? "+" : ""}
                  {Math.round(shadowResult.delta_total).toLocaleString("tr-TR")} ₺ (
                  {shadowResult.delta_pct >= 0 ? "+" : ""}
                  {shadowResult.delta_pct.toFixed(1)}%) · billable{" "}
                  {shadowResult.billable_m2.toFixed(3)} m²
                </div>
              )}
            </div>
          ) : (
            <div className="text-[12px] text-kirmizi">{shadowResult.reason}</div>
          )}
        </div>
      </div>
    </Card>
  );
}
