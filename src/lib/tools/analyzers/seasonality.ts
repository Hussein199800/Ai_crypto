import type { OHLCV } from "@/types/market";

export const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export interface Seasonality {
  years: number[];
  /** العائد الشهري % لكل سنة (null إن لم يتوفر) */
  grid: Record<number, (number | null)[]>;
  monthStats: { month: number; avg: number | null; winRate: number | null; samples: number }[];
  quarterStats: { quarter: number; avg: number | null; winRate: number | null; samples: number }[];
}

/**
 * الأداء الشهري والربع سنوي (Matrix Q) من الشموع الأسبوعية/اليومية:
 * إغلاق الشهر = آخر إغلاق داخل ذلك الشهر (UTC). نتائج تاريخية وليست توقعًا.
 */
export function seasonality(candles: OHLCV[]): Seasonality | null {
  if (candles.length < 60) return null;
  const monthClose = new Map<string, number>();
  for (const c of candles) {
    const d = new Date(c.time);
    monthClose.set(`${d.getUTCFullYear()}-${d.getUTCMonth()}`, c.close);
  }
  const keys = [...monthClose.keys()].map((k) => k.split("-").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const grid: Seasonality["grid"] = {};
  for (let i = 1; i < keys.length; i++) {
    const [y, m] = keys[i];
    const [py, pm] = keys[i - 1];
    // نتجاهل الأشهر غير المتتالية (فجوات البيانات)
    if (!((py === y && pm === m - 1) || (py === y - 1 && pm === 11 && m === 0))) continue;
    const prev = monthClose.get(`${py}-${pm}`)!;
    const cur = monthClose.get(`${y}-${m}`)!;
    grid[y] ??= new Array(12).fill(null);
    grid[y][m] = ((cur - prev) / prev) * 100;
  }
  const years = Object.keys(grid).map(Number).sort();
  const monthStats = Array.from({ length: 12 }, (_, m) => {
    const vals = years.map((y) => grid[y][m]).filter((v): v is number => v !== null);
    return { month: m, avg: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null, winRate: vals.length ? (vals.filter((v) => v > 0).length / vals.length) * 100 : null, samples: vals.length };
  });
  const quarterStats = [0, 1, 2, 3].map((q) => {
    const vals: number[] = [];
    for (const y of years) {
      const ms = grid[y].slice(q * 3, q * 3 + 3);
      if (ms.every((v) => v !== null)) vals.push((ms.reduce((acc, v) => acc * (1 + (v as number) / 100), 1) - 1) * 100);
    }
    return { quarter: q + 1, avg: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null, winRate: vals.length ? (vals.filter((v) => v > 0).length / vals.length) * 100 : null, samples: vals.length };
  });
  return { years, grid, monthStats, quarterStats };
}
