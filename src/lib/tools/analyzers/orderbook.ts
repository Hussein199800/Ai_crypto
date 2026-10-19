import type { OrderBook } from "@/types/market";

export interface OrderBookAnalysis {
  mid: number;
  spreadPct: number;
  depth: { pct: number; bids: number; asks: number; imbalance: number }[];
  bidWalls: { price: number; notional: number }[];
  askWalls: { price: number; notional: number }[];
}

/** تحليل دفتر الأوامر: العمق بالقيمة (USD) ضمن نطاقات، وعدم التوازن، وجدران السيولة الأكبر */
export function analyzeOrderBook(book: OrderBook): OrderBookAnalysis | null {
  const bestBid = book.bids[0]?.price;
  const bestAsk = book.asks[0]?.price;
  if (!bestBid || !bestAsk) return null;
  const mid = (bestBid + bestAsk) / 2;
  const notional = (l: { price: number; quantity: number }) => l.price * l.quantity;
  const depth = [0.5, 1, 2, 5].map((pct) => {
    const bids = book.bids.filter((l) => l.price >= mid * (1 - pct / 100)).reduce((s, l) => s + notional(l), 0);
    const asks = book.asks.filter((l) => l.price <= mid * (1 + pct / 100)).reduce((s, l) => s + notional(l), 0);
    return { pct, bids, asks, imbalance: bids + asks > 0 ? (bids - asks) / (bids + asks) : 0 };
  });
  const walls = (levels: { price: number; quantity: number }[]) => {
    const near = levels.filter((l) => Math.abs(l.price - mid) / mid <= 0.05).map((l) => ({ price: l.price, notional: notional(l) }));
    if (near.length === 0) return [];
    const m = near.reduce((s, l) => s + l.notional, 0) / near.length;
    const sd = Math.sqrt(near.reduce((s, l) => s + (l.notional - m) ** 2, 0) / near.length);
    return near
      .filter((l) => l.notional > m + 3 * sd)
      .sort((a, b) => b.notional - a.notional)
      .slice(0, 3);
  };
  return { mid, spreadPct: ((bestAsk - bestBid) / mid) * 100, depth, bidWalls: walls(book.bids), askWalls: walls(book.asks) };
}
