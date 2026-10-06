import { SCORING_RULES } from "@/config/scoring";
import { formatNumber, formatPercent, formatPrice } from "@/lib/formatters";
import {
  adx,
  atr,
  bollinger,
  buyPressure,
  detectDivergence,
  distancePct,
  ema,
  fibonacciRetracement,
  last,
  lastCross,
  macd,
  obv,
  roc,
  rsi,
  slopePct,
  sma,
  stochRsi,
  supportResistance,
  swingPoints,
  valueAgo,
  volumeMA,
  vwap,
  type LevelZone,
  type Pivot,
} from "@/lib/indicators";
import { categoryAverage, countSignals } from "@/lib/scoring";
import { CATEGORY_WEIGHTS } from "@/config/scoring";
import type { IndicatorSignal, ScoreCategory, TimeframeAnalysis, TrendDirection } from "@/types/analysis";
import type { OHLCV, Timeframe } from "@/types/market";
import { makeSignal, unavailableSignal } from "./signal";

/** القيم الخام المحسوبة لإطار زمني — تُستخدم في أقسام التقرير الأخرى وتُحفظ كـ IndicatorSnapshot */
export interface ComputedIndicators {
  timeframe: Timeframe;
  price: number;
  ema20: number | null;
  ema50: number | null;
  ema100: number | null;
  ema200: number | null;
  sma20: number | null;
  sma50: number | null;
  ema200Slope: number | null;
  rsi14: number | null;
  rsiPrev: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  macdHistPrev: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  bbPercentB: number | null;
  bbBandwidth: number | null;
  atr14: number | null;
  atrPct: number | null;
  adx14: number | null;
  plusDI: number | null;
  minusDI: number | null;
  stochK: number | null;
  stochD: number | null;
  obv: number | null;
  obvSlope: number | null;
  volume: number | null;
  volumeMA20: number | null;
  vwap: number | null;
  roc10: number | null;
  buyPressure: number | null;
  supports: LevelZone[];
  resistances: LevelZone[];
  fib: ReturnType<typeof fibonacciRetracement>;
  pivots: Pivot[];
  divergence: ReturnType<typeof detectDivergence>;
  goldenDeathCross: { type: "GOLDEN" | "DEATH"; barsAgo: number } | null;
  priceChange10: number | null;
  volumeRatio10: number | null;
  hasVolume: boolean;
}

export interface TimeframeResult {
  analysis: TimeframeAnalysis;
  computed: ComputedIndicators | null;
}

const fmt = (v: number | null, d = 2) => (v == null ? "غير متاح" : formatNumber(v, d));

export function analyzeTimeframe(candles: OHLCV[], timeframe: Timeframe): TimeframeResult {
  if (candles.length < SCORING_RULES.minCandles) {
    return {
      analysis: {
        timeframe,
        available: false,
        candles: candles.length,
        lastClose: candles.at(-1)?.close ?? null,
        lastTime: candles.at(-1)?.time ?? null,
        trend: "UNKNOWN",
        signals: [],
        categoryScores: {},
        score: null,
        counts: { positive: 0, negative: 0, neutral: 0 },
        note: `بيانات غير كافية (${candles.length} شمعة من أصل ${SCORING_RULES.minCandles} على الأقل)`,
      },
      computed: null,
    };
  }

  const c = computeIndicators(candles, timeframe);
  const trend = trendOf(c);
  const signals = buildSignals(c, trend);

  const categoryScores: Partial<Record<ScoreCategory, number>> = {};
  for (const cat of ["trend", "momentum", "movingAverages", "volume", "levels", "volatility"] as ScoreCategory[]) {
    const avg = categoryAverage(signals.filter((s) => s.category === cat));
    if (avg !== null) categoryScores[cat] = avg;
  }
  let w = 0;
  let acc = 0;
  for (const [cat, v] of Object.entries(categoryScores) as [ScoreCategory, number][]) {
    w += CATEGORY_WEIGHTS[cat];
    acc += CATEGORY_WEIGHTS[cat] * (50 + 50 * v);
  }

  return {
    analysis: {
      timeframe,
      available: true,
      candles: candles.length,
      lastClose: c.price,
      lastTime: candles[candles.length - 1].time,
      trend,
      signals,
      categoryScores,
      score: w > 0 ? Math.round(acc / w) : null,
      counts: countSignals(signals),
      note: candles.length < 200 ? "عدد الشموع أقل من 200 — بعض المتوسطات الطويلة غير متاحة" : undefined,
    },
    computed: c,
  };
}

