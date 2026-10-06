import type { OHLCV, Timeframe } from "@/types/market";

export const TIMEFRAME_MS: Record<Timeframe, number> = {
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
};

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  "15m": "15 دقيقة",
  "1h": "ساعة",
  "4h": "4 ساعات",
  "1d": "يومي",
  "1w": "أسبوعي",
};

/** عدد الفترات في السنة لكل إطار — لحساب التقلب السنوي */
export const PERIODS_PER_YEAR: Record<Timeframe, number> = {
  "15m": 35_040,
  "1h": 8_760,
  "4h": 2_190,
  "1d": 365,
  "1w": 52,
};

/** بداية الشمعة التي تحتوي الوقت المعطى (الأسبوع يبدأ الإثنين كما في Binance) */
export function alignTime(ms: number, tf: Timeframe): number {
  if (tf === "1w") {
    const MONDAY_OFFSET = 4 * 86_400_000; // 1970-01-01 كان خميسًا
    const w = TIMEFRAME_MS["1w"];
    return Math.floor((ms - MONDAY_OFFSET) / w) * w + MONDAY_OFFSET;
  }
  const size = TIMEFRAME_MS[tf];
  return Math.floor(ms / size) * size;
}

/** الشموع المكتملة فقط (تستبعد الشمعة الجارية التي لم تُغلق بعد) */
export function closedCandles(candles: OHLCV[], tf: Timeframe, now = Date.now()): OHLCV[] {
  const size = TIMEFRAME_MS[tf];
  return candles.filter((c) => c.time + size <= now);
}

/**
 * تجميع نقاط زمنية (وقت، قيمة) في شموع. يُستخدم عندما يوفّر المزود نقاط أسعار فقط
 * (مثل CoinGecko market_chart أو لقطات السوق المحفوظة).
 */
export function aggregatePoints(
  points: [number, number][],
  tf: Timeframe,
  volumes?: [number, number][],
): OHLCV[] {
  const buckets = new Map<number, OHLCV & { vSum: number; vCount: number }>();
  const volMap = new Map<number, number>();
  if (volumes) for (const [t, v] of volumes) volMap.set(t, v);
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  for (const [t, v] of sorted) {
    if (!Number.isFinite(v)) continue;
    const key = alignTime(t, tf);
    const b = buckets.get(key);
    const vol = volMap.get(t) ?? 0;
    if (!b) {
      buckets.set(key, { time: key, open: v, high: v, low: v, close: v, volume: 0, vSum: vol, vCount: vol ? 1 : 0 });
    } else {
      b.high = Math.max(b.high, v);
      b.low = Math.min(b.low, v);
      b.close = v;
      if (vol) {
        b.vSum += vol;
        b.vCount += 1;
      }
    }
  }
  const out = [...buckets.values()].sort((a, b) => a.time - b.time);
  // افتتاح كل شمعة = إغلاق السابقة لاستمرارية السلسلة
  for (let i = 1; i < out.length; i++) {
    out[i].open = out[i - 1].close;
    out[i].high = Math.max(out[i].high, out[i].open);
    out[i].low = Math.min(out[i].low, out[i].open);
  }
  return out.map(({ vSum, vCount, ...c }) => ({ ...c, volume: vCount ? vSum / vCount : 0 }));
}
