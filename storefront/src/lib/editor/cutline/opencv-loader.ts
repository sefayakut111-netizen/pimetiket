/* OpenCV.js — tarayıcıda lazy load (poc.html ile aynı CDN) */

export type OpenCvModule = {
  Mat: new () => OpenCvMat;
  MatVector: new () => OpenCvMatVector;
  imread: (el: HTMLCanvasElement | HTMLImageElement) => OpenCvMat;
  cvtColor: (src: OpenCvMat, dst: OpenCvMat, code: number) => void;
  split: (src: OpenCvMat, mv: OpenCvMatVector) => void;
  threshold: (
    src: OpenCvMat,
    dst: OpenCvMat,
    thresh: number,
    maxval: number,
    type: number
  ) => void;
  mean: (mat: OpenCvMat) => { [key: number]: number };
  getStructuringElement: (shape: number, size: OpenCvSize) => OpenCvMat;
  morphologyEx: (
    src: OpenCvMat,
    dst: OpenCvMat,
    op: number,
    kernel: OpenCvMat
  ) => void;
  dilate: (src: OpenCvMat, dst: OpenCvMat, kernel: OpenCvMat) => void;
  erode: (src: OpenCvMat, dst: OpenCvMat, kernel: OpenCvMat) => void;
  findContours: (
    image: OpenCvMat,
    contours: OpenCvMatVector,
    hierarchy: OpenCvMat,
    mode: number,
    method: number
  ) => void;
  contourArea: (contour: OpenCvMat) => number;
  arcLength: (curve: OpenCvMat, closed: boolean) => number;
  approxPolyDP: (
    curve: OpenCvMat,
    approxCurve: OpenCvMat,
    epsilon: number,
    closed: boolean
  ) => void;
  convexHull: (
    points: OpenCvMat,
    hull: OpenCvMat,
    clockwise: boolean,
    returnPoints: boolean
  ) => void;
  matFromArray: (
    rows: number,
    cols: number,
    type: number,
    array: number[]
  ) => OpenCvMat;
  boundingRect: (contour: OpenCvMat) => { x: number; y: number; width: number; height: number };
  minEnclosingCircle: (points: OpenCvMat) => {
    center: { x: number; y: number };
    radius: number;
  };
  COLOR_RGBA2GRAY: number;
  THRESH_BINARY: number;
  THRESH_BINARY_INV: number;
  MORPH_ELLIPSE: number;
  MORPH_CLOSE: number;
  MORPH_OPEN: number;
  RETR_EXTERNAL: number;
  CHAIN_APPROX_SIMPLE: number;
  CV_32SC2: number;
  Size: new (w: number, h: number) => OpenCvSize;
};

type OpenCvMat = { rows: number; cols: number; data32S: Int32Array; delete: () => void };
type OpenCvMatVector = {
  size: () => number;
  get: (i: number) => OpenCvMat;
  delete: () => void;
};
type OpenCvSize = { width: number; height: number };

declare global {
  interface Window {
    cv?: OpenCvModule & { onRuntimeInitialized?: () => void };
  }
}

let loadPromise: Promise<OpenCvModule> | null = null;

const OPENCV_LOAD_TIMEOUT_MS = 12_000;

function loadOpenCvScript(): Promise<OpenCvModule> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.10.0/opencv.js";
    script.async = true;
    script.onerror = () => reject(new Error("opencv.js yüklenemedi"));
    const prev = window.cv?.onRuntimeInitialized;
    window.cv = {
      onRuntimeInitialized: () => {
        prev?.();
        if (window.cv?.Mat) resolve(window.cv);
        else reject(new Error("OpenCV init başarısız"));
      },
    } as Window["cv"];
    document.head.appendChild(script);
  });
}

export function loadOpenCv(): Promise<OpenCvModule> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV yalnız tarayıcıda"));
  }
  if (window.cv?.Mat) {
    return Promise.resolve(window.cv);
  }
  loadPromise ??= Promise.race([
    loadOpenCvScript(),
    new Promise<OpenCvModule>((_, reject) => {
      setTimeout(
        () => reject(new Error("OpenCV yükleme zaman aşımı")),
        OPENCV_LOAD_TIMEOUT_MS
      );
    }),
  ]).catch((err) => {
    loadPromise = null;
    throw err;
  });
  return loadPromise;
}

export function imageToCvMat(
  cv: OpenCvModule,
  image: HTMLImageElement
): OpenCvMat {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d yok");
  ctx.drawImage(image, 0, 0);
  return cv.imread(canvas);
}
