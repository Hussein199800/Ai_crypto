import { getAssetConfig } from "@/config/assets";
import { HttpError } from "@/lib/errors";
import { logError } from "@/lib/logger";
import type { Horizon } from "@/types/analysis";
import { TIMEFRAMES, type MarketDataProvider, type OHLCVSeries, type Timeframe } from "@/types/market";
import { runAnalysis, type AnalysisOutput } from "./engine";

export interface BuiltReport extends AnalysisOutput {
  series: Partial<Record<Timeframe, OHLCVSeries | null>>;
}

/**
 * الخطوات 1–8 من توليد التقرير: جلب البيانات من أي مزود ثم التحليل.
 * مستقلة عن قاعدة البيانات لتعمل على الخادم وفي المتصفح (النسخة الثابتة).
 */
export async function fetchAndAnalyze(provider: MarketDataProvider, symbol: string, horizon: Horizon): Promise<BuiltReport> {
  const cfg = getAssetConfig(symbol);
  if (!cfg) throw new HttpError(404, "الرمز غير مدعوم");
  const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch((e) => (logError(`report.fetch.${cfg.symbol}`, e), null));

  // فشل مصدر لا يوقف التقرير بل يخفض جودة البيانات
  const [overview, global, dominance, fearGreed, news, ...seriesList] = await Promise.all([
    safe(provider.getAssetOverview(cfg.symbol)),
    safe(provider.getGlobalMarketData()),
    safe(provider.getDominanceData()),
    safe(provider.getFearGreedIndex()),
    safe(provider.getMarketNews()),
    ...TIMEFRAMES.map((tf) => safe(provider.getOHLCV(cfg.symbol, tf))),
  ]);
  if (!overview) throw new HttpError(503, "تعذر جلب بيانات الأصل من مزودي البيانات حاليًا. حاول لاحقًا.");

  const series: Partial<Record<Timeframe, OHLCVSeries | null>> = {};
  TIMEFRAMES.forEach((tf, i) => (series[tf] = seriesList[i] as OHLCVSeries | null));

  const daily = async (sym: string) =>
    sym === cfg.symbol ? (series["1d"]?.candles ?? null) : ((await safe(provider.getOHLCV(sym, "1d")))?.candles ?? null);
  const [btcDaily, ethDaily, ethBtcDaily] = await Promise.all([daily("BTC"), daily("ETH"), daily("ETHBTC")]);

  const out = runAnalysis({ symbol: cfg.symbol, horizon, overview, series, global, dominance, fearGreed, news, btcDaily, ethDaily, ethBtcDaily });
  return { ...out, series };
}
