import { swingPoints } from "@/lib/indicators/levels";
import type { OHLCV } from "@/types/market";

export type SwingLabel = "HH" | "LH" | "HL" | "LL";

export interface StructureEvent {
  type: "BOS" | "CHOCH";
  direction: "UP" | "DOWN";
  level: number;
  index: number;
}

export interface MarketStructure {
  trend: "UP" | "DOWN" | "UNKNOWN";
  swings: { index: number; price: number; type: "high" | "low"; label: SwingLabel | null }[];
  events: StructureEvent[];
  lastEvent: StructureEvent | null;
  lastSwingHigh: number | null;
  lastSwingLow: number | null;
}

/**
 * هيكل السوق: تصنيف القمم والقيعان (HH/LH/HL/LL) ورصد الكسور:
 * BOS = كسر في اتجاه الترند الحالي (استمرار)، CHOCH = كسر عكس الترند (تغير الطابع).
 * يُعتمد على إغلاق الشمعة وليس الذيل، وعلى نقاط ارتكاز مؤكدة فقط (3 شموع على كل جانب).
 */
export function analyzeStructure(candles: OHLCV[], strength = 3): MarketStructure {
  const pivots = swingPoints(candles, strength, strength);
  let prevHigh: number | null = null;
  let prevLow: number | null = null;
  const swings: MarketStructure["swings"] = pivots.map((p) => {
    let label: SwingLabel | null = null;
    if (p.type === "high") {
      if (prevHigh !== null) label = p.price > prevHigh ? "HH" : "LH";
      prevHigh = p.price;
    } else {
      if (prevLow !== null) label = p.price > prevLow ? "HL" : "LL";
      prevLow = p.price;
    }
    return { index: p.index, price: p.price, type: p.type, label };
  });

  const events: StructureEvent[] = [];
  let trend: MarketStructure["trend"] = "UNKNOWN";
  let activeHigh: number | null = null;
  let activeLow: number | null = null;
  let pi = 0;
  for (let i = 0; i < candles.length; i++) {
    // النقطة تصبح مؤكدة بعد مرور `strength` شمعة
    while (pi < pivots.length && pivots[pi].index + strength <= i) {
      if (pivots[pi].type === "high") activeHigh = pivots[pi].price;
      else activeLow = pivots[pi].price;
      pi++;
    }
    const c = candles[i].close;
    if (activeHigh !== null && c > activeHigh) {
      events.push({ type: trend === "DOWN" ? "CHOCH" : "BOS", direction: "UP", level: activeHigh, index: i });
      trend = "UP";
      activeHigh = null;
    } else if (activeLow !== null && c < activeLow) {
      events.push({ type: trend === "UP" ? "CHOCH" : "BOS", direction: "DOWN", level: activeLow, index: i });
      trend = "DOWN";
      activeLow = null;
    }
  }
  const highs = pivots.filter((p) => p.type === "high");
  const lows = pivots.filter((p) => p.type === "low");
  return {
    trend,
    swings,
    events,
    lastEvent: events[events.length - 1] ?? null,
    lastSwingHigh: highs[highs.length - 1]?.price ?? null,
    lastSwingLow: lows[lows.length - 1]?.price ?? null,
  };
}
