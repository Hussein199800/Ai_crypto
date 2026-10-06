import { CATEGORY_LABELS, CATEGORY_WEIGHTS, SCORING_RULES, SIGNAL_BANDS } from "@/config/scoring";
import { BAND_LABELS, DECISION_LABELS, RECOMMENDATION_LABELS } from "@/lib/formatters/labels";
import { clamp } from "@/lib/indicators/utils";
import type {
  Decision,
  IndicatorSignal,
  Recommendation,
  ScoreBreakdown,
  ScoreCategory,
  ScoreResult,
  SignalBand,
  SignalCounts,
  SignalDirection,
  TrendDirection,
} from "@/types/analysis";

/** تحويل الدرجة (-1..1) إلى اتجاه */
export function directionOf(score: number): SignalDirection {
  if (score > 0.15) return "positive";
  if (score < -0.15) return "negative";
  return "neutral";
}

/** متوسط مرجح لدرجات الإشارات المتاحة في فئة */
export function categoryAverage(signals: IndicatorSignal[]): number | null {
  const avail = signals.filter((s) => s.available);
  const wsum = avail.reduce((s, x) => s + x.weight, 0);
  if (wsum === 0) return null;
  return avail.reduce((s, x) => s + x.score * x.weight, 0) / wsum;
}

export function countSignals(signals: IndicatorSignal[]): SignalCounts {
  const c: SignalCounts = { positive: 0, negative: 0, neutral: 0 };
  for (const s of signals) if (s.available) c[s.direction]++;
  return c;
}

export function bandOf(score: number): SignalBand {
  if (score >= SIGNAL_BANDS.strongPositive) return "STRONG_POSITIVE";
  if (score >= SIGNAL_BANDS.cautiousPositive) return "CAUTIOUS_POSITIVE";
  if (score >= SIGNAL_BANDS.neutral) return "NEUTRAL";
  if (score >= SIGNAL_BANDS.cautiousNegative) return "CAUTIOUS_NEGATIVE";
  return "STRONG_NEGATIVE";
}

export interface ScoreInput {
  /** درجة كل فئة (-1..1) أو null إن لم تتوفر */
  categories: Partial<Record<ScoreCategory, number | null>>;
  /** جميع الإشارات المستخدمة (للعدّ وحساب التوافق) */
  signals: IndicatorSignal[];
  dataQuality: number;
  insufficientData: boolean;
  /** اتجاهات الأطر الزمنية المستخدمة مع أوزانها */
  timeframeTrends: { trend: TrendDirection; weight: number }[];
  /** الاتجاه طويل المدى ومدى قوته — لتقرير "بيع محتمل" */
  longTrend: TrendDirection;
  trendStrength: number | null;
  /** للمؤشرات السوقية والعملات المستقرة لا تُصدر توصية شراء/بيع */
  isMarketIndicator: boolean;
  /** نسبة تغطية المؤشرات المتاحة 0..1 */
  coverage: number;
  /**
   * حصة الوزن الإيجابي من مجموع الأوزان الاتجاهية (0..1) مرجحة بأوزان الأطر الزمنية.
   * إن لم تُمرَّر تُحسب من عدد الإشارات.
   */
  positiveShare?: number;
  weights?: Record<ScoreCategory, number>;
}

/**
 * نظام التقييم:
 * 1) الدرجة الخام = متوسط مرجح لدرجات الفئات (50 = محايد).
 * 2) الدرجة المعدلة = تقريب الدرجة نحو 50 بحسب جودة البيانات.
 * 3) الثقة = جودة البيانات + توافق الإشارات + توافق الأطر الزمنية + التغطية.
 * 4) حواجز أمان: التضارب أو نقص البيانات أو ضعف الثقة ← "محايد / انتظار".
 */
