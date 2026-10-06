import { getAssetConfig } from "@/config/assets";
import { CATEGORY_WEIGHTS, HORIZON_PRIMARY_TIMEFRAME, HORIZON_TIMEFRAME_WEIGHTS } from "@/config/scoring";
import { DISCLAIMER, formatNumber, formatPercent } from "@/lib/formatters";
import { TREND_LABELS } from "@/lib/formatters/labels";
import { assessRisk } from "@/lib/risk";
import { categoryAverage, computeScore } from "@/lib/scoring";
import { closedCandles } from "@/lib/timeframes";
import type { AnalysisReportData, Horizon, IndicatorSignal, ScoreCategory, TimeframeAnalysis } from "@/types/analysis";
import {
  TIMEFRAMES,
  type AssetOverview,
  type DominanceData,
  type FearGreedData,
  type GlobalMarketData,
  type MarketNewsResult,
  type OHLCV,
  type OHLCVSeries,
  type Timeframe,
} from "@/types/market";
import { assessDataQuality } from "./data-quality";
import { computeKeyLevels } from "./levels";
import { analyzeMarketContext } from "./market-context";
import { buildScenarios } from "./scenarios";
import { buildMomentumAnalysis, buildTrendAnalysis, buildVolumeAnalysis } from "./sections";
import { makeSignal } from "./signal";
import { buildSummary } from "./summary";
import { analyzeTimeframe, type ComputedIndicators, type TimeframeResult } from "./timeframe";

export interface AnalysisInput {
  symbol: string;
  horizon: Horizon;
  overview: AssetOverview;
  series: Partial<Record<Timeframe, OHLCVSeries | null>>;
  global: GlobalMarketData | null;
  dominance: DominanceData | null;
  fearGreed: FearGreedData | null;
  news: MarketNewsResult | null;
  btcDaily: OHLCV[] | null;
  ethDaily: OHLCV[] | null;
  ethBtcDaily: OHLCV[] | null;
  now?: number;
}

export interface AnalysisOutput {
  report: AnalysisReportData;
  computed: Partial<Record<Timeframe, ComputedIndicators>>;
}

const TECH_CATEGORIES: ScoreCategory[] = ["trend", "momentum", "movingAverages", "volume", "levels", "volatility"];

/**
 * محرك التحليل — دالة نقية (بدون أي اتصال بالشبكة أو قاعدة البيانات)
 * تأخذ البيانات الخام وتنتج تقريرًا كاملًا. هذا يجعلها قابلة للاختبار بالكامل.
 */
