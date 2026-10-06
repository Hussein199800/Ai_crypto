import { percentText, priceText } from "@/lib/formatters";
import { PHASE_LABELS, RISK_LABELS, TREND_LABELS } from "@/lib/formatters/labels";
import { TIMEFRAME_LABELS } from "@/lib/timeframes";
import type {
  DataQualityReport,
  IndicatorSignal,
  KeyLevels,
  MarketContext,
  MomentumAnalysis,
  ReportSummary,
  RiskAssessment,
  ScoreResult,
  TrendAnalysis,
  VolumeAnalysis,
} from "@/types/analysis";
import type { Timeframe } from "@/types/market";

export interface SummaryInput {
  display: string;
  isMarketIndicator: boolean;
  primaryTf: Timeframe;
  scoring: ScoreResult;
  trend: TrendAnalysis;
  momentum: MomentumAnalysis;
  volume: VolumeAnalysis;
  market: MarketContext;
  levels: KeyLevels;
  risk: RiskAssessment;
  dataQuality: DataQualityReport;
  signals: IndicatorSignal[];
}

function topSignals(signals: IndicatorSignal[], dir: "positive" | "negative", n: number) {
  const seen = new Set<string>();
  return signals
    .filter((s) => s.available && s.direction === dir)
    .sort((a, b) => (dir === "positive" ? b.contribution - a.contribution : a.contribution - b.contribution))
    .filter((s) => {
      if (seen.has(s.key)) return false;
      seen.add(s.key);
      return true;
    })
    .slice(0, n);
}

export function buildSummary(i: SummaryInput): ReportSummary {
  const s = i.scoring;
  const strengths = topSignals(i.signals, "positive", 5).map((x) => `${x.nameAr} (${x.nameEn}): ${x.status}`);
  const weaknesses = topSignals(i.signals, "negative", 5).map((x) => `${x.nameAr} (${x.nameEn}): ${x.status}`);
  if (strengths.length === 0) strengths.push("لا توجد عوامل إيجابية بارزة حاليًا.");
  if (weaknesses.length === 0) weaknesses.push("لا توجد عوامل سلبية بارزة حاليًا.");

  const risks = [
    ...i.risk.factors,
    ...i.volume.warnings,
    ...i.dataQuality.issues.filter((x) => x.severity !== "info").map((x) => x.message),
  ].slice(0, 7);
  if (risks.length === 0) risks.push(`مستوى المخاطرة ${RISK_LABELS[i.risk.level]} وفق المعطيات الحالية، مع بقاء مخاطر السوق العامة قائمة دائمًا.`);

  const watch: string[] = [];
  if (i.levels.resistance1 != null) watch.push(`إغلاق ${TIMEFRAME_LABELS[i.primaryTf]} فوق المقاومة ${priceText(i.levels.resistance1)}`);
  if (i.levels.support1 != null) watch.push(`صمود الدعم ${priceText(i.levels.support1)}`);
  watch.push("اتجاه هيمنة تيثر USDT.D (ارتفاعها القوي سلبي لشهية المخاطرة)");
  watch.push("تغيرات هيمنة البيتكوين BTC.D مع اتجاه إجمالي السوق");
  if (i.momentum.divergence.type !== "NONE") watch.push(i.momentum.divergence.description);
  if (i.volume.supportedByVolume === false) watch.push("عودة الحجم لتأكيد أي صعود");

  const technical = `على الإطار المرجعي (${TIMEFRAME_LABELS[i.primaryTf]}): ${i.trend.description} ${i.momentum.description} ${i.volume.description}`;
  const market = i.market.available
    ? `${PHASE_LABELS[i.market.phase]}. اتجاه السوق العام ${TREND_LABELS[i.market.marketTrend]}${
        i.market.totalChange24h != null ? ` (إجمالي السوق ${percentText(i.market.totalChange24h)} خلال 24 ساعة)` : ""
      }. ${i.market.relations.slice(1, 3).join(" ")}`
    : "بيانات السوق العامة غير متاحة حاليًا، لذلك لم يُربط التقرير بحالة السوق.";

  const reasons: string[] = [];
  if (i.isMarketIndicator) {
    reasons.push("هذا الأصل مؤشر سوقي أو عملة مستقرة، ولا تُصدر له توصيات شراء أو بيع مباشرة.");
  }
  reasons.push(`الدرجة بعد تعديل جودة البيانات ${s.adjustedScore}/100 (${s.bandLabel})، والدرجة الخام ${s.rawScore}.`);
  reasons.push(`مستوى الثقة ${s.confidence}%، مع ${s.counts.positive} عامل إيجابي و${s.counts.negative} عامل سلبي و${s.counts.neutral} محايد.`);
  for (const g of s.guards.slice(0, 2)) reasons.push(g);
  if (strengths[0] && s.counts.positive > 0) reasons.push(`أبرز عامل إيجابي: ${strengths[0]}.`);
  if (weaknesses[0] && s.counts.negative > 0) reasons.push(`أبرز عامل سلبي: ${weaknesses[0]}.`);
  reasons.push(`مستوى المخاطرة ${RISK_LABELS[i.risk.level]}.`);

  const headline = i.isMarketIndicator
    ? `${i.display}: قراءة سوقية — اتجاه ${TREND_LABELS[i.trend.medium]} (درجة ${s.adjustedScore}/100، ثقة ${s.confidence}%)`
    : `${i.display}: ${s.recommendationLabel} — درجة ${s.adjustedScore}/100 وثقة ${s.confidence}%`;

  return {
    headline,
    technical,
    market,
    strengths,
    weaknesses,
    risks,
    watch: watch.slice(0, 6),
    decision: s.decision,
    decisionLabel: s.decisionLabel,
    decisionReasons: reasons.slice(0, 6),
  };
}
