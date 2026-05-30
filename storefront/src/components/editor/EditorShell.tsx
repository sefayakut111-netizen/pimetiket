"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DesignDropZone,
  type DesignTempState,
} from "@/components/ui/DesignDropZone";
import {
  EditorCanvas,
  type EditorCanvasHandle,
} from "@/components/editor/EditorCanvas";
import { ShapePreview } from "@/components/templates/ShapePreview";
import { Button, Card, Eyebrow, Input, Pill, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { buildEditorIframeSrc } from "@/lib/editor/build-editor-iframe-src";
import { writeEditorHandoff } from "@/lib/editor/editor-handoff";
import {
  CATEGORY_LABELS,
  DIE_CUT_TEMPLATES,
  type DieCutTemplate,
  type ShapeCategory,
} from "@/lib/templates/die-cut-templates";
import type { BgDetectResult } from "@/lib/proof/background-detect";

const STEPS = [
  "Görsel yükle",
  "Bıçak seç",
  "Ebatlandır",
  "Arka plan",
  "Ürüne ekle",
] as const;

type BladeTab = "template" | "auto";

export default function EditorShell() {
  const router = useRouter();
  const toast = useToast();
  const canvasRef = useRef<EditorCanvasHandle>(null);

  const [step, setStep] = useState(1);
  const [design, setDesign] = useState<DesignTempState | null>(null);
  const [widthMm, setWidthMm] = useState(50);
  const [heightMm, setHeightMm] = useState(50);
  const [lockAspect, setLockAspect] = useState(true);
  const [aspect, setAspect] = useState(1);
  const [bladeTab, setBladeTab] = useState<BladeTab>("template");
  const [category, setCategory] = useState<ShapeCategory | "all">("all");
  const [selectedTpl, setSelectedTpl] = useState<DieCutTemplate | null>(null);
  const [bgDetect, setBgDetect] = useState<BgDetectResult | null>(null);
  const [bgLoading, setBgLoading] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!design) {
      setIframeSrc(null);
      return;
    }
    setIframeSrc(
      buildEditorIframeSrc({
        tempDesignId: design.tempId,
        fileName: design.fileName,
        mimeType: design.mimeType,
        widthMm,
        heightMm,
        origin: window.location.origin,
      })
    );
  }, [design?.tempId, design?.fileName, design?.mimeType, widthMm, heightMm]);

  useEffect(() => {
    if (!design?.tempId || step < 4) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/editor/background?tempDesignId=${design.tempId}`
        );
        const data = (await res.json()) as {
          detect?: BgDetectResult;
        };
        if (!cancelled && data.detect) setBgDetect(data.detect);
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [design?.tempId, step]);

  const applyTemplate = useCallback((tpl: DieCutTemplate) => {
    setSelectedTpl(tpl);
    setWidthMm(tpl.widthMm);
    setHeightMm(tpl.heightMm);
    setAspect(tpl.widthMm / tpl.heightMm);
    const mode =
      tpl.shape === "circle"
        ? "circle"
        : tpl.shape === "rect" || tpl.shape === "ellipse"
          ? "rect"
          : "contour";
    canvasRef.current?.postMessage({
      type: "pim-editor-set-shape",
      shape: tpl.shape,
      widthMm: tpl.widthMm,
      heightMm: tpl.heightMm,
      cornerRadiusMm: tpl.cornerRadiusMm,
      mode,
    });
  }, []);

  const setAutoContour = useCallback(() => {
    setSelectedTpl(null);
    canvasRef.current?.postMessage({
      type: "pim-editor-set-shape",
      shape: "contour",
      mode: "contour",
      widthMm,
      heightMm,
    });
  }, [widthMm, heightMm]);

  useEffect(() => {
    if (step >= 3 && design) {
      canvasRef.current?.postMessage({
        type: "pim-editor-set-size",
        widthMm,
        heightMm,
      });
    }
  }, [widthMm, heightMm, step, design]);

  const handleWidthChange = (w: number) => {
    setWidthMm(w);
    if (lockAspect && aspect > 0) {
      setHeightMm(Math.round(w / aspect));
    }
  };

  const handleHeightChange = (h: number) => {
    setHeightMm(h);
    if (lockAspect && aspect > 0) {
      setWidthMm(Math.round(h * aspect));
    }
  };

  const persistDraft = useCallback(
    async (payload: {
      svg: string;
      preview_png_base64: string | null;
      meta: Record<string, unknown>;
    }): Promise<string | null> => {
      if (!design) return null;
      setSaving(true);
      try {
        const res = await fetch("/api/editor/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tempDesignId: design.tempId,
            svg: payload.svg,
            preview_png_base64: payload.preview_png_base64 ?? undefined,
            source: payload.meta.source ?? "raster",
            mode: payload.meta.mode ?? "contour",
            offset_mm: payload.meta.offset_mm,
            width_mm: payload.meta.width_mm ?? widthMm,
            height_mm: payload.meta.height_mm ?? heightMm,
            cutline_width_mm: payload.meta.cutline_width_mm,
            cutline_height_mm: payload.meta.cutline_height_mm,
            material_type: payload.meta.material_type ?? "paper",
            placement_json: payload.meta.image_placement,
          }),
        });
        const data = (await res.json()) as { draftId?: string; error?: string };
        if (!res.ok || !data.draftId) {
          toast.error(data.error ?? "Kayıt başarısız");
          return null;
        }
        setDraftId(data.draftId);
        return data.draftId;
      } catch {
        toast.error("Kayıt sırasında bağlantı hatası");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [design, widthMm, heightMm, toast]
  );

  const handleSaved = useCallback(
    (payload: {
      svg: string;
      preview_png_base64: string | null;
      meta: Record<string, unknown>;
    }) => {
      void persistDraft(payload);
    },
    [persistDraft]
  );

  const removeBackground = async () => {
    if (!design) return;
    setBgLoading(true);
    try {
      const res = await fetch("/api/editor/bg-remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tempDesignId: design.tempId }),
      });
      const data = (await res.json()) as {
        newTempDesignId?: string;
        previewUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.newTempDesignId) {
        toast.error(data.error ?? "Arka plan kaldırılamadı");
        return;
      }
      setDesign({
        ...design,
        tempId: data.newTempDesignId,
        previewUrl: data.previewUrl ?? design.previewUrl,
        fileName: design.fileName.replace(/(\.[^.]+)?$/, "-nobg.png"),
        mimeType: "image/png",
      });
      setBgDetect(null);
      toast.success("Arka plan kaldırıldı");
    } catch {
      toast.error("Bağlantı hatası");
    } finally {
      setBgLoading(false);
    }
  };

  const addToProduct = async (product: "sticker" | "etiket") => {
    if (!design) {
      toast.error("Önce görsel yükle");
      return;
    }

    let resolvedDraftId = draftId;
    if (!resolvedDraftId) {
      canvasRef.current?.postMessage({ type: "pim-request-export" });
      toast.info("Bıçak kaydediliyor…");
      await new Promise((r) => setTimeout(r, 800));
      resolvedDraftId = draftId;
    }
    if (!resolvedDraftId) {
      toast.error("Bıçak kaydı alınamadı — POC'ta Kaydet'e basıp tekrar dene");
      return;
    }

    writeEditorHandoff({
      tempId: design.tempId,
      previewUrl: design.generatedPreviewUrl ?? design.previewUrl,
      fileName: design.fileName,
      mimeType: design.mimeType,
      sizeBytes: design.sizeBytes,
      editorCutlineDraftId: resolvedDraftId,
      widthMm,
      heightMm,
    });

    router.push(
      product === "etiket"
        ? "/etiket/yapilandir?from=editor"
        : "/sticker/yapilandir?from=editor"
    );
  };

  const filteredTemplates = DIE_CUT_TEMPLATES.filter(
    (t) => category === "all" || t.category === category
  );

  return (
    <main className="py-8 pb-24">
      <div className="mx-auto max-w-[1200px] px-4 md:px-8">
        <Eyebrow>Üye editörü · İndirme yok</Eyebrow>
        <h1 className="mt-2 text-[28px] md:text-[36px] font-semibold tracking-tight">
          Bıçak & baskı hazırlama
        </h1>
        <p className="mt-2 text-[14px] text-gri-700 max-w-[560px]">
          Görselini yükle, bıçağı seç, ebatlandır — çıktı doğrudan siparişe
          akar. Bu sayfada dosya indirme yok.
        </p>

        <div className="mt-6 flex gap-1 overflow-x-auto pb-1">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <button
                key={label}
                type="button"
                onClick={() => n <= step && setStep(n)}
                className={cn(
                  "shrink-0 h-9 px-3 rounded-full text-[12.5px] font-semibold transition-colors",
                  active
                    ? "bg-pim-mercan text-white"
                    : done
                      ? "bg-yesil-soft text-yesil"
                      : "bg-gri-100 text-gri-600"
                )}
              >
                {n}. {label}
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          <Card padding="p-5" className="h-fit">
            {step === 1 && (
              <>
                <h2 className="text-[16px] font-semibold">Görsel yükle</h2>
                <p className="mt-1 text-[13px] text-gri-700">
                  PNG, JPG, PDF, AI veya PSD — konfigüratördekiyle aynı akış.
                </p>
                <div className="mt-4">
                  <DesignDropZone value={design} onChange={setDesign} />
                </div>
                <Button
                  type="button"
                  variant="primary"
                  className="mt-4 w-full"
                  disabled={!design}
                  onClick={() => setStep(2)}
                >
                  Devam
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-[16px] font-semibold">Bıçak seç</h2>
                <div className="mt-3 flex gap-1 p-1 rounded-lg bg-gri-100">
                  <button
                    type="button"
                    className={cn(
                      "flex-1 h-8 rounded-md text-[12px] font-semibold",
                      bladeTab === "template" && "bg-white shadow-1"
                    )}
                    onClick={() => setBladeTab("template")}
                  >
                    Hazır şablon
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex-1 h-8 rounded-md text-[12px] font-semibold",
                      bladeTab === "auto" && "bg-white shadow-1"
                    )}
                    onClick={() => {
                      setBladeTab("auto");
                      setAutoContour();
                    }}
                  >
                    Görselden otomatik
                  </button>
                </div>
                {bladeTab === "template" ? (
                  <>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={cn(
                          "h-7 px-2 rounded-full text-[11px] font-semibold",
                          category === "all"
                            ? "bg-pim-mercan-tint text-pim-mercan"
                            : "bg-gri-100"
                        )}
                        onClick={() => setCategory("all")}
                      >
                        Hepsi
                      </button>
                      {(Object.keys(CATEGORY_LABELS) as ShapeCategory[]).map(
                        (c) => (
                          <button
                            key={c}
                            type="button"
                            className={cn(
                              "h-7 px-2 rounded-full text-[11px] font-semibold",
                              category === c
                                ? "bg-pim-mercan-tint text-pim-mercan"
                                : "bg-gri-100"
                            )}
                            onClick={() => setCategory(c)}
                          >
                            {CATEGORY_LABELS[c]}
                          </button>
                        )
                      )}
                    </div>
                    <div className="mt-3 max-h-[320px] overflow-y-auto grid grid-cols-2 gap-2">
                      {filteredTemplates.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => applyTemplate(tpl)}
                          className={cn(
                            "text-left rounded-lg ring-1 p-2 transition-colors",
                            selectedTpl?.id === tpl.id
                              ? "ring-pim-mercan bg-pim-mercan-tint"
                              : "ring-gri-200 hover:ring-pim-mercan"
                          )}
                        >
                          <ShapePreview tpl={tpl} set="kisscut" box={64} />
                          <div className="mt-1 text-[10.5px] font-semibold line-clamp-2">
                            {tpl.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-[13px] text-gri-700">
                    Kontur modu — görselin şeklinden otomatik bıçak üretilir.
                    Sağdaki önizlemede offset ayarlayabilirsin.
                  </p>
                )}
                <Button
                  type="button"
                  variant="primary"
                  className="mt-4 w-full"
                  onClick={() => setStep(3)}
                >
                  Devam
                </Button>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="text-[16px] font-semibold">Ebatlandır</h2>
                <p className="mt-1 text-[13px] text-gri-700">
                  Gerçek baskı boyutu (mm). Canlı önizleme sağda güncellenir.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[12px] font-semibold">Genişlik</label>
                    <Input
                      type="number"
                      min={5}
                      max={500}
                      value={widthMm}
                      onChange={(e) =>
                        handleWidthChange(Number(e.target.value) || 50)
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold">Yükseklik</label>
                    <Input
                      type="number"
                      min={5}
                      max={500}
                      value={heightMm}
                      onChange={(e) =>
                        handleHeightChange(Number(e.target.value) || 50)
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
                <label className="mt-3 flex items-center gap-2 text-[12.5px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lockAspect}
                    onChange={(e) => setLockAspect(e.target.checked)}
                    className="accent-pim-mercan"
                  />
                  Oran kilidi
                </label>
                <Pill variant="gri" className="mt-3">
                  {widthMm}×{heightMm} mm
                </Pill>
                <Button
                  type="button"
                  variant="primary"
                  className="mt-4 w-full"
                  onClick={() => setStep(4)}
                >
                  Devam
                </Button>
              </>
            )}

            {step === 4 && (
              <>
                <h2 className="text-[16px] font-semibold">Arka plan</h2>
                {bgDetect?.needsRemoval ? (
                  <>
                    <p className="mt-1 text-[13px] text-gri-700">
                      Beyaz/düz zemin tespit edildi — kaldırmak baskı kalitesini
                      artırır.
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      className="mt-4 w-full"
                      disabled={bgLoading}
                      onClick={() => void removeBackground()}
                    >
                      {bgLoading ? "Kaldırılıyor…" : "Arka planı kaldır"}
                    </Button>
                  </>
                ) : (
                  <p className="mt-1 text-[13px] text-gri-700">
                    {bgDetect
                      ? "Şeffaf veya uygun zemin — ek işlem gerekmiyor."
                      : "Analiz ediliyor…"}
                  </p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-4 w-full"
                  onClick={() => setStep(5)}
                >
                  Devam
                </Button>
              </>
            )}

            {step === 5 && (
              <>
                <h2 className="text-[16px] font-semibold">Ürüne ekle</h2>
                <p className="mt-1 text-[13px] text-gri-700">
                  Sticker veya etiket konfigüratörüne geç — ölçü ve tasarım
                  ön-dolu gelir.
                </p>
                {draftId && (
                  <Pill variant="yesil" className="mt-2">
                    Bıçak kaydedildi
                  </Pill>
                )}
                {saving && (
                  <p className="mt-2 text-[12px] text-gri-600">Kaydediliyor…</p>
                )}
                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={saving}
                    onClick={() => void addToProduct("sticker")}
                  >
                    Sticker&apos;a ekle
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => void addToProduct("etiket")}
                  >
                    Etiket&apos;e ekle
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() =>
                    canvasRef.current?.postMessage({ type: "pim-request-export" })
                  }
                >
                  Bıçağı yeniden kaydet
                </Button>
              </>
            )}
          </Card>

          <div className="min-h-[480px]">
            {design && step >= 2 ? (
              <EditorCanvas
                ref={canvasRef}
                iframeSrc={iframeSrc}
                onSaved={handleSaved}
                onError={(m) => toast.error(m)}
              />
            ) : (
              <div className="h-full min-h-[480px] rounded-xl bg-gri-50 grid place-items-center text-gri-600 text-[14px] p-8 text-center">
                {step === 1
                  ? "Görsel yükleyince bıçak önizlemesi burada açılır."
                  : "Önce görsel yükle."}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