export function computeIndicators(candles: OHLCV[], timeframe: Timeframe): ComputedIndicators {
  const closes = candles.map((x) => x.close);
  const volumes = candles.map((x) => x.volume);
  const price = closes[closes.length - 1];
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const e100 = ema(closes, 100);
  const e200 = ema(closes, 200);
  const r = rsi(closes, 14);
  const m = macd(closes);
  const bb = bollinger(closes, 20, 2);
  const a = atr(candles, 14);
  const ad = adx(candles, 14);
  const st = stochRsi(closes);
  const ob = obv(candles);
  const vma = volumeMA(volumes, 20);
  const vw = vwap(candles, timeframe);
  const rc = roc(closes, 10);
  const hasVolume = volumes.some((v) => v > 0);
  const { supports, resistances } = supportResistance(candles, price, { lookback: 200 });
  const cross = lastCross(e50, e200, 60);

  const n = closes.length;
  const priceChange10 = n > 10 ? ((price - closes[n - 11]) / closes[n - 11]) * 100 : null;
  const recentVol = volumes.slice(-10);
  const priorVol = volumes.slice(-30, -10);
  const volumeRatio10 =
    hasVolume && priorVol.length >= 10
      ? recentVol.reduce((s, v) => s + v, 0) / recentVol.length / (priorVol.reduce((s, v) => s + v, 0) / priorVol.length || 1)
      : null;
  const atrVal = last(a);

  return {
    timeframe,
    price,
    ema20: last(e20),
    ema50: last(e50),
    ema100: last(e100),
    ema200: last(e200),
    sma20: last(sma(closes, 20)),
    sma50: last(sma(closes, 50)),
    ema200Slope: slopePct(e200, 20),
    rsi14: last(r),
    rsiPrev: valueAgo(r, 5),
    macd: last(m.macd),
    macdSignal: last(m.signal),
    macdHist: last(m.histogram),
    macdHistPrev: valueAgo(m.histogram, 3),
    bbUpper: last(bb.upper),
    bbMiddle: last(bb.middle),
    bbLower: last(bb.lower),
    bbPercentB: last(bb.percentB),
    bbBandwidth: last(bb.bandwidth),
    atr14: atrVal,
    atrPct: atrVal != null && price > 0 ? (atrVal / price) * 100 : null,
    adx14: last(ad.adx),
    plusDI: last(ad.plusDI),
    minusDI: last(ad.minusDI),
    stochK: last(st.k),
    stochD: last(st.d),
    obv: hasVolume ? ob[ob.length - 1] : null,
    obvSlope: hasVolume ? obvSlope(ob, 20) : null,
    volume: hasVolume ? volumes[n - 1] : null,
    volumeMA20: hasVolume ? last(vma) : null,
    vwap: last(vw),
    roc10: last(rc),
    buyPressure: hasVolume ? buyPressure(candles, 20) : null,
    supports,
    resistances,
    fib: fibonacciRetracement(candles, 120),
    pivots: swingPoints(candles.slice(-150), 3, 3),
    divergence: detectDivergence(candles, r, 60),
    goldenDeathCross: cross ? { type: cross.type === "above" ? "GOLDEN" : "DEATH", barsAgo: cross.barsAgo } : null,
    priceChange10,
    volumeRatio10,
    hasVolume,
  };
}

/** ميل OBV كنسبة من متوسط القيمة المطلقة (لأن OBV قد يكون سالبًا) */
function obvSlope(series: number[], lookback: number): number | null {
  if (series.length <= lookback) return null;
  const a = series[series.length - 1 - lookback];
  const b = series[series.length - 1];
  const scale = series.slice(-lookback * 3).reduce((s, v) => s + Math.abs(v), 0) / Math.min(series.length, lookback * 3);
  return scale === 0 ? 0 : ((b - a) / scale) * 100;
}

