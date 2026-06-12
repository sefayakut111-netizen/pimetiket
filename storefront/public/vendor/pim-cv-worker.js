/**
 * Pim Etiket — OpenCV cutline compute worker (statik /public, Turbopack dışı).
 * Ağır mask/kontur işleri ana thread'i kilitlemez.
 */
/* global cv, Module, importScripts */
var Module = {
  onRuntimeInitialized: function () {
    self.postMessage({ type: 'cv-ready' });
  },
};

importScripts('/vendor/opencv.js');

function smoothPath(path, smoothnessVal) {
  if (!path || path.length < 3 || !smoothnessVal || smoothnessVal <= 0) return path;
  const iterations = smoothnessVal >= 50 ? 2 : 1;
  let pts = path.map(function (pt) { return { x: pt[0], y: pt[1] }; });
  for (let iter = 0; iter < iterations; iter++) {
    const next = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      next.push(
        { x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y },
        { x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y }
      );
    }
    pts = next;
  }
  return pts.map(function (p) { return [p.x, p.y]; });
}

function detectBackgroundColor(grayMat) {
  const w = grayMat.cols;
  const h = grayMat.rows;
  const sampleSize = Math.min(10, Math.floor(Math.min(w, h) / 10));
  const samples = [];
  const corners = [
    { x: 0, y: 0 },
    { x: w - sampleSize, y: 0 },
    { x: 0, y: h - sampleSize },
    { x: w - sampleSize, y: h - sampleSize },
  ];
  for (let c = 0; c < corners.length; c++) {
    const corner = corners[c];
    for (let dy = 0; dy < sampleSize; dy++) {
      for (let dx = 0; dx < sampleSize; dx++) {
        samples.push(grayMat.data[(corner.y + dy) * w + (corner.x + dx)]);
      }
    }
  }
  samples.sort(function (a, b) { return a - b; });
  return samples[Math.floor(samples.length / 2)];
}

function buildMask(srcMat) {
  let mask = new cv.Mat();
  const hasAlpha = srcMat.channels() === 4;
  let isAlphaUseful = false;
  let detectedBg = null;

  if (hasAlpha) {
    const channels = new cv.MatVector();
    cv.split(srcMat, channels);
    const alphaChannel = channels.get(3);
    const meanAlpha = cv.mean(alphaChannel)[0];
    if (meanAlpha < 250) {
      cv.threshold(alphaChannel, mask, 200, 255, cv.THRESH_BINARY);
      isAlphaUseful = true;
    } else {
      const gray = new cv.Mat();
      cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
      detectedBg = detectBackgroundColor(gray);
      const threshold = Math.max(200, detectedBg - 8);
      cv.threshold(gray, mask, threshold, 255, cv.THRESH_BINARY_INV);
      gray.delete();
    }
    channels.delete();
  } else {
    const gray = new cv.Mat();
    cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
    detectedBg = detectBackgroundColor(gray);
    const threshold = Math.max(200, detectedBg - 8);
    cv.threshold(gray, mask, threshold, 255, cv.THRESH_BINARY_INV);
    gray.delete();
  }

  const minDim = Math.min(srcMat.cols, srcMat.rows);
  const closeSize = Math.max(5, Math.min(9, Math.round(minDim / 120) * 2 + 1));
  const closeKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(closeSize, closeSize));
  const closed = new cv.Mat();
  cv.morphologyEx(mask, closed, cv.MORPH_CLOSE, closeKernel);
  mask.delete();
  closeKernel.delete();

  const openKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
  const cleaned = new cv.Mat();
  cv.morphologyEx(closed, cleaned, cv.MORPH_OPEN, openKernel);
  closed.delete();
  openKernel.delete();

  return { mask: cleaned, hasAlpha, isAlphaUseful, detectedBg };
}

