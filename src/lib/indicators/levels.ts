import type { OHLCV } from "@/types/market";
import type { Series } from "./utils";

export interface Pivot {
  index: number;
  time: number;
  price: number;
  type: "high" | "low";
}

/** القمم والقيعان المحلية (Swing Highs / Lows) */
export function swingPoints(candles: OHLCV[], left = 3, right = 3): Pivot[] {
  const pivots: Pivot[] = [];
  for (let i = left; i < candles.length - right; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) isHigh = false;
      if (candles[j].low <= c.low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) pivots.push({ index: i, time: c.time, price: c.high, type: "high" });
    if (isLow) pivots.push({ index: i, time: c.time, price: c.low, type: "low" });
  }
  return pivots;
}

export interface LevelZone {
  price: number;
  touches: number;
  lastIndex: number;
}

/**
 * مستويات الدعم والمقاومة عبر تجميع القمم والقيعان المتقاربة.
 * لا تُخترع مستويات: إذا لم توجد نقاط ارتكاز كافية تُعاد قوائم فارغة.
 */
export function supportResistance(
  candles: OHLCV[],
  currentPrice: number,
  opts: { lookback?: number; tolerancePct?: number } = {},
): { supports: LevelZone[]; resistances: LevelZone[] } {
  const lookback = opts.lookback ?? 200;
  const tol = (opts.tolerancePct ?? 1.2) / 100;
  const slice = candles.slice(-lookback);
  const offset = candles.length - slice.length;
  const pivots = swingPoints(slice, 3, 3);
  const zones: LevelZone[] = [];
  for (const p of pivots) {
    const z = zones.find((zz) => Math.abs(zz.price - p.price) / zz.price <= tol);
    if (z) {
      z.price = (z.price * z.touches + p.price) / (z.touches + 1);
      z.touches += 1;
      z.lastIndex = Math.max(z.lastIndex, p.index + offset);
    } else {
      zones.push({ price: p.price, touches: 1, lastIndex: p.index + offset });
    }
  }
  const supports = zones
    .filter((z) => z.price < currentPrice * (1 - tol / 4))
    .sort((a, b) => b.price - a.price);
  const resistances = zones
    .filter((z) => z.price > currentPrice * (1 + tol / 4))
    .sort((a, b) => a.price - b.price);
  return { supports, resistances };
}

export const FIB_RATIOS = [0.236, 0.382, 0.5, 0.618, 0.786] as const;

/**
 * مستويات تصحيح فيبوناتشي بين أعلى قمة وأدنى قاع في النافذة.
 * في الاتجاه الصاعد تُقاس التصحيحات من القمة نزولًا، والعكس في الهابط.
 */
export function fibonacciRetracement(candles: OHLCV[], lookback = 120): {
  high: number;
  low: number;
  trendUp: boolean;
  levels: { level: number; price: number }[];
} | null {
  const slice = candles.slice(-lookback);
  if (slice.length < 20) return null;
  let hi = -Infinity;
  let lo = Infinity;
  let hiIdx = 0;
  let loIdx = 0;
  slice.forEach((c, i) => {
    if (c.high > hi) {
      hi = c.high;
      hiIdx = i;
    }
    if (c.low < lo) {
      lo = c.low;
      loIdx = i;
    }
  });
  if (!(hi > lo)) return null;
  const trendUp = loIdx < hiIdx;
  const range = hi - lo;
  const levels = FIB_RATIOS.map((r) => ({
    level: r,
    price: trendUp ? hi - range * r : lo + range * r,
  }));
  return { high: hi, low: lo, trendUp, levels };
}

/**
 * اكتشاف الانفراج (Divergence) بين السعر وRSI في آخر قمتين/قاعين.
 * إيجابي: قاع سعري أدنى مع قاع RSI أعلى. سلبي: قمة سعرية أعلى مع قمة RSI أدنى.
 */
export function detectDivergence(
  candles: OHLCV[],
  rsiSeries: Series,
  lookback = 60,
): { type: "BULLISH" | "BEARISH" | "NONE"; barsAgo: number | null } {
  const start = Math.max(0, candles.length - lookback);
  const pivots = swingPoints(candles.slice(start), 3, 3).map((p) => ({ ...p, index: p.index + start }));
  const lows = pivots.filter((p) => p.type === "low").slice(-2);
  const highs = pivots.filter((p) => p.type === "high").slice(-2);
  const res: { type: "BULLISH" | "BEARISH" | "NONE"; barsAgo: number | null }[] = [];
  if (lows.length === 2) {
    const [a, b] = lows;
    const ra = rsiSeries[a.index];
    const rb = rsiSeries[b.index];
    if (ra !== null && rb !== null && b.price < a.price && rb > ra + 1) {
      res.push({ type: "BULLISH", barsAgo: candles.length - 1 - b.index });
    }
  }
  if (highs.length === 2) {
    const [a, b] = highs;
    const ra = rsiSeries[a.index];
    const rb = rsiSeries[b.index];
    if (ra !== null && rb !== null && b.price > a.price && rb < ra - 1) {
      res.push({ type: "BEARISH", barsAgo: candles.length - 1 - b.index });
    }
  }
  if (res.length === 0) return { type: "NONE", barsAgo: null };
  // الأحدث هو المعتمد
  res.sort((x, y) => (x.barsAgo ?? 0) - (y.barsAgo ?? 0));
  return res[0];
}
