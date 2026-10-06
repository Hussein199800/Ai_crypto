import type { Horizon, ScoreCategory } from "@/types/analysis";
import type { Timeframe } from "@/types/market";

/**
 * إعدادات نظام التقييم — قابلة للتعديل دون المساس بمنطق التحليل.
 * مجموع الأوزان لا يجب أن يساوي 1 بالضرورة؛ يتم تطبيعها تلقائيًا.
 */
export const CATEGORY_WEIGHTS: Record<ScoreCategory, number> = {
  trend: 0.2, // الاتجاه العام
  momentum: 0.15, // الزخم
  movingAverages: 0.15, // المتوسطات المتحركة
  volume: 0.15, // الحجم والسيولة
  levels: 0.1, // الدعم والمقاومة
  volatility: 0.1, // التقلب والمخاطر
  market: 0.1, // السوق العام وBTC.D وUSDT.D
  dataNews: 0.05, // جودة البيانات والأخبار
};

export const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  trend: "الاتجاه العام",
  momentum: "الزخم",
  movingAverages: "المتوسطات المتحركة",
  volume: "الحجم والسيولة",
  levels: "الدعم والمقاومة",
  volatility: "التقلب والمخاطر",
  market: "السوق العام (BTC.D / USDT.D)",
  dataNews: "جودة البيانات والأخبار",
};

/** وزن كل إطار زمني بحسب الأفق الزمني للتقرير */
export const HORIZON_TIMEFRAME_WEIGHTS: Record<Horizon, Record<Timeframe, number>> = {
  SHORT: { "15m": 0.25, "1h": 0.35, "4h": 0.3, "1d": 0.1, "1w": 0 },
  MEDIUM: { "15m": 0.05, "1h": 0.15, "4h": 0.3, "1d": 0.35, "1w": 0.15 },
  LONG: { "15m": 0, "1h": 0, "4h": 0.1, "1d": 0.45, "1w": 0.45 },
};

/** الإطار الزمني المرجعي لكل أفق (للمستويات والسيناريوهات) */
export const HORIZON_PRIMARY_TIMEFRAME: Record<Horizon, Timeframe> = {
  SHORT: "4h",
  MEDIUM: "1d",
  LONG: "1w",
};

/** نطاقات الإشارة النهائية */
export const SIGNAL_BANDS = {
  strongPositive: 80,
  cautiousPositive: 65,
  neutral: 45,
  cautiousNegative: 30,
} as const;

export const SCORING_RULES = {
  /** حد أدنى للشموع لاعتبار الإطار الزمني صالحًا للتحليل */
  minCandles: 50,
  /** الحد الأدنى للثقة لإصدار إشارة قوية (شراء محتمل / بيع محتمل) */
  minConfidenceForStrongSignal: 60,
  /** دون هذه الثقة يُحيَّد التقييم إلى "محايد / انتظار" */
  minConfidenceForDirectionalSignal: 40,
  /** دون جودة البيانات هذه تُعتبر البيانات غير كافية */
  minDataQuality: 35,
  /**
   * تضارب الإشارات: إذا كانت حصة الوزن الإيجابي ضمن 50% ± هذا الهامش
   * (مثلًا بين 42% و58%) تُعتبر المؤشرات متضاربة ويُحيَّد التقييم.
   */
  conflictBand: 0.08,
  /** حد أدنى لعامل تعديل جودة البيانات */
  minQualityFactor: 0.3,
  /** عتبات مؤشر القوة النسبية RSI */
  rsi: { overbought: 75, oversold: 25, healthyLow: 45, healthyHigh: 65 },
  /** تغير قوي في USDT.D بالنقاط المئوية خلال 24 ساعة */
  usdtDominanceStrongRise: 0.15,
  /** تغير ملحوظ في BTC.D بالنقاط المئوية خلال 24 ساعة */
  btcDominanceNotableChange: 0.3,
} as const;

/** وزن كل مؤشر داخل فئته */
export const INDICATOR_WEIGHTS: Record<string, number> = {
  priceVsEma200: 1.5,
  ema200Slope: 1,
  adx: 1,
  structure: 1,
  ema20vs50: 1,
  ema50vs100: 0.8,
  priceVsEma20: 0.7,
  priceVsEma50: 0.9,
  priceVsSma20: 0.5,
  priceVsSma50: 0.6,
  rsi14: 1.2,
  macd: 1.2,
  stochRsi: 0.6,
  roc: 0.6,
  divergence: 0.8,
  volumeTrend: 1,
  obv: 1,
  volumeConfirm: 1.2,
  vwap: 0.6,
  srPosition: 1,
  fibonacci: 0.6,
  bollinger: 0.8,
  atr: 1,
};