export function runAnalysis(input: AnalysisInput): AnalysisOutput {
  const cfg = getAssetConfig(input.symbol);
  if (!cfg) throw new Error(`الرمز غير مدعوم: ${input.symbol}`);
  const now = input.now ?? Date.now();
  const horizon = input.horizon;
  const tfWeights = HORIZON_TIMEFRAME_WEIGHTS[horizon];
  const isMarketIndicator = cfg.kind !== "CRYPTO";

  // 1) تحليل كل إطار زمني على الشموع المكتملة فقط
  const results: Partial<Record<Timeframe, TimeframeResult>> = {};
  for (const tf of TIMEFRAMES) {
    const s = input.series[tf];
    const candles = s ? closedCandles(s.candles, tf, now) : [];
    results[tf] = analyzeTimeframe(candles, tf);
  }

  // 2) جودة البيانات
  const dataQuality = assessDataQuality({
    horizon,
    series: input.series,
    overviewMeta: input.overview.meta,
    hasPrice: input.overview.price != null,
    globalAvailable: Boolean(input.global && input.dominance),
    globalStale: Boolean(input.global?.meta.isStale),
    fearGreedAvailable: Boolean(input.fearGreed),
    expectsVolume: cfg.kind !== "DOMINANCE",
    now,
  });

  // 3) السوق العام
  const market = analyzeMarketContext({
    symbol: cfg.symbol,
    kind: cfg.kind,
    global: input.global,
    dominance: input.dominance,
    fearGreed: input.fearGreed,
    btcDaily: input.btcDaily,
    ethDaily: input.ethDaily,
    ethBtcDaily: input.ethBtcDaily,
  });

  // 4) الإطار المرجعي
  const primaryTf = pickPrimary(results, HORIZON_PRIMARY_TIMEFRAME[horizon], tfWeights);
  const primary = results[primaryTf]?.computed ?? null;

  // 5) تجميع الفئات الفنية عبر الأطر الزمنية بحسب أوزان الأفق
  const categories: Partial<Record<ScoreCategory, number | null>> = {};
  const tfShareByCat: Partial<Record<ScoreCategory, Map<Timeframe, number>>> = {};
  for (const cat of TECH_CATEGORIES) {
    let w = 0;
    let acc = 0;
    const shares = new Map<Timeframe, number>();
    for (const tf of TIMEFRAMES) {
      const r = results[tf];
      const v = r?.analysis.categoryScores[cat];
      if (!r?.analysis.available || v == null || tfWeights[tf] <= 0) continue;
      w += tfWeights[tf];
      acc += tfWeights[tf] * v;
      shares.set(tf, tfWeights[tf]);
    }
    categories[cat] = w > 0 ? acc / w : null;
    for (const [tf, sw] of shares) shares.set(tf, sw / w);
    tfShareByCat[cat] = shares;
  }
  categories.market = categoryAverage(market.signals);

  // الأخبار: تُستخدم فقط إن توفر مزود أخبار بتصنيف للمعنويات
  const newsSignals = buildNewsSignals(input.news, cfg.symbol, cfg.name);
  categories.dataNews = categoryAverage(newsSignals);

  // 6) حساب مساهمة كل مؤشر بالنقاط (للشفافية)
  const availCatWeight = (Object.keys(CATEGORY_WEIGHTS) as ScoreCategory[]).reduce(
    (s, c) => s + (categories[c] != null ? CATEGORY_WEIGHTS[c] : 0),
    0,
  );
  const timeframes: TimeframeAnalysis[] = TIMEFRAMES.map((tf) => results[tf]!.analysis);
  for (const t of timeframes) {
    for (const cat of TECH_CATEGORIES) {
      const share = tfShareByCat[cat]?.get(t.timeframe) ?? 0;
      assignContributions(t.signals.filter((s) => s.category === cat), share, cat, availCatWeight);
    }
  }
  assignContributions(market.signals, 1, "market", availCatWeight);
  assignContributions(newsSignals, 1, "dataNews", availCatWeight);

  const usedSignals: IndicatorSignal[] = [
    ...timeframes.filter((t) => tfWeights[t.timeframe] > 0).flatMap((t) => t.signals),
    ...market.signals,
    ...newsSignals,
  ];
  const coverage = usedSignals.length ? usedSignals.filter((s) => s.available).length / usedSignals.length : 0;

  // حصة الوزن الإيجابي مرجحة بأوزان الأطر الزمنية (لكشف التضارب بعدالة)
  let posW = 0;
  let negW = 0;
  for (const t of timeframes) {
    const w = tfWeights[t.timeframe];
    if (w <= 0) continue;
    for (const s of t.signals) {
      if (!s.available) continue;
      if (s.direction === "positive") posW += w * s.weight * Math.abs(s.score);
      if (s.direction === "negative") negW += w * s.weight * Math.abs(s.score);
    }
  }
  for (const s of [...market.signals, ...newsSignals]) {
    if (s.direction === "positive") posW += 0.2 * s.weight * Math.abs(s.score);
    if (s.direction === "negative") negW += 0.2 * s.weight * Math.abs(s.score);
  }
  const positiveShare = posW + negW > 0 ? posW / (posW + negW) : 0.5;

  const trend = buildTrendAnalysis(results, primary);

  // 7) الدرجة والثقة والتوصية
  const scoring = computeScore({
    categories,
    signals: usedSignals.filter((s) => s.available),
    dataQuality: dataQuality.score,
    insufficientData: dataQuality.insufficient,
    timeframeTrends: timeframes.filter((t) => t.available && tfWeights[t.timeframe] > 0).map((t) => ({ trend: t.trend, weight: tfWeights[t.timeframe] })),
    longTrend: trend.long,
    trendStrength: trend.strength,
    isMarketIndicator,
    coverage,
    positiveShare,
  });

  const momentum = buildMomentumAnalysis(primary);
  const volume = buildVolumeAnalysis(primary, input.overview);
  const daily = input.series["1d"]?.candles ?? null;
  const risk = assessRisk({
    kind: cfg.kind,
    overview: input.overview,
    daily,
    primaryAtrPct: primary?.atrPct ?? null,
    liquidity: volume.liquidityLevel,
    fearGreed: input.fearGreed?.value ?? null,
    usdtDominanceChange24h: input.dominance?.usdtDominanceChange24h ?? null,
    dataQuality: dataQuality.score,
    conflicted: scoring.conflicted,
  });

  // 8) المستويات والسيناريوهات والملخص
  const levels = computeKeyLevels(primary, scoring.recommendation, dataQuality.insufficient);
  const scenarios = buildScenarios(scoring.adjustedScore, levels, market, primaryTf);
  const summary = buildSummary({
    display: cfg.display,
    isMarketIndicator,
    primaryTf,
    scoring,
    trend,
    momentum,
    volume,
    market,
    levels,
    risk,
    dataQuality,
    signals: usedSignals,
  });

  const sources = Array.from(
    new Set(
      [
        input.overview.meta.source,
        ...Object.values(input.series).map((s) => s?.meta.source),
        input.global?.meta.source,
        input.fearGreed?.meta.source,
        input.news?.items.length ? input.news.meta.source : undefined,
      ].filter((x): x is string => Boolean(x) && x !== "—" && x !== "غير متاح"),
    ),
  );

  const computed: Partial<Record<Timeframe, ComputedIndicators>> = {};
  for (const tf of TIMEFRAMES) if (results[tf]?.computed) computed[tf] = results[tf]!.computed!;

  return {
    report: {
      version: 1,
      symbol: cfg.symbol,
      display: cfg.display,
      name: cfg.name,
      nameAr: cfg.nameAr,
      kind: cfg.kind,
      horizon,
      generatedAt: new Date(now).toISOString(),
      overview: input.overview,
      scoring,
      risk,
      dataQuality,
      timeframes,
      trend,
      momentum,
      volume,
      market,
      levels,
      scenarios,
      summary,
      indicatorReading: indicatorReading(cfg.kind, cfg.symbol, input, trend.medium),
      sources,
      isMock: dataQuality.isMock,
      disclaimer: DISCLAIMER,
    },
    computed,
  };
}

