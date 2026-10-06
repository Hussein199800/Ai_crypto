import { SCORING_RULES } from "@/config/scoring";
import { formatCompact, formatNumber, formatPercent } from "@/lib/formatters";
import { PHASE_LABELS, TREND_LABELS } from "@/lib/formatters/labels";
import type { IndicatorSignal, MarketContext, MarketPhase, TrendDirection } from "@/types/analysis";
import type { AssetKind, DominanceData, FearGreedData, GlobalMarketData, OHLCV } from "@/types/market";
import { computeIndicators, trendOf } from "./timeframe";
import { makeSignal } from "./signal";

export interface MarketContextInput {
  symbol: string;
  kind: AssetKind;
  global: GlobalMarketData | null;
  dominance: DominanceData | null;
  fearGreed: FearGreedData | null;
  btcDaily: OHLCV[] | null;
  ethDaily: OHLCV[] | null;
  ethBtcDaily: OHLCV[] | null;
}

export function dailyTrend(candles: OHLCV[] | null): TrendDirection {
  if (!candles || candles.length < 50) return "UNKNOWN";
  return trendOf(computeIndicators(candles, "1d"));
}

/**
 * تحديد مرحلة السوق من تغيرات الهيمنة وإجمالي السوق.
 * لا يُستخدم أي مؤشر منفردًا: المرحلة ناتجة عن تركيب عدة قراءات.
 */
export function determinePhase(p: {
  btcDominance: number | null;
  btcDominanceChange24h: number | null;
  usdtDominanceChange24h: number | null;
  totalChange24h: number | null;
}): MarketPhase {
  const bd = p.btcDominanceChange24h;
  const ud = p.usdtDominanceChange24h;
  const tc = p.totalChange24h;
  if (tc == null) return "NEUTRAL";
  if (ud != null && ud > 0.1 && tc < 0) return "RISK_OFF";
  if (bd != null && ud != null && bd > 0.2 && ud > 0.05) return "RISK_OFF";
  if (bd != null && bd < -0.2 && tc > 0) return "ALTCOIN_SEASON";
  if (bd != null && bd > 0.2 && (p.btcDominance ?? 0) > 50) return "BITCOIN_SEASON";
  if (ud != null && ud < -0.05 && tc > 0) return "RISK_ON";
  return "NEUTRAL";
}

