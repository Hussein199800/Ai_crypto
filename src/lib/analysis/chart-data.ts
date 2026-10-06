import { getAssetConfig } from "@/config/assets";
import { HttpError } from "@/lib/errors";
import { atr, bollinger, ema, macd, obv, rsi, sma, supportResistance, volumeMA, type Series } from "@/lib/indicators";
import type { DataMeta, MarketDataProvider, OHLCV, Timeframe } from "@/types/market";

export interface ChartData {
  symbol: string;
  display: string;
  kind: string;
  timeframe: Timeframe;
  candles: OHLCV[];
  indicators: {
    ema20: Series;
    ema50: Series;
    ema200: Series;
    sma20: Series;
    sma50: Series;
    bbUpper: Series;
    bbLower: Series;
    rsi14: Series;
    macd: Series;
    macdSignal: Series;
    macdHist: Series;
    obv: Series;
    volumeMA20: Series;
  };
  levels: { supports: number[]; resistances: number[] };
  atr14: number | null;
  meta: DataMeta;
  hasVolume: boolean;
}

/** بيانات الرسم البياني مع المؤشرات محسوبة على الخادم (تُقص إلى آخر `limit` شمعة بعد الحساب) */
export async function buildChartData(provider: MarketDataProvider, symbol: string, timeframe: Timeframe, limit: number): Promise<ChartData> {
  const cfg = getAssetConfig(symbol);
  if (!cfg) throw new HttpError(404, "الرمز غير مدعوم");
  const series = await provider.getOHLCV(cfg.symbol, timeframe);
  const all = series.candles;
  const closes = all.map((c) => c.close);
  const m = macd(closes);
  const bb = bollinger(closes, 20, 2);
  const cut = <T,>(arr: T[]) => arr.slice(-limit);
  const hasVolume = all.some((c) => c.volume > 0);
  const price = closes[closes.length - 1];
  const sr = price ? supportResistance(all, price, { lookback: 200 }) : { supports: [], resistances: [] };
  const atrS = atr(all, 14);
  return {
    symbol: cfg.symbol,
    display: cfg.display,
    kind: cfg.kind,
    timeframe,
    candles: cut(all),
    indicators: {
      ema20: cut(ema(closes, 20)),
      ema50: cut(ema(closes, 50)),
      ema200: cut(ema(closes, 200)),
      sma20: cut(sma(closes, 20)),
      sma50: cut(sma(closes, 50)),
      bbUpper: cut(bb.upper),
      bbLower: cut(bb.lower),
      rsi14: cut(rsi(closes, 14)),
      macd: cut(m.macd),
      macdSignal: cut(m.signal),
      macdHist: cut(m.histogram),
      obv: hasVolume ? cut(obv(all)) : cut(all.map(() => null)),
      volumeMA20: cut(volumeMA(all.map((c) => c.volume), 20)),
    },
    levels: {
      supports: sr.supports.slice(0, 3).map((s) => s.price),
      resistances: sr.resistances.slice(0, 3).map((s) => s.price),
    },
    atr14: atrS[atrS.length - 1] ?? null,
    meta: series.meta,
    hasVolume,
  };
}
