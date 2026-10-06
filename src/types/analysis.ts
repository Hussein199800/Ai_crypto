import type { AssetKind, AssetOverview, Timeframe } from "@/types/market";

export type SignalDirection = "positive" | "negative" | "neutral";

/** فئات التقييم — تطابق أوزان ملف الإعدادات config/scoring.ts */
export type ScoreCategory =
  | "trend"
  | "momentum"
  | "movingAverages"
  | "volume"
  | "levels"
  | "volatility"
  | "market"
  | "dataNews";

export type Horizon = "SHORT" | "MEDIUM" | "LONG";

export type Recommendation =
  | "POSSIBLE_BUY"
  | "GRADUAL_BUY"
  | "NEUTRAL"
  | "REDUCE_RISK"
  | "NO_BUY"
  | "POSSIBLE_SELL"
  | "MARKET_INDICATOR";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type Decision = "WAIT" | "WATCH" | "GRADUAL_BUY" | "AVOID";
export type SignalBand =
  | "STRONG_POSITIVE"
  | "CAUTIOUS_POSITIVE"
  | "NEUTRAL"
  | "CAUTIOUS_NEGATIVE"
  | "STRONG_NEGATIVE";

export type TrendDirection = "UP" | "DOWN" | "SIDEWAYS" | "UNKNOWN";
export type MarketPhase = "BITCOIN_SEASON" | "ALTCOIN_SEASON" | "RISK_OFF" | "RISK_ON" | "NEUTRAL";

export interface IndicatorSignal {
  key: string;
  nameAr: string;
  nameEn: string;
  category: ScoreCategory;
  value: number | null;
  valueText: string;
  status: string;
  direction: SignalDirection;
  /** من -1 (سلبي تمامًا) إلى +1 (إيجابي تمامًا) */
  score: number;
  /** الوزن النسبي داخل الفئة */
  weight: number;
  /** المساهمة التقريبية بالنقاط في الدرجة النهائية (تُحسب بعد التجميع) */
  contribution: number;
  explanation: string;
  available: boolean;
}

export interface TimeframeAnalysis {
  timeframe: Timeframe;
  available: boolean;
  candles: number;
  lastClose: number | null;
  lastTime: number | null;
  trend: TrendDirection;
  signals: IndicatorSignal[];
  categoryScores: Partial<Record<ScoreCategory, number>>;
  /** 0..100 */
  score: number | null;
  counts: SignalCounts;
  note?: string;
}

export interface SignalCounts {
  positive: number;
  negative: number;
  neutral: number;
}

export interface MovingAverageState {
  key: string;
  label: string;
  value: number | null;
  above: boolean | null;
  distancePct: number | null;
}

export interface SwingPoint {
  time: number;
  price: number;
}

export interface TrendAnalysis {
  short: TrendDirection;
  medium: TrendDirection;
  long: TrendDirection;
  strength: number | null;
  strengthLabel: string;
  priceVsMAs: MovingAverageState[];
  cross: { type: "GOLDEN" | "DEATH" | "NONE"; timeframe: Timeframe | null; barsAgo: number | null; description: string };
  swings: {
    highs: SwingPoint[];
    lows: SwingPoint[];
    structure: "HIGHER_HIGHS" | "LOWER_LOWS" | "MIXED" | "UNKNOWN";
    description: string;
  };
  zone: "NEAR_SUPPORT" | "NEAR_RESISTANCE" | "MIDDLE" | "UNKNOWN";
  zoneDescription: string;
  description: string;
}

export interface MomentumAnalysis {
  rsi: number | null;
  rsiState: string;
  macd: { macd: number; signal: number; histogram: number } | null;
  roc: number | null;
  buyPressure: number | null;
  divergence: { type: "BULLISH" | "BEARISH" | "NONE"; description: string };
  trend: "IMPROVING" | "WEAKENING" | "STABLE" | "UNKNOWN";
  description: string;
}

export interface VolumeAnalysis {
  currentVolume: number | null;
  averageVolume: number | null;
  volumeChangePct: number | null;
  volume24h: number | null;
  volumeToMarketCap: number | null;
  liquidityLevel: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  spreadPct: number | null;
  supportedByVolume: boolean | null;
  obvTrend: TrendDirection;
  warnings: string[];
  description: string;
}

