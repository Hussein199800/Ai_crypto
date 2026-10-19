import type { MarketDataProvider, Timeframe } from "@/types/market";
import { buildToolContext } from "./context";
import { runTools } from "./registry";
import type { ToolResult } from "./types";

export interface ToolsResponse {
  symbol: string;
  timeframe: Timeframe;
  price: number | null;
  results: ToolResult[];
  sources: string[];
  isMock: boolean;
  isStale: boolean;
  generatedAt: string;
}

/** تشغيل الأدوات لأصل وإطار — مشترك بين الخادم والنسخة الثابتة */
export async function computeTools(provider: MarketDataProvider, symbol: string, timeframe: Timeframe, ids?: string[]): Promise<ToolsResponse> {
  const { ctx, sources, isMock, isStale } = await buildToolContext(provider, symbol, timeframe);
  return {
    symbol: ctx.symbol,
    timeframe,
    price: ctx.price,
    results: runTools(ctx, ids),
    sources,
    isMock,
    isStale,
    generatedAt: new Date(ctx.now).toISOString(),
  };
}
