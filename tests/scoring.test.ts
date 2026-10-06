import { describe, expect, it } from "vitest";
import { bandOf, computeScore, type ScoreInput } from "@/lib/scoring";
import { makeSignal } from "@/lib/analysis/signal";
import type { IndicatorSignal, ScoreCategory } from "@/types/analysis";

function signals(pos: number, neg: number, neu = 0): IndicatorSignal[] {
  const mk = (score: number, i: number) =>
    makeSignal({ key: `k${i}`, nameAr: "x", nameEn: "x", category: "trend", value: null, valueText: "", status: "", score, explanation: "" });
  return [...Array.from({ length: pos }, (_, i) => mk(0.8, i)), ...Array.from({ length: neg }, (_, i) => mk(-0.8, 100 + i)), ...Array.from({ length: neu }, (_, i) => mk(0, 200 + i))];
}

function input(level: number, over: Partial<ScoreInput> = {}): ScoreInput {
  const cats: Partial<Record<ScoreCategory, number>> = { trend: level, momentum: level, movingAverages: level, volume: level, levels: level, volatility: level, market: level, dataNews: level };
  const pos = level > 0 ? 20 : 2;
  const neg = level < 0 ? 20 : 2;
  return {
    categories: cats,
    signals: signals(pos, neg, 3),
    dataQuality: 95,
    insufficientData: false,
    timeframeTrends: [
      { trend: level > 0 ? "UP" : level < 0 ? "DOWN" : "SIDEWAYS", weight: 0.35 },
      { trend: level > 0 ? "UP" : level < 0 ? "DOWN" : "SIDEWAYS", weight: 0.3 },
    ],
    longTrend: level > 0 ? "UP" : level < 0 ? "DOWN" : "SIDEWAYS",
    trendStrength: 35,
    isMarketIndicator: false,
    coverage: 1,
    ...over,
  };
}

describe("نظام الدرجات", () => {
  it("نطاقات الإشارة حسب المواصفة", () => {
    expect(bandOf(85)).toBe("STRONG_POSITIVE");
    expect(bandOf(80)).toBe("STRONG_POSITIVE");
    expect(bandOf(70)).toBe("CAUTIOUS_POSITIVE");
    expect(bandOf(50)).toBe("NEUTRAL");
    expect(bandOf(35)).toBe("CAUTIOUS_NEGATIVE");
    expect(bandOf(10)).toBe("STRONG_NEGATIVE");
  });

  it("درجة مرتفعة وثقة كافية ← شراء محتمل", () => {
    const r = computeScore(input(0.8));
    expect(r.rawScore).toBe(90);
    expect(r.recommendation).toBe("POSSIBLE_BUY");
    expect(r.decision).toBe("GRADUAL_BUY");
    expect(r.confidence).toBeLessThanOrEqual(95);
  });

  it("درجة مرتفعة مع ثقة منخفضة ← شراء تدريجي فقط", () => {
    const r = computeScore(input(0.8, { dataQuality: 80, signals: signals(6, 4, 10), timeframeTrends: [{ trend: "UP", weight: 0.2 }], coverage: 0.2 }));
    expect(r.adjustedScore).toBeGreaterThanOrEqual(80);
    expect(r.confidence).toBeLessThan(60);
    expect(r.recommendation).toBe("GRADUAL_BUY");
    expect(r.recommendation).not.toBe("POSSIBLE_BUY");
  });

  it("درجة إيجابية بحذر ← شراء تدريجي", () => {
    expect(computeScore(input(0.4)).recommendation).toBe("GRADUAL_BUY");
  });

  it("درجة سلبية قوية مع اتجاه هابط قوي ← بيع محتمل، وبدون اتجاه قوي ← عدم شراء", () => {
    expect(computeScore(input(-0.8)).recommendation).toBe("POSSIBLE_SELL");
    expect(computeScore(input(-0.8, { trendStrength: 15 })).recommendation).toBe("NO_BUY");
    expect(computeScore(input(-0.8, { longTrend: "SIDEWAYS" })).recommendation).toBe("NO_BUY");
  });

  it("درجة سلبية بحذر ← تقليل المخاطرة", () => {
    expect(computeScore(input(-0.4)).recommendation).toBe("REDUCE_RISK");
  });

  it("تضارب المؤشرات ← محايد / انتظار", () => {
    const r = computeScore(input(0.5, { signals: signals(10, 10, 2) }));
    expect(r.conflicted).toBe(true);
    expect(r.recommendation).toBe("NEUTRAL");
    expect(r.guards.join(" ")).toContain("متضاربة");
  });

  it("تضارب الأطر الزمنية المؤثرة ← محايد", () => {
    const r = computeScore(input(0.5, { timeframeTrends: [{ trend: "UP", weight: 0.35 }, { trend: "DOWN", weight: 0.35 }] }));
    expect(r.conflicted).toBe(true);
    expect(r.recommendation).toBe("NEUTRAL");
  });

  it("البيانات الناقصة ← لا توصية قوية وثقة منخفضة", () => {
    const r = computeScore(input(0.8, { insufficientData: true, dataQuality: 20 }));
    expect(r.recommendation).toBe("NEUTRAL");
    expect(r.confidence).toBeLessThanOrEqual(30);
    // الدرجة المعدلة تقترب من 50 بحسب جودة البيانات
    expect(r.adjustedScore).toBeLessThan(r.rawScore);
    expect(r.adjustedScore).toBe(Math.round(50 + (90 - 50) * 0.3));
  });

  it("خفض جودة البيانات يخفض الثقة", () => {
    expect(computeScore(input(0.5, { dataQuality: 50 })).confidence).toBeLessThan(computeScore(input(0.5, { dataQuality: 100 })).confidence);
  });

  it("المؤشرات السوقية لا تحصل على توصية شراء/بيع", () => {
    expect(computeScore(input(0.8, { isMarketIndicator: true })).recommendation).toBe("MARKET_INDICATOR");
  });

  it("الفئات غير المتاحة تُستبعد ويُعاد تطبيع الأوزان", () => {
    const r = computeScore(input(0, { categories: { trend: 1, momentum: null } }));
    expect(r.rawScore).toBe(100);
    expect(r.breakdown.find((b) => b.category === "momentum")!.available).toBe(false);
  });

  it("الأوزان قابلة للتعديل", () => {
    const weights = { trend: 1, momentum: 0, movingAverages: 0, volume: 0, levels: 0, volatility: 0, market: 0, dataNews: 0 };
    const r = computeScore(input(0, { categories: { trend: -1, momentum: 1 }, weights }));
    expect(r.rawScore).toBe(0);
  });
});
