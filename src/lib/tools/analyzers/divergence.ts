import { swingPoints } from "@/lib/indicators/levels";
import type { Series } from "@/lib/indicators/utils";
import type { OHLCV } from "@/types/market";

export interface DivergenceHit {
  type: "BULLISH" | "BEARISH" | "HIDDEN_BULLISH" | "HIDDEN_BEARISH";
  barsAgo: number;
}

/**
 * انفراج عام بين السعر وأي مؤشر: يقارن آخر قاعين/قمتين للسعر بقيم المؤشر عندهما.
 * عادي: السعر قاع أدنى والمؤشر قاع أعلى (إيجابي). مخفي: السعر قاع أعلى والمؤشر قاع أدنى (استمرار).
 * يُشترط أن يكون فرق المؤشر أكبر من 3% من مداه في النافذة لتجنب الضوضاء.
 */
export function genericDivergence(candles: OHLCV[], series: Series, lookback = 80): DivergenceHit | null {
  const start = Math.max(0, candles.length - lookback);
  const vals = series.slice(start).filter((v): v is number => v !== null);
  if (vals.length < 20) return null;
  const range = Math.max(...vals) - Math.min(...vals) || 1;
  const minDiff = range * 0.03;
  const piv = swingPoints(candles.slice(start), 3, 3).map((p) => ({ ...p, index: p.index + start }));
  const hits: DivergenceHit[] = [];
  const lows = piv.filter((p) => p.type === "low").slice(-2);
  const highs = piv.filter((p) => p.type === "high").slice(-2);
  if (lows.length === 2) {
    const [a, b] = lows;
    const sa = series[a.index];
    const sb = series[b.index];
    if (sa !== null && sb !== null) {
      if (b.price < a.price && sb > sa + minDiff) hits.push({ type: "BULLISH", barsAgo: candles.length - 1 - b.index });
      if (b.price > a.price && sb < sa - minDiff) hits.push({ type: "HIDDEN_BULLISH", barsAgo: candles.length - 1 - b.index });
    }
  }
  if (highs.length === 2) {
    const [a, b] = highs;
    const sa = series[a.index];
    const sb = series[b.index];
    if (sa !== null && sb !== null) {
      if (b.price > a.price && sb < sa - minDiff) hits.push({ type: "BEARISH", barsAgo: candles.length - 1 - b.index });
      if (b.price < a.price && sb > sa + minDiff) hits.push({ type: "HIDDEN_BEARISH", barsAgo: candles.length - 1 - b.index });
    }
  }
  if (hits.length === 0) return null;
  return hits.sort((x, y) => x.barsAgo - y.barsAgo)[0];
}
