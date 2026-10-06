import type { MarketPhase, RiskLevel, TrendDirection } from "@/types/analysis";
import type { AssetOverview, DominanceData, FearGreedData, GlobalMarketData, OHLCV } from "@/types/market";
import { formatPercent } from "@/lib/formatters";
import { dailyTrend, determinePhase } from "./market-context";

export interface MarketState {
  trend: TrendDirection;
  liquidity: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  risk: RiskLevel;
  phase: MarketPhase;
  notes: string[];
}

export interface MarketAlertItem {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  symbol?: string;
}

/** حالة السوق العامة للوحة التحكم — مبنية على عدة مؤشرات مجتمعة */
export function computeMarketState(g: GlobalMarketData | null, d: DominanceData | null, fg: FearGreedData | null, btcDaily: OHLCV[] | null): MarketState {
  const notes: string[] = [];
  const btcTrend = dailyTrend(btcDaily);
  const tc = g?.marketCapChange24h ?? null;
  let trend: TrendDirection = "UNKNOWN";
  if (tc != null || btcTrend !== "UNKNOWN") {
    if ((tc ?? 0) > 1 && btcTrend !== "DOWN") trend = "UP";
    else if ((tc ?? 0) < -1 && btcTrend !== "UP") trend = "DOWN";
    else trend = btcTrend === "UNKNOWN" ? "SIDEWAYS" : btcTrend;
  }

  let liquidity: MarketState["liquidity"] = "UNKNOWN";
  if (g?.totalVolume24h && g.totalMarketCap) {
    const ratio = (g.totalVolume24h / g.totalMarketCap) * 100;
    liquidity = ratio >= 6 ? "HIGH" : ratio >= 3 ? "MEDIUM" : "LOW";
    notes.push(`نسبة حجم التداول إلى القيمة السوقية ${ratio.toFixed(2)}%.`);
  }

  let riskPts = 0;
  if (fg) {
    if (fg.value > 80 || fg.value < 20) riskPts += 2;
    else if (fg.value > 70 || fg.value < 30) riskPts += 1;
  }
  const udc = d?.usdtDominanceChange24h ?? null;
  if (udc != null && udc > 0.15) riskPts += 2;
  else if (udc != null && udc > 0.05) riskPts += 1;
  if (tc != null && Math.abs(tc) > 5) riskPts += 2;
  else if (tc != null && Math.abs(tc) > 2.5) riskPts += 1;
  if (trend === "DOWN") riskPts += 1;
  const risk: RiskLevel = riskPts >= 4 ? "HIGH" : riskPts >= 2 ? "MEDIUM" : "LOW";

  const phase = determinePhase({
    btcDominance: d?.btcDominance ?? null,
    btcDominanceChange24h: d?.btcDominanceChange24h ?? null,
    usdtDominanceChange24h: udc,
    totalChange24h: tc,
  });
  return { trend, liquidity, risk, phase, notes };
}

/** تنبيهات السوق النظامية — محدودة العدد وبعتبات واضحة لتجنب التضليل */
export function computeMarketAlerts(
  overviews: AssetOverview[],
  d: DominanceData | null,
  fg: FearGreedData | null,
  stale: boolean,
): MarketAlertItem[] {
  const alerts: MarketAlertItem[] = [];
  if (stale) {
    alerts.push({ id: "stale", severity: "warning", title: "بيانات غير محدثة", message: "تعذر تحديث بعض البيانات من المصدر، والمعروض هو آخر بيانات محفوظة وليست لحظية." });
  }
  const udc = d?.usdtDominanceChange24h;
  if (udc != null && udc > 0.15) {
    alerts.push({ id: "usdt-d", severity: "warning", title: "ارتفاع هيمنة تيثر USDT.D", message: `ارتفعت هيمنة تيثر بنحو ${udc.toFixed(2)} نقطة خلال 24 ساعة — إشارة على تراجع شهية المخاطرة.`, symbol: "USDT.D" });
  }
  const bdc = d?.btcDominanceChange24h;
  if (bdc != null && Math.abs(bdc) > 0.5) {
    alerts.push({
      id: "btc-d",
      severity: "info",
      title: "تغير ملحوظ في هيمنة البيتكوين BTC.D",
      message: `${bdc > 0 ? "ارتفعت" : "انخفضت"} هيمنة البيتكوين بنحو ${Math.abs(bdc).toFixed(2)} نقطة خلال 24 ساعة.`,
      symbol: "BTC.D",
    });
  }
  if (fg && (fg.value >= 80 || fg.value <= 20)) {
    alerts.push({
      id: "fng",
      severity: "warning",
      title: fg.value >= 80 ? "طمع شديد في السوق" : "خوف شديد في السوق",
      message: `مؤشر الخوف والطمع عند ${fg.value} — ${fg.value >= 80 ? "احتمال تشبع وتصحيحات" : "تقلبات مرتفعة وفرص مصحوبة بمخاطر"}.`,
    });
  }
  const movers = overviews
    .filter((o) => o.kind === "CRYPTO" && o.change24h != null && Math.abs(o.change24h) >= 8)
    .sort((a, b) => Math.abs(b.change24h!) - Math.abs(a.change24h!))
    .slice(0, 3);
  for (const m of movers) {
    alerts.push({
      id: `move-${m.symbol}`,
      severity: Math.abs(m.change24h!) >= 15 ? "critical" : "info",
      title: `تغير قوي في سعر ${m.symbol}`,
      message: `${m.name}: ${formatPercent(m.change24h)} خلال 24 ساعة.`,
      symbol: m.symbol,
    });
  }
  return alerts.slice(0, 6);
}

/** ترتيب القوة السعرية النسبية (ليس درجة تحليل) */
export function relativeStrength(o: AssetOverview): number | null {
  if (o.change24h == null && o.change7d == null) return null;
  return (o.change7d ?? 0) * 0.5 + (o.change24h ?? 0) * 0.3 + (o.change30d ?? 0) * 0.2;
}