export function trendOf(c: ComputedIndicators): TrendDirection {
  if (c.ema20 == null || c.ema50 == null) return "UNKNOWN";
  if (c.price > c.ema50 && c.ema20 > c.ema50) return "UP";
  if (c.price < c.ema50 && c.ema20 < c.ema50) return "DOWN";
  return "SIDEWAYS";
}

function structureOf(pivots: Pivot[]): "HIGHER_HIGHS" | "LOWER_LOWS" | "MIXED" | "UNKNOWN" {
  const highs = pivots.filter((p) => p.type === "high").slice(-2);
  const lows = pivots.filter((p) => p.type === "low").slice(-2);
  if (highs.length < 2 || lows.length < 2) return "UNKNOWN";
  const hh = highs[1].price > highs[0].price;
  const hl = lows[1].price > lows[0].price;
  if (hh && hl) return "HIGHER_HIGHS";
  if (!hh && !hl) return "LOWER_LOWS";
  return "MIXED";
}
export { structureOf };

function buildSignals(c: ComputedIndicators, trend: TrendDirection): IndicatorSignal[] {
  const s: IndicatorSignal[] = [];
  const p = c.price;
  const up = trend === "UP";
  const down = trend === "DOWN";

  // ───── الاتجاه ─────
  if (c.ema200 != null) {
    const above = p > c.ema200;
    const slope = c.ema200Slope ?? 0;
    const score = above ? (slope > 0 ? 1 : 0.4) : slope < 0 ? -1 : -0.4;
    s.push(
      makeSignal({
        key: "priceVsEma200",
        nameAr: "السعر مقابل المتوسط الأسي 200",
        nameEn: "Price vs EMA 200",
        category: "trend",
        value: c.ema200,
        valueText: formatPrice(c.ema200),
        status: `${above ? "فوق" : "تحت"} EMA 200 — الميل ${slope > 0 ? "إيجابي" : slope < 0 ? "سلبي" : "مستوٍ"}`,
        score,
        explanation: above
          ? "تداول السعر فوق المتوسط الأسي 200 يعني أن الاتجاه طويل المدى في هذا الإطار يميل للصعود، ويقوى ذلك عندما يكون ميل المتوسط إيجابيًا."
          : "تداول السعر تحت المتوسط الأسي 200 يشير إلى ضعف الاتجاه طويل المدى في هذا الإطار.",
      }),
    );
  } else {
    s.push(unavailableSignal("priceVsEma200", "السعر مقابل المتوسط الأسي 200", "Price vs EMA 200", "trend", "يتطلب 200 شمعة على الأقل."));
  }

  if (c.adx14 != null && c.plusDI != null && c.minusDI != null) {
    const bull = c.plusDI > c.minusDI;
    const strong = c.adx14 >= 25;
    const weak = c.adx14 < 20;
    const score = weak ? 0 : (bull ? 1 : -1) * (strong ? 0.8 : 0.3);
    s.push(
      makeSignal({
        key: "adx",
        nameAr: "مؤشر متوسط الاتجاه",
        nameEn: "ADX 14",
        category: "trend",
        value: c.adx14,
        valueText: `${fmt(c.adx14, 1)} (+DI ${fmt(c.plusDI, 1)} / -DI ${fmt(c.minusDI, 1)})`,
        status: weak ? "لا يوجد اتجاه واضح" : `${strong ? "اتجاه قوي" : "اتجاه متوسط"} ${bull ? "صاعد" : "هابط"}`,
        score,
        explanation: "ADX يقيس قوة الاتجاه لا اتجاهه؛ فوق 25 يعني اتجاهًا قويًا، ويحدد +DI و-DI أيّ الطرفين يسيطر.",
      }),
    );
  } else {
    s.push(unavailableSignal("adx", "مؤشر متوسط الاتجاه", "ADX 14", "trend", "بيانات غير كافية."));
  }

  const structure = structureOf(c.pivots);
  if (structure !== "UNKNOWN") {
    s.push(
      makeSignal({
        key: "structure",
        nameAr: "هيكل القمم والقيعان",
        nameEn: "Market Structure",
        category: "trend",
        value: null,
        valueText: structure === "HIGHER_HIGHS" ? "قمم وقيعان أعلى" : structure === "LOWER_LOWS" ? "قمم وقيعان أدنى" : "مختلط",
        status: structure === "HIGHER_HIGHS" ? "هيكل صاعد" : structure === "LOWER_LOWS" ? "هيكل هابط" : "هيكل غير محسوم",
        score: structure === "HIGHER_HIGHS" ? 0.7 : structure === "LOWER_LOWS" ? -0.7 : 0,
        explanation: "تكوين قمم وقيعان أعلى يدل على سيطرة المشترين، والعكس يدل على سيطرة البائعين.",
      }),
    );
  }

  if (c.goldenDeathCross && c.goldenDeathCross.barsAgo <= 20) {
    const golden = c.goldenDeathCross.type === "GOLDEN";
    s.push(
      makeSignal({
        key: "maCross",
        nameAr: golden ? "تقاطع ذهبي" : "تقاطع الموت",
        nameEn: golden ? "Golden Cross (EMA50/200)" : "Death Cross (EMA50/200)",
        category: "trend",
        value: c.goldenDeathCross.barsAgo,
        valueText: `قبل ${c.goldenDeathCross.barsAgo} شمعة`,
        status: golden ? "EMA 50 عبر فوق EMA 200" : "EMA 50 عبر تحت EMA 200",
        score: golden ? 0.7 : -0.7,
        weight: 0.8,
        explanation: golden
          ? "التقاطع الذهبي إشارة متأخرة على تحسن الاتجاه، ويحتاج إلى تأكيد من الحجم والزخم."
          : "تقاطع الموت إشارة متأخرة على ضعف الاتجاه، ولا يعني بالضرورة استمرار الهبوط.",
      }),
    );
  }

  // ───── المتوسطات المتحركة ─────
  const maPair = (key: string, nameAr: string, nameEn: string, a: number | null, b: number | null, mag: number, aboveText: string, belowText: string) => {
    if (a == null || b == null) {
      s.push(unavailableSignal(key, nameAr, nameEn, "movingAverages", "بيانات غير كافية لحساب المتوسط."));
      return;
    }
    const above = a > b;
    s.push(
      makeSignal({
        key,
        nameAr,
        nameEn,
        category: "movingAverages",
        value: b,
        valueText: formatPrice(b),
        status: above ? aboveText : belowText,
        score: above ? mag : -mag,
        explanation: above ? `${aboveText}: عامل إيجابي.` : `${belowText}: عامل سلبي.`,
      }),
    );
  };
  maPair("ema20vs50", "تقاطع المتوسطين الأسيين 20 و50", "EMA 20 vs EMA 50", c.ema20, c.ema50, 0.6, "EMA 20 فوق EMA 50", "EMA 20 تحت EMA 50");
  maPair("ema50vs100", "المتوسط الأسي 50 مقابل 100", "EMA 50 vs EMA 100", c.ema50, c.ema100, 0.5, "EMA 50 فوق EMA 100", "EMA 50 تحت EMA 100");
  maPair("priceVsEma20", "السعر مقابل المتوسط الأسي 20", "Price vs EMA 20", p, c.ema20, 0.4, "السعر فوق EMA 20", "السعر تحت EMA 20");
  maPair("priceVsEma50", "السعر مقابل المتوسط الأسي 50", "Price vs EMA 50", p, c.ema50, 0.5, "السعر فوق EMA 50", "السعر تحت EMA 50");
  maPair("priceVsSma20", "السعر مقابل المتوسط البسيط 20", "Price vs SMA 20", p, c.sma20, 0.3, "السعر فوق SMA 20", "السعر تحت SMA 20");
  maPair("priceVsSma50", "السعر مقابل المتوسط البسيط 50", "Price vs SMA 50", p, c.sma50, 0.4, "السعر فوق SMA 50", "السعر تحت SMA 50");

  // ───── الزخم ─────
  if (c.rsi14 != null) {
    const r = c.rsi14;
    const R = SCORING_RULES.rsi;
    let score = 0;
    let status = "";
    let explanation = "";
    if (r > R.overbought) {
      score = -0.3;
      status = "تشبع شرائي — تحذير وليس إشارة بيع مباشرة";
      explanation = "RSI فوق 75 يعني أن الصعود ممتد وقد يحدث تصحيح أو تباطؤ، لكنه وحده لا يكفي للبيع خاصة في الاتجاهات القوية.";
    } else if (r >= R.healthyHigh) {
      score = up ? 0.3 : 0.1;
      status = "زخم قوي يقترب من التشبع";
      explanation = "زخم شرائي واضح، مع ضرورة مراقبة الاقتراب من مناطق التشبع.";
    } else if (r >= R.healthyLow) {
      score = up ? 0.6 : 0.1;
      status = up ? "منطقة صحية مع اتجاه صاعد" : "منطقة متوازنة";
      explanation = up ? "RSI بين 45 و65 مع اتجاه صاعد يعكس زخمًا صحيًا غير مبالغ فيه." : "RSI في منطقة وسطى دون إشارة واضحة.";
    } else if (r >= 35) {
      score = down ? -0.4 : -0.1;
      status = "زخم ضعيف";
      explanation = "RSI دون 45 يدل على ضعف نسبي في قوة المشترين.";
    } else if (r >= R.oversold) {
      score = -0.3;
      status = "زخم سلبي";
      explanation = "البائعون يسيطرون على الزخم حاليًا.";
    } else {
      score = 0.05;
      status = "تشبع بيعي — احتمال ارتداد وليس إشارة شراء مباشرة";
      explanation = "RSI تحت 25 قد يسبق ارتدادًا فنيًا، لكنه وحده لا يكفي للشراء لأن الأسعار قد تبقى في تشبع بيعي فترة طويلة في الاتجاهات الهابطة.";
    }
    s.push(makeSignal({ key: "rsi14", nameAr: "مؤشر القوة النسبية", nameEn: "RSI 14", category: "momentum", value: r, valueText: fmt(r, 1), status, score, explanation }));
  } else {
    s.push(unavailableSignal("rsi14", "مؤشر القوة النسبية", "RSI 14", "momentum", "بيانات غير كافية."));
  }

  if (c.macd != null && c.macdSignal != null && c.macdHist != null) {
    const bull = c.macd > c.macdSignal && c.macdHist > 0;
    const bear = c.macd < c.macdSignal && c.macdHist < 0;
    const rising = c.macdHistPrev != null && c.macdHist > c.macdHistPrev;
    let score = bull ? (rising ? 0.8 : 0.5) : bear ? (rising ? -0.4 : -0.8) : 0;
    if (c.macd > 0 && score > 0) score += 0.1;
    if (c.macd < 0 && score < 0) score -= 0.1;
    s.push(
      makeSignal({
        key: "macd",
        nameAr: "مؤشر تقارب وتباعد المتوسطات",
        nameEn: "MACD (12,26,9)",
        category: "momentum",
        value: c.macd,
        valueText: `MACD ${fmt(c.macd, 4)} / Signal ${fmt(c.macdSignal, 4)} / Hist ${fmt(c.macdHist, 4)}`,
        status: bull ? `فوق خط الإشارة والهيستوجرام إيجابي${rising ? " ومتزايد" : ""}` : bear ? `تحت خط الإشارة والهيستوجرام سلبي${rising ? " لكنه يتحسن" : ""}` : "تقاطع وشيك / محايد",
        score,
        explanation: "MACD فوق خط الإشارة مع هيستوجرام إيجابي يعني تسارع الزخم الصاعد، والعكس يعني تسارع الزخم الهابط.",
      }),
    );
  } else {
    s.push(unavailableSignal("macd", "مؤشر تقارب وتباعد المتوسطات", "MACD", "momentum", "بيانات غير كافية."));
  }

  if (c.stochK != null && c.stochD != null) {
    const k = c.stochK;
    const d = c.stochD;
    let score = k > d ? 0.2 : -0.2;
    let status = k > d ? "الخط K فوق D" : "الخط K تحت D";
    if (k > 80 && k < d) {
      score = -0.35;
      status = "منطقة تشبع مع فقدان زخم";
    } else if (k < 20 && k > d) {
      score = 0.35;
      status = "منطقة تشبع بيعي مع بداية تحسن";
    }
    s.push(
      makeSignal({
        key: "stochRsi",
        nameAr: "مؤشر ستوكاستيك RSI",
        nameEn: "Stochastic RSI",
        category: "momentum",
        value: k,
        valueText: `K ${fmt(k, 1)} / D ${fmt(d, 1)}`,
        status,
        score,
        explanation: "مؤشر حساس للتغيرات القصيرة في الزخم؛ يفيد في التوقيت لكنه يعطي إشارات كاذبة كثيرة إذا استُخدم منفردًا.",
      }),
    );
  }

  if (c.roc10 != null) {
    const scale = Math.max((c.atrPct ?? 2) * 3, 0.5);
    s.push(
      makeSignal({
        key: "roc",
        nameAr: "معدل تغير السعر",
        nameEn: "ROC 10",
        category: "momentum",
        value: c.roc10,
        valueText: formatPercent(c.roc10),
        status: c.roc10 > 0 ? "تغير إيجابي خلال 10 شموع" : "تغير سلبي خلال 10 شموع",
        score: Math.max(-1, Math.min(1, c.roc10 / scale)) * 0.6,
        explanation: "يقيس سرعة تغير السعر مقارنة بالتقلب المعتاد للأصل.",
      }),
    );
  }

  if (c.divergence.type !== "NONE") {
    const bull = c.divergence.type === "BULLISH";
    s.push(
      makeSignal({
        key: "divergence",
        nameAr: bull ? "انفراج إيجابي" : "انفراج سلبي",
        nameEn: bull ? "Bullish Divergence (RSI)" : "Bearish Divergence (RSI)",
        category: "momentum",
        value: c.divergence.barsAgo,
        valueText: `قبل ${c.divergence.barsAgo} شمعة`,
        status: bull ? "قاع سعري أدنى مع قاع RSI أعلى" : "قمة سعرية أعلى مع قمة RSI أدنى",
        score: bull ? 0.6 : -0.6,
        explanation: bull ? "قد يشير إلى ضعف ضغط البيع واحتمال ارتداد، ويحتاج تأكيدًا." : "قد يشير إلى ضعف ضغط الشراء رغم ارتفاع السعر.",
      }),
    );
  }

  // ───── الحجم والسيولة ─────
  if (c.hasVolume && c.volume != null && c.volumeMA20 != null && c.volumeMA20 > 0) {
    const ratio = c.volume / c.volumeMA20;
    const priceUp = (c.priceChange10 ?? 0) > 0;
    let score = 0;
    let status = "حجم قريب من المتوسط";
    if (ratio > 1.3) {
      score = priceUp ? 0.6 : -0.6;
      status = priceUp ? "حجم مرتفع مع صعود" : "حجم مرتفع مع هبوط";
    } else if (ratio < 0.7) {
      score = -0.1;
      status = "حجم ضعيف";
    }
    s.push(
      makeSignal({
        key: "volumeTrend",
        nameAr: "الحجم مقابل متوسطه",
        nameEn: "Volume vs MA 20",
        category: "volume",
        value: ratio,
        valueText: `${fmt(ratio, 2)}x`,
        status,
        score,
        explanation: "مقارنة حجم آخر شمعة مكتملة بمتوسط الحجم لآخر 20 شمعة لمعرفة مدى مشاركة السوق في الحركة.",
      }),
    );
  } else {
    s.push(unavailableSignal("volumeTrend", "الحجم مقابل متوسطه", "Volume vs MA 20", "volume", "لا تتوفر بيانات حجم لهذا الأصل."));
  }

  if (c.hasVolume && c.obvSlope != null) {
    const priceUp = (c.priceChange10 ?? 0) > 0;
    const obvUp = c.obvSlope > 0;
    let score = obvUp ? 0.5 : -0.5;
    let status = obvUp ? "OBV صاعد — تراكم" : "OBV هابط — تصريف";
    if (priceUp && !obvUp) {
      score = -0.6;
      status = "السعر يرتفع وOBV ينخفض — تحذير";
    } else if (!priceUp && obvUp) {
      score = 0.3;
      status = "السعر ينخفض وOBV يرتفع — تراكم محتمل";
    }
    s.push(
      makeSignal({
        key: "obv",
        nameAr: "حجم التوازن",
        nameEn: "OBV",
        category: "volume",
        value: c.obv,
        valueText: formatNumber(c.obv, 0),
        status,
        score,
        explanation: "OBV يجمع الحجم في الأيام الصاعدة ويطرحه في الهابطة؛ اتجاهه يكشف إن كانت السيولة تدخل أم تخرج.",
      }),
    );
  }

  if (c.hasVolume && c.priceChange10 != null && c.volumeRatio10 != null) {
    const pc = c.priceChange10;
    const vr = c.volumeRatio10;
    let score = 0;
    let status = "لا إشارة واضحة";
    let explanation = "مقارنة تغير السعر خلال آخر 10 شموع مع تغير متوسط الحجم.";
    if (pc > 3 && vr < 0.85) {
      score = -0.6;
      status = "ارتفاع سعري بدون حجم داعم — تحذير";
      explanation = "ارتفاع السعر مع انخفاض الحجم قد يعني ضعف المشاركة واحتمال فشل الحركة.";
    } else if (pc > 0 && vr >= 1.1) {
      score = 0.6;
      status = "الصعود مدعوم بحجم متزايد";
    } else if (pc < -3 && vr >= 1.1) {
      score = -0.5;
      status = "هبوط مدعوم بحجم مرتفع";
    } else if (pc < 0 && vr < 0.85) {
      score = 0.1;
      status = "هبوط بحجم متراجع — احتمال ضعف البائعين";
    }
    s.push(
      makeSignal({
        key: "volumeConfirm",
        nameAr: "تأكيد الحجم للحركة",
        nameEn: "Volume Confirmation",
        category: "volume",
        value: vr,
        valueText: `السعر ${formatPercent(pc)} / الحجم ${fmt(vr, 2)}x`,
        status,
        score,
        explanation,
      }),
    );
  }

  if (c.vwap != null) {
    const above = p > c.vwap;
    s.push(
      makeSignal({
        key: "vwap",
        nameAr: "متوسط السعر المرجح بالحجم",
        nameEn: "VWAP (يومي)",
        category: "volume",
        value: c.vwap,
        valueText: formatPrice(c.vwap),
        status: above ? "السعر فوق VWAP" : "السعر تحت VWAP",
        score: above ? 0.3 : -0.3,
        explanation: "VWAP يمثل متوسط سعر التداول المرجح بالحجم لليوم الحالي؛ التداول فوقه يعكس سيطرة المشترين خلال الجلسة.",
      }),
    );
  }

  // ───── الدعم والمقاومة ─────
  const s1 = c.supports[0]?.price ?? null;
  const r1 = c.resistances[0]?.price ?? null;
  if (s1 != null && r1 != null && r1 > s1) {
    const pos = (p - s1) / (r1 - s1);
    let score = (0.5 - pos) * 0.8;
    if (down && score > 0) score *= 0.5;
    s.push(
      makeSignal({
        key: "srPosition",
        nameAr: "الموقع بين الدعم والمقاومة",
        nameEn: "Support / Resistance Position",
        category: "levels",
        value: pos * 100,
        valueText: `${fmt(pos * 100, 0)}% من النطاق`,
        status: pos < 0.25 ? "قرب الدعم" : pos > 0.75 ? "قرب المقاومة" : "منتصف النطاق",
        score,
        explanation: `الدعم الأقرب ${formatPrice(s1)} والمقاومة الأقرب ${formatPrice(r1)}. القرب من الدعم يحسّن نسبة العائد للمخاطرة، والقرب من المقاومة يزيد احتمال التذبذب.`,
      }),
    );
  } else {
    s.push(unavailableSignal("srPosition", "الموقع بين الدعم والمقاومة", "Support / Resistance", "levels", "لا تتوفر نقاط ارتكاز كافية لتحديد دعم ومقاومة موثوقين."));
  }

  if (c.fib) {
    const lv = (r: number) => c.fib!.levels.find((l) => l.level === r)!.price;
    let score = 0;
    let status = "";
    if (c.fib.trendUp) {
      if (p >= lv(0.382)) {
        score = 0.4;
        status = "تصحيح سطحي فوق 38.2%";
      } else if (p >= lv(0.618)) {
        score = 0.1;
        status = "بين 38.2% و61.8% — منطقة تصحيح طبيعية";
      } else if (p >= lv(0.786)) {
        score = -0.2;
        status = "تصحيح عميق دون 61.8%";
      } else {
        score = -0.4;
        status = "كسر 78.6% — ضعف واضح";
      }
    } else {
      if (p <= lv(0.382)) {
        score = -0.4;
        status = "ارتداد ضعيف دون 38.2%";
      } else if (p <= lv(0.618)) {
        score = -0.1;
        status = "ارتداد متوسط";
      } else {
        score = 0.3;
        status = "ارتداد قوي فوق 61.8%";
      }
    }
    s.push(
      makeSignal({
        key: "fibonacci",
        nameAr: "تصحيحات فيبوناتشي",
        nameEn: "Fibonacci Retracement",
        category: "levels",
        value: null,
        valueText: `${formatPrice(c.fib.low)} → ${formatPrice(c.fib.high)}`,
        status,
        score,
        explanation: "مستويات فيبوناتشي بين أعلى قمة وأدنى قاع في آخر 120 شمعة تساعد على تقييم عمق التصحيح أو قوة الارتداد.",
      }),
    );
  }

  // ───── التقلب والمخاطر ─────
  if (c.atrPct != null && c.bbBandwidth != null) {
    // نقارن ATR% الحالي بعرض نطاق بولينجر كمرجع للتقلب المعتاد
    const ratio = c.atrPct / Math.max(c.bbBandwidth / 4, 0.0001);
    const expanding = ratio > 1.5;
    const calm = ratio < 0.7;
    const priceDown = (c.priceChange10 ?? 0) < 0;
    const score = expanding ? (priceDown ? -0.6 : -0.15) : calm ? 0.2 : 0.15;
    s.push(
      makeSignal({
        key: "atr",
        nameAr: "متوسط المدى الحقيقي",
        nameEn: "ATR 14",
        category: "volatility",
        value: c.atr14,
        valueText: `${formatPrice(c.atr14)} (${formatPercent(c.atrPct, { sign: false })})`,
        status: expanding ? "تقلب متزايد" : calm ? "تقلب منخفض" : "تقلب طبيعي",
        score,
        explanation: "ATR يقيس متوسط مدى الحركة؛ ارتفاعه المفاجئ خاصة مع الهبوط يزيد المخاطر ويتطلب وقف خسارة أوسع.",
      }),
    );
  }

  if (c.bbPercentB != null) {
    const b = c.bbPercentB;
    let score = 0;
    let status = "داخل النطاق";
    if (b > 1) {
      score = -0.3;
      status = "فوق الحد العلوي — امتداد مفرط";
    } else if (b < 0) {
      score = -0.2;
      status = "دون الحد السفلي — ضغط بيعي قوي";
    } else if (b >= 0.5 && up) {
      score = 0.3;
      status = "النصف العلوي من النطاق مع اتجاه صاعد";
    } else if (b < 0.5 && down) {
      score = -0.3;
      status = "النصف السفلي من النطاق مع اتجاه هابط";
    }
    s.push(
      makeSignal({
        key: "bollinger",
        nameAr: "نطاقات بولينجر",
        nameEn: "Bollinger Bands (20,2)",
        category: "volatility",
        value: b,
        valueText: `%B ${fmt(b, 2)} / العرض ${formatPercent(c.bbBandwidth, { sign: false })}`,
        status,
        score,
        explanation: "تقيس موقع السعر بالنسبة لتقلبه المعتاد؛ الخروج عن النطاق يعني حركة ممتدة قد تتبعها عودة للمتوسط.",
      }),
    );
  }

  return s;
}

/** مساعد لعرض المسافة بين السعر ومتوسط */
export function maDistance(price: number, ma: number | null) {
  return distancePct(price, ma);
}
