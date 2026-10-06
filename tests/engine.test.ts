import { describe, expect, it } from "vitest";
import { runAnalysis } from "@/lib/analysis/engine";
import { analysisInput, dominanceFrom, makeCandles, neutralGlobal, overview, series } from "./helpers";
import type { AnalysisInput } from "@/lib/analysis/engine";

const BUY = ["POSSIBLE_BUY", "GRADUAL_BUY"];
const SELL_OR_AVOID = ["REDUCE_RISK", "NO_BUY", "POSSIBLE_SELL"];

function marketFor(up: boolean): Partial<AnalysisInput> {
  const btc = makeCandles({ n: 250, drift: up ? 0.004 : -0.004, noise: 0.01, seed: 2 });
  const g = neutralGlobal({ marketCapChange24h: up ? 2 : -2 });
  return { btcDaily: btc, ethDaily: btc, ethBtcDaily: btc, global: g, dominance: dominanceFrom(g, { usdtDominanceChange24h: up ? -0.1 : 0.2 }) };
}

const UP = { drift: 0.006, noise: 0.01, wave: 0.004, volumeTrend: 0.003, seed: 5 };
const DOWN = { drift: -0.006, noise: 0.01, wave: 0.004, volumeTrend: 0.003, seed: 6 };

describe("محرك التحليل", () => {
  it("اتجاه صاعد واضح مع حجم داعم ← إشارة شراء (تدريجي أو محتمل)", () => {
    const r = runAnalysis(analysisInput(UP, marketFor(true))).report;
    expect(r.scoring.adjustedScore).toBeGreaterThanOrEqual(65);
    expect(BUY).toContain(r.scoring.recommendation);
    expect(r.trend.medium).toBe("UP");
    expect(r.scoring.counts.positive).toBeGreaterThan(r.scoring.counts.negative);
  });

  it("تتغير التوصية عند تغير المؤشرات (صاعد ← هابط)", () => {
    const up = runAnalysis(analysisInput(UP, marketFor(true))).report.scoring;
    const down = runAnalysis(analysisInput(DOWN, marketFor(false))).report.scoring;
    expect(down.adjustedScore).toBeLessThan(45);
    expect(SELL_OR_AVOID).toContain(down.recommendation);
    expect(up.recommendation).not.toBe(down.recommendation);
  });

  it("RSI منخفض جدًا في اتجاه هابط لا يعطي إشارة شراء", () => {
    const r = runAnalysis(analysisInput(DOWN, marketFor(false))).report;
    expect(r.momentum.rsi!).toBeLessThan(25);
    expect(BUY).not.toContain(r.scoring.recommendation);
    const rsiSignal = r.timeframes.find((t) => t.timeframe === "1d")!.signals.find((s) => s.key === "rsi14")!;
    expect(rsiSignal.direction).toBe("neutral");
    expect(rsiSignal.status).toContain("ليس إشارة شراء");
  });

  it("RSI مرتفع جدًا في اتجاه صاعد لا يعطي إشارة بيع", () => {
    const r = runAnalysis(analysisInput(UP, marketFor(true))).report;
    expect(r.momentum.rsi!).toBeGreaterThan(75);
    expect(r.scoring.recommendation).not.toBe("POSSIBLE_SELL");
    const rsiSignal = r.timeframes.find((t) => t.timeframe === "1d")!.signals.find((s) => s.key === "rsi14")!;
    expect(rsiSignal.status).toContain("تحذير");
  });

  it("البيانات الناقصة ← محايد، ثقة منخفضة، ومستويات غير متاحة بدل أرقام مخترعة", () => {
    const r = runAnalysis(analysisInput({ ...UP, n: 30 }, marketFor(true))).report;
    expect(r.dataQuality.insufficient).toBe(true);
    expect(r.scoring.recommendation).toBe("NEUTRAL");
    expect(r.scoring.confidence).toBeLessThanOrEqual(30);
    expect(r.levels.support1).toBeNull();
    expect(r.levels.resistance1).toBeNull();
    expect(r.levels.entryZone).toBeNull();
    expect(r.levels.targets).toEqual([]);
    expect(r.scoring.guards.join(" ")).toContain("ناقصة");
  });

  it("غياب أطر زمنية مهمة يخفض جودة البيانات والثقة", () => {
    const full = runAnalysis(analysisInput(UP, marketFor(true))).report;
    const input = analysisInput(UP, marketFor(true));
    input.series["1d"] = null;
    input.series["1w"] = null;
    const partial = runAnalysis(input).report;
    expect(partial.dataQuality.score).toBeLessThan(full.dataQuality.score);
    expect(partial.scoring.confidence).toBeLessThan(full.scoring.confidence);
    expect(partial.dataQuality.issues.some((i) => i.message.includes("يومي"))).toBe(true);
  });

  it("البيانات القديمة تُوسم بأنها ليست لحظية وتخفض الجودة", () => {
    const input = analysisInput(UP, marketFor(true));
    input.series["4h"] = series(input.series["4h"]!.candles, "4h", { isStale: true });
    const r = runAnalysis(input).report;
    expect(r.dataQuality.isStale).toBe(true);
    expect(r.dataQuality.issues.map((i) => i.message).join(" ")).toContain("ليست لحظية");
    expect(r.dataQuality.score).toBeLessThan(100);
  });

  it("شموع متوقفة منذ أيام ← تنبيه بأنها ليست لحظية", () => {
    const old = Date.UTC(2026, 8, 20);
    const input = analysisInput({ ...UP, now: old }, marketFor(true));
    const r = runAnalysis(input).report;
    expect(r.dataQuality.isStale).toBe(true);
  });

  it("ارتفاع USDT.D بقوة يُضعف فئة السوق العام", () => {
    const g = neutralGlobal();
    const base = analysisInput(UP, { global: g, dominance: dominanceFrom(g, { usdtDominanceChange24h: -0.1 }) });
    const risky = analysisInput(UP, { global: g, dominance: dominanceFrom(g, { usdtDominanceChange24h: 0.4 }) });
    const m1 = runAnalysis(base).report.scoring.breakdown.find((b) => b.category === "market")!.score!;
    const m2 = runAnalysis(risky).report.scoring.breakdown.find((b) => b.category === "market")!.score!;
    expect(m2).toBeLessThan(m1);
    expect(runAnalysis(risky).report.market.relations.join(" ")).toContain("تيثر");
  });

  it("BTC.D وUSDT.D يرتفعان معًا ← حالة دفاعية Risk-Off", () => {
    const g = neutralGlobal({ marketCapChange24h: -1 });
    const r = runAnalysis(analysisInput(UP, { global: g, dominance: dominanceFrom(g, { btcDominanceChange24h: 0.4, usdtDominanceChange24h: 0.2 }) })).report;
    expect(r.market.phase).toBe("RISK_OFF");
    expect(r.market.signals.find((s) => s.key === "btcDominance")!.direction).toBe("negative");
  });

  it("BTC.D ينخفض والسوق يرتفع ← إيجابي للعملات البديلة", () => {
    const g = neutralGlobal({ marketCapChange24h: 3 });
    const r = runAnalysis(analysisInput(UP, { global: g, dominance: dominanceFrom(g, { btcDominanceChange24h: -0.5, usdtDominanceChange24h: -0.1 }) })).report;
    expect(r.market.phase).toBe("ALTCOIN_SEASON");
    expect(r.market.signals.find((s) => s.key === "btcDominance")!.direction).toBe("positive");
  });

  it("المؤشرات السوقية (BTC.D) لا تُعطى توصية شراء", () => {
    const input = analysisInput({ ...UP, volume: 0 }, { symbol: "BTC.D", overview: overview(56, { symbol: "BTC.D", kind: "DOMINANCE", marketCap: null }) });
    const r = runAnalysis(input).report;
    expect(r.scoring.recommendation).toBe("MARKET_INDICATOR");
    expect(r.indicatorReading).toContain("ليست");
  });

  it("مجموع مساهمات المؤشرات يفسر انحراف الدرجة الخام عن 50", () => {
    const r = runAnalysis(analysisInput(UP, marketFor(true))).report;
    const sum = [...r.timeframes.flatMap((t) => t.signals), ...r.market.signals].reduce((s, x) => s + (x.available ? x.contribution : 0), 0);
    expect(Math.abs(50 + sum - r.scoring.rawScore)).toBeLessThanOrEqual(1.5);
  });

  it("يتضمن التقرير ثلاثة سيناريوهات وإخلاء مسؤولية ولا يستخدم لغة مضمونة", () => {
    const r = runAnalysis(analysisInput(UP, marketFor(true))).report;
    expect(r.scenarios.map((s) => s.type)).toEqual(["POSITIVE", "NEUTRAL", "NEGATIVE"]);
    expect(r.disclaimer).toContain("ليس نصيحة مالية");
    const text = JSON.stringify(r);
    expect(text).not.toMatch(/سترتفع حتمًا|مضمون الربح|توصية استثمارية مؤكدة/);
    expect(r.summary.decisionReasons.length).toBeGreaterThanOrEqual(3);
    expect(r.summary.decisionReasons.length).toBeLessThanOrEqual(6);
  });
});
