/** OpenCV.js tip tanımları (main + worker) */

export const OPENCV_JS_URL = "https://docs.opencv.org/4.10.0/opencv.js";

export type OpenCvModule = {
  Mat: new () => OpenCvMat;
  MatVector: new () => OpenCvMatVector;
  imread: (el: HTMLCanvasElement | OffscreenCanvas) => OpenCvMat;
  matFromImageData?: (imageData: ImageData) => OpenCvMat;
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

export type OpenCvMat = {
  rows: number;
  cols: number;
  data32S: Int32Array;
  delete: () => void;
};
export type OpenCvMatVector = {
  size: () => number;
  get: (i: number) => OpenCvMat;
  delete: () => void;
};
export type OpenCvSize = { width: number; height: number };