export interface MarketContext {
  available: boolean;
  btcTrend: TrendDirection;
  ethTrend: TrendDirection;
  ethBtcTrend: TrendDirection;
  btcDominance: number | null;
  btcDominanceChange24h: number | null;
  usdtDominance: number | null;
  usdtDominanceChange24h: number | null;
  totalMarketCap: number | null;
  totalChange24h: number | null;
  total2: number | null;
  total3: number | null;
  fearGreed: { value: number; classificationAr: string } | null;
  phase: MarketPhase;
  marketTrend: TrendDirection;
  signals: IndicatorSignal[];
  relations: string[];
  dominanceMethod: string;
  dataTime: string | null;
}

export interface LevelValue {
  label: string;
  value: number | null;
}

export interface Scenario {
  type: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  title: string;
  /** ترجيح نسبي وصفي — ليس احتمالًا مضمونًا */
  likelihood: "أعلى نسبيًا" | "متوسط" | "أقل نسبيًا";
  conditions: string[];
  levels: LevelValue[];
  confirmations: string[];
  invalidations: string[];
  watch: string[];
  range?: { low: number | null; high: number | null };
}

export interface KeyLevels {
  available: boolean;
  support1: number | null;
  support2: number | null;
  resistance1: number | null;
  resistance2: number | null;
  entryZone: { low: number; high: number } | null;
  invalidation: number | null;
  targets: number[];
  fibonacci: { level: number; price: number }[];
  method: string;
  notes: string[];
}

export interface ScoreBreakdown {
  category: ScoreCategory;
  labelAr: string;
  weight: number;
  /** 0..100 أو null إن لم تتوفر بيانات */
  score: number | null;
  weightedPoints: number;
  available: boolean;
}

export interface ScoreResult {
  rawScore: number;
  adjustedScore: number;
  confidence: number;
  dataQuality: number;
  band: SignalBand;
  bandLabel: string;
  recommendation: Recommendation;
  recommendationLabel: string;
  decision: Decision;
  decisionLabel: string;
  conflicted: boolean;
  breakdown: ScoreBreakdown[];
  counts: SignalCounts;
  /** أسباب تعديل التقييم (تضارب، نقص بيانات...) */
  guards: string[];
  /** نسبة العوامل الإيجابية من مجموع العوامل الاتجاهية 0..100 */
  balance: number;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  atrPct: number | null;
  volatility30d: number | null;
  drawdownFromAth: number | null;
  maxDrawdown90d: number | null;
  factors: string[];
}

export interface DataQualityIssue {
  severity: "info" | "warning" | "critical";
  message: string;
}

export interface DataQualityReport {
  score: number;
  issues: DataQualityIssue[];
  timeframesAvailable: Timeframe[];
  isStale: boolean;
  isMock: boolean;
  insufficient: boolean;
}

export interface ReportSummary {
  headline: string;
  technical: string;
  market: string;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  watch: string[];
  decision: Decision;
  decisionLabel: string;
  decisionReasons: string[];
}

export interface AnalysisReportData {
  version: 1;
  symbol: string;
  display: string;
  name: string;
  nameAr: string;
  kind: AssetKind;
  horizon: Horizon;
  generatedAt: string;
  overview: AssetOverview;
  scoring: ScoreResult;
  risk: RiskAssessment;
  dataQuality: DataQualityReport;
  timeframes: TimeframeAnalysis[];
  trend: TrendAnalysis;
  momentum: MomentumAnalysis;
  volume: VolumeAnalysis;
  market: MarketContext;
  levels: KeyLevels;
  scenarios: Scenario[];
  summary: ReportSummary;
  /** قراءة خاصة للمؤشرات السوقية والعملات المستقرة */
  indicatorReading: string | null;
  sources: string[];
  isMock: boolean;
  disclaimer: string;
}

/** تقرير محفوظ كما يُعاد من الـ API */
export interface ReportRecord {
  id: string | null;
  symbol: string;
  assetName: string;
  userId: string | null;
  isPublic: boolean;
  horizon: Horizon;
  recommendation: Recommendation;
  riskLevel: RiskLevel;
  rawScore: number;
  score: number;
  confidence: number;
  dataQuality: number;
  priceAtAnalysis: number | null;
  change24h: number | null;
  isMock: boolean;
  createdAt: string;
  persisted: boolean;
  isOwner?: boolean;
  data?: AnalysisReportData;
}
