import type { OHLCV, Timeframe } from "@/types/market";
import type { Series } from "./utils";

/** حجم التوازن OBV */
export function obv(candles: OHLCV[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < candles.length; i++) {
    if (i > 0) {
      if (candles[i].close > candles[i - 1].close) acc += candles[i].volume;
      else if (candles[i].close < candles[i - 1].close) acc -= candles[i].volume;
    }
    out.push(acc);
  }
  return out;
}

const INTRADAY: Timeframe[] = ["15m", "1h", "4h"];

/**
 * متوسط السعر المرجح بالحجم VWAP — مُرسى يوميًا (يبدأ من جديد عند بداية كل يوم UTC).
 * لا يُحسب للأطر اليومية والأسبوعية لأنه غير مناسب لها.
 */
export function vwap(candles: OHLCV[], timeframe: Timeframe): Series {
  const out: Series = new Array(candles.length).fill(null);
  if (!INTRADAY.includes(timeframe)) return out;
  let day = -1;
  let pv = 0;
  let vol = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const d = Math.floor(c.time / 86_400_000);
    if (d !== day) {
      day = d;
      pv = 0;
      vol = 0;
    }
    const typical = (c.high + c.low + c.close) / 3;
    pv += typical * c.volume;
    vol += c.volume;
    out[i] = vol > 0 ? pv / vol : null;
  }
  return out;
}

/** نسبة حجم الشموع الصاعدة من إجمالي الحجم — تقدير لقوة المشترين (0..100) */
export function buyPressure(candles: OHLCV[], lookback = 20): number | null {
  const slice = candles.slice(-lookback);
  if (slice.length < 5) return null;
  let up = 0;
  let total = 0;
  for (const c of slice) {
    total += c.volume;
    if (c.close >= c.open) up += c.volume;
  }
  return total > 0 ? (up / total) * 100 : null;
}