export function analyzeMarketContext(input: MarketContextInput): MarketContext {
  const { global: g, dominance: d, fearGreed: fg } = input;
  const isBtc = input.symbol === "BTC";
  const isAlt = input.kind === "CRYPTO" && !isBtc;
  const btcTrend = dailyTrend(input.btcDaily);
  const ethTrend = dailyTrend(input.ethDaily);
  const ethBtcTrend = dailyTrend(input.ethBtcDaily);
  const totalChange = g?.marketCapChange24h ?? null;
  const bdc = d?.btcDominanceChange24h ?? null;
  const udc = d?.usdtDominanceChange24h ?? null;
  const signals: IndicatorSignal[] = [];
  const relations: string[] = [];

  if (totalChange != null) {
    signals.push(
      makeSignal({
        key: "totalTrend",
        nameAr: "إجمالي القيمة السوقية",
        nameEn: "TOTAL Market Cap (24h)",
        category: "market",
        value: totalChange,
        valueText: `${formatCompact(g?.totalMarketCap)} (${formatPercent(totalChange)})`,
        status: totalChange > 1.5 ? "السوق الكلي يرتفع بوضوح" : totalChange < -1.5 ? "السوق الكلي يتراجع بوضوح" : "السوق الكلي مستقر نسبيًا",
        score: Math.max(-0.6, Math.min(0.6, totalChange / 3)),
        explanation: "اتجاه إجمالي السوق يعكس تدفق السيولة العام إلى العملات الرقمية أو خروجها منها.",
      }),
    );
  }

  if (udc != null) {
    const strong = udc > SCORING_RULES.usdtDominanceStrongRise;
    const score = strong ? -0.8 : udc > 0.05 ? -0.3 : udc < -0.05 ? 0.4 : 0;
    signals.push(
      makeSignal({
        key: "usdtDominance",
        nameAr: "هيمنة تيثر",
        nameEn: "USDT.D (24h)",
        category: "market",
        value: d?.usdtDominance ?? null,
        valueText: `${formatNumber(d?.usdtDominance, 2)}% (${udc > 0 ? "+" : ""}${formatNumber(udc, 3)} نقطة)`,
        status: strong ? "ارتفاع قوي — تراجع شهية المخاطرة" : udc > 0.05 ? "ارتفاع طفيف" : udc < -0.05 ? "انخفاض — عودة السيولة للأصول" : "مستقرة",
        score,
        explanation: "ارتفاع هيمنة تيثر يعني تحول جزء من السيولة إلى العملة المستقرة (موقف دفاعي)، وانخفاضها يعني إقبالًا على الأصول الأكثر مخاطرة.",
      }),
    );
  }

  if (bdc != null && totalChange != null) {
    const bdUp = bdc > 0.05;
    const bdDown = bdc < -0.05;
    const totalUp = totalChange > 0;
    let score = 0;
    let status = "هيمنة البيتكوين مستقرة";
    if (bdUp && udc != null && udc > 0.05) {
      score = -0.6;
      status = "BTC.D وUSDT.D يرتفعان معًا — حالة دفاعية";
      relations.push("ارتفاع هيمنة البيتكوين وهيمنة تيثر معًا يشير إلى حالة دفاعية أو Risk-Off محتملة: السيولة تتجه للأصول الأكثر أمانًا نسبيًا.");
    } else if (bdUp && totalUp) {
      score = isBtc ? 0.5 : isAlt ? -0.3 : 0;
      status = "BTC.D يرتفع مع صعود السوق — قوة نسبية للبيتكوين";
      relations.push("ارتفاع هيمنة البيتكوين مع صعود السوق الكلي يعني قوة نسبية للبيتكوين واحتمال ضعف نسبي للعملات البديلة.");
    } else if (bdDown && totalUp) {
      score = isAlt ? 0.6 : isBtc ? 0.1 : 0;
      status = "BTC.D ينخفض مع صعود السوق — توسع السيولة للبديلة";
      relations.push("انخفاض هيمنة البيتكوين مع صعود السوق الكلي قد يعني توسع السيولة نحو العملات البديلة.");
    } else if (bdUp && !totalUp) {
      score = isBtc ? -0.1 : -0.4;
      status = "BTC.D يرتفع مع تراجع السوق — البديلة تتراجع أسرع";
      relations.push("ارتفاع هيمنة البيتكوين مع تراجع السوق يعني أن العملات البديلة تتراجع بوتيرة أسرع من البيتكوين.");
    } else if (bdDown && !totalUp) {
      score = -0.3;
      status = "BTC.D ينخفض مع تراجع السوق";
      relations.push("انخفاض هيمنة البيتكوين مع تراجع السوق قد يعكس ضغط بيع على البيتكوين نفسه.");
    }
    signals.push(
      makeSignal({
        key: "btcDominance",
        nameAr: "هيمنة البيتكوين",
        nameEn: "BTC.D (24h)",
        category: "market",
        value: d?.btcDominance ?? null,
        valueText: `${formatNumber(d?.btcDominance, 2)}% (${bdc > 0 ? "+" : ""}${formatNumber(bdc, 3)} نقطة)`,
        status,
        score,
        explanation: "تُقرأ هيمنة البيتكوين دائمًا مع اتجاه إجمالي السوق، وليست توصية شراء أو بيع بحد ذاتها.",
      }),
    );
  }

  if (!isBtc && btcTrend !== "UNKNOWN" && input.kind === "CRYPTO") {
    signals.push(
      makeSignal({
        key: "btcTrend",
        nameAr: "اتجاه البيتكوين (يومي)",
        nameEn: "BTC Daily Trend",
        category: "market",
        value: null,
        valueText: TREND_LABELS[btcTrend],
        status: `البيتكوين في اتجاه ${TREND_LABELS[btcTrend]}`,
        score: btcTrend === "UP" ? 0.5 : btcTrend === "DOWN" ? -0.5 : 0,
        explanation: "معظم العملات البديلة تتأثر باتجاه البيتكوين؛ هبوطه يضغط عادة على السوق كله.",
      }),
    );
  }

  if (isAlt && input.symbol !== "ETH" && ethBtcTrend !== "UNKNOWN") {
    signals.push(
      makeSignal({
        key: "ethBtc",
        nameAr: "نسبة الإيثريوم إلى البيتكوين",
        nameEn: "ETH/BTC Trend",
        category: "market",
        value: null,
        valueText: TREND_LABELS[ethBtcTrend],
        status: ethBtcTrend === "UP" ? "ETH/BTC صاعد — شهية للبديلة" : ethBtcTrend === "DOWN" ? "ETH/BTC هابط — تفضيل للبيتكوين" : "ETH/BTC عرضي",
        score: ethBtcTrend === "UP" ? 0.3 : ethBtcTrend === "DOWN" ? -0.3 : 0,
        explanation: "صعود ETH/BTC يُعدّ غالبًا مؤشرًا مبكرًا على انتقال السيولة إلى العملات البديلة.",
      }),
    );
    if (ethBtcTrend === "UP") relations.push("ETH/BTC في اتجاه صاعد، وهو مؤشر داعم للعملات البديلة.");
  }

  if (fg) {
    const v = fg.value;
    const score = v > 80 ? -0.3 : v >= 55 ? 0.3 : v >= 45 ? 0 : v >= 25 ? -0.2 : -0.1;
    signals.push(
      makeSignal({
        key: "fearGreed",
        nameAr: "مؤشر الخوف والطمع",
        nameEn: "Fear & Greed Index",
        category: "market",
        value: v,
        valueText: `${v} / 100 — ${fg.classificationAr}`,
        status: v > 80 ? "طمع شديد — حذر من التشبع" : v < 25 ? "خوف شديد — فرص محتملة مع مخاطر عالية" : fg.classificationAr,
        score,
        explanation: "يقيس معنويات السوق؛ الطمع الشديد قد يسبق تصحيحات، والخوف الشديد قد يسبق ارتدادات لكنه يرافق مخاطر مرتفعة.",
      }),
    );
  }

  const phase = determinePhase({
    btcDominance: d?.btcDominance ?? null,
    btcDominanceChange24h: bdc,
    usdtDominanceChange24h: udc,
    totalChange24h: totalChange,
  });
  relations.unshift(`مرحلة السوق المقدّرة: ${PHASE_LABELS[phase]}.`);
  if (udc != null && udc > SCORING_RULES.usdtDominanceStrongRise) {
    relations.push("هيمنة تيثر ترتفع بقوة: تحذير من تراجع الشهية للمخاطرة، ويُفضّل الحذر في الدخول الجديد.");
  }
  const marketTrend: TrendDirection =
    totalChange == null ? "UNKNOWN" : totalChange > 1 && btcTrend !== "DOWN" ? "UP" : totalChange < -1 && btcTrend !== "UP" ? "DOWN" : btcTrend === "UNKNOWN" ? "SIDEWAYS" : btcTrend;

  return {
    available: Boolean(g || d || fg),
    btcTrend,
    ethTrend,
    ethBtcTrend,
    btcDominance: d?.btcDominance ?? null,
    btcDominanceChange24h: bdc,
    usdtDominance: d?.usdtDominance ?? null,
    usdtDominanceChange24h: udc,
    totalMarketCap: g?.totalMarketCap ?? null,
    totalChange24h: totalChange,
    total2: d?.total2 ?? null,
    total3: d?.total3 ?? null,
    fearGreed: fg ? { value: fg.value, classificationAr: fg.classificationAr } : null,
    phase,
    marketTrend,
    signals,
    relations,
    dominanceMethod: d?.method ?? "غير متاح",
    dataTime: g?.meta.dataTime ?? g?.meta.fetchedAt ?? null,
  };
}
