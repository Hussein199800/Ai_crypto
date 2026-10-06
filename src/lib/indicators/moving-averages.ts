import type { Series } from "./utils";

/** المتوسط المتحرك البسيط SMA */
export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/**
 * المتوسط المتحرك الأسي EMA
 * تبدأ القيمة الأولى بمتوسط بسيط لأول `period` قيمة، ثم يُطبَّق معامل التنعيم 2/(n+1).
 */
export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i++) prev += values[i];
  prev /= period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** EMA على سلسلة تحتوي على قيم فارغة في بدايتها */
export function emaOfSeries(series: Series, period: number): Series {
  const out: Series = new Array(series.length).fill(null);
  const firstIdx = series.findIndex((v) => v !== null);
  if (firstIdx < 0) return out;
  const compact = series.slice(firstIdx).map((v) => v ?? 0);
  const e = ema(compact, period);
  for (let i = 0; i < e.length; i++) out[firstIdx + i] = e[i];
  return out;
}

/** متوسط الحجم المتحرك */
export function volumeMA(volumes: number[], period = 20): Series {
  return sma(volumes, period);
}
