"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, useToast } from "@/components/ui";
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
import {
  ImageEnhancePrompt,
  type EnhanceResult,
} from "@/components/design/ImageEnhancePrompt";
import { roundEditorMm } from "@/lib/editor/coords";
import {
  effectivePrintDpi,
  printDpiStatus,
  suggestMmFromAspectLongEdge,
} from "@/lib/editor/suggest-mm-from-pixels";
import {
  DIE_CUT_BY_ID,
  type CutSet,
  type DieCutTemplate,
} from "@/lib/templates/die-cut-templates";
import { EditorDieCutPicker } from "@/components/editor/EditorDieCutPicker";
import { EditorPreviewLegend } from "@/components/editor/EditorPreviewLegend";
import { EditorPimPanel } from "@/components/editor/EditorPimPanel";
import { EditorPanelSection } from "@/components/editor/EditorPanelSection";
import { EditorUploadZone } from "@/components/editor/EditorUploadZone";
import {
  EditorLayerToggles,
  EditorZoomControls,
  type EditorLayer,
} from "@/components/editor/EditorPreviewToolbar";
import {
  formatOffsetLabel,
  offsetNoteText,
} from "@/lib/editor/offset-label";
import { cn } from "@/lib/cn";
import {
  dispatchPimCommand,
  type PimCommandResult,
} from "@/lib/editor/dispatch-pim-command";
import {
  EditorBgRemovePrompt,
  type BgRemovePreviewPayload,
} from "@/components/editor/EditorBgRemovePrompt";
import { validateEditorUploadFile } from "@/lib/editor/file-limits";
import {
  humanizePocError,
  isKnownPocErrorCode,
} from "@/lib/editor/poc-error-messages";
import type { PimEditorCommand } from "@/lib/editor/pim-command-schema";

type PocStatusState = "loading" | "ready" | "loaded" | "error" | "timeout";
type CutMode = "contour" | "hull" | "rect" | "circle";
type CutSource = "ozel" | "sekil" | "diecut";
type SekilPreset = "circle" | "square" | "rect";

const CUT_SOURCES: { id: CutSource; label: string; desc: string }[] = [
  {
    id: "ozel",
    label: "Özel kesim",
    desc: "Görselini izleyen bıçak (yükle, otomatik sarar)",
  },
  {
    id: "sekil",
    label: "Hazır şekil",
    desc: "Yuvarlak / kare / dikdörtgen — düzgün geometri",
  },
  {
    id: "diecut",
    label: "Şekilli kesim (die-cut)",
    desc: "Hazır kesim boyutlarından seç",
  },
];

const CONTOUR_VARIANTS: { mode: Extract<CutMode, "contour" | "hull">; label: string }[] =
  [
    { mode: "contour", label: "Sıkı kontur" },
    { mode: "hull", label: "Geniş (çevresel)" },
  ];

const SEKIL_PRESETS: { id: SekilPreset; label: string }[] = [
  { id: "circle", label: "Yuvarlak" },
  { id: "square", label: "Kare" },
  { id: "rect", label: "Dikdörtgen" },
];

function cutModeFromTemplate(tpl: DieCutTemplate): CutMode {
  if (tpl.shape === "circle") return "circle";
  if (tpl.shape === "rect" || tpl.shape === "ellipse") return "rect";
  return "contour";
}

const DEFAULT_WIDTH_MM = 50;
const DEFAULT_HEIGHT_MM = 50;
/** Tasarım yüklendikten sonra bıçak beklemesi (OpenCV cold start için makul süre). */
const CUTLINE_WAIT_MS = 10_000;
const CUTLINE_FAIL_MESSAGE = "Bıçak hazırlanamadı — lütfen tekrar dene";

const EDITOR_TOOL_TABS = [
  { id: "gorsel", label: "Görsel" },
  { id: "bicak", label: "Bıçak" },
  { id: "boyut", label: "Boyut" },
] as const;

type EditorToolTab = (typeof EDITOR_TOOL_TABS)[number]["id"];

const MOBILE_ACCORDION = [
  { id: "aracilar", label: "Araçlar", tab: "gorsel" as EditorToolTab },
  { id: "bicak", label: "Bıçak", tab: "bicak" as EditorToolTab },
  { id: "boyut", label: "Boyut", tab: "boyut" as EditorToolTab },
] as const;

type MobileAccordionId = (typeof MOBILE_ACCORDION)[number]["id"];

type EditorUndoSnapshot = {
  widthMm: number;
  heightMm: number;
  cutMode: CutMode;
  cutSource: CutSource;
  sekilPreset: SekilPreset;
  imageScalePct: number;
  offsetMm: number;
  smoothness: number;
  cornerRadiusMm: number;
  activeDieCutId: string | null;
};

const FIT_BUTTONS = [
  { id: "pim-fit-center", label: "Ortala" },
  { id: "pim-fit-contain", label: "Sığdır" },
  { id: "pim-fit-cover", label: "Doldur" },
] as const;

