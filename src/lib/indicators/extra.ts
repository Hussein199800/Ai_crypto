import type { OHLCV } from "@/types/market";
import { ema, sma } from "./moving-averages";
import { atr } from "./volatility";
import type { Series } from "./utils";

const typical = (c: OHLCV) => (c.high + c.low + c.close) / 3;

/** مؤشر قناة السلع CCI */
export function cci(candles: OHLCV[], period = 20): Series {
  const tp = candles.map(typical);
  const m = sma(tp, period);
  return tp.map((v, i) => {
    const mean = m[i];
    if (mean === null) return null;
    let dev = 0;
    for (let j = i - period + 1; j <= i; j++) dev += Math.abs(tp[j] - mean);
    dev /= period;
    return dev === 0 ? 0 : (v - mean) / (0.015 * dev);
  });
}

/** مؤشر ويليامز ‎%R (من -100 إلى 0) */
export function williamsR(candles: OHLCV[], period = 14): Series {
  return candles.map((c, i) => {
    if (i < period - 1) return null;
    const w = candles.slice(i - period + 1, i + 1);
    const hi = Math.max(...w.map((x) => x.high));
    const lo = Math.min(...w.map((x) => x.low));
    return hi === lo ? -50 : ((hi - c.close) / (hi - lo)) * -100;
  });
}

/** الستوكاستيك الكلاسيكي ‎%K و‎%D */
export function stochastic(candles: OHLCV[], period = 14, kSmooth = 3, dSmooth = 3): { k: Series; d: Series } {
  const raw: Series = candles.map((c, i) => {
    if (i < period - 1) return null;
    const w = candles.slice(i - period + 1, i + 1);
    const hi = Math.max(...w.map((x) => x.high));
    const lo = Math.min(...w.map((x) => x.low));
    return hi === lo ? 50 : ((c.close - lo) / (hi - lo)) * 100;
  });
  const k = smoothNullable(raw, kSmooth);
  return { k, d: smoothNullable(k, dSmooth) };
}

function smoothNullable(series: Series, period: number): Series {
  const out: Series = new Array(series.length).fill(null);
  const first = series.findIndex((v) => v !== null);
  if (first < 0) return out;
  const s = sma(series.slice(first).map((v) => v ?? 0), period);
  s.forEach((v, i) => (out[first + i] = v));
  return out;
}

/** الزخم: الفرق بين الإغلاق الحالي والإغلاق قبل n شمعة */
export function momentum(closes: number[], period = 10): Series {
  return closes.map((c, i) => (i < period ? null : c - closes[i - period]));
}

/** مؤشر تدفق المال MFI (0..100) */
export function mfi(candles: OHLCV[], period = 14): Series {
  const tp = candles.map(typical);
  return candles.map((_, i) => {
    if (i < period) return null;
    let pos = 0;
    let neg = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const flow = tp[j] * candles[j].volume;
      if (tp[j] > tp[j - 1]) pos += flow;
      else if (tp[j] < tp[j - 1]) neg += flow;
    }
    if (neg === 0) return pos === 0 ? 50 : 100;
    return 100 - 100 / (1 + pos / neg);
  });
}

/** قناة كيلتنر: EMA ± مضاعف ATR */
export function keltner(candles: OHLCV[], period = 20, mult = 1.5): { upper: Series; middle: Series; lower: Series } {
  const mid = ema(candles.map((c) => c.close), period);
  const a = atr(candles, period);
  return {
    middle: mid,
    upper: mid.map((m, i) => (m === null || a[i] === null ? null : m + mult * a[i]!)),
    lower: mid.map((m, i) => (m === null || a[i] === null ? null : m - mult * a[i]!)),
  };
}

const midpoint = (candles: OHLCV[], end: number, period: number): number | null => {
  if (end - period + 1 < 0) return null;
  let hi = -Infinity;
  let lo = Infinity;
  for (let j = end - period + 1; j <= end; j++) {
    hi = Math.max(hi, candles[j].high);
    lo = Math.min(lo, candles[j].low);
  }
  return (hi + lo) / 2;
};

export interface IchimokuResult {
  tenkan: Series;
  kijun: Series;
  /** السحابة المعروضة عند كل شمعة (بعد إزاحتها 26 للأمام) */
  spanA: Series;
  spanB: Series;
  /** قيم السحابة المستقبلية المحسوبة من آخر شمعة (تُعرض بعد 26 فترة) */
  futureSpanA: number | null;
  futureSpanB: number | null;
}

