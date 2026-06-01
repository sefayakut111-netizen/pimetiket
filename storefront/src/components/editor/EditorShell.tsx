"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Pill, useToast } from "@/components/ui";
import {
  EditorCoachmark,
  isEditorOnboarded,
  markEditorOnboarded,
} from "@/components/editor/EditorCoachmark";
import { buildEditorIframeSrc } from "@/lib/editor/build-editor-iframe-src";
import {
  deriveEditorProductHint,
  writeEditorHandoff,
  type PocCutlineMeta,
  type PocDesignFilePayload,
  type PocEditorSavedPayload,
} from "@/lib/editor/editor-handoff";
import { uploadFileToTempDesign } from "@/lib/design-temp-upload";
import { DIE_CUT_BY_ID } from "@/lib/templates/die-cut-templates";

type PocStatusState = "loading" | "ready" | "loaded" | "error" | "timeout";

function base64ToFile(
  base64: string,
  fileName: string,
  mimeType: string
): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mimeType });
}

export default function EditorShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sablonPrefilledRef = useRef(false);
  const exportWaitRef = useRef<
    ((payload: PocEditorSavedPayload | null) => void) | null
  >(null);
  const designFileWaitRef = useRef<((file: File | null) => void) | null>(null);
  const pendingSablonRef = useRef<
    | {
        shape: string;
        widthMm: number;
        heightMm: number;
        cornerRadiusMm?: number;
      }
    | null
  >(null);

  const [iframeSrc] = useState(() => buildEditorIframeSrc());
  const [iframeHeight, setIframeHeight] = useState(900);
  const [designLoaded, setDesignLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [showCoach, setShowCoach] = useState(false);
  const [pocMeta, setPocMeta] = useState<PocCutlineMeta | null>(null);
  const [pocStatus, setPocStatus] = useState<{
    state: PocStatusState;
    message: string;
  } | null>({ state: "loading", message: "POC editör yükleniyor…" });

  useEffect(() => {
    if (!isEditorOnboarded()) setShowCoach(true);
  }, []);

  useEffect(() => {
    const id = searchParams.get("sablon")?.trim();
    if (!id || sablonPrefilledRef.current) return;
    const tpl = DIE_CUT_BY_ID.get(id);
    if (!tpl) return;
    sablonPrefilledRef.current = true;
    pendingSablonRef.current = {
      shape: tpl.shape,
      widthMm: tpl.widthMm,
      heightMm: tpl.heightMm,
      cornerRadiusMm: tpl.cornerRadiusMm,
    };
  }, [searchParams]);

  const postToPoc = useCallback((payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(payload, window.location.origin);
  }, []);

  const applyPendingSablon = useCallback(() => {
    const tpl = pendingSablonRef.current;
    if (!tpl || !iframeRef.current?.contentWindow) return;
    const mode =
      tpl.shape === "circle"
        ? "circle"
        : tpl.shape === "rect" || tpl.shape === "ellipse"
          ? "rect"
          : "contour";
    postToPoc({
      type: "pim-editor-set-shape",
      shape: tpl.shape,
      mode,
      widthMm: tpl.widthMm,
      heightMm: tpl.heightMm,
      cornerRadiusMm: tpl.cornerRadiusMm ?? 0,
    });
    pendingSablonRef.current = null;
  }, [postToPoc]);

  useEffect(() => {
    let timeoutHandle: number | null = null;
    let loaded = false;

    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) {
        return;
      }
      const data = e.data as Record<string, unknown> | undefined;
      if (!data || typeof data.type !== "string") return;

      if (data.type === "pim-poc-ready") {
        setPocStatus({ state: "ready", message: "Editör hazır — görsel yükleyin" });
        applyPendingSablon();
      } else if (data.type === "pim-poc-loaded") {
        loaded = true;
        setDesignLoaded(true);
        setPocStatus({
          state: "loaded",
          message: "Tasarım yüklendi — bıçak otomatik netleşecek",
        });
        window.setTimeout(() => setPocStatus(null), 3000);
      } else if (data.type === "pim-poc-error") {
        setPocStatus({
          state: "error",
          message: `POC hatası: ${String(data.error ?? "(boş)")}`,
        });
      } else if (
        data.type === "pim-poc-resize" &&
        typeof data.height === "number"
      ) {
        const h = data.height;
        setIframeHeight((prev) => {
          const next = Math.max(720, Math.min(h + 8, 4800));
          return Math.abs(prev - next) < 8 ? prev : next;
        });
      } else if (data.type === "pim-editor-saved") {
        const payload = data as unknown as PocEditorSavedPayload;
        setPocMeta(payload.meta);
        exportWaitRef.current?.(payload);
        exportWaitRef.current = null;
      } else if (data.type === "pim-design-file") {
        const filePayload = data as unknown as PocDesignFilePayload;
        if (filePayload.error || !filePayload.base64 || !filePayload.fileName) {
          designFileWaitRef.current?.(null);
          designFileWaitRef.current = null;
          return;
        }
        try {
          const file = base64ToFile(
            filePayload.base64,
            filePayload.fileName,
            filePayload.mimeType || "application/octet-stream"
          );
          designFileWaitRef.current?.(file);
        } catch {
          designFileWaitRef.current?.(null);
        }
        designFileWaitRef.current = null;
      }
    };

    window.addEventListener("message", handler);
    timeoutHandle = window.setTimeout(() => {
      if (!loaded) {
        setPocStatus((prev) =>
          prev?.state === "loaded"
            ? prev
            : {
                state: "timeout",
                message:
                  "Editör yanıt vermedi. Sayfayı yenileyin veya bir süre sonra tekrar deneyin.",
              }
        );
      }
    }, 120_000);

    return () => {
      window.removeEventListener("message", handler);
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
    };
  }, [applyPendingSablon]);

  const productHint = useMemo(
    () => deriveEditorProductHint(pocMeta),
    [pocMeta]
  );

  const requestDesignFile = useCallback((): Promise<File | null> => {
    return new Promise((resolve) => {
      designFileWaitRef.current = resolve;
      postToPoc({ type: "pim-request-design-file" });
      window.setTimeout(() => {
        if (designFileWaitRef.current) {
          designFileWaitRef.current(null);
          designFileWaitRef.current = null;
        }
      }, 20_000);
    });
  }, [postToPoc]);

  const requestExport = useCallback((): Promise<PocEditorSavedPayload | null> => {
    return new Promise((resolve) => {
      exportWaitRef.current = resolve;
      postToPoc({ type: "pim-request-export" });
      window.setTimeout(() => {
        if (exportWaitRef.current) {
          exportWaitRef.current(null);
          exportWaitRef.current = null;
        }
      }, 20_000);
    });
  }, [postToPoc]);

  const persistDraft = useCallback(
    async (
      tempDesignId: string,
      payload: PocEditorSavedPayload
    ): Promise<string | null> => {
      const meta = payload.meta;
      const res = await fetch("/api/editor/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tempDesignId,
          svg: payload.svg,
          preview_png_base64: payload.preview_png_base64 ?? undefined,
          source: meta.source ?? "raster",
          mode: meta.mode ?? "contour",
          offset_mm: meta.offset_mm,
          smoothness: meta.smoothness,
          width_mm: meta.width_mm,
          height_mm: meta.height_mm,
          cutline_width_mm: meta.cutline_width_mm,
          cutline_height_mm: meta.cutline_height_mm,
          material_type: meta.material_type ?? "paper",
          placement_json: meta.image_placement,
        }),
      });
      const data = (await res.json()) as { draftId?: string; error?: string };
      if (!res.ok || !data.draftId) {
        toast.error(data.error ?? "Bıçak kaydı başarısız");
        return null;
      }
      setDraftId(data.draftId);
      return data.draftId;
    },
    [toast]
  );

  const addToProduct = async (product: "sticker" | "etiket") => {
    if (!designLoaded) {
      toast.error("Önce görsel yükle ve bıçağı ayarla");
      return;
    }
    if (!iframeRef.current) return;

    setSaving(true);
    try {
      const exported = await requestExport();
      if (!exported?.svg) {
        toast.error("Bıçak dışa aktarılamadı — POC'ta Kaydet'e basmayı dene");
        return;
      }
      setPocMeta(exported.meta);

      const file = await requestDesignFile();
      if (!file) {
        toast.error("Tasarım dosyası alınamadı");
        return;
      }

      const uploaded = await uploadFileToTempDesign(file);
      if (!uploaded) {
        toast.error("Tasarım yüklenemedi");
        return;
      }

      const resolvedDraftId =
        draftId ?? (await persistDraft(uploaded.tempId, exported));
      if (!resolvedDraftId) return;

      writeEditorHandoff({
        tempId: uploaded.tempId,
        previewUrl: uploaded.generatedPreviewUrl ?? uploaded.previewUrl,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        editorCutlineDraftId: resolvedDraftId,
        widthMm: exported.meta.width_mm ?? 50,
        heightMm: exported.meta.height_mm ?? 50,
      });

      router.push(
        product === "etiket"
          ? "/etiket/yapilandir?from=editor"
          : "/sticker/yapilandir?from=editor"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main
      className="editor-workspace min-h-[calc(100dvh-56px)] bg-gri-50"
      data-editor-workspace
    >
      <EditorCoachmark
        open={showCoach}
        onComplete={() => {
          markEditorOnboarded();
          setShowCoach(false);
        }}
        onDismissSession={() => setShowCoach(false)}
      />

      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-gri-200 bg-white px-4 py-3 shadow-1">
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] md:text-[17px] font-semibold tracking-tight text-lacivert">
            Bıçak & baskı hazırlama
          </h1>
          <p className="mt-0.5 text-[12px] text-gri-600 leading-snug">
            Görseli yükle, bıçağı ayarla, ardından ürüne ekle.
          </p>
        </div>

        <div
          className="flex shrink-0 flex-col items-end gap-1"
          data-onboard="export"
        >
          {productHint.message ? (
            <p className="text-[10px] text-gri-500 leading-snug text-right max-w-[220px]">
              {productHint.message}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {saving ? (
              <span className="text-[11px] text-gri-600">Kaydediliyor…</span>
            ) : null}
            {draftId ? (
              <Pill variant="yesil" className="hidden sm:inline-flex">
                Kayıtlı
              </Pill>
            ) : null}
            <Button
              type="button"
              variant={
                productHint.primary === "sticker" ? "primary" : "secondary"
              }
              size="sm"
              disabled={saving || !designLoaded}
              onClick={() => void addToProduct("sticker")}
            >
              Sticker&apos;a ekle
            </Button>
            <Button
              type="button"
              variant={
                productHint.primary === "etiket" ? "primary" : "secondary"
              }
              size="sm"
              disabled={saving || !designLoaded}
              onClick={() => void addToProduct("etiket")}
            >
              Etiket&apos;e ekle
            </Button>
          </div>
        </div>
      </header>

      {pocStatus ? (
        <div
          className={
            "mx-auto mt-3 max-w-[1600px] px-4 shrink-0 rounded-xl border px-3 py-1.5 text-[12px] " +
            (pocStatus.state === "error" || pocStatus.state === "timeout"
              ? "border-kirmizi/40 bg-kirmizi-soft text-kirmizi"
              : pocStatus.state === "loaded"
                ? "border-yesil/40 bg-yesil-soft text-yesil"
                : pocStatus.state === "ready"
                  ? "border-pim-mercan/40 bg-pim-mercan-tint text-lacivert"
                  : "border-sari/40 bg-sari-soft text-lacivert")
          }
        >
          <span className="font-semibold capitalize">{pocStatus.state}:</span>{" "}
          {pocStatus.message}
        </div>
      ) : null}

      <div className="mx-auto max-w-[1600px] px-4 py-4">
        <div className="overflow-hidden rounded-xl border border-gri-200 bg-white shadow-sm">
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title="Bıçak editörü"
            className="block w-full border-0"
            style={{ height: iframeHeight }}
            scrolling="no"
            sandbox="allow-scripts allow-same-origin allow-downloads"
          />
        </div>

        <p className="mt-3 text-center text-[12px] text-gri-600">
          Şablon arıyorsan{" "}
          <Link href="/sablonlar?tab=kesim" className="text-pim-mercan underline">
            kesim şablonları
          </Link>
          sayfasına bakabilirsin.
        </p>
      </div>
    </main>
  );
}
