/**
 * @deprecated OpenCV artık yalnız contour.worker.ts içinde yüklenir.
 * Tipler için opencv-types kullanın; preload için preloadContourWorker().
 */
export type {
  OpenCvMat,
  OpenCvMatVector,
  OpenCvModule,
  OpenCvSize,
} from "@/lib/editor/cutline/opencv-types";

export { OPENCV_JS_URL } from "@/lib/editor/cutline/opencv-types";

export function loadOpenCv(): Promise<never> {
  return Promise.reject(
    new Error(
      "loadOpenCv kaldırıldı — preloadContourWorker() kullanın (Web Worker)"
    )
  );
}