/** إيشيموكو كينكو هيو (9 / 26 / 52 مع إزاحة 26) */
export function ichimoku(candles: OHLCV[], conv = 9, base = 26, spanBPeriod = 52, shift = 26): IchimokuResult {
  const n = candles.length;
  const tenkan: Series = candles.map((_, i) => midpoint(candles, i, conv));
  const kijun: Series = candles.map((_, i) => midpoint(candles, i, base));
  const rawA: Series = tenkan.map((t, i) => (t === null || kijun[i] === null ? null : (t + kijun[i]!) / 2));
  const rawB: Series = candles.map((_, i) => midpoint(candles, i, spanBPeriod));
  const spanA: Series = candles.map((_, i) => (i - shift >= 0 ? rawA[i - shift] : null));
  const spanB: Series = candles.map((_, i) => (i - shift >= 0 ? rawB[i - shift] : null));
  return { tenkan, kijun, spanA, spanB, futureSpanA: rawA[n - 1] ?? null, futureSpanB: rawB[n - 1] ?? null };
}

/** مؤشر التذبذب Choppiness Index: فوق 61.8 تذبذب، تحت 38.2 اتجاه */
export function choppiness(candles: OHLCV[], period = 14): Series {
  return candles.map((_, i) => {
    if (i < period) return null;
    let trSum = 0;
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      const c = candles[j];
      const pc = candles[j - 1].close;
      trSum += Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
      hi = Math.max(hi, c.high);
      lo = Math.min(lo, c.low);
    }
    if (hi === lo || trSum === 0) return 100;
    return (100 * Math.log10(trSum / (hi - lo))) / Math.log10(period);
  });
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  /** القيمة العادلة عند آخر نقطة */
  fair: number;
  stdDev: number;
  r2: number;
}

/** الانحدار الخطي بالمربعات الصغرى على سلسلة (x = 0..n-1) */
export function linearRegression(values: number[]): RegressionResult | null {
  const n = values.length;
  if (n < 3) return null;
  const mx = (n - 1) / 2;
  const my = values.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - mx) * (values[i] - my);
    sxx += (i - mx) ** 2;
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const fit = intercept + slope * i;
    ssRes += (values[i] - fit) ** 2;
    ssTot += (values[i] - my) ** 2;
  }
  return { slope, intercept, fair: intercept + slope * (n - 1), stdDev: Math.sqrt(ssRes / n), r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
}

export interface TdSequential {
  /** عدّاد الإعداد الحالي: موجب = إعداد شرائي (هبوط متتالٍ)، سالب = بيعي */
  buySetup: number;
  sellSetup: number;
  /** آخر إعداد مكتمل (9) */
  lastCompleted: { type: "BUY" | "SELL"; barsAgo: number } | null;
  /** عداد العد التنازلي (حتى 13) منذ آخر إعداد مكتمل */
  countdown: number;
}

/**
 * مؤشر DeMark TD Sequential (مبسّط):
 * إعداد شراء: 9 إغلاقات متتالية أقل من إغلاق ما قبل 4 شموع، وإعداد بيع بالعكس.
 * العد التنازلي: إغلاق ≤ أدنى سعر قبل شمعتين (للشراء) حتى 13.
 */
export function tdSequential(candles: OHLCV[]): TdSequential {
  let buy = 0;
  let sell = 0;
  let last: TdSequential["lastCompleted"] = null;
  let lastIdx = -1;
  for (let i = 4; i < candles.length; i++) {
    const c = candles[i].close;
    const ref = candles[i - 4].close;
    buy = c < ref ? buy + 1 : 0;
    sell = c > ref ? sell + 1 : 0;
    if (buy === 9) {
      last = { type: "BUY", barsAgo: 0 };
      lastIdx = i;
    }
    if (sell === 9) {
      last = { type: "SELL", barsAgo: 0 };
      lastIdx = i;
    }
    if (buy > 9) buy = 9;
    if (sell > 9) sell = 9;
  }
  let countdown = 0;
  if (last && lastIdx >= 0) {
    last.barsAgo = candles.length - 1 - lastIdx;
    for (let i = lastIdx + 1; i < candles.length && countdown < 13; i++) {
      if (i < 2) continue;
      if (last.type === "BUY" && candles[i].close <= candles[i - 2].low) countdown++;
      if (last.type === "SELL" && candles[i].close >= candles[i - 2].high) countdown++;
    }
  }
  return { buySetup: buy, sellSetup: sell, lastCompleted: last, countdown };
}

/** فراكتلات ويليامز (شمعتان على كل جانب) */
export function williamsFractals(candles: OHLCV[], side = 2): { up: { index: number; price: number }[]; down: { index: number; price: number }[] } {
  const up: { index: number; price: number }[] = [];
  const down: { index: number; price: number }[] = [];
  for (let i = side; i < candles.length - side; i++) {
    let isUp = true;
    let isDown = true;
    for (let j = 1; j <= side; j++) {
      if (!(candles[i].high > candles[i - j].high && candles[i].high > candles[i + j].high)) isUp = false;
      if (!(candles[i].low < candles[i - j].low && candles[i].low < candles[i + j].low)) isDown = false;
    }
    if (isUp) up.push({ index: i, price: candles[i].high });
    if (isDown) down.push({ index: i, price: candles[i].low });
  }
  return { up, down };
}
