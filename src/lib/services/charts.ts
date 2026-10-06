import { buildChartData, type ChartData } from "@/lib/analysis/chart-data";
import { getMarketDataProvider } from "@/lib/providers";
import type { Timeframe } from "@/types/market";

export type { ChartData };

/** بيانات الرسم البياني مع المؤشرات محسوبة على الخادم */
export function getChartData(symbol: string, timeframe: Timeframe, limit: number): Promise<ChartData> {
  return buildChartData(getMarketDataProvider(), symbol, timeframe, limit);
}
