import type { Decision, Horizon, MarketPhase, Recommendation, RiskLevel, SignalBand, SignalDirection, TrendDirection } from "@/types/analysis";

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  POSSIBLE_BUY: "شراء محتمل",
  GRADUAL_BUY: "شراء تدريجي",
  NEUTRAL: "محايد / انتظار",
  REDUCE_RISK: "تقليل المخاطرة",
  NO_BUY: "عدم شراء",
  POSSIBLE_SELL: "بيع محتمل",
  MARKET_INDICATOR: "مؤشر سوقي — لا توصية مباشرة",
};

export const RECOMMENDATION_TONE: Record<Recommendation, "positive" | "negative" | "warning" | "info" | "neutral"> = {
  POSSIBLE_BUY: "positive",
  GRADUAL_BUY: "positive",
  NEUTRAL: "warning",
  REDUCE_RISK: "negative",
  NO_BUY: "negative",
  POSSIBLE_SELL: "negative",
  MARKET_INDICATOR: "info",
};

/** مجموعات التصفية في صفحة التقارير */
export const RECOMMENDATION_GROUPS: Record<string, { label: string; values: Recommendation[] }> = {
  buy: { label: "إشارة شراء", values: ["POSSIBLE_BUY", "GRADUAL_BUY"] },
  neutral: { label: "محايد", values: ["NEUTRAL", "MARKET_INDICATOR"] },
  avoid: { label: "عدم شراء", values: ["REDUCE_RISK", "NO_BUY"] },
  sell: { label: "بيع", values: ["POSSIBLE_SELL"] },
};

export const RISK_LABELS: Record<RiskLevel, string> = { LOW: "منخفض", MEDIUM: "متوسط", HIGH: "مرتفع" };
export const HORIZON_LABELS: Record<Horizon, string> = { SHORT: "قصير", MEDIUM: "متوسط", LONG: "طويل" };
export const HORIZON_DESCRIPTIONS: Record<Horizon, string> = {
  SHORT: "قصير المدى (ساعات إلى أيام)",
  MEDIUM: "متوسط المدى (أيام إلى أسابيع)",
  LONG: "طويل المدى (أسابيع إلى أشهر)",
};
export const DECISION_LABELS: Record<Decision, string> = {
  WAIT: "انتظار",
  WATCH: "مراقبة",
  GRADUAL_BUY: "شراء تدريجي",
  AVOID: "تجنب",
};
export const BAND_LABELS: Record<SignalBand, string> = {
  STRONG_POSITIVE: "إيجابي قوي",
  CAUTIOUS_POSITIVE: "إيجابي بحذر",
  NEUTRAL: "محايد / انتظار",
  CAUTIOUS_NEGATIVE: "سلبي بحذر",
  STRONG_NEGATIVE: "سلبي قوي / تجنب",
};
export const TREND_LABELS: Record<TrendDirection, string> = {
  UP: "صاعد",
  DOWN: "هابط",
  SIDEWAYS: "عرضي",
  UNKNOWN: "غير متاح",
};
export const PHASE_LABELS: Record<MarketPhase, string> = {
  BITCOIN_SEASON: "موسم البيتكوين Bitcoin Season",
  ALTCOIN_SEASON: "موسم العملات البديلة Altcoin Season",
  RISK_OFF: "عزوف عن المخاطرة Risk-Off",
  RISK_ON: "إقبال على المخاطرة Risk-On",
  NEUTRAL: "محايد Neutral",
};
export const DIRECTION_LABELS: Record<SignalDirection, string> = {
  positive: "إيجابي",
  negative: "سلبي",
  neutral: "محايد",
};

export const DISCLAIMER =
  "هذا التقرير تقييم آلي وإشارة تحليلية مبنية على بيانات تاريخية ومؤشرات فنية، وليس نصيحة مالية أو استشارة استثمارية مرخّصة. أسواق العملات الرقمية شديدة التقلب وقد تخسر رأس مالك كاملًا. النتائج سيناريوهات محتملة وليست ضمانًا، واتخاذ القرار مسؤوليتك وحدك.";
