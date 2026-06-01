"use client";

import {
  hullFromImage,
  offsetPolygonPx,
} from "@/lib/editor/alpha-contour";
import { offsetMmToPx } from "@/lib/editor/cutline/contour-opencv-algorithms";
import type { PathRing } from "@/lib/editor/cutline/types";
import type { WorkerOut } from "@/lib/editor/cutline/contour.worker";

const WORKER_TIMEOUT_MS = 12_000;

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

let worker: Worker | null = null;
let readyPromise: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<
  number,
  {
    resolve: (paths: PathRing[][]) => void;
    reject: (err: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();

function fallbackFastPaths(
  image: HTMLImageElement,
  offsetsMm: number[],
  useHull: boolean,
  pxPerMmInImage: number
): PathRing[][] {
  const baseHull = hullFromImage(image, useHull);
  return offsetsMm.map((offsetMm) => {
    const expandPx = offsetMmToPx(offsetMm, pxPerMmInImage, 1);
    const expanded = offsetPolygonPx(baseHull, expandPx);
    return [expanded.map((p) => [p.x, p.y] as [number, number])];
  });
}

export function canUseContourWorker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap === "function"
  );
}

function rejectAllPending(reason: string) {
  for (const [, entry] of pending) {
    clearTimeout(entry.timeout);
    entry.reject(new Error(reason));
  }
  pending.clear();
}

function handleWorkerMessage(data: WorkerOut) {
  if ("type" in data && data.type === "ready") {
    return;
  }
  if ("type" in data && data.type === "error") {
    if (!("id" in data)) {
      console.error("[contour-worker] init error:", data.error);
    }
    readyPromise = null;
    return;
  }
  if (!("id" in data)) return;
  const entry = pending.get(data.id);
  if (!entry) return;
  clearTimeout(entry.timeout);
  pending.delete(data.id);
  if ("error" in data && data.error) {
    entry.reject(new Error(data.error));
  } else if ("paths" in data) {
    entry.resolve(data.paths);
  }
}

function ensureWorker(): Worker {
  if (!canUseContourWorker()) {
    throw new Error("Contour worker desteklenmiyor");
  }
  if (!worker) {
    worker = new Worker(new URL("./contour.worker.ts", import.meta.url));
    worker.onmessage = (event: MessageEvent<WorkerOut>) => {
      handleWorkerMessage(event.data);
    };
    worker.onerror = (event) => {
      console.error("[contour-worker] worker error:", event.message ?? event);
      readyPromise = null;
      rejectAllPending("Contour worker hatası");
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

function waitForWorkerReady(w: Worker): Promise<void> {
  if (readyPromise) return readyPromise;
  readyPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      readyPromise = null;
      reject(new Error("Contour worker hazır değil (zaman aşımı)"));
    }, WORKER_TIMEOUT_MS);

    const onReady = (event: MessageEvent<WorkerOut>) => {
      const data = event.data;
      if ("type" in data && data.type === "ready") {
        clearTimeout(timeout);
        w.removeEventListener("message", onReady);
        resolve();
        return;
      }
      if ("type" in data && data.type === "error") {
        clearTimeout(timeout);
        w.removeEventListener("message", onReady);
        readyPromise = null;
        reject(new Error(data.error));
      }
    };
    w.addEventListener("message", onReady);
    const init: InitMessage = { type: "init" };
    w.postMessage(init);
  });
  return readyPromise;
}

/** Editör mount — OpenCV yalnız worker içinde yüklenir */
export function preloadContourWorker(): Promise<void> {
  if (!canUseContourWorker()) {
    return Promise.resolve();
  }
  try {
    const w = ensureWorker();
    return waitForWorkerReady(w);
  } catch (err) {
    console.error("[contour-worker] preload failed:", err);
    return Promise.resolve();
  }
}

export function terminateContourWorker(): void {
  rejectAllPending("Contour worker sonlandırıldı");
  if (worker) {
    worker.terminate();
    worker = null;
  }
  readyPromise = null;
}

function computeViaWorker(
  image: HTMLImageElement,
  offsetsMm: number[],
  smoothness: number,
  useHull: boolean,
  pxPerMmInImage: number
): Promise<PathRing[][]> {
  const w = ensureWorker();
  return waitForWorkerReady(w).then(
    () =>
      new Promise<PathRing[][]>((resolve, reject) => {
        const id = nextId++;
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error("Contour worker zaman aşımı"));
        }, WORKER_TIMEOUT_MS);

        pending.set(id, { resolve, reject, timeout });

        void createImageBitmap(image).then((bitmap) => {
          const msg: ComputeMessage = {
            type: "compute",
            id,
            imageBitmap: bitmap,
            offsetsMm,
            smoothness,
            useHull,
            pxPerMmInImage,
          };
          w.postMessage(msg, [bitmap]);
        }, reject);
      })
  );
}

/** OpenCV kontur — worker; başarısızsa alpha hızlı yol (main thread) */
export async function computeContourPathsPxMultiViaWorker(
  image: HTMLImageElement,
  offsetsMm: number[],
  smoothness: number,
  useHull: boolean,
  pxPerMmInImage: number
): Promise<PathRing[][]> {
  if (offsetsMm.length === 0) return [];
  if (!canUseContourWorker()) {
    return fallbackFastPaths(image, offsetsMm, useHull, pxPerMmInImage);
  }
  try {
    return await computeViaWorker(
      image,
      offsetsMm,
      smoothness,
      useHull,
      pxPerMmInImage
    );
  } catch (err) {
    console.error(
      "[contour-worker] OpenCV refine failed, falling back to fast preview:",
      err
    );
    return fallbackFastPaths(image, offsetsMm, useHull, pxPerMmInImage);
  }
}
