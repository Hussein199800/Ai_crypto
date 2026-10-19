import type { OHLCV } from "@/types/market";

export interface CandleAnatomy {
  direction: "UP" | "DOWN" | "FLAT";
  bodyPct: number;
  upperWickPct: number;
  lowerWickPct: number;
  rangeVsAtr: number | null;
  patterns: { nameAr: string; bias: "bullish" | "bearish" | "neutral" }[];
}

/** تشريح الشمعة: نسب الجسم والذيول وأنماط الشمعة الواحدة والشمعتين */
export function candleAnatomy(c: OHLCV, prev: OHLCV | null, atr: number | null, priorTrend: "UP" | "DOWN" | "SIDEWAYS" | "UNKNOWN"): CandleAnatomy {
  const range = c.high - c.low || 1e-12;
  const body = Math.abs(c.close - c.open);
  const upper = c.high - Math.max(c.open, c.close);
  const lower = Math.min(c.open, c.close) - c.low;
  const patterns: CandleAnatomy["patterns"] = [];
  const bodyR = body / range;
  if (bodyR < 0.1) patterns.push({ nameAr: "دوجي — تردد بين المشترين والبائعين", bias: "neutral" });
  if (bodyR > 0.9) patterns.push({ nameAr: c.close > c.open ? "ماروبوزو صاعد — سيطرة شرائية" : "ماروبوزو هابط — سيطرة بيعية", bias: c.close > c.open ? "bullish" : "bearish" });
  if (lower >= 2 * body && upper <= body * 0.5 && bodyR >= 0.1) {
    patterns.push(priorTrend === "DOWN" ? { nameAr: "مطرقة بعد هبوط — رفض للأسعار المنخفضة", bias: "bullish" } : { nameAr: "رجل معلق — ذيل سفلي طويل", bias: priorTrend === "UP" ? "bearish" : "neutral" });
  }
  if (upper >= 2 * body && lower <= body * 0.5 && bodyR >= 0.1) {
    patterns.push(priorTrend === "UP" ? { nameAr: "شهاب بعد صعود — رفض للأسعار المرتفعة", bias: "bearish" } : { nameAr: "مطرقة مقلوبة — ذيل علوي طويل", bias: priorTrend === "DOWN" ? "bullish" : "neutral" });
  }
  if (prev) {
    const pBodyHi = Math.max(prev.open, prev.close);
    const pBodyLo = Math.min(prev.open, prev.close);
    if (c.close > c.open && prev.close < prev.open && c.close >= pBodyHi && c.open <= pBodyLo) patterns.push({ nameAr: "ابتلاع شرائي", bias: "bullish" });
    if (c.close < c.open && prev.close > prev.open && c.open >= pBodyHi && c.close <= pBodyLo) patterns.push({ nameAr: "ابتلاع بيعي", bias: "bearish" });
    if (c.high <= prev.high && c.low >= prev.low) patterns.push({ nameAr: "شمعة داخلية — انضغاط", bias: "neutral" });
  }
  return {
    direction: c.close > c.open ? "UP" : c.close < c.open ? "DOWN" : "FLAT",
    bodyPct: bodyR * 100,
    upperWickPct: (upper / range) * 100,
    lowerWickPct: (lower / range) * 100,
    rangeVsAtr: atr ? range / atr : null,
    patterns,
  };
}
