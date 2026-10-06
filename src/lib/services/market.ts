import type { Viewer } from "@/lib/auth/policy";
import { buildDashboardData, type DashboardData } from "@/lib/analysis/dashboard";
import { getMarketDataProvider } from "@/lib/providers";
import type { AssetOverview } from "@/types/market";
import { latestScores } from "./reports";

export type { DashboardData, RankedAsset } from "@/lib/analysis/dashboard";

export function getDashboardData(viewer: Viewer | null): Promise<DashboardData> {
  return buildDashboardData(getMarketDataProvider(), (symbols) => latestScores(symbols, viewer));
}

export async function getAssetsList(viewer: Viewer | null, symbols: string[]) {
  const provider = getMarketDataProvider();
  const overviews = provider.getAssetsOverview
    ? await provider.getAssetsOverview(symbols)
    : await Promise.all(symbols.map((s) => provider.getAssetOverview(s).catch(() => null))).then((x) => x.filter((o): o is AssetOverview => o !== null));
  const scores = await latestScores(overviews.map((o) => o.symbol), viewer);
  return overviews.map((o) => ({ ...o, analysis: scores[o.symbol] ?? null }));
}
