import { percentText, priceText } from "@/lib/formatters";
import { TREND_LABELS } from "@/lib/formatters/labels";
import { distancePct } from "@/lib/indicators";
import type { MomentumAnalysis, MovingAverageState, TrendAnalysis, TrendDirection, VolumeAnalysis } from "@/types/analysis";
import type { AssetOverview, Timeframe } from "@/types/market";
import { structureOf, type ComputedIndicators, type TimeframeResult } from "./timeframe";

function pick(results: Partial<Record<Timeframe, TimeframeResult>>, order: Timeframe[]) {
  for (const tf of order) {
    const r = results[tf];
    if (r?.analysis.available && r.computed) return r;
  }
  return null;
}

export function buildTrendAnalysis(results: Partial<Record<Timeframe, TimeframeResult>>, primary: ComputedIndicators | null): TrendAnalysis {
  const shortR = pick(results, ["4h", "1h", "15m"]);
  const medR = pick(results, ["1d", "4h"]);
  const longR = pick(results, ["1w", "1d"]);
  const short: TrendDirection = shortR?.analysis.trend ?? "UNKNOWN";
  const medium: TrendDirection = medR?.analysis.trend ?? "UNKNOWN";
  let long: TrendDirection = longR?.analysis.trend ?? "UNKNOWN";
  // في الإطار اليومي كبديل: نستخدم EMA 200 للاتجاه طويل المدى
  if (longR && longR.analysis.timeframe === "1d" && longR.computed?.ema200 != null) {
    long = longR.computed.price > longR.computed.ema200 ? "UP" : "DOWN";
  }

  const ref = medR?.computed ?? primary;
  const strength = primary?.adx14 ?? null;
  const strengthLabel =
    strength == null ? "غير متاح" : strength >= 40 ? "قوي جدًا" : strength >= 25 ? "قوي" : strength >= 20 ? "متوسط" : "ضعيف / لا اتجاه";

  const mas: MovingAverageState[] = ref
    ? (
        [
          ["ema20", "EMA 20", ref.ema20],
          ["ema50", "EMA 50", ref.ema50],
          ["ema100", "EMA 100", ref.ema100],
          ["ema200", "EMA 200", ref.ema200],
          ["sma20", "SMA 20", ref.sma20],
          ["sma50", "SMA 50", ref.sma50],
        ] as [string, string, number | null][]
      ).map(([key, label, value]) => ({
        key,
        label,
        value,
        above: value == null ? null : ref.price > value,
        distancePct: distancePct(ref.price, value),
      }))
    : [];

  // التقاطع الذهبي / تقاطع الموت: الأولوية للإطار اليومي
  let cross: TrendAnalysis["cross"] = { type: "NONE", timeframe: null, barsAgo: null, description: "لا يوجد تقاطع حديث بين EMA 50 وEMA 200." };
  for (const tf of ["1d", "4h", "1w"] as Timeframe[]) {
    const c = results[tf]?.computed?.goldenDeathCross;
    if (c) {
      cross = {
        type: c.type,
        timeframe: tf,
        barsAgo: c.barsAgo,
        description:
          c.type === "GOLDEN"
            ? `تقاطع ذهبي (EMA 50 فوق EMA 200) على إطار ${tf} قبل ${c.barsAgo} شمعة — إشارة متأخرة على تحسن الاتجاه.`
            : `تقاطع الموت (EMA 50 تحت EMA 200) على إطار ${tf} قبل ${c.barsAgo} شمعة — إشارة متأخرة على ضعف الاتجاه.`,
      };
      break;
    }
  }

  const pivots = primary?.pivots ?? [];
  const structure = structureOf(pivots);
  const swings = {
    highs: pivots.filter((p) => p.type === "high").slice(-3).map((p) => ({ time: p.time, price: p.price })),
    lows: pivots.filter((p) => p.type === "low").slice(-3).map((p) => ({ time: p.time, price: p.price })),
    structure,
    description:
      structure === "HIGHER_HIGHS"
        ? "السعر يكوّن قممًا وقيعانًا أعلى — هيكل صاعد."
        : structure === "LOWER_LOWS"
          ? "السعر يكوّن قممًا وقيعانًا أدنى — هيكل هابط."
          : structure === "MIXED"
            ? "القمم والقيعان غير متسقة — هيكل غير محسوم."
            : "لا تتوفر قمم وقيعان كافية للحكم.",
  };

  let zone: TrendAnalysis["zone"] = "UNKNOWN";
  let zoneDescription = "لا تتوفر مستويات دعم ومقاومة كافية.";
  if (primary && primary.atr14 != null) {
    const s1 = primary.supports[0]?.price;
    const r1 = primary.resistances[0]?.price;
    const nearS = s1 != null && primary.price - s1 <= primary.atr14 * 1.2;
    const nearR = r1 != null && r1 - primary.price <= primary.atr14 * 1.2;
    if (nearS && !nearR) {
      zone = "NEAR_SUPPORT";
      zoneDescription = `السعر قريب من منطقة دعم عند ${priceText(s1)}.`;
    } else if (nearR && !nearS) {
      zone = "NEAR_RESISTANCE";
      zoneDescription = `السعر قريب من منطقة مقاومة عند ${priceText(r1)}.`;
    } else if (s1 != null || r1 != null) {
      zone = "MIDDLE";
      zoneDescription = `السعر بين الدعم ${priceText(s1 ?? null)} والمقاومة ${priceText(r1 ?? null)}.`;
    }
  }

  const description = `الاتجاه قصير المدى ${TREND_LABELS[short]}، ومتوسط المدى ${TREND_LABELS[medium]}، وطويل المدى ${TREND_LABELS[long]}. قوة الاتجاه (ADX): ${strengthLabel}.`;
  return { short, medium, long, strength, strengthLabel, priceVsMAs: mas, cross, swings, zone, zoneDescription, description };
}

