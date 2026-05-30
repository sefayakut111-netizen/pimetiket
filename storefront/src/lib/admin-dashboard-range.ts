/**
 * Dashboard zaman aralığı — admin page + aggregate API ortak kaynak.
 */

export type DashboardTimeRange = "today" | "7d" | "mtd" | "30d" | "custom";

export interface DashboardRangeWindow {
  start: number;
  end?: number;
  prevStart: number;
  prevEnd: number;
  days: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function getDashboardRangeWindow(
  range: DashboardTimeRange,
  customFrom?: string,
  customTo?: string
): DashboardRangeWindow {
  const now = Date.now();
  if (range === "custom" && customFrom && customTo) {
    const from = new Date(customFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(customTo);
    to.setHours(23, 59, 59, 999);
    const duration = to.getTime() - from.getTime();
    const days = Math.max(1, Math.ceil(duration / DAY));
    return {
      start: from.getTime(),
      end: to.getTime(),
      prevStart: from.getTime() - duration,
      prevEnd: from.getTime(),
      days,
    };
  }
  if (range === "today") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return {
      start: startOfDay.getTime(),
      end: endOfDay.getTime(),
      prevStart: startOfDay.getTime() - DAY,
      prevEnd: startOfDay.getTime(),
      days: 1,
    };
  }
  if (range === "7d") {
    return {
      start: now - 7 * DAY,
      prevStart: now - 14 * DAY,
      prevEnd: now - 7 * DAY,
      days: 7,
    };
  }
  if (range === "mtd") {
    const today = new Date();
    const startOfMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
      0,
      0,
      0,
      0
    );
    const startOfPrevMonth = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1,
      0,
      0,
      0,
      0
    );
    const elapsedMs = now - startOfMonth.getTime();
    const elapsedDays = Math.max(1, Math.ceil(elapsedMs / DAY));
    const prevEnd = startOfPrevMonth.getTime() + elapsedMs;
    return {
      start: startOfMonth.getTime(),
      prevStart: startOfPrevMonth.getTime(),
      prevEnd,
      days: elapsedDays,
    };
  }
  return {
    start: now - 30 * DAY,
    prevStart: now - 60 * DAY,
    prevEnd: now - 30 * DAY,
    days: 30,
  };
}

export function dashboardRangeQueryParams(
  range: DashboardTimeRange,
  customFrom?: string,
  customTo?: string
): URLSearchParams {
  const qs = new URLSearchParams({ range });
  if (range === "custom" && customFrom && customTo) {
    qs.set("from", customFrom);
    qs.set("to", customTo);
  }
  qs.set("excludeTest", "1");
  return qs;
}