const CUT_TYPE_OPTIONS: {
  id: CutSet;
  label: string;
  hint: string;
}[] = [
  {
    id: "kisscut",
    label: "Yarım kesim",
    hint: "Sadece sticker katmanı kesilir, soyulur",
  },
  {
    id: "thrucut",
    label: "Tam kesim",
    hint: "Kağıt boydan boya kesilir, parça ayrılır",
  },
];

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
  const pendingTemplateRef = useRef<DieCutTemplate | null>(null);

  const [iframeSrc] = useState(() => buildEditorIframeSrc());
  const [designLoaded, setDesignLoaded] = useState(false);
  const designLoadedRef = useRef(false);
  const [cutlineReady, setCutlineReady] = useState(false);
  const [cutlineError, setCutlineError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [widthMm, setWidthMm] = useState(DEFAULT_WIDTH_MM);
  const [heightMm, setHeightMm] = useState(DEFAULT_HEIGHT_MM);
  const [lockAspect, setLockAspect] = useState(true);
  const [aspect, setAspect] = useState(1);
  const [pocMeta, setPocMeta] = useState<PocCutlineMeta | null>(null);
  const [cutSource, setCutSource] = useState<CutSource>("ozel");
  const [sekilPreset, setSekilPreset] = useState<SekilPreset>("circle");
  const [activeDieCutId, setActiveDieCutId] = useState<string | null>(null);
  const [cutMode, setCutMode] = useState<CutMode>("contour");
  const [imagePixelW, setImagePixelW] = useState(0);
  const [imagePixelH, setImagePixelH] = useState(0);
  const [imageScalePct, setImageScalePct] = useState(100);
  const baseWidthMmRef = useRef(DEFAULT_WIDTH_MM);
  const baseHeightMmRef = useRef(DEFAULT_HEIGHT_MM);
  const userSizeTouchedRef = useRef(false);
  const scaleEchoSuppressUntilRef = useRef(0);
  const [mmLabelProbe, setMmLabelProbe] = useState<{
    widthMm: number;
    heightMm: number;
  } | null>(null);
  const [offsetMm, setOffsetMm] = useState(0);
  const [smoothness, setSmoothness] = useState(0);
  const [cornerRadiusMm, setCornerRadiusMm] = useState(0);
  const [viewZoom, setViewZoom] = useState(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [canRemoveBg, setCanRemoveBg] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [showEnhancePrompt, setShowEnhancePrompt] = useState(false);
  const [enhanceDismissed, setEnhanceDismissed] = useState(false);
  const [showCircleContourSuggest, setShowCircleContourSuggest] = useState(false);
  const [layers, setLayers] = useState<Record<EditorLayer, boolean>>({
    cut: true,
    white: false,
    bleed: false,
    safe: false,
  });
  const [pocStatus, setPocStatus] = useState<{
    state: PocStatusState;
    message: string;
  } | null>({ state: "loading", message: "Editör yükleniyor…" });
  const [toolTab, setToolTab] = useState<EditorToolTab>("gorsel");
  const [mobileAccordion, setMobileAccordion] =
    useState<MobileAccordionId | null>("aracilar");
  const [cutType, setCutType] = useState<CutSet>("kisscut");
  const [dirty, setDirty] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [bgRemovePreview, setBgRemovePreview] =
    useState<BgRemovePreviewPayload | null>(null);
  const undoSnapshotRef = useRef<EditorUndoSnapshot | null>(null);
  const autoSwitchToBicakRef = useRef(false);

  useEffect(() => {
    if (!isEditorOnboarded()) setShowCoach(true);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (designLoaded && dirty && !saving) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [designLoaded, dirty, saving]);

  useEffect(() => {
    designLoadedRef.current = designLoaded;
  }, [designLoaded]);

  const markCutlinePending = useCallback(() => {
    setCutlineReady(false);
    setCutlineError(null);
  }, []);

  const reportCutlineFailure = useCallback((message: string) => {
    setCutlineError(message);
    setCutlineReady(false);
    setPocStatus({ state: "error", message });
  }, []);

  useEffect(() => {
    if (designLoaded && !autoSwitchToBicakRef.current) {
      autoSwitchToBicakRef.current = true;
      setToolTab("bicak");
    }
  }, [designLoaded]);

  const postToPoc = useCallback((payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(
      payload,
      window.location.origin
    );
  }, []);

  const syncCutTypeToPoc = useCallback(
    (type: CutSet) => {
      postToPoc({ type: "pim-set-cut-type", cutType: type });
    },
    [postToPoc]
  );

  const handleCutTypeChange = useCallback(
    (type: CutSet) => {
      setCutType(type);
      syncCutTypeToPoc(type);
    },
    [syncCutTypeToPoc]
  );

  const uploadFileToPoc = useCallback(
    async (file: File) => {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(
          null,
          bytes.subarray(i, i + chunk) as unknown as number[]
        );
      }
      postToPoc({
        type: "pim-upload-file",
        base64: btoa(binary),
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
      });
    },
    [postToPoc]
  );

  const handleToggleLayer = useCallback(
    (layer: EditorLayer, on: boolean) => {
      setLayers((prev) => ({ ...prev, [layer]: on }));
      postToPoc({ type: "pim-toggle-layer", layer, on });
    },
    [postToPoc]
  );

  const syncSizeToPoc = useCallback(
    (w: number, h: number) => {
      scaleEchoSuppressUntilRef.current = performance.now() + 800;
      postToPoc({ type: "pim-editor-set-size", widthMm: w, heightMm: h });
    },
    [postToPoc]
  );

  const setBaseFromSize = useCallback((w: number, h: number, scalePct: number) => {
    const factor = scalePct / 100;
    if (factor <= 0) return;
    baseWidthMmRef.current = roundEditorMm(w / factor);
    baseHeightMmRef.current = roundEditorMm(h / factor);
  }, []);

  const sizeFromScalePct = useCallback((pct: number) => {
    const factor = pct / 100;
    return {
      w: roundEditorMm(baseWidthMmRef.current * factor),
      h: roundEditorMm(baseHeightMmRef.current * factor),
    };
  }, []);

  const scalePctFromWidth = useCallback((w: number) => {
    if (baseWidthMmRef.current <= 0) return 100;
    return Math.max(
      25,
      Math.min(200, Math.round((w / baseWidthMmRef.current) * 100))
    );
  }, []);

  const applyCoordinatedScale = useCallback(
    (pct: number, options?: { syncPocSize?: boolean; syncPocScale?: boolean }) => {
      const clamped = Math.max(25, Math.min(200, pct));
      const { syncPocSize = true, syncPocScale = false } = options ?? {};
      setImageScalePct(clamped);
      const { w, h } = sizeFromScalePct(clamped);
      setWidthMm(w);
      setHeightMm(h);
      if (syncPocScale) {
        postToPoc({ type: "pim-set-image-scale", scale: clamped / 100 });
      }
      if (syncPocSize) {
        syncSizeToPoc(w, h);
        markCutlinePending();
      }
      return { w, h, pct: clamped };
    },
    [postToPoc, sizeFromScalePct, syncSizeToPoc, markCutlinePending]
  );

  const applyCoordinatedSize = useCallback(
    (w: number, h: number, options?: { fromUser?: boolean }) => {
      const nw = roundEditorMm(w);
      const nh = roundEditorMm(h);
      if (options?.fromUser) {
        userSizeTouchedRef.current = true;
      }
      setWidthMm(nw);
      setHeightMm(nh);
      const pct = scalePctFromWidth(nw);
      setImageScalePct(pct);
      syncSizeToPoc(nw, nh);
      markCutlinePending();
    },
    [scalePctFromWidth, syncSizeToPoc, markCutlinePending]
  );

  const captureUndoSnapshot = useCallback(() => {
    undoSnapshotRef.current = {
      widthMm,
      heightMm,
      cutMode,
      cutSource,
      sekilPreset,
      imageScalePct,
      offsetMm,
      smoothness,
      cornerRadiusMm,
      activeDieCutId,
    };
    setCanUndo(true);
    setDirty(true);
  }, [
    widthMm,
    heightMm,
    cutMode,
    cutSource,
    sekilPreset,
    imageScalePct,
    offsetMm,
    smoothness,
    cornerRadiusMm,
    activeDieCutId,
  ]);

  const performUndo = useCallback(() => {
    const snap = undoSnapshotRef.current;
    if (!snap) return;
    setWidthMm(snap.widthMm);
    setHeightMm(snap.heightMm);
    setCutMode(snap.cutMode);
    setCutSource(snap.cutSource);
    setSekilPreset(snap.sekilPreset);
    setImageScalePct(snap.imageScalePct);
    setOffsetMm(snap.offsetMm);
    setSmoothness(snap.smoothness);
    setCornerRadiusMm(snap.cornerRadiusMm);
    setActiveDieCutId(snap.activeDieCutId);
    markCutlinePending();
    postToPoc({
      type: "pim-editor-set-shape",
      mode: snap.cutMode,
      widthMm: snap.widthMm,
      heightMm: snap.heightMm,
      ...(snap.cutMode === "rect" ? { cornerRadiusMm: snap.cornerRadiusMm } : {}),
    });
    postToPoc({ type: "pim-set-offset", offsetMm: snap.offsetMm });
    postToPoc({ type: "pim-set-smoothness", smoothness: snap.smoothness });
    postToPoc({ type: "pim-set-image-scale", scale: snap.imageScalePct / 100 });
    syncSizeToPoc(snap.widthMm, snap.heightMm);
    undoSnapshotRef.current = null;
    setCanUndo(false);
    setPocStatus({ state: "loaded", message: "Son işlem geri alındı" });
    window.setTimeout(() => setPocStatus(null), 2500);
  }, [postToPoc, syncSizeToPoc, markCutlinePending]);

  const handleRemoveBg = useCallback(() => {
    captureUndoSnapshot();
    setRemovingBg(true);
    postToPoc({ type: "pim-trigger-bg-remove" });
  }, [postToPoc, captureUndoSnapshot]);

  const handleBgRemoveAccept = useCallback(() => {
    postToPoc({ type: "pim-bg-remove-accept" });
    setBgRemovePreview(null);
    setDirty(true);
  }, [postToPoc]);

  const handleBgRemoveReject = useCallback(() => {
    postToPoc({ type: "pim-bg-remove-reject" });
    setBgRemovePreview(null);
  }, [postToPoc]);

  const applyTemplateState = useCallback((tpl: DieCutTemplate) => {
    userSizeTouchedRef.current = true;
    setWidthMm(tpl.widthMm);
    setHeightMm(tpl.heightMm);
    baseWidthMmRef.current = tpl.widthMm;
    baseHeightMmRef.current = tpl.heightMm;
    setImageScalePct(100);
    setAspect(tpl.widthMm / tpl.heightMm);
    setCornerRadiusMm(
      typeof tpl.cornerRadiusMm === "number" ? tpl.cornerRadiusMm : 0
    );
    setCutMode(cutModeFromTemplate(tpl));
    setActiveDieCutId(tpl.id);
  }, []);

  const applyTemplateToPoc = useCallback(
    (tpl: DieCutTemplate) => {
      const mode = cutModeFromTemplate(tpl);
      markCutlinePending();
      postToPoc({
        type: "pim-editor-set-shape",
        shape: tpl.shape,
        mode,
        widthMm: tpl.widthMm,
        heightMm: tpl.heightMm,
        cornerRadiusMm: tpl.cornerRadiusMm ?? 0,
      });
      syncSizeToPoc(tpl.widthMm, tpl.heightMm);
    },
    [postToPoc, syncSizeToPoc, markCutlinePending]
  );

  const applyTemplate = useCallback(
    (tpl: DieCutTemplate) => {
      applyTemplateState(tpl);
      if (iframeRef.current?.contentWindow) {
        applyTemplateToPoc(tpl);
        pendingTemplateRef.current = null;
      } else {
        pendingTemplateRef.current = tpl;
      }
    },
    [applyTemplateState, applyTemplateToPoc]
  );

  useEffect(() => {
    const id = searchParams.get("sablon")?.trim();
    if (!id || sablonPrefilledRef.current) return;
    const tpl = DIE_CUT_BY_ID.get(id);
    if (!tpl) return;
    sablonPrefilledRef.current = true;
    setCutSource("diecut");
    applyTemplateState(tpl);
    pendingTemplateRef.current = tpl;
  }, [searchParams, applyTemplateState]);

  const applyPendingTemplate = useCallback(() => {
    const tpl = pendingTemplateRef.current;
    if (!tpl || !iframeRef.current?.contentWindow) return;
    applyTemplateToPoc(tpl);
    pendingTemplateRef.current = null;
  }, [applyTemplateToPoc]);

  const applyPendingSablon = applyPendingTemplate;

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
        setPocStatus({ state: "ready", message: "Görsel yükle — bıçak otomatik netleşir" });
        syncSizeToPoc(widthMm, heightMm);
        syncCutTypeToPoc(cutType);
        applyPendingSablon();
      } else if (data.type === "pim-poc-loading") {
        setPocStatus({ state: "loading", message: "Dosya işleniyor…" });
        setDesignLoaded(false);
        markCutlinePending();
        setImageScalePct(100);
        baseWidthMmRef.current = DEFAULT_WIDTH_MM;
        baseHeightMmRef.current = DEFAULT_HEIGHT_MM;
        setOffsetMm(0);
        setSmoothness(0);
        setCornerRadiusMm(0);
        setViewZoom(1);
        setFileName(null);
        setCanRemoveBg(false);
        setRemovingBg(false);
      } else if (data.type === "pim-poc-loaded") {
        loaded = true;
        markCutlinePending();
        setDesignLoaded(true);
        setRemovingBg(false);
        if (typeof data.fileName === "string" && data.fileName) {
          setFileName(data.fileName);
        }
        if (typeof data.canRemoveBg === "boolean") {
          setCanRemoveBg(data.canRemoveBg);
        } else if (data.source === "raster") {
          setCanRemoveBg(true);
        }
        const pixelW =
          typeof data.width === "number" && data.width > 0 ? data.width : 0;
        const pixelH =
          typeof data.height === "number" && data.height > 0 ? data.height : 0;
        if (pixelW > 0) setImagePixelW(pixelW);
        if (pixelH > 0) setImagePixelH(pixelH);

        if (
          !userSizeTouchedRef.current &&
          pixelW > 0 &&
          pixelH > 0 &&
          !sablonPrefilledRef.current
        ) {
          const suggested = suggestMmFromAspectLongEdge(pixelW, pixelH);
          setAspect(suggested.aspect);
          setLockAspect(true);
          baseWidthMmRef.current = suggested.widthMm;
          baseHeightMmRef.current = suggested.heightMm;
          applyCoordinatedSize(suggested.widthMm, suggested.heightMm);
          toast.info(
            `Boyutu dosyana uydurduk: ${suggested.widthMm}×${suggested.heightMm} mm — istediğin gibi değiştirebilirsin.`
          );
        }

        setDirty(true);
        setPocStatus({
          state: "loaded",
          message: "Tasarım yüklendi — kontur hesaplanıyor…",
        });
        setShowCircleContourSuggest(false);
      } else if (data.type === "pim-mm-labels") {
        if (
          typeof data.widthMm === "number" &&
          typeof data.heightMm === "number"
        ) {
          setMmLabelProbe({
            widthMm: data.widthMm,
            heightMm: data.heightMm,
          });
        }
      } else if (data.type === "pim-circle-contour-suggest") {
        if (cutMode === "circle" && cutSource === "sekil") {
          setShowCircleContourSuggest(true);
        }
      } else if (data.type === "pim-circle-contour-suggest-clear") {
        setShowCircleContourSuggest(false);
      } else if (data.type === "pim-image-scale-changed") {
        if (typeof data.scale === "number" && data.scale > 0) {
          // Shell kaynaklı set-size'dan gelen echo penceresi → TÜMÜNÜ yok say (slider zıplamasın)
          if (performance.now() < scaleEchoSuppressUntilRef.current) {
            return;
          }
          const pct = Math.round(
            Math.max(25, Math.min(200, data.scale * 100))
          );
          if (pct !== imageScalePct) {
            applyCoordinatedScale(pct, {
              syncPocScale: false,
              syncPocSize: false,
            });
          }
        }
      } else if (data.type === "pim-cutline-ready") {
        setCutlineError(null);
        setCutlineReady(true);
        const meta = data.meta as PocCutlineMeta | undefined;
        if (meta) {
          setPocMeta((prev) => ({ ...prev, ...meta }));
          if (
            meta.mode === "contour" ||
            meta.mode === "hull" ||
            meta.mode === "rect" ||
            meta.mode === "circle"
          ) {
            setCutMode(meta.mode);
          }
          setBaseFromSize(widthMm, heightMm, imageScalePct);
        }
        setPocStatus({
          state: "loaded",
          message: "Bıçak hazır — ürüne ekleyebilirsin",
        });
        window.setTimeout(() => setPocStatus(null), 2500);
      } else if (data.type === "pim-bg-remove-started") {
        setRemovingBg(true);
      } else if (data.type === "pim-bg-remove-preview") {
        setRemovingBg(false);
        if (
          typeof data.beforeDataUrl === "string" &&
          typeof data.afterDataUrl === "string" &&
          typeof data.fileName === "string"
        ) {
          setBgRemovePreview({
            beforeDataUrl: data.beforeDataUrl,
            afterDataUrl: data.afterDataUrl,
            fileName: data.fileName,
          });
        }
      } else if (data.type === "pim-bg-remove-done") {
        setRemovingBg(false);
        if (!data.previewPending) {
          setBgRemovePreview(null);
        }
      } else if (data.type === "pim-view-zoom-changed") {
        if (typeof data.zoom === "number" && data.zoom > 0) {
          setViewZoom(Math.max(0.25, Math.min(3, data.zoom)));
        }
      } else if (data.type === "pim-poc-status") {
        const msg = String(data.msg ?? "");
        const level = String(data.level ?? "warn");
        if (!msg) return;
        if (level === "err") {
          setPocStatus({ state: "error", message: msg });
          toast.error(msg);
        } else if (level === "ok") {
          setPocStatus({ state: "loaded", message: msg });
          window.setTimeout(() => setPocStatus(null), 2500);
        } else {
          setPocStatus({ state: "ready", message: msg });
        }
      } else if (data.type === "pim-poc-error") {
        const errMsg = String(data.error ?? "(boş)");
        console.error("[editor] poc error:", errMsg);
        const humanMsg = humanizePocError(errMsg);
        if (designLoadedRef.current && !isKnownPocErrorCode(errMsg)) {
          reportCutlineFailure(`${CUTLINE_FAIL_MESSAGE} (${errMsg})`);
        } else {
          setPocStatus({
            state: "error",
            message: humanMsg,
          });
          toast.error(humanMsg);
        }
      } else if (data.type === "pim-cutline-auto-failed") {
        const errMsg = String(data.error ?? "kontur_uretilemedi");
        reportCutlineFailure(`${CUTLINE_FAIL_MESSAGE} (${errMsg})`);
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
                  "Editör yanıt vermedi. Sayfayı yenileyip tekrar deneyin.",
              }
        );
      }
    }, 120_000);

    return () => {
      window.removeEventListener("message", handler);
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
    };
  }, [applyPendingSablon, applyCoordinatedScale, applyCoordinatedSize, setBaseFromSize, syncSizeToPoc, syncCutTypeToPoc, cutType, widthMm, heightMm, imageScalePct, cutMode, cutSource, markCutlinePending, reportCutlineFailure, toast]);

  useEffect(() => {
    if (!designLoaded || cutlineReady || cutlineError) return;
    const timeout = window.setTimeout(() => {
      reportCutlineFailure(CUTLINE_FAIL_MESSAGE);
    }, CUTLINE_WAIT_MS);
    return () => window.clearTimeout(timeout);
  }, [designLoaded, cutlineReady, cutlineError, reportCutlineFailure]);

  const retryCutline = useCallback(() => {
    if (!designLoadedRef.current) return;
    markCutlinePending();
    setPocStatus({
      state: "loaded",
      message: "Kontur yeniden hesaplanıyor…",
    });
    postToPoc({ type: "pim-flush-cutline" });
  }, [markCutlinePending, postToPoc]);

  const productHint = useMemo(
    () => deriveEditorProductHint(pocMeta),
    [pocMeta]
  );

  const ctaBlockedReason = useMemo(() => {
    if (saving) return "Kaydediliyor…";
    if (!designLoaded) return "Önce görsel yükle";
    if (cutlineError) return cutlineError;
    if (!cutlineReady) return "Bıçak hazırlanıyor…";
    return null;
  }, [saving, designLoaded, cutlineReady, cutlineError]);

  const handleWidthChange = (raw: number) => {
    captureUndoSnapshot();
    const w = roundEditorMm(raw);
    const h =
      lockAspect && aspect > 0 ? roundEditorMm(w / aspect) : heightMm;
    applyCoordinatedSize(w, h, { fromUser: true });
  };

  const handleHeightChange = (raw: number) => {
    captureUndoSnapshot();
    const h = roundEditorMm(raw);
    const w =
      lockAspect && aspect > 0 ? roundEditorMm(h * aspect) : widthMm;
    applyCoordinatedSize(w, h, { fromUser: true });
  };

  const handleLockAspectChange = (on: boolean) => {
    if (on && heightMm > 0) setAspect(widthMm / heightMm);
    setLockAspect(on);
  };

  const handleCutModeChange = (mode: CutMode) => {
    captureUndoSnapshot();
    setCutMode(mode);
    markCutlinePending();
    postToPoc({
      type: "pim-editor-set-shape",
      mode,
      widthMm,
      heightMm,
      ...(mode === "rect" ? { cornerRadiusMm } : {}),
    });
  };

  const handleCutSourceChange = useCallback(
    (src: CutSource) => {
      captureUndoSnapshot();
      setCutSource(src);
      if (src === "ozel") {
        setCutMode("contour");
        markCutlinePending();
        postToPoc({
          type: "pim-editor-set-shape",
          shape: "contour",
          mode: "contour",
          widthMm,
          heightMm,
        });
      } else if (src === "sekil") {
        setSekilPreset("circle");
        setCutMode("circle");
        markCutlinePending();
        postToPoc({
          type: "pim-editor-set-shape",
          shape: "circle",
          mode: "circle",
          widthMm,
          heightMm,
        });
      }
    },
    [postToPoc, widthMm, heightMm, markCutlinePending, captureUndoSnapshot]
  );

  const dismissCircleContourSuggest = useCallback(() => {
    setShowCircleContourSuggest(false);
    postToPoc({ type: "pim-dismiss-circle-contour-suggest" });
  }, [postToPoc]);

  const acceptCircleContourSuggest = useCallback(() => {
    setShowCircleContourSuggest(false);
    postToPoc({ type: "pim-dismiss-circle-contour-suggest" });
    handleCutSourceChange("ozel");
  }, [postToPoc, handleCutSourceChange]);

  const handleSekilPresetChange = useCallback(
    (preset: SekilPreset) => {
      captureUndoSnapshot();
      setSekilPreset(preset);
      markCutlinePending();
      if (preset === "circle") {
        setCutMode("circle");
        postToPoc({
          type: "pim-editor-set-shape",
          shape: "circle",
          mode: "circle",
          widthMm,
          heightMm,
        });
        return;
      }
      setCutMode("rect");
      const radius = preset === "square" ? 0 : cornerRadiusMm;
      if (preset === "square") {
        setCornerRadiusMm(0);
      }
      postToPoc({
        type: "pim-editor-set-shape",
        shape: "rect",
        mode: "rect",
        widthMm,
        heightMm,
        cornerRadiusMm: radius,
      });
    },
    [postToPoc, widthMm, heightMm, cornerRadiusMm, markCutlinePending, captureUndoSnapshot]
  );

  const handleDieCutSelect = useCallback(
    (tpl: DieCutTemplate) => {
      captureUndoSnapshot();
      setCutSource("diecut");
      applyTemplate(tpl);
    },
    [applyTemplate, captureUndoSnapshot]
  );

  const showCornerRadius = useMemo(() => {
    if (cutSource === "sekil") return cutMode === "rect";
    if (cutSource === "diecut") {
      const tpl = activeDieCutId ? DIE_CUT_BY_ID.get(activeDieCutId) : null;
      return tpl?.shape === "rect";
    }
    return false;
  }, [cutSource, cutMode, activeDieCutId]);

  const handleImageScaleChange = (pct: number) => {
    captureUndoSnapshot();
    applyCoordinatedScale(pct);
  };

  const handleOffsetChange = (raw: number) => {
    const clamped = Math.max(0, Math.min(5, raw));
    setOffsetMm(clamped);
    postToPoc({ type: "pim-set-offset", offsetMm: clamped });
  };

  const handleSmoothnessChange = (raw: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(raw)));
    setSmoothness(clamped);
    postToPoc({ type: "pim-set-smoothness", smoothness: clamped });
  };

  const maxCornerRadiusMm = useMemo(
    () => Math.min(20, widthMm / 2, heightMm / 2),
    [widthMm, heightMm]
  );

  const handleCornerRadiusChange = (raw: number) => {
    const clamped = Math.max(0, Math.min(maxCornerRadiusMm, raw));
    setCornerRadiusMm(clamped);
    markCutlinePending();
    postToPoc({
      type: "pim-editor-set-shape",
      shape: "rect",
      mode: "rect",
      widthMm,
      heightMm,
      cornerRadiusMm: clamped,
    });
  };

  const zoomIn = useCallback(() => {
    setViewZoom((z) => {
      const next = Math.min(3, Math.round((z + 0.1) * 10) / 10);
      postToPoc({ type: "pim-set-view-zoom", zoom: next });
      return next;
    });
  }, [postToPoc]);

  const zoomOut = useCallback(() => {
    setViewZoom((z) => {
      const next = Math.max(0.25, Math.round((z - 0.1) * 10) / 10);
      postToPoc({ type: "pim-set-view-zoom", zoom: next });
      return next;
    });
  }, [postToPoc]);

  const zoomReset = useCallback(() => {
    setViewZoom(1);
    postToPoc({ type: "pim-set-view-zoom", zoom: 1 });
  }, [postToPoc]);

  const handlePimCommand = useCallback(
    (command: PimEditorCommand): PimCommandResult => {
      const destructive =
        command.action === "set_size" ||
        command.action === "set_size_from_reference" ||
        command.action === "apply_auto_cut" ||
        command.action === "apply_shape_cut" ||
        command.action === "apply_template" ||
        command.action === "set_image_scale" ||
        command.action === "remove_background";
      if (destructive) captureUndoSnapshot();

      const result = dispatchPimCommand(command, {
        widthMm,
        heightMm,
        postToPoc,
        setWidthMm,
        setHeightMm,
        setCutMode,
        setCutlineReady,
        setImageScalePct,
        setLayers,
        handleRemoveBg,
        syncSizeToPoc,
        applyCoordinatedScale,
        applyCoordinatedSize,
        setBaseFromSize,
      });
      if (result.ok) setDirty(true);
      return result;
    },
    [
      widthMm,
      heightMm,
      postToPoc,
      handleRemoveBg,
      syncSizeToPoc,
      applyCoordinatedScale,
      applyCoordinatedSize,
      setBaseFromSize,
      captureUndoSnapshot,
    ]
  );

  const dpiInfo = useMemo(() => {
    if (imagePixelW <= 0 || imagePixelH <= 0) return null;
    const dpi = effectivePrintDpi(
      imagePixelW,
      imagePixelH,
      widthMm,
      heightMm
    );
    return printDpiStatus(dpi);
  }, [imagePixelW, imagePixelH, widthMm, heightMm]);

  const suggestEnhance = useMemo(() => {
    if (!designLoaded || enhanceDismissed) return false;
    if (pocMeta?.source === "vector" || pocMeta?.source === "vector-with-cutline") {
      return false;
    }
    return dpiInfo?.level === "warn" || dpiInfo?.level === "critical";
  }, [designLoaded, enhanceDismissed, dpiInfo?.level, pocMeta?.source]);

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

  const runEditorEnhance = useCallback(async (): Promise<EnhanceResult | null> => {
    const file = await requestDesignFile();
    if (!file) return null;
    const uploaded = await uploadFileToTempDesign(file);
    if (!uploaded) return null;

    const res = await fetch("/api/design/enhance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tempDesignId: uploaded.tempId }),
    });
    const j = (await res.json()) as EnhanceResult & {
      ok?: boolean;
      error?: string;
    };
    if (!res.ok || !j.ok || !j.enhancedTempDesignId) return null;
    return {
      originalPreviewUrl: j.originalPreviewUrl ?? uploaded.previewUrl,
      enhancedPreviewUrl: j.enhancedPreviewUrl ?? null,
      enhancedTempDesignId: j.enhancedTempDesignId,
      originalWidth: j.originalWidth,
      originalHeight: j.originalHeight,
      enhancedWidth: j.enhancedWidth,
      enhancedHeight: j.enhancedHeight,
      scale: j.scale,
    };
  }, [requestDesignFile]);

  const acceptEditorEnhance = useCallback(
    async (result: EnhanceResult) => {
      if (!result.enhancedPreviewUrl) return;
      const res = await fetch(result.enhancedPreviewUrl);
      if (!res.ok) {
        toast.error("İyileştirilmiş görsel alınamadı");
        return;
      }
      const blob = await res.blob();
      const file = new File([blob], "enhanced.png", { type: "image/png" });
      await uploadFileToPoc(file);
      setShowEnhancePrompt(false);
      setEnhanceDismissed(true);
      toast.success("İyileştirilmiş görsel yüklendi");
    },
    [toast, uploadFileToPoc]
  );

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
          width_mm: meta.width_mm ?? widthMm,
          height_mm: meta.height_mm ?? heightMm,
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
      return data.draftId;
    },
    [toast, widthMm, heightMm]
  );

  const addToProduct = async (product: "sticker" | "etiket") => {
    if (ctaBlockedReason) {
      toast.info(ctaBlockedReason);
      return;
    }
    if (!iframeRef.current) return;

    setSaving(true);
    try {
      const exported = await requestExport();
      if (!exported?.svg) {
        toast.error("Bıçak dışa aktarılamadı — tekrar dene");
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

      const resolvedDraftId = await persistDraft(uploaded.tempId, exported);
      if (!resolvedDraftId) return;

      writeEditorHandoff({
        tempId: uploaded.tempId,
        previewUrl: uploaded.generatedPreviewUrl ?? uploaded.previewUrl,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        editorCutlineDraftId: resolvedDraftId,
        widthMm: exported.meta.width_mm ?? widthMm,
        heightMm: exported.meta.height_mm ?? heightMm,
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

  const sourceLabel = useMemo(() => {
    const s = pocMeta?.source;
    if (s === "vector") return "Vektörel";
    if (s === "vector-with-cutline") return "Vektörel + bıçak";
    if (s === "psd") return "PSD";
    if (designLoaded) return "Raster";
    return "—";
  }, [pocMeta?.source, designLoaded]);

  return (
    <main
      className="editor-workspace flex flex-col bg-gri-50 px-4 md:px-6 lg:h-[calc(100dvh-56px)] lg:overflow-hidden lg:px-8"
      data-editor-workspace
    >
      {mmLabelProbe ? (
        <span data-testid="editor-mm-labels" className="sr-only">
          {mmLabelProbe.widthMm}×{mmLabelProbe.heightMm}
        </span>
      ) : null}
      <div className="mx-auto flex w-full max-w-[1600px] flex-col lg:h-full lg:min-h-0 lg:overflow-hidden">
      <EditorCoachmark
        open={showCoach}
        onComplete={() => {
          markEditorOnboarded();
          setShowCoach(false);
        }}
        onDismissSession={() => setShowCoach(false)}
      />

      <header className="z-30 flex shrink-0 flex-wrap items-center gap-3 border-b border-gri-200 bg-white px-4 py-3 shadow-1">
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] md:text-[17px] font-semibold tracking-tight text-lacivert">
            Bıçak & baskı hazırlama
          </h1>
          <p className="mt-0.5 text-[12px] text-gri-600 leading-snug">
            Görsel yükle, boyutu ayarla, ürüne ekle.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1" data-onboard="export">
          {productHint.message ? (
            <p className="text-[10px] text-gri-500 leading-snug text-right max-w-[220px]">
              {productHint.message}
            </p>
          ) : null}
          {ctaBlockedReason ? (
            <p className="text-[11px] text-gri-600">{ctaBlockedReason}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {canUndo ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => performUndo()}
              >
                Geri al
              </Button>
            ) : null}
            <Button
              type="button"
              variant={
                productHint.primary === "sticker" ? "primary" : "secondary"
              }
              size="sm"
              disabled={!!ctaBlockedReason}
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
              disabled={!!ctaBlockedReason}
              onClick={() => void addToProduct("etiket")}
            >
              Etiket&apos;e ekle
            </Button>
          </div>
        </div>
      </header>

      {pocStatus ? (
        <div
          className={cn(
            "mx-4 mt-2 shrink-0 rounded-xl border px-3 py-1.5 text-[12px]",
            pocStatus.state === "error" || pocStatus.state === "timeout"
              ? "border-kirmizi/40 bg-kirmizi-soft text-kirmizi"
              : pocStatus.state === "loaded"
                ? "border-yesil/40 bg-yesil-soft text-yesil"
                : pocStatus.state === "ready"
                  ? "border-pim-mercan/40 bg-pim-mercan-tint text-lacivert"
                  : "border-sari/40 bg-sari-soft text-lacivert"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{pocStatus.message}</span>
            {cutlineError ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => retryCutline()}
              >
                Tekrar dene
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col lg:grid lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:grid-cols-[360px_1fr_320px]">
        <section className="order-1 flex min-h-[50vh] min-w-0 flex-col gap-2 overflow-hidden p-3 lg:order-2 lg:min-h-0 lg:flex-1 lg:p-4">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
            <EditorPreviewLegend cutType={cutType} />
            <EditorZoomControls
              zoom={viewZoom}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onZoomReset={zoomReset}
            />
          </div>

          {showCircleContourSuggest ? (
            <div className="shrink-0 rounded-xl border border-sari/40 bg-sari-soft px-3 py-2.5 text-[12px] text-lacivert">
              <p className="leading-relaxed">
                Bu görsel daireye tam oturmuyor. Şekline göre özel kesim (die-cut)
                daha şık durabilir — ister misin?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={acceptCircleContourSuggest}
                >
                  Özel kesime geç
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={dismissCircleContourSuggest}
                >
                  Yuvarlak kalsın
                </Button>
              </div>
            </div>
          ) : null}

          <div className="min-h-[50vh] flex-1 overflow-hidden rounded-xl border border-gri-200 bg-gri-100 shadow-sm lg:min-h-0">
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              title="Bıçak editörü"
              className="block h-full w-full min-h-[50vh] border-0 lg:min-h-[420px]"
              scrolling="no"
              sandbox="allow-scripts allow-same-origin allow-downloads"
            />
          </div>
        </section>

        <aside className="order-2 flex flex-col border-b border-gri-200 bg-white lg:order-1 lg:min-h-0 lg:overflow-hidden lg:border-b-0 lg:border-r">
          <div
            className="hidden shrink-0 gap-1 border-b border-gri-100 p-2 lg:flex"
            role="tablist"
            aria-label="Editör adımları"
          >
            {EDITOR_TOOL_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={toolTab === tab.id}
                data-onboard={
                  tab.id === "gorsel"
                    ? undefined
                    : tab.id === "bicak"
                      ? "blade"
                      : tab.id === "boyut"
                        ? "size"
                        : undefined
                }
                onClick={() => setToolTab(tab.id)}
                className={cn(
                  "flex-1 rounded-md px-2 py-2 text-[12px] font-semibold transition-colors",
                  toolTab === tab.id
                    ? "bg-pim-mercan text-white shadow-sm"
                    : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="border-b border-gri-200 lg:hidden">
            {MOBILE_ACCORDION.map(({ id, label, tab }) => {
              const open = mobileAccordion === id;
              return (
                <div key={id} className="border-b border-gri-100 last:border-b-0">
                  <button
                    type="button"
                    aria-expanded={open}
                    data-onboard={
                      id === "bicak" ? "blade" : id === "boyut" ? "size" : undefined
                    }
                    onClick={() => {
                      if (open) {
                        setMobileAccordion(null);
                      } else {
                        setMobileAccordion(id);
                        setToolTab(tab);
                      }
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-3.5 text-left text-[14px] font-semibold transition-colors",
                      open
                        ? "bg-pim-mercan-tint text-lacivert"
                        : "bg-white text-gri-700"
                    )}
                  >
                    <span>{label}</span>
                    <span className="text-[12px] text-gri-500" aria-hidden>
                      {open ? "▾" : "▸"}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          <div
            className={cn(
              "px-4 py-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto",
              mobileAccordion ? "block" : "hidden lg:block"
            )}
          >
            {toolTab === "gorsel" ? (
              <>
                <EditorPanelSection title="Dosya yükle" first>
                  <div data-onboard="file">
                  <EditorUploadZone
                    designLoaded={designLoaded}
                    fileName={fileName}
                    canRemoveBg={canRemoveBg}
                    removingBg={removingBg}
                    disabled={pocStatus?.state === "loading"}
                    onValidationError={(message) => {
                      setPocStatus({ state: "error", message });
                    }}
                    onFileSelected={(file) => {
                      setEnhanceDismissed(false);
                      setShowEnhancePrompt(false);
                      setPocStatus({
                        state: "loading",
                        message: "Dosya işleniyor…",
                      });
                      void (async () => {
                        const err = await validateEditorUploadFile(file);
                        if (err) {
                          setPocStatus({ state: "error", message: err });
                          toast.error(err);
                          return;
                        }
                        try {
                          await uploadFileToPoc(file);
                        } catch (uploadErr) {
                          const msg =
                            uploadErr instanceof Error
                              ? uploadErr.message
                              : "Dosya yüklenemedi";
                          setPocStatus({ state: "error", message: msg });
                          toast.error(msg);
                        }
                      })();
                    }}
                    onRemoveBg={handleRemoveBg}
                  />
                  </div>
                  {bgRemovePreview ? (
                    <div className="mt-3">
                      <EditorBgRemovePrompt
                        preview={bgRemovePreview}
                        onAccept={handleBgRemoveAccept}
                        onReject={handleBgRemoveReject}
                      />
                    </div>
                  ) : null}
                  {designLoaded &&
                  pocMeta?.source !== "vector" &&
                  pocMeta?.source !== "vector-with-cutline" ? (
                    <div className="mt-3 space-y-2">
                      {(suggestEnhance || showEnhancePrompt) && !enhanceDismissed ? (
                        <ImageEnhancePrompt
                          mode="editor"
                          effectiveDpi={dpiInfo?.dpi}
                          onEnhanceRequest={runEditorEnhance}
                          onAcceptEnhanced={acceptEditorEnhance}
                          onReject={() => {
                            setShowEnhancePrompt(false);
                            setEnhanceDismissed(true);
                          }}
                        />
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          disabled={pocStatus?.state === "loading"}
                          onClick={() => setShowEnhancePrompt(true)}
                        >
                          Görseli iyileştir (AI)
                        </Button>
                      )}
                    </div>
                  ) : null}
                </EditorPanelSection>
              </>
            ) : null}

            {toolTab === "bicak" ? (
              <>
                <EditorPanelSection title="Kesim kaynağı" first>
                  <div className="flex flex-col gap-1.5">
                    {CUT_SOURCES.map(({ id, label, desc }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleCutSourceChange(id)}
                        className={cn(
                          "rounded-md px-2.5 py-2 text-left transition-colors",
                          cutSource === id
                            ? "bg-pim-mercan text-white shadow-sm"
                            : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                        )}
                      >
                        <span className="block text-[12px] font-medium">
                          {label}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 block text-[11px] leading-snug",
                            cutSource === id ? "text-white/90" : "text-gri-600"
                          )}
                        >
                          {desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </EditorPanelSection>

                {cutSource === "ozel" ? (
                  <EditorPanelSection title="Kontur tipi">
                    <div className="flex flex-wrap gap-1.5">
                      {CONTOUR_VARIANTS.map(({ mode, label }) => (
                        <button
                          key={mode}
                          type="button"
                          disabled={!designLoaded}
                          onClick={() => handleCutModeChange(mode)}
                          className={cn(
                            "rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none",
                            cutMode === mode
                              ? "bg-pim-mercan text-white shadow-sm"
                              : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </EditorPanelSection>
                ) : null}

                {cutSource === "sekil" ? (
                  <EditorPanelSection title="Şekil">
                    <div className="flex flex-wrap gap-1.5">
                      {SEKIL_PRESETS.map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleSekilPresetChange(id)}
                          className={cn(
                            "rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                            sekilPreset === id
                              ? "bg-pim-mercan text-white shadow-sm"
                              : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </EditorPanelSection>
                ) : null}

                {cutSource === "diecut" ? (
                  <EditorPanelSection title="Şablon galerisi">
                    <EditorDieCutPicker
                      activeId={activeDieCutId}
                      onSelect={handleDieCutSelect}
                    />
                  </EditorPanelSection>
                ) : null}

                <EditorPanelSection title="Kesim türü">
                  <div className="flex flex-col gap-1.5">
                    {CUT_TYPE_OPTIONS.map(({ id, label, hint }) => (
                      <button
                        key={id}
                        type="button"
                        disabled={!designLoaded}
                        onClick={() => handleCutTypeChange(id)}
                        className={cn(
                          "rounded-md px-2.5 py-2 text-left transition-colors disabled:opacity-40 disabled:pointer-events-none",
                          cutType === id
                            ? "bg-pim-mercan text-white shadow-sm"
                            : "bg-gri-100 text-gri-700 hover:bg-gri-200"
                        )}
                      >
                        <span className="block text-[12px] font-medium">{label}</span>
                        <span
                          className={cn(
                            "mt-0.5 block text-[11px] leading-snug",
                            cutType === id ? "text-white/90" : "text-gri-600"
                          )}
                        >
                          {hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </EditorPanelSection>

                <EditorPanelSection title="Yerleştir">
                  <div className="flex flex-wrap gap-1.5">
                    {FIT_BUTTONS.map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        disabled={!designLoaded}
                        onClick={() => postToPoc({ type: btn.id })}
                        className="rounded-md bg-gri-100 px-2.5 py-1.5 text-[12px] font-medium text-gri-700 hover:bg-gri-200 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </EditorPanelSection>

                <EditorPanelSection title="Kesim mesafesi (ofset)">
                  <label className="block text-[11px] text-gri-600">
                    <span className="flex items-center justify-between gap-2">
                      <span>Bıçağı genişlet</span>
                      <span className="tabular-nums font-medium text-lacivert">
                        {formatOffsetLabel(offsetMm)}
                      </span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={5}
                      step={0.1}
                      value={offsetMm}
                      disabled={!designLoaded}
                      onChange={(e) =>
                        handleOffsetChange(parseFloat(e.target.value))
                      }
                      onPointerUp={() =>
                        postToPoc({ type: "pim-flush-cutline" })
                      }
                      className="mt-1.5 w-full accent-pim-mercan disabled:opacity-40"
                    />
                  </label>
                  {offsetNoteText(offsetMm) ? (
                    <p className="mt-1 text-[10px] text-gri-500 leading-snug">
                      {offsetNoteText(offsetMm)}
                    </p>
                  ) : null}
                </EditorPanelSection>

                {cutSource === "ozel" ? (
                  <EditorPanelSection title="Yumuşatma">
                    <label className="block text-[11px] text-gri-600">
                      <span className="flex items-center justify-between gap-2">
                        <span>Kontur köşeleri</span>
                        <span className="tabular-nums font-medium text-lacivert">
                          {smoothness}
                        </span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={smoothness}
                        disabled={!designLoaded || cutMode === "hull"}
                        onChange={(e) =>
                          handleSmoothnessChange(parseInt(e.target.value, 10))
                        }
                        onPointerUp={() =>
                          postToPoc({ type: "pim-flush-cutline" })
                        }
                        className="mt-1.5 w-full accent-pim-mercan disabled:opacity-40"
                      />
                    </label>
                    {cutMode === "hull" ? (
                      <p className="mt-1 text-[10px] text-gri-500 leading-snug">
                        Geniş kesimde yumuşatma uygulanmaz.
                      </p>
                    ) : null}
                  </EditorPanelSection>
                ) : null}

                {showCornerRadius ? (
                  <EditorPanelSection title="Köşe yuvarlama">
                    <label className="block text-[11px] text-gri-600">
                      <span className="flex items-center justify-between gap-2">
                        <span>Yarıçap</span>
                        <span className="tabular-nums font-medium text-lacivert">
                          {cornerRadiusMm.toFixed(1)} mm
                        </span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={maxCornerRadiusMm}
                        step={0.5}
                        value={Math.min(cornerRadiusMm, maxCornerRadiusMm)}
                        disabled={!designLoaded}
                        onChange={(e) =>
                          handleCornerRadiusChange(parseFloat(e.target.value))
                        }
                        className="mt-1.5 w-full accent-pim-mercan disabled:opacity-40"
                      />
                    </label>
                  </EditorPanelSection>
                ) : null}
              </>
            ) : null}

            {toolTab === "boyut" ? (
              <>
                <EditorPanelSection title="Baskı boyutu (mm)" first>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[11px] text-gri-600">
                      Genişlik (mm)
                      <Input
                        type="number"
                        min={5}
                        max={500}
                        step={0.1}
                        value={widthMm}
                        className="mt-1"
                        disabled={!designLoaded}
                        onChange={(e) =>
                          handleWidthChange(parseFloat(e.target.value) || DEFAULT_WIDTH_MM)
                        }
                      />
                    </label>
                    <label className="block text-[11px] text-gri-600">
                      Yükseklik (mm)
                      <Input
                        type="number"
                        min={5}
                        max={500}
                        step={0.1}
                        value={heightMm}
                        className="mt-1"
                        disabled={!designLoaded}
                        onChange={(e) =>
                          handleHeightChange(parseFloat(e.target.value) || DEFAULT_HEIGHT_MM)
                        }
                      />
                    </label>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-[12px] text-gri-700">
                    <input
                      type="checkbox"
                      checked={lockAspect}
                      onChange={(e) => handleLockAspectChange(e.target.checked)}
                      className="accent-pim-mercan"
                    />
                    Oran kilidi
                  </label>
                  <p className="mt-2 text-[12px] tabular-nums text-gri-800">
                    {widthMm.toFixed(1)} × {heightMm.toFixed(1)} mm
                  </p>

                  <label className="mt-4 block text-[11px] text-gri-600">
                    <span className="flex items-center justify-between gap-2">
                      <span>Görsel ölçek (baskı boyutunu büyütür/küçültür)</span>
                      <span className="shrink-0 tabular-nums font-medium text-lacivert">
                        %{imageScalePct}
                      </span>
                    </span>
                    <input
                      type="range"
                      min={25}
                      max={200}
                      step={1}
                      value={imageScalePct}
                      disabled={!designLoaded}
                      onChange={(e) =>
                        handleImageScaleChange(parseInt(e.target.value, 10))
                      }
                      className="mt-1.5 w-full accent-pim-mercan disabled:opacity-40"
                    />
                  </label>
                  <p className="mt-1 text-[10px] text-gri-500 leading-snug">
                    %25–%200. Ölçek ve mm birlikte güncellenir.
                  </p>
                </EditorPanelSection>

                <EditorPanelSection title="Katmanlar">
                  <div className={cn(!designLoaded && "pointer-events-none opacity-40")}>
                    <EditorLayerToggles layers={layers} onToggleLayer={handleToggleLayer} />
                  </div>
                </EditorPanelSection>
              </>
            ) : null}

            <p className="border-t border-gri-100 pt-3 text-[11px] text-gri-600 leading-snug">
              <Link href="/sablonlar?tab=kesim" className="text-pim-mercan underline">
                Kesim şablonları
              </Link>
            </p>
          </div>

          <div className="shrink-0 border-t border-gri-200 bg-gri-50 px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gri-500">
              Özet
            </p>
            <dl className="space-y-1.5 text-[12px]">
              <div className="flex justify-between gap-2">
                <dt className="text-gri-600">Kaynak</dt>
                <dd className="font-medium text-lacivert">{sourceLabel}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gri-600">Baskı boyutu</dt>
                <dd className="font-medium tabular-nums text-lacivert">
                  {widthMm.toFixed(1)} × {heightMm.toFixed(1)} mm
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gri-600">Bıçak</dt>
                <dd
                  className={cn(
                    "font-medium",
                    cutlineReady
                      ? "text-yesil"
                      : cutlineError
                        ? "text-kirmizi"
                        : "text-gri-500"
                  )}
                >
                  {cutlineReady
                    ? "Hazır"
                    : cutlineError
                      ? "Hata"
                      : designLoaded
                        ? "Hesaplanıyor…"
                        : "—"}
                </dd>
              </div>
              {dpiInfo ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-gri-600">Baskı DPI</dt>
                  <dd
                    className={cn(
                      "font-medium tabular-nums text-right",
                      dpiInfo.level === "ok"
                        ? "text-yesil"
                        : dpiInfo.level === "warn"
                          ? "text-sari"
                          : "text-kirmizi"
                    )}
                  >
                    ≈{dpiInfo.dpi}
                  </dd>
                </div>
              ) : null}
            </dl>
            {dpiInfo?.message ? (
              <p
                className={cn(
                  "mt-2 rounded-lg px-2 py-1.5 text-[11px] leading-snug",
                  dpiInfo.level === "warn"
                    ? "bg-sari-soft text-lacivert"
                    : "bg-kirmizi-soft text-kirmizi"
                )}
              >
                {dpiInfo.level === "ok"
                  ? "Baskı kalitesi iyi"
                  : dpiInfo.message}
              </p>
            ) : dpiInfo?.level === "ok" ? (
              <p className="mt-2 text-[11px] text-yesil">Baskı kalitesi iyi</p>
            ) : null}
          </div>
        </aside>

        <EditorPimPanel
          onCommand={handlePimCommand}
          disabled={pocStatus?.state === "loading"}
        />
      </div>
      </div>
    </main>
  );
}
