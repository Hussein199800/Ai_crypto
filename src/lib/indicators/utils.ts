export type Series = (number | null)[];

/** آخر قيمة غير فارغة في السلسلة */
export function last(series: Series): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i];
    if (v !== null && Number.isFinite(v)) return v;
  }
  return null;
}

/** القيمة قبل n عنصر من النهاية (0 = الأخيرة) */
export function valueAgo(series: Series, n: number): number | null {
  const idx = series.length - 1 - n;
  if (idx < 0) return null;
  const v = series[idx];
  return v !== null && Number.isFinite(v) ? v : null;
}

/** نسبة التغير المئوية للسلسلة خلال آخر lookback عنصر */
export function slopePct(series: Series, lookback: number): number | null {
  const a = valueAgo(series, lookback);
  const b = valueAgo(series, 0);
  if (a === null || b === null || a === 0) return null;
  return ((b - a) / Math.abs(a)) * 100;
}

export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length === 0) return NaN;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export interface CrossResult {
  /** above = الخط السريع عبر فوق البطيء */
  type: "above" | "below";
  barsAgo: number;
}

/** آخر تقاطع بين سلسلتين خلال نافذة بحث */
export function lastCross(fast: Series, slow: Series, lookback = 50): CrossResult | null {
  const n = Math.min(fast.length, slow.length);
  const start = Math.max(1, n - lookback);
  for (let i = n - 1; i >= start; i--) {
    const f0 = fast[i - 1];
    const s0 = slow[i - 1];
    const f1 = fast[i];
    const s1 = slow[i];
    if (f0 === null || s0 === null || f1 === null || s1 === null) continue;
    if (f0 <= s0 && f1 > s1) return { type: "above", barsAgo: n - 1 - i };
    if (f0 >= s0 && f1 < s1) return { type: "below", barsAgo: n - 1 - i };
  }
  return null;
}

/** نسبة المسافة المئوية بين قيمتين */
export function distancePct(price: number, ref: number | null): number | null {
  if (ref === null || ref === 0) return null;
  return ((price - ref) / ref) * 100;
}
