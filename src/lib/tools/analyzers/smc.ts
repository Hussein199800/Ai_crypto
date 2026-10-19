import type { OHLCV } from "@/types/market";
import { analyzeStructure } from "./structure";

export interface Zone {
  type: "BULLISH" | "BEARISH";
  top: number;
  bottom: number;
  index: number;
  mitigated: boolean;
}

/**
 * كتل الأوامر (Order Blocks): آخر شمعة عكسية قبل الحركة الاندفاعية التي كسرت الهيكل.
 * كتلة شرائية = آخر شمعة هابطة قبل كسر صاعد، والعكس للكتلة البيعية.
 * تُعتبر "مُختبرة" (mitigated) إذا عاد السعر إليها بعد تكوّنها.
 */
export function orderBlocks(candles: OHLCV[]): Zone[] {
  const ms = analyzeStructure(candles);
  const zones: Zone[] = [];
  for (const ev of ms.events) {
    const bullish = ev.direction === "UP";
    let j = ev.index - 1;
    const limit = Math.max(0, ev.index - 30);
    while (j >= limit) {
      const c = candles[j];
      if (bullish ? c.close < c.open : c.close > c.open) break;
      j--;
    }
    if (j < limit) continue;
    const ob = candles[j];
    const zone: Zone = { type: bullish ? "BULLISH" : "BEARISH", top: ob.high, bottom: ob.low, index: j, mitigated: false };
    for (let k = ev.index + 1; k < candles.length; k++) {
      if (bullish ? candles[k].low <= zone.top : candles[k].high >= zone.bottom) {
        zone.mitigated = true;
        break;
      }
    }
    zones.push(zone);
  }
  return zones;
}

/**
 * فجوات القيمة العادلة (FVG): فجوة سعرية بين ذيل الشمعة الأولى والثالثة.
 * صاعدة إذا كان قاع الشمعة الثالثة أعلى من قمة الأولى. تُعتبر مُغلقة إذا عبرها السعر بالكامل.
 */
export function fairValueGaps(candles: OHLCV[], lookback = 150): Zone[] {
  const out: Zone[] = [];
  const start = Math.max(2, candles.length - lookback);
  for (let i = start; i < candles.length; i++) {
    const a = candles[i - 2];
    const c = candles[i];
    let zone: Zone | null = null;
    if (c.low > a.high) zone = { type: "BULLISH", top: c.low, bottom: a.high, index: i - 1, mitigated: false };
    else if (c.high < a.low) zone = { type: "BEARISH", top: a.low, bottom: c.high, index: i - 1, mitigated: false };
    if (!zone) continue;
    for (let k = i + 1; k < candles.length; k++) {
      if (zone.type === "BULLISH" ? candles[k].low <= zone.bottom : candles[k].high >= zone.top) {
        zone.mitigated = true;
        break;
      }
    }
    out.push(zone);
  }
  return out;
}
