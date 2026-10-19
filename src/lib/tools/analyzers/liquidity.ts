import { swingPoints } from "@/lib/indicators/levels";
import type { OHLCV } from "@/types/market";

export interface LiquidityPool {
  side: "BUY_SIDE" | "SELL_SIDE";
  price: number;
  touches: number;
  lastIndex: number;
  swept: boolean;
  sweptIndex: number | null;
}

/**
 * مجمعات السيولة: قمم متساوية (EQH) فوقها أوامر وقف البائعين = سيولة شرائية،
 * وقيعان متساوية (EQL) تحتها سيولة بيعية. "الاصطياد" (Sweep): ذيل يتجاوز المستوى ثم إغلاق يعود دونه.
 */
export function liquidityPools(candles: OHLCV[], tolerancePct = 0.15, lookback = 200): LiquidityPool[] {
  const slice = candles.slice(-lookback);
  const offset = candles.length - slice.length;
  const pivots = swingPoints(slice, 2, 2);
  const pools: LiquidityPool[] = [];
  for (const type of ["high", "low"] as const) {
    const pts = pivots.filter((p) => p.type === type);
    const used = new Set<number>();
    for (let i = 0; i < pts.length; i++) {
      if (used.has(i)) continue;
      const group = [pts[i]];
      for (let j = i + 1; j < pts.length; j++) {
        if (used.has(j)) continue;
        if (Math.abs(pts[j].price - pts[i].price) / pts[i].price <= tolerancePct / 100) {
          group.push(pts[j]);
          used.add(j);
        }
      }
      if (group.length < 2) continue;
      const price = type === "high" ? Math.max(...group.map((g) => g.price)) : Math.min(...group.map((g) => g.price));
      const lastIndex = Math.max(...group.map((g) => g.index)) + offset;
      let sweptIndex: number | null = null;
      for (let k = lastIndex + 1; k < candles.length; k++) {
        const c = candles[k];
        if (type === "high" ? c.high > price && c.close < price : c.low < price && c.close > price) {
          sweptIndex = k;
          break;
        }
        // كسر حقيقي بالإغلاق يلغي المستوى دون اصطياد
        if (type === "high" ? c.close > price : c.close < price) break;
      }
      pools.push({ side: type === "high" ? "BUY_SIDE" : "SELL_SIDE", price, touches: group.length, lastIndex, swept: sweptIndex !== null, sweptIndex });
    }
  }
  return pools;
}