function pickPrimary(results: Partial<Record<Timeframe, TimeframeResult>>, preferred: Timeframe, weights: Record<Timeframe, number>): Timeframe {
  if (results[preferred]?.analysis.available) return preferred;
  const ordered = [...TIMEFRAMES].sort((a, b) => weights[b] - weights[a]);
  return ordered.find((tf) => results[tf]?.analysis.available) ?? preferred;
}

/** المساهمة = درجة المؤشر × حصته في الفئة × حصة الإطار × وزن الفئة × 50 نقطة */
function assignContributions(signals: IndicatorSignal[], tfShare: number, cat: ScoreCategory, availCatWeight: number) {
  const avail = signals.filter((s) => s.available);
  const wsum = avail.reduce((s, x) => s + x.weight, 0);
  if (wsum === 0 || availCatWeight === 0) return;
  const catShare = CATEGORY_WEIGHTS[cat] / availCatWeight;
  for (const s of avail) s.contribution = Math.round(s.score * (s.weight / wsum) * tfShare * catShare * 50 * 100) / 100;
}

function buildNewsSignals(news: MarketNewsResult | null, symbol: string, name: string): IndicatorSignal[] {
  if (!news || news.items.length === 0 || news.meta.isMock) return [];
  const rated = news.items.filter((n) => n.sentiment);
  if (rated.length === 0) return [];
  const re = new RegExp(`\\b(${symbol}|${name})\\b`, "i");
  const specific = rated.filter((n) => re.test(n.title));
  const pool = specific.length >= 2 ? specific : rated;
  const pos = pool.filter((n) => n.sentiment === "positive").length;
  const neg = pool.filter((n) => n.sentiment === "negative").length;
  const score = ((pos - neg) / pool.length) * (specific.length >= 2 ? 0.8 : 0.4);
  return [
    makeSignal({
      key: "newsSentiment",
      nameAr: "معنويات الأخبار",
      nameEn: "News Sentiment",
      category: "dataNews",
      value: pos - neg,
      valueText: `${pos} إيجابي / ${neg} سلبي من ${pool.length}`,
      status: specific.length >= 2 ? "أخبار متعلقة بالأصل" : "أخبار السوق العامة",
      score,
      weight: 1,
      explanation: "تقدير مبسط لمعنويات العناوين الأخيرة بناءً على تصويت مستخدمي مزود الأخبار؛ وزنه صغير لأنه عرضة للضوضاء.",
    }),
  ];
}

