import { historicalVolatility, maxDrawdown } from "@/lib/indicators";
import type { RiskAssessment, RiskLevel, VolumeAnalysis } from "@/types/analysis";
import type { AssetKind, AssetOverview, OHLCV } from "@/types/market";
import { formatPercent } from "@/lib/formatters";

export interface RiskInput {
  kind: AssetKind;
  overview: AssetOverview;
  daily: OHLCV[] | null;
  primaryAtrPct: number | null;
  liquidity: VolumeAnalysis["liquidityLevel"];
  fearGreed: number | null;
  usdtDominanceChange24h: number | null;
  dataQuality: number;
  conflicted: boolean;
}

/** تقييم المخاطر: درجة 0..100 (الأعلى = مخاطرة أكبر) مع عوامل مفسّرة */
export function assessRisk(input: RiskInput): RiskAssessment {
  const factors: string[] = [];
  let score = 0;
  const closes = input.daily?.map((c) => c.close) ?? [];
  const vol30 = closes.length > 31 ? historicalVolatility(closes, 365, 30) : null;
  const mdd90 = closes.length > 10 ? maxDrawdown(closes.slice(-90)) : null;
  const o = input.overview;
  const ddAth = o.ath && o.price ? ((o.price - o.ath) / o.ath) * 100 : null;

  if (input.kind === "STABLECOIN") {
    const dev = o.price != null ? Math.abs(o.price - 1) : null;
    if (dev != null && dev > 0.01) {
      factors.push(`انحراف عن الربط بالدولار بمقدار ${formatPercent(dev * 100, { sign: false })}`);
      return { level: "HIGH", score: 80, atrPct: input.primaryAtrPct, volatility30d: vol30, drawdownFromAth: ddAth, maxDrawdown90d: mdd90, factors };
    }
    factors.push("عملة مستقرة مرتبطة بالدولار — المخاطر الرئيسية تتعلق بالجهة المصدرة والربط");
    return { level: "LOW", score: 15, atrPct: input.primaryAtrPct, volatility30d: vol30, drawdownFromAth: null, maxDrawdown90d: mdd90, factors };
  }

  if (vol30 != null) {
    if (vol30 > 120) {
      score += 45;
      factors.push(`تقلب سنوي مرتفع جدًا (${vol30.toFixed(0)}%)`);
    } else if (vol30 > 80) {
      score += 32;
      factors.push(`تقلب سنوي مرتفع (${vol30.toFixed(0)}%)`);
    } else if (vol30 > 50) {
      score += 20;
      factors.push(`تقلب سنوي متوسط (${vol30.toFixed(0)}%)`);
    } else {
      score += 8;
    }
  } else {
    score += 15;
    factors.push("تعذر حساب التقلب التاريخي");
  }

  if (input.kind === "CRYPTO") {
    if (o.rank == null || o.rank > 100) {
      score += 15;
      factors.push("قيمة سوقية صغيرة نسبيًا أو ترتيب غير معروف");
    } else if (o.rank > 20) {
      score += 8;
    }
  }
  if (input.liquidity === "LOW") {
    score += 15;
    factors.push("سيولة ضعيفة — احتمال انزلاق سعري أكبر");
  } else if (input.liquidity === "MEDIUM") score += 5;

  if (ddAth != null && ddAth < -80) {
    score += 10;
    factors.push(`بعيدة عن قمتها التاريخية بنسبة ${formatPercent(ddAth)}`);
  }
  if (mdd90 != null && mdd90 < -40) {
    score += 10;
    factors.push(`أقصى تراجع خلال 90 يومًا ${formatPercent(mdd90)}`);
  }
  if (input.fearGreed != null && (input.fearGreed > 80 || input.fearGreed < 20)) {
    score += 5;
    factors.push("معنويات السوق في منطقة متطرفة");
  }
  if (input.usdtDominanceChange24h != null && input.usdtDominanceChange24h > 0.15) {
    score += 5;
    factors.push("ارتفاع هيمنة تيثر — بيئة دفاعية");
  }
  if (input.dataQuality < 60) {
    score += 10;
    factors.push("جودة البيانات محدودة");
  }
  if (input.conflicted) {
    score += 5;
    factors.push("تضارب في المؤشرات يزيد عدم اليقين");
  }
  score = Math.min(100, Math.round(score));
  const level: RiskLevel = score < 35 ? "LOW" : score < 60 ? "MEDIUM" : "HIGH";
  return { level, score, atrPct: input.primaryAtrPct, volatility30d: vol30, drawdownFromAth: ddAth, maxDrawdown90d: mdd90, factors };
}
