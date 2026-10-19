import { getAssetConfig } from "@/config/assets";
import { HttpError } from "@/lib/errors";
import { closedCandles, TIMEFRAME_MS } from "@/lib/timeframes";
import { TIMEFRAMES, type MarketDataProvider, type OHLCV, type Timeframe } from "@/types/market";
import type { ToolContext } from "./types";

/** يجلب كل ما تحتاجه الأدوات من أي مزود (الخادم أو المتصفح) ويبني سياق التشغيل */
export async function buildToolContext(provider: MarketDataProvider, symbol: string, timeframe: Timeframe, now = Date.now()): Promise<{ ctx: ToolContext; sources: string[]; isMock: boolean; isStale: boolean }> {
  const cfg = getAssetConfig(symbol);
  if (!cfg) throw new HttpError(404, "الرمز غير مدعوم");
  const safe = <T,>(p: Promise<T>) => p.catch(() => null);
  const [overview, book, ...series] = await Promise.all([
    safe(provider.getAssetOverview(cfg.symbol)),
    provider.getOrderBook ? safe(provider.getOrderBook(cfg.symbol, 500)) : Promise.resolve(null),
    ...TIMEFRAMES.map((tf) => safe(provider.getOHLCV(cfg.symbol, tf))),
  ]);
  const byTf: Partial<Record<Timeframe, OHLCV[]>> = {};
  const sources = new Set<string>();
  let isMock = false;
  let isStale = false;
  TIMEFRAMES.forEach((tf, i) => {
    const s = series[i];
    if (!s) return;
    byTf[tf] = closedCandles(s.candles, tf, now);
    sources.add(s.meta.source);
    isMock ||= s.meta.isMock;
    isStale ||= s.meta.isStale;
  });
  const selected = series[TIMEFRAMES.indexOf(timeframe)];
  const lastC = selected?.candles[selected.candles.length - 1];
  const forming: OHLCV | null = lastC && lastC.time + TIMEFRAME_MS[timeframe] > now ? lastC : null;
  if (!byTf[timeframe] || byTf[timeframe]!.length === 0) throw new HttpError(503, "تعذر جلب شموع هذا الأصل حاليًا");
  if (book) sources.add(book.meta.source);
  return {
    ctx: {
      symbol: cfg.symbol,
      kind: cfg.kind,
      timeframe,
      candles: byTf[timeframe]!,
      forming,
      byTf,
      price: overview?.price ?? forming?.close ?? byTf[timeframe]!.at(-1)!.close,
      orderBook: book,
      now,
    },
    sources: [...sources],
    isMock,
    isStale,
  };
}
