import type { DominanceData, GlobalMarketData } from "@/types/market";

/**
 * حساب الهيمنة: القيمة السوقية للأصل ÷ إجمالي القيمة السوقية للعملات الرقمية × 100
 * - BTC.D = Bitcoin Market Cap / Total Crypto Market Cap * 100
 * - USDT.D = USDT Market Cap / Total Crypto Market Cap * 100
 * يُعيد null إذا كانت البيانات ناقصة أو غير منطقية بدلًا من اختلاق رقم.
 */
export function calculateDominance(assetMarketCap: number | null | undefined, totalMarketCap: number | null | undefined): number | null {
  if (assetMarketCap == null || totalMarketCap == null) return null;
  if (!Number.isFinite(assetMarketCap) || !Number.isFinite(totalMarketCap)) return null;
  if (totalMarketCap <= 0 || assetMarketCap < 0 || assetMarketCap > totalMarketCap) return null;
  return (assetMarketCap / totalMarketCap) * 100;
}

/**
 * تقدير تغير الهيمنة خلال 24 ساعة (بالنقاط المئوية) من تغير القيمة السوقية للأصل
 * وتغير إجمالي السوق: القيمة السابقة = القيمة الحالية ÷ (1 + التغير%).
 */
export function deriveDominanceChange24h(
  assetMarketCap: number | null,
  assetChange24hPct: number | null,
  totalMarketCap: number | null,
  totalChange24hPct: number | null,
): number | null {
  if (assetMarketCap == null || assetChange24hPct == null || totalMarketCap == null || totalChange24hPct == null) return null;
  const now = calculateDominance(assetMarketCap, totalMarketCap);
  const prevAsset = assetMarketCap / (1 + assetChange24hPct / 100);
  const prevTotal = totalMarketCap / (1 + totalChange24hPct / 100);
  const prev = calculateDominance(prevAsset, prevTotal);
  if (now == null || prev == null) return null;
  return now - prev;
}

export function buildDominanceData(g: GlobalMarketData): DominanceData {
  const total = g.totalMarketCap;
  const btc = g.btcMarketCap;
  const eth = g.ethMarketCap;
  return {
    btcDominance: calculateDominance(btc, total),
    ethDominance: calculateDominance(eth, total),
    usdtDominance: calculateDominance(g.usdtMarketCap, total),
    btcDominanceChange24h: deriveDominanceChange24h(btc, g.btcChange24h, total, g.marketCapChange24h),
    usdtDominanceChange24h: deriveDominanceChange24h(g.usdtMarketCap, g.usdtChange24h, total, g.marketCapChange24h),
    total,
    total2: btc != null ? total - btc : null,
    total3: btc != null && eth != null ? total - btc - eth : null,
    method: `محسوبة: القيمة السوقية للأصل ÷ إجمالي السوق × 100 (المصدر: ${g.meta.source}). قد تختلف النتيجة بين المزودين بسبب اختلاف تعريف إجمالي السوق وعدد العملات المشمولة. تغير 24 ساعة مُشتق من تغير القيم السوقية.`,
    meta: { ...g.meta },
  };
}