function generateOffsetPaths(mask, offsetPx, smoothness, useHull) {
  let workingMask = mask;
  let needsDelete = false;
  const absOffset = Math.abs(offsetPx);
  if (absOffset > 0) {
    const kernel = cv.getStructuringElement(
      cv.MORPH_ELLIPSE,
      new cv.Size(2 * absOffset + 1, 2 * absOffset + 1)
    );
    workingMask = new cv.Mat();
    if (offsetPx > 0) {
      cv.dilate(mask, workingMask, kernel);
    } else {
      cv.erode(mask, workingMask, kernel);
    }
    kernel.delete();
    needsDelete = true;
  }

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(workingMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  const paths = [];

  if (useHull && contours.size() > 0) {
    const allPoints = [];
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      for (let j = 0; j < c.rows; j++) {
        allPoints.push(c.data32S[j * 2], c.data32S[j * 2 + 1]);
      }
    }
    if (allPoints.length >= 6) {
      const mat = cv.matFromArray(allPoints.length / 2, 1, cv.CV_32SC2, allPoints);
      const hull = new cv.Mat();
      cv.convexHull(mat, hull, false, true);
      const path = [];
      for (let i = 0; i < hull.rows; i++) {
        path.push([hull.data32S[i * 2], hull.data32S[i * 2 + 1]]);
      }
      paths.push(path);
      mat.delete();
      hull.delete();
    }
  } else {
    const totalArea = workingMask.rows * workingMask.cols;
    const minArea = Math.max(100, totalArea * 0.003);
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      if (cv.contourArea(c) < minArea) continue;
      const approx = new cv.Mat();
      const epsilon = (smoothness / 100) * 0.015 * cv.arcLength(c, true);
      cv.approxPolyDP(c, approx, epsilon, true);
      const path = [];
      for (let j = 0; j < approx.rows; j++) {
        path.push([approx.data32S[j * 2], approx.data32S[j * 2 + 1]]);
      }
      paths.push(smoothPath(path, smoothness));
      approx.delete();
    }
  }

  contours.delete();
  hierarchy.delete();
  if (needsDelete) workingMask.delete();
  return paths;
}

function getBoundingRect(mask) {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  if (contours.size() === 0) {
    contours.delete();
    hierarchy.delete();
    return null;
  }
  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
  for (let i = 0; i < contours.size(); i++) {
    const r = cv.boundingRect(contours.get(i));
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  contours.delete();
  hierarchy.delete();
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function getEnclosingCircle(mask) {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  if (contours.size() === 0) {
    contours.delete();
    hierarchy.delete();
    return null;
  }
  const allPoints = [];
  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);
    for (let j = 0; j < c.rows; j++) {
      allPoints.push(c.data32S[j * 2], c.data32S[j * 2 + 1]);
    }
  }
  contours.delete();
  hierarchy.delete();
  if (allPoints.length < 6) return null;
  const mat = cv.matFromArray(allPoints.length / 2, 1, cv.CV_32SC2, allPoints);
  const result = cv.minEnclosingCircle(mat);
  mat.delete();
  return { cx: result.center.x, cy: result.center.y, r: result.radius };
}

function matFromImageData(imageData) {
  const mat = new cv.Mat(imageData.height, imageData.width, cv.CV_8UC4);
  mat.data.set(imageData.data);
  return mat;
}

function trimTransparentBoundsImageData(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const d = imageData.data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (d[i + 3] > 10) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) {
    return {
      imageData: imageData,
      width: width,
      height: height,
      trimmed: false,
    };
  }
  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  const out = new Uint8ClampedArray(tw * th * 4);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const si = ((minY + y) * width + (minX + x)) * 4;
      const di = (y * tw + x) * 4;
      out[di] = d[si];
      out[di + 1] = d[si + 1];
      out[di + 2] = d[si + 2];
      out[di + 3] = d[si + 3];
    }
  }
  return {
    imageData: { data: out, width: tw, height: th },
    width: tw,
    height: th,
    trimmed: true,
  };
}

function computeRadialMetrics(imageData, bboxDiag) {
  const mat = matFromImageData(imageData);
  const maskResult = buildMask(mat);
  const mask = maskResult.mask;
  mat.delete();
  if (!maskResult.isAlphaUseful && maskResult.hasAlpha) {
    mask.delete();
    return { method: 'diagonal' };
  }
  const moments = cv.moments(mask, true);
  let contentCx = 0;
  let contentCy = 0;
  if (moments.m00 > 0) {
    contentCx = moments.m10 / moments.m00;
    contentCy = moments.m01 / moments.m00;
  } else {
    const rect = getBoundingRect(mask);
    if (rect) {
      contentCx = rect.x + rect.w / 2;
      contentCy = rect.y + rect.h / 2;
    }
  }
  let rContent = 0;
  const data = mask.data;
  const cols = mask.cols;
  const rows = mask.rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (data[y * cols + x] > 0) {
        rContent = Math.max(rContent, Math.hypot(x - contentCx, y - contentCy));
      }
    }
  }
  mask.delete();
  if (rContent <= 0) return { method: 'diagonal' };
  return {
    contentCx,
    contentCy,
    rContent,
    method: maskResult.isAlphaUseful ? 'opencv-alpha' : 'diagonal',
    bboxDiag,
  };
}

