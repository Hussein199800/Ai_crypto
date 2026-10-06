import { ema, emaOfSeries, sma } from "./moving-averages";
import type { Series } from "./utils";

/**
 * مؤشر القوة النسبية RSI بطريقة Wilder.
 * أول قيمة تظهر عند الفهرس `period`.
 */
export function rsi(closes: number[], period = 14): Series {
  const out: Series = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = toRsi(avgGain, avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = toRsi(avgGain, avgLoss);
  }
  return out;
}

function toRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export interface MacdResult {
  macd: Series;
  signal: Series;
  histogram: Series;
}

/** مؤشر MACD: الفرق بين EMA السريع والبطيء، وخط الإشارة EMA للخط، والهيستوجرام */
export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const fastE = ema(closes, fast);
  const slowE = ema(closes, slow);
  const line: Series = closes.map((_, i) => {
    const f = fastE[i];
    const s = slowE[i];
    return f !== null && s !== null ? f - s : null;
  });
  const signal = emaOfSeries(line, signalPeriod);
  const histogram: Series = line.map((v, i) => {
    const s = signal[i];
    return v !== null && s !== null ? v - s : null;
  });
  return { macd: line, signal, histogram };
}

export interface StochRsiResult {
  k: Series;
  d: Series;
}

/** مؤشر Stochastic RSI (القيم من 0 إلى 100) */
export function stochRsi(closes: number[], rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3): StochRsiResult {
  const r = rsi(closes, rsiPeriod);
  const raw: Series = new Array(closes.length).fill(null);
  for (let i = 0; i < r.length; i++) {
    if (i - stochPeriod + 1 < 0) continue;
    const window = r.slice(i - stochPeriod + 1, i + 1);
    if (window.some((v) => v === null)) continue;
    const vals = window as number[];
    const hi = Math.max(...vals);
    const lo = Math.min(...vals);
    raw[i] = hi === lo ? 50 : ((vals[vals.length - 1] - lo) / (hi - lo)) * 100;
  }
  const k = smoothSeries(raw, kSmooth);
  const d = smoothSeries(k, dSmooth);
  return { k, d };
}

function smoothSeries(series: Series, period: number): Series {
  const out: Series = new Array(series.length).fill(null);
  const firstIdx = series.findIndex((v) => v !== null);
  if (firstIdx < 0) return out;
  const compact = series.slice(firstIdx).map((v) => v ?? 0);
  const s = sma(compact, period);
  for (let i = 0; i < s.length; i++) out[firstIdx + i] = s[i];
  return out;
}

/** معدل تغير السعر ROC كنسبة مئوية */
export function roc(closes: number[], period = 10): Series {
  return closes.map((c, i) => {
    if (i < period) return null;
    const prev = closes[i - period];
    return prev === 0 ? null : ((c - prev) / prev) * 100;
  });
}