function indicatorReading(kind: string, symbol: string, input: AnalysisInput, mediumTrend: AnalysisReportData["trend"]["medium"]): string | null {
  const d = input.dominance;
  const tc = input.global?.marketCapChange24h ?? null;
  const tcText = tc != null ? `إجمالي السوق ${formatPercent(tc)} خلال 24 ساعة` : "اتجاه إجمالي السوق غير متاح";
  switch (kind) {
    case "STABLECOIN": {
      const p = input.overview.price;
      const dev = p != null ? (p - 1) * 100 : null;
      return `عملة مستقرة: لا تنطبق عليها توصيات الشراء أو البيع، والتحليل يركز على ثبات الربط بالدولار (الانحراف الحالي ${dev != null ? formatPercent(dev, { digits: 3 }) : "غير متاح"}). ${
        symbol === "USDT" && d?.usdtDominance != null ? `هيمنة تيثر USDT.D عند ${formatNumber(d.usdtDominance, 2)}%، وارتفاعها يعني اتجاه السيولة نحو الأمان.` : ""
      }`;
    }
    case "DOMINANCE":
      if (symbol === "BTC.D") {
        return `هيمنة البيتكوين BTC.D ليست أصلًا قابلًا للشراء ولا تُعد توصية مباشرة. الاتجاه متوسط المدى ${TREND_LABELS[mediumTrend]}، و${tcText}. صعود BTC.D مع صعود السوق يعني قوة نسبية للبيتكوين، وهبوطها مع صعود السوق قد يعني توسع السيولة نحو العملات البديلة. ${d?.method ?? ""}`;
      }
      return `هيمنة تيثر USDT.D مؤشر على شهية المخاطرة وليست توصية مباشرة. الاتجاه متوسط المدى ${TREND_LABELS[mediumTrend]}، و${tcText}. ارتفاعها بقوة يحذّر من تراجع شهية المخاطرة، وانخفاضها يعني عودة السيولة إلى الأصول الرقمية. ${d?.method ?? ""}`;
    case "INDEX":
      return `${symbol} مؤشر لإجمالي القيمة السوقية${symbol === "TOTAL2" ? " باستثناء البيتكوين" : symbol === "TOTAL3" ? " باستثناء البيتكوين والإيثريوم" : ""} — يُستخدم لتقييم بيئة السوق وليس توصية مباشرة. الاتجاه متوسط المدى ${TREND_LABELS[mediumTrend]}.`;
    case "PAIR":
      return `نسبة ETH/BTC تقيس أداء الإيثريوم مقارنة بالبيتكوين؛ صعودها غالبًا مؤشر مبكر على شهية العملات البديلة. الاتجاه متوسط المدى ${TREND_LABELS[mediumTrend]}. ليست توصية مباشرة.`;
    default:
      return null;
  }
}