export function buildMomentumAnalysis(c: ComputedIndicators | null): MomentumAnalysis {
  if (!c) {
    return { rsi: null, rsiState: "غير متاح", macd: null, roc: null, buyPressure: null, divergence: { type: "NONE", description: "غير متاح" }, trend: "UNKNOWN", description: "بيانات الزخم غير متاحة." };
  }
  const r = c.rsi14;
  const rsiState =
    r == null ? "غير متاح" : r > 75 ? "تشبع شرائي" : r >= 55 ? "زخم إيجابي" : r >= 45 ? "متوازن" : r >= 25 ? "زخم سلبي" : "تشبع بيعي";
  const histRising = c.macdHist != null && c.macdHistPrev != null ? c.macdHist > c.macdHistPrev : null;
  const rsiRising = r != null && c.rsiPrev != null ? r > c.rsiPrev : null;
  let trend: MomentumAnalysis["trend"] = "UNKNOWN";
  if (histRising != null && rsiRising != null) trend = histRising && rsiRising ? "IMPROVING" : !histRising && !rsiRising ? "WEAKENING" : "STABLE";
  const divDesc =
    c.divergence.type === "BULLISH"
      ? `انفراج إيجابي بين السعر وRSI قبل ${c.divergence.barsAgo} شمعة.`
      : c.divergence.type === "BEARISH"
        ? `انفراج سلبي بين السعر وRSI قبل ${c.divergence.barsAgo} شمعة.`
        : "لا يوجد انفراج واضح بين السعر وRSI.";
  const bp = c.buyPressure;
  const trendText = trend === "IMPROVING" ? "الزخم يتحسن" : trend === "WEAKENING" ? "الزخم يضعف" : trend === "STABLE" ? "الزخم مستقر" : "اتجاه الزخم غير واضح";
  return {
    rsi: r,
    rsiState,
    macd: c.macd != null && c.macdSignal != null && c.macdHist != null ? { macd: c.macd, signal: c.macdSignal, histogram: c.macdHist } : null,
    roc: c.roc10,
    buyPressure: bp,
    divergence: { type: c.divergence.type, description: divDesc },
    trend,
    description: `${trendText}. RSI في حالة "${rsiState}"${bp != null ? `، وحصة حجم الشموع الصاعدة ${bp.toFixed(0)}% من إجمالي الحجم (تقدير لقوة المشترين)` : ""}.`,
  };
}

export function buildVolumeAnalysis(c: ComputedIndicators | null, overview: AssetOverview): VolumeAnalysis {
  const warnings: string[] = [];
  const vol24 = overview.volume24h;
  const mcap = overview.marketCap;
  const v2m = vol24 != null && mcap ? (vol24 / mcap) * 100 : null;
  let liquidity: VolumeAnalysis["liquidityLevel"] = "UNKNOWN";
  if (vol24 != null) {
    if (vol24 >= 500e6 || (v2m ?? 0) >= 8) liquidity = "HIGH";
    else if (vol24 >= 20e6 || (v2m ?? 0) >= 3) liquidity = "MEDIUM";
    else liquidity = "LOW";
  }
  if (!c || !c.hasVolume) {
    return {
      currentVolume: null,
      averageVolume: null,
      volumeChangePct: null,
      volume24h: vol24,
      volumeToMarketCap: v2m,
      liquidityLevel: liquidity,
      spreadPct: overview.spreadPct ?? null,
      supportedByVolume: null,
      obvTrend: "UNKNOWN",
      warnings: ["لا تتوفر بيانات حجم تفصيلية لهذا الأصل."],
      description: "تحليل الحجم غير متاح لهذا الأصل.",
    };
  }
  const change = c.volume != null && c.volumeMA20 ? ((c.volume - c.volumeMA20) / c.volumeMA20) * 100 : null;
  let supported: boolean | null = null;
  if (c.priceChange10 != null && c.volumeRatio10 != null) {
    if (c.priceChange10 > 0) supported = c.volumeRatio10 >= 1;
    if (c.priceChange10 > 3 && c.volumeRatio10 < 0.85) warnings.push("ارتفاع سعري بدون ارتفاع واضح في الحجم — قد تكون الحركة ضعيفة.");
    if (c.priceChange10 < -3 && c.volumeRatio10 > 1.2) warnings.push("هبوط مصحوب بحجم مرتفع — ضغط بيع حقيقي.");
  }
  if (liquidity === "LOW") warnings.push("سيولة منخفضة — قد يكون الانزلاق السعري مرتفعًا.");
  if ((overview.spreadPct ?? 0) > 0.2) warnings.push(`فارق سعر الشراء والبيع مرتفع (${percentText(overview.spreadPct, { sign: false })}).`);
  const obvTrend: TrendDirection = c.obvSlope == null ? "UNKNOWN" : c.obvSlope > 2 ? "UP" : c.obvSlope < -2 ? "DOWN" : "SIDEWAYS";
  return {
    currentVolume: c.volume,
    averageVolume: c.volumeMA20,
    volumeChangePct: change,
    volume24h: vol24,
    volumeToMarketCap: v2m,
    liquidityLevel: liquidity,
    spreadPct: overview.spreadPct ?? null,
    supportedByVolume: supported,
    obvTrend,
    warnings,
    description:
      supported === true
        ? "الحركة الأخيرة مدعومة بحجم تداول متزايد."
        : supported === false
          ? "الحركة الصاعدة الأخيرة غير مدعومة بحجم كافٍ."
          : "لا توجد حركة صاعدة واضحة تحتاج إلى تأكيد حجم حاليًا.",
  };
}
