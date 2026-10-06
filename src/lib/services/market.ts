import { CRYPTO_ASSETS } from "@/config/assets";
import type { Viewer } from "@/lib/auth/policy";
import { computeMarketAlerts, computeMarketState, relativeStrength, type MarketAlertItem, type MarketState } from "@/lib/analysis/market-state";
import { logError } from "@/lib/logger";
import { getMarketDataProvider } from "@/lib/providers";
import type { AssetOverview, DataMeta, DominanceData, FearGreedData, GlobalMarketData } from "@/types/market";
import { latestScores } from "./reports";

export interface RankedAsset {
  overview: AssetOverview;
  strength: number | null;
  score: { score: number; recommendation: string; createdAt: string; id: string } | null;
}

export interface DashboardData {
  global: GlobalMarketData | null;
  dominance: DominanceData | null;
  fearGreed: FearGreedData | null;
  state: MarketState;
  strongest: RankedAsset[];
  weakest: RankedAsset[];
  alerts: MarketAlertItem[];
  meta: DataMeta;
}

export async function getDashboardData(viewer: Viewer | null): Promise<DashboardData> {
  const provider = getMarketDataProvider();
  const safe = <T,>(p: Promise<T>, ctx: string): Promise<T | null> => p.catch((e) => (logError(ctx, e), null));
  const coins = CRYPTO_ASSETS.filter((a) => a.kind === "CRYPTO").map((a) => a.symbol);
  const [global, dominance, fearGreed, btcDaily, overviews] = await Promise.all([
    safe(provider.getGlobalMarketData(), "dash.global"),
    safe(provider.getDominanceData(), "dash.dominance"),
    safe(provider.getFearGreedIndex(), "dash.fng"),
    safe(provider.getOHLCV("BTC", "1d"), "dash.btc"),
    safe(provider.getAssetsOverview ? provider.getAssetsOverview(coins) : Promise.all(coins.map((s) => provider.getAssetOverview(s))), "dash.overviews"),
  ]);
  const list = overviews ?? [];
  const scores = await latestScores(list.map((o) => o.symbol), viewer);
  const ranked: RankedAsset[] = list
    .map((o) => ({ overview: o, strength: relativeStrength(o), score: scores[o.symbol] ?? null }))
    .filter((r) => r.strength !== null)
    .sort((a, b) => b.strength! - a.strength!);
  const stale = Boolean(global?.meta.isStale || list.some((o) => o.meta.isStale));
  const isMock = Boolean(global?.meta.isMock || list.some((o) => o.meta.isMock));
  return {
    global,
    dominance,
    fearGreed,
    state: computeMarketState(global, dominance, fearGreed, btcDaily?.candles ?? null),
    strongest: ranked.slice(0, 5),
    weakest: ranked.slice(-5).reverse(),
    alerts: computeMarketAlerts(list, dominance, fearGreed, stale),
    meta: {
      source: global?.meta.source ?? "غير متاح",
      fetchedAt: new Date().toISOString(),
      dataTime: global?.meta.dataTime,
      isStale: stale,
      isMock,
    },
  };
}

export async function getAssetsList(viewer: Viewer | null, symbols: string[]) {
  const provider = getMarketDataProvider();
  const overviews = provider.getAssetsOverview
    ? await provider.getAssetsOverview(symbols)
    : await Promise.all(symbols.map((s) => provider.getAssetOverview(s).catch(() => null))).then((x) => x.filter((o): o is AssetOverview => o !== null));
  const scores = await latestScores(overviews.map((o) => o.symbol), viewer);
  return overviews.map((o) => ({ ...o, analysis: scores[o.symbol] ?? null }));
}
