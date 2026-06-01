/**
 * OpenCV kontur — dedicated worker (classic, importScripts).
 * Next: new Worker(new URL('./contour.worker.ts', import.meta.url)) — type: module kullanma.
 */
/// <reference lib="webworker" />

import { computePathsFromBitmap } from "@/lib/editor/cutline/contour-opencv-algorithms";
import { OPENCV_JS_URL, type OpenCvModule } from "@/lib/editor/cutline/opencv-types";
import type { PathRing } from "@/lib/editor/cutline/types";

const OPENCV_INIT_TIMEOUT_MS = 12_000;

type CvGlobal = {
  cv?: OpenCvModule;
  Module?: unknown;
};

let cvPromise: Promise<OpenCvModule> | null = null;

function loadOpenCvInWorker(): Promise<OpenCvModule> {
  const g = self as unknown as CvGlobal;
  if (g.cv?.Mat) {
    return Promise.resolve(g.cv);
  }
  if (cvPromise) {
    return cvPromise;
  }
  cvPromise = new Promise<OpenCvModule>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cvPromise = null;
      reject(new Error("OpenCV yükleme zaman aşımı"));
    }, OPENCV_INIT_TIMEOUT_MS);

    const finish = (cv: OpenCvModule) => {
      clearTimeout(timeout);
      resolve(cv);
    };
    const fail = (err: unknown) => {
      clearTimeout(timeout);
      cvPromise = null;
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    try {
      // POC pattern (public/poc.html): Module global'i importScripts'ten ÖNCE kur.
      // OpenCV WASM init bitince Module.onRuntimeInitialized çağrılır; cv.Mat o an hazır.
      const gg = self as unknown as { Module?: unknown; cv?: OpenCvModule };
      gg.Module = {
        onRuntimeInitialized: () => {
          const cv = (gg.cv ?? (gg.Module as OpenCvModule)) as OpenCvModule;
          if (cv?.Mat) {
            g.cv = cv;
            finish(cv);
          } else {
            fail(new Error("OpenCV init OK ama Mat yok"));
          }
        },
      };

      importScripts(OPENCV_JS_URL);

      if (g.cv?.Mat) {
        finish(g.cv);
      }
    } catch (err) {
      fail(err);
    }
  });
  return cvPromise;
}

type InitMessage = { type: "init" };

type ComputeMessage = {
  type: "compute";
  id: number;
  imageBitmap: ImageBitmap;
  offsetsMm: number[];
  smoothness: number;
  useHull: boolean;
  pxPerMmInImage: number;
};

type WorkerInMessage = InitMessage | ComputeMessage;

export type ReadyOut = { type: "ready" };
export type ComputeOkOut = { id: number; paths: PathRing[][] };
export type ComputeErrOut = { id: number; error: string };
export type InitErrOut = { type: "error"; error: string };
export type WorkerOut =
  | ReadyOut
  | ComputeOkOut
  | ComputeErrOut
  | InitErrOut;

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;
  if (msg.type === "init") {
    void loadOpenCvInWorker()
      .then(() => {
        const out: ReadyOut = { type: "ready" };
        self.postMessage(out);
      })
      .catch((err: unknown) => {
        console.error("[contour-worker] init:", err);
        const out: InitErrOut = {
          type: "error",
          error: err instanceof Error ? err.message : String(err),
        };
        self.postMessage(out);
      });
    return;
  }

  if (msg.type === "compute") {
    void (async () => {
      try {
        const cv = await loadOpenCvInWorker();
        const paths = computePathsFromBitmap(
          cv,
          msg.imageBitmap,
          msg.offsetsMm,
          msg.smoothness,
          msg.useHull,
          msg.pxPerMmInImage
        );
        msg.imageBitmap.close();
        const out: ComputeOkOut = { id: msg.id, paths };
        self.postMessage(out);
      } catch (err) {
        try {
          msg.imageBitmap.close();
        } catch {
          /* close */
        }
        const out: ComputeErrOut = {
          id: msg.id,
          error: err instanceof Error ? err.message : String(err),
        };
        self.postMessage(out);
      }
    })();
  }
};