function computeCutline(imageData, params) {
  const mat = matFromImageData(imageData);
  const maskResult = buildMask(mat);
  const mask = maskResult.mask;
  mat.delete();
  const maskMeta = {
    isAlphaUseful: maskResult.isAlphaUseful,
    detectedBg: maskResult.detectedBg,
    hasAlpha: maskResult.hasAlpha,
  };

  const mode = params.mode;
  const offsetPx = params.offsetPx;
  const bleedPx = params.bleedPx;
  const safePx = params.safePx;
  const smoothness = params.smoothness;

  const result = { maskMeta, rect: null, circle: null, paths: null };

  if (mode === 'rect') {
    result.rect = getBoundingRect(mask);
  } else if (mode === 'circle') {
    result.circle = getEnclosingCircle(mask);
  } else if (mode === 'hull') {
    result.paths = {
      current: generateOffsetPaths(mask, offsetPx, smoothness, true),
      bleed: generateOffsetPaths(mask, offsetPx + bleedPx, smoothness, true),
      safe: generateOffsetPaths(mask, offsetPx - safePx, smoothness, true),
    };
  } else {
    result.paths = {
      current: generateOffsetPaths(mask, offsetPx, smoothness, false),
      bleed: generateOffsetPaths(mask, offsetPx + bleedPx, smoothness, false),
      safe: generateOffsetPaths(mask, offsetPx - safePx, smoothness, false),
    };
  }

  mask.delete();
  return result;
}

function computeWhitePlan(imageData, params) {
  const mat = matFromImageData(imageData);
  const maskResult = buildMask(mat);
  let baseMask = maskResult.mask;

  const whitePlanMode = params.whitePlanMode;
  if (whitePlanMode === 'smart') {
    const gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
    const darkMask = new cv.Mat();
    cv.threshold(gray, darkMask, 200, 255, cv.THRESH_BINARY_INV);
    const smartMask = new cv.Mat();
    cv.bitwise_and(baseMask, darkMask, smartMask);
    baseMask.delete();
    baseMask = smartMask;
    gray.delete();
    darkMask.delete();
  }
  mat.delete();

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(baseMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  const totalArea = baseMask.rows * baseMask.cols;
  const minArea =
    whitePlanMode === 'ai'
      ? Math.max(20, totalArea * 0.0005)
      : Math.max(100, totalArea * 0.003);

  const paths = [];
  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);
    if (cv.contourArea(c) < minArea) continue;
    const approx = new cv.Mat();
    const epsilon = 0.003 * cv.arcLength(c, true);
    cv.approxPolyDP(c, approx, epsilon, true);
    const path = [];
    for (let j = 0; j < approx.rows; j++) {
      path.push([approx.data32S[j * 2], approx.data32S[j * 2 + 1]]);
    }
    paths.push(path);
    approx.delete();
  }

  contours.delete();
  hierarchy.delete();
  baseMask.delete();

  return {
    paths,
    maskMeta: {
      isAlphaUseful: maskResult.isAlphaUseful,
      detectedBg: maskResult.detectedBg,
      hasAlpha: maskResult.hasAlpha,
    },
  };
}

self.onmessage = function (e) {
  const msg = e.data || {};
  const requestId = msg.requestId;
  try {
    if (msg.type === 'trim-image') {
      const trimmed = trimTransparentBoundsImageData(msg.imageData);
      self.postMessage({
        requestId,
        type: 'trim-result',
        width: trimmed.width,
        height: trimmed.height,
        trimmed: trimmed.trimmed,
        imageData: trimmed.imageData,
      });
    } else if (msg.type === 'compute-cutline') {
      const result = computeCutline(msg.imageData, msg.params || {});
      self.postMessage({ requestId, type: 'cutline-result', result });
    } else if (msg.type === 'compute-white-plan') {
      const result = computeWhitePlan(msg.imageData, msg.params || {});
      self.postMessage({ requestId, type: 'white-plan-result', result });
    } else if (msg.type === 'compute-radial-metrics') {
      const result = computeRadialMetrics(msg.imageData, msg.bboxDiag || 0);
      self.postMessage({ requestId, type: 'radial-metrics-result', result });
    } else {
      self.postMessage({ requestId, error: 'unknown_type' });
    }
  } catch (err) {
    self.postMessage({
      requestId,
      error: String(err && err.message ? err.message : err),
    });
  }
};
