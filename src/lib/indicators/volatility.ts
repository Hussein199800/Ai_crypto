import type { OHLCV } from "@/types/market";
import { sma } from "./moving-averages";
import type { Series } from "./utils";

export interface BollingerResult {
  upper: Series;
  middle: Series;
  lower: Series;
  /** عرض النطاق كنسبة من المتوسط */
  bandwidth: Series;
  /** موقع السعر داخل النطاق (0 = الحد السفلي، 1 = الحد العلوي) */
  percentB: Series;
}

/** نطاقات بولينجر Bollinger Bands */
export function bollinger(closes: number[], period = 20, mult = 2): BollingerResult {
  const middle = sma(closes, period);
  const upper: Series = new Array(closes.length).fill(null);
  const lower: Series = new Array(closes.length).fill(null);
  const bandwidth: Series = new Array(closes.length).fill(null);
  const percentB: Series = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const m = middle[i];
    if (m === null) continue;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (closes[j] - m) ** 2;
    const sd = Math.sqrt(variance / period);
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
    bandwidth[i] = m === 0 ? null : ((upper[i]! - lower[i]!) / m) * 100;
    const width = upper[i]! - lower[i]!;
    percentB[i] = width === 0 ? 0.5 : (closes[i] - lower[i]!) / width;
  }
  return { upper, middle, lower, bandwidth, percentB };
}

export function trueRange(candles: OHLCV[]): number[] {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const pc = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
  });
}

/** متوسط المدى الحقيقي ATR بطريقة Wilder */
export function atr(candles: OHLCV[], period = 14): Series {
  const out: Series = new Array(candles.length).fill(null);
  if (candles.length < period + 1) return out;
  const tr = trueRange(candles);
  let prev = 0;
  for (let i = 1; i <= period; i++) prev += tr[i];
  prev /= period;
  out[period] = prev;
  for (let i = period + 1; i < candles.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

export interface AdxResult {
  adx: Series;
  plusDI: Series;
  minusDI: Series;
}

/** مؤشر متوسط الاتجاه ADX مع +DI و-DI (طريقة Wilder) */
export function adx(candles: OHLCV[], period = 14): AdxResult {
  const n = candles.length;
  const adxOut: Series = new Array(n).fill(null);
  const plusOut: Series = new Array(n).fill(null);
  const minusOut: Series = new Array(n).fill(null);
  if (n < period * 2 + 1) return { adx: adxOut, plusDI: plusOut, minusDI: minusOut };

  const tr = trueRange(candles);
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  for (let i = 1; i < n; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }

  let trS = 0;
  let pS = 0;
  let mS = 0;
  for (let i = 1; i <= period; i++) {
    trS += tr[i];
    pS += plusDM[i];
    mS += minusDM[i];
  }
  const dx: Series = new Array(n).fill(null);
  for (let i = period; i < n; i++) {
    if (i > period) {
      trS = trS - trS / period + tr[i];
      pS = pS - pS / period + plusDM[i];
      mS = mS - mS / period + minusDM[i];
    }
    const pdi = trS === 0 ? 0 : (100 * pS) / trS;
    const mdi = trS === 0 ? 0 : (100 * mS) / trS;
    plusOut[i] = pdi;
    minusOut[i] = mdi;
    const sum = pdi + mdi;
    dx[i] = sum === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / sum;
  }

  let adxPrev = 0;
  for (let i = period; i < period * 2; i++) adxPrev += dx[i] ?? 0;
  adxPrev /= period;
  adxOut[period * 2 - 1] = adxPrev;
  for (let i = period * 2; i < n; i++) {
    adxPrev = (adxPrev * (period - 1) + (dx[i] ?? 0)) / period;
    adxOut[i] = adxPrev;
  }
  return { adx: adxOut, plusDI: plusOut, minusDI: minusOut };
}

/** التقلب التاريخي السنوي بناءً على العوائد اللوغاريتمية */
export function historicalVolatility(closes: number[], periodsPerYear: number, lookback = 30): number | null {
  if (closes.length < lookback + 1) return null;
  const slice = closes.slice(-lookback - 1);
  const rets: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1] <= 0 || slice[i] <= 0) continue;
    rets.push(Math.log(slice[i] / slice[i - 1]));
  }
  if (rets.length < 2) return null;
  const m = rets.reduce((s, v) => s + v, 0) / rets.length;
  const variance = rets.reduce((s, v) => s + (v - m) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear) * 100;
}

/** أقصى تراجع من قمة إلى قاع خلال النافذة (نسبة مئوية سالبة) */
export function maxDrawdown(closes: number[]): number | null {
  if (closes.length < 2) return null;
  let peak = closes[0];
  let mdd = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    if (peak > 0) mdd = Math.min(mdd, ((c - peak) / peak) * 100);
  }
  return mdd;
}
