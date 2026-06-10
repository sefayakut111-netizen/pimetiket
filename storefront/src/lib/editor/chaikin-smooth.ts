/** Chaikin corner-cutting — poc.html smoothPath ile senkron. */

export type PathPoint = [number, number];

export function chaikinSmoothPath(
  path: PathPoint[],
  smoothness: number
): PathPoint[] {
  if (!path || path.length < 3 || smoothness <= 0) return path;

  const iterations = smoothness >= 50 ? 2 : 1;
  let pts = path.map(([x, y]) => ({ x, y }));

  for (let iter = 0; iter < iterations; iter++) {
    const next: { x: number; y: number }[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i]!;
      const p1 = pts[(i + 1) % pts.length]!;
      next.push(
        { x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y },
        { x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y }
      );
    }
    pts = next;
  }

  return pts.map((p) => [p.x, p.y]);
}
