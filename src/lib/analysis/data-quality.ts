import { HORIZON_PRIMARY_TIMEFRAME, HORIZON_TIMEFRAME_WEIGHTS, SCORING_RULES } from "@/config/scoring";
import { TIMEFRAME_LABELS, TIMEFRAME_MS } from "@/lib/timeframes";
import type { DataQualityIssue, DataQualityReport, Horizon } from "@/types/analysis";
import { TIMEFRAMES, type DataMeta, type OHLCVSeries, type Timeframe } from "@/types/market";

export interface DataQualityInput {
  horizon: Horizon;
  series: Partial<Record<Timeframe, OHLCVSeries | null>>;
  overviewMeta: DataMeta | null;
  hasPrice: boolean;
  globalAvailable: boolean;
  globalStale: boolean;
  fearGreedAvailable: boolean;
  /** هل يحتاج الأصل بيانات حجم (المؤشرات السوقية لا تملك حجمًا) */
  expectsVolume: boolean;
  now?: number;
}

/** تقييم جودة البيانات (0..100) مع قائمة بالمشكلات بلغة واضحة */
export function assessDataQuality(input: DataQualityInput): DataQualityReport {
  const now = input.now ?? Date.now();
  const issues: DataQualityIssue[] = [];
  let score = 100;
  const weights = HORIZON_TIMEFRAME_WEIGHTS[input.horizon];
  const primary = HORIZON_PRIMARY_TIMEFRAME[input.horizon];
  const available: Timeframe[] = [];
  let stale = false;
  let isMock = Boolean(input.overviewMeta?.isMock);

  for (const tf of TIMEFRAMES) {
    const s = input.series[tf];
    const w = weights[tf];
    const count = s?.candles.length ?? 0;
    if (s?.meta.isMock) isMock = true;
    if (count >= SCORING_RULES.minCandles) available.push(tf);
    if (w <= 0) continue;
    if (count < SCORING_RULES.minCandles) {
      score -= w * 70;
      issues.push({ severity: w >= 0.3 ? "critical" : "warning", message: `بيانات إطار ${TIMEFRAME_LABELS[tf]} غير كافية (${count} شمعة).` });
      continue;
    }
    if (s!.meta.isStale) {
      stale = true;
    }
    const lastT = s!.candles[count - 1].time;
    const age = now - (lastT + TIMEFRAME_MS[tf]);
    if (age > TIMEFRAME_MS[tf] * 3 && age > 2 * 3_600_000) {
      score -= w * 40;
      stale = true;
      issues.push({ severity: "warning", message: `آخر شمعة على إطار ${TIMEFRAME_LABELS[tf]} قديمة — البيانات ليست لحظية.` });
    }
    if (s!.meta.note?.includes("مُجمّعة")) {
      score -= w * 15;
      issues.push({ severity: "info", message: `شموع إطار ${TIMEFRAME_LABELS[tf]} مُجمّعة من نقاط سعرية والحجم تقديري.` });
    }
  }
  const primaryCount = input.series[primary]?.candles.length ?? 0;
  if (primaryCount >= SCORING_RULES.minCandles && primaryCount < 200) {
    score -= 8;
    issues.push({ severity: "info", message: `أقل من 200 شمعة على الإطار المرجعي — المتوسط EMA 200 غير متاح.` });
  }
  if (!input.hasPrice) {
    score -= 15;
    issues.push({ severity: "warning", message: "السعر الحالي غير متاح من المصدر." });
  }
  if (input.overviewMeta?.isStale) stale = true;
  if (!input.globalAvailable) {
    score -= 10;
    issues.push({ severity: "warning", message: "بيانات السوق العامة (BTC.D / USDT.D / TOTAL) غير متاحة." });
  } else if (input.globalStale) {
    stale = true;
  }
  if (!input.fearGreedAvailable) {
    score -= 3;
    issues.push({ severity: "info", message: "مؤشر الخوف والطمع غير متاح." });
  }
  if (stale) {
    score -= 20;
    issues.push({ severity: "warning", message: "بعض البيانات من ذاكرة مؤقتة قديمة بعد تعذر التحديث — ليست لحظية." });
  }
  if (isMock) {
    issues.unshift({ severity: "warning", message: "بيانات تجريبية (Mock) — لا تعكس السوق الحقيقي ولا تصلح لاتخاذ أي قرار." });
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const primaryOk = primaryCount >= SCORING_RULES.minCandles;
  return {
    score,
    issues,
    timeframesAvailable: available,
    isStale: stale,
    isMock,
    insufficient: score < SCORING_RULES.minDataQuality || !primaryOk,
  };
}