export function computeScore(input: ScoreInput): ScoreResult {
  const weights = input.weights ?? CATEGORY_WEIGHTS;
  const breakdown: ScoreBreakdown[] = [];
  let wsum = 0;
  let acc = 0;
  for (const cat of Object.keys(weights) as ScoreCategory[]) {
    const raw = input.categories[cat];
    const available = raw != null && Number.isFinite(raw);
    const score100 = available ? 50 + 50 * clamp(raw!, -1, 1) : null;
    if (available) {
      wsum += weights[cat];
      acc += weights[cat] * score100!;
    }
    breakdown.push({ category: cat, labelAr: CATEGORY_LABELS[cat], weight: weights[cat], score: score100 === null ? null : Math.round(score100), weightedPoints: 0, available });
  }
  const rawScore = wsum > 0 ? acc / wsum : 50;
  for (const b of breakdown) {
    if (b.available && b.score !== null) b.weightedPoints = Math.round(((b.weight / wsum) * (b.score - 50)) * 10) / 10;
  }

  const qualityFactor = clamp(input.dataQuality / 100, SCORING_RULES.minQualityFactor, 1);
  const adjustedScore = 50 + (rawScore - 50) * qualityFactor;

  const counts = countSignals(input.signals);
  const total = counts.positive + counts.negative + counts.neutral;
  const directional = counts.positive + counts.negative;
  const balance = directional > 0 ? Math.round((counts.positive / directional) * 100) : 50;

  // توافق الإشارات
  const agreement = total > 0 ? Math.abs(counts.positive - counts.negative) / total : 0;
  const overallSign = Math.sign(rawScore - 50);
  const tfW = input.timeframeTrends.reduce((s, t) => s + t.weight, 0);
  const tfAgree =
    tfW > 0 && overallSign !== 0
      ? input.timeframeTrends.reduce((s, t) => s + (Math.sign(trendSign(t.trend)) === overallSign ? t.weight : 0), 0) / tfW
      : 0.5;

  const guards: string[] = [];
  const posShare = input.positiveShare ?? (directional > 0 ? counts.positive / directional : 0.5);
  // تضارب الإشارات: توازن شبه متساوٍ بين الإيجابي والسلبي (مثلًا 45% مقابل 55%)
  const conflictBand = SCORING_RULES.conflictBand;
  const signalConflict = directional >= 4 && Math.abs(posShare - 0.5) <= conflictBand;
  // تضارب الأطر: أطر ذات وزن مؤثر (≥ 25%) في اتجاهين متعاكسين
  const major = input.timeframeTrends.filter((t) => t.weight >= 0.25 && t.trend !== "UNKNOWN");
  const trendConflict = major.some((t) => t.trend === "UP") && major.some((t) => t.trend === "DOWN");
  const conflicted = signalConflict || trendConflict;
  if (conflicted) guards.push("المؤشرات متضاربة بين الإيجابي والسلبي أو بين الأطر الزمنية، لذلك تم تحييد التقييم.");

  let confidence =
    input.dataQuality * 0.45 + agreement * 100 * 0.3 + tfAgree * 100 * 0.15 + clamp(input.coverage, 0, 1) * 100 * 0.1;
  if (conflicted) confidence *= 0.85;
  if (input.insufficientData) confidence = Math.min(confidence, 30);
  // لا يقين كامل في الأسواق — الحد الأقصى 95%
  confidence = Math.round(clamp(confidence, 5, 95));

  const band = bandOf(adjustedScore);
  let recommendation: Recommendation;
  if (input.isMarketIndicator) {
    recommendation = "MARKET_INDICATOR";
  } else if (input.insufficientData) {
    recommendation = "NEUTRAL";
    guards.push("البيانات ناقصة أو غير كافية، لذلك لا تُصدر إشارة قوية.");
  } else if (conflicted) {
    recommendation = "NEUTRAL";
  } else if (confidence < SCORING_RULES.minConfidenceForDirectionalSignal && (band !== "NEUTRAL")) {
    recommendation = "NEUTRAL";
    guards.push(`مستوى الثقة منخفض (${confidence}%)، لذلك تم تحييد الإشارة.`);
  } else {
    recommendation = mapBand(band, confidence, input.longTrend, input.trendStrength, guards);
  }

  const decision = decide(recommendation, adjustedScore, conflicted || input.insufficientData);

  return {
    rawScore: Math.round(rawScore),
    adjustedScore: Math.round(adjustedScore),
    confidence,
    dataQuality: Math.round(input.dataQuality),
    band,
    bandLabel: BAND_LABELS[band],
    recommendation,
    recommendationLabel: RECOMMENDATION_LABELS[recommendation],
    decision,
    decisionLabel: DECISION_LABELS[decision],
    conflicted,
    breakdown,
    counts,
    guards,
    balance,
  };
}

function trendSign(t: TrendDirection) {
  return t === "UP" ? 1 : t === "DOWN" ? -1 : 0;
}

function mapBand(band: SignalBand, confidence: number, longTrend: TrendDirection, strength: number | null, guards: string[]): Recommendation {
  switch (band) {
    case "STRONG_POSITIVE":
      if (confidence < SCORING_RULES.minConfidenceForStrongSignal) {
        guards.push("الدرجة مرتفعة لكن الثقة غير كافية لإشارة قوية، لذلك خُفّضت إلى شراء تدريجي.");
        return "GRADUAL_BUY";
      }
      return "POSSIBLE_BUY";
    case "CAUTIOUS_POSITIVE":
      return "GRADUAL_BUY";
    case "NEUTRAL":
      return "NEUTRAL";
    case "CAUTIOUS_NEGATIVE":
      return "REDUCE_RISK";
    case "STRONG_NEGATIVE":
      // "بيع محتمل" يتطلب اتجاهًا هابطًا مؤكدًا وقويًا وثقة كافية — وإلا "عدم شراء"
      if (longTrend === "DOWN" && (strength ?? 0) >= 25 && confidence >= SCORING_RULES.minConfidenceForStrongSignal) return "POSSIBLE_SELL";
      return "NO_BUY";
  }
}

function decide(rec: Recommendation, score: number, uncertain: boolean): Decision {
  switch (rec) {
    case "POSSIBLE_BUY":
    case "GRADUAL_BUY":
      return "GRADUAL_BUY";
    case "NEUTRAL":
      return uncertain || score < 55 ? "WAIT" : "WATCH";
    case "MARKET_INDICATOR":
      return "WATCH";
    default:
      return "AVOID";
  }
}
