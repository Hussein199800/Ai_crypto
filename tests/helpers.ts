import type { AssetOverview, DataMeta, DominanceData, FearGreedData, GlobalMarketData, OHLCV, OHLCVSeries, Timeframe } from "@/types/market";
import { TIMEFRAMES } from "@/types/market";
import { TIMEFRAME_MS, alignTime } from "@/lib/timeframes";
import type { AnalysisInput } from "@/lib/analysis/engine";

export const NOW = Date.UTC(2026, 9, 6, 12, 0, 0);

export function meta(over: Partial<DataMeta> = {}): DataMeta {
  return { source: "test", fetchedAt: new Date(NOW).toISOString(), isStale: false, isMock: false, ...over };
}

/** مولد أرقام شبه عشوائية حتمي */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * سلسلة شموع اصطناعية: drift = الاتجاه لكل شمعة، wave = تذبذب دوري (تصحيحات)،
 * volumeTrend = ميل الحجم مع الزمن.
 */
export function makeCandles(opts: {
  n?: number;
  tf?: Timeframe;
  start?: number;
  drift?: number;
  noise?: number;
  wave?: number;
  volume?: number;
  volumeTrend?: number;
  seed?: number;
  now?: number;
}): OHLCV[] {
  const n = opts.n ?? 300;
  const tf = opts.tf ?? "1d";
  const r = rng(opts.seed ?? 1);
  const size = TIMEFRAME_MS[tf];
  const end = alignTime(opts.now ?? NOW, tf) - size;
  let price = opts.start ?? 100;
  const out: OHLCV[] = [];
  for (let i = 0; i < n; i++) {
    const open = price;
    const wave = (opts.wave ?? 0) * Math.sin(i / 6);
    const change = (opts.drift ?? 0) + wave + ((r() - 0.5) * 2 * (opts.noise ?? 0.01));
    const close = Math.max(0.0001, open * (1 + change));
    const high = Math.max(open, close) * (1 + r() * 0.005);
    const low = Math.min(open, close) * (1 - r() * 0.005);
    const baseVol = (opts.volume ?? 1000) * (1 + (opts.volumeTrend ?? 0) * i);
    const volume = baseVol * (close >= open ? 1.3 : 0.8) * (0.9 + r() * 0.2);
    out.push({ time: end - (n - 1 - i) * size, open, high, low, close, volume });
    price = close;
  }
  return out;
}

export function series(candles: OHLCV[], tf: Timeframe, m: Partial<DataMeta> = {}): OHLCVSeries {
  return { symbol: "TEST", timeframe: tf, candles, meta: meta(m) };
}

export function overview(price: number, over: Partial<AssetOverview> = {}): AssetOverview {
  return {
    symbol: "SOL",
    name: "Solana",
    kind: "CRYPTO",
    price,
    change1h: 0.2,
    change24h: 1,
    change7d: 3,
    change30d: 8,
    marketCap: 60e9,
    volume24h: 2e9,
    high24h: null,
    low24h: null,
    ath: price * 1.2,
    athDate: null,
    atl: null,
    atlDate: null,
    circulatingSupply: null,
    maxSupply: null,
    rank: 5,
    spreadPct: 0.02,
    meta: meta(),
    ...over,
  };
}

export function neutralGlobal(over: Partial<GlobalMarketData> = {}): GlobalMarketData {
  return {
    totalMarketCap: 2.4e12,
    totalVolume24h: 1e11,
    marketCapChange24h: 0.2,
    btcMarketCap: 1.3e12,
    ethMarketCap: 3e11,
    usdtMarketCap: 1.2e11,
    btcChange24h: 0.2,
    ethChange24h: 0.2,
    usdtChange24h: 0.2,
    activeCryptocurrencies: 10000,
    meta: meta(),
    ...over,
  };
}

export function dominanceFrom(g: GlobalMarketData, over: Partial<DominanceData> = {}): DominanceData {
  return {
    btcDominance: (g.btcMarketCap! / g.totalMarketCap) * 100,
    ethDominance: (g.ethMarketCap! / g.totalMarketCap) * 100,
    usdtDominance: (g.usdtMarketCap! / g.totalMarketCap) * 100,
    btcDominanceChange24h: 0,
    usdtDominanceChange24h: 0,
    total: g.totalMarketCap,
    total2: g.totalMarketCap - g.btcMarketCap!,
    total3: g.totalMarketCap - g.btcMarketCap! - g.ethMarketCap!,
    method: "test",
    meta: meta(),
    ...over,
  };
}

export function fearGreed(value: number): FearGreedData {
  return { value, classification: "x", classificationAr: "x", timestamp: new Date(NOW).toISOString(), history: [], meta: meta() };
}

/** مدخلات تحليل كاملة بنفس شكل السلسلة على جميع الأطر */
export function analysisInput(shape: Parameters<typeof makeCandles>[0], over: Partial<AnalysisInput> = {}): AnalysisInput {
  const s: AnalysisInput["series"] = {};
  for (const tf of TIMEFRAMES) s[tf] = series(makeCandles({ ...shape, tf }), tf);
  const last = s["1d"]!.candles.at(-1)!.close;
  const g = neutralGlobal();
  return {
    symbol: "SOL",
    horizon: "MEDIUM",
    overview: overview(last),
    series: s,
    global: g,
    dominance: dominanceFrom(g),
    fearGreed: fearGreed(50),
    news: null,
    btcDaily: makeCandles({ n: 250, drift: 0, noise: 0.01, seed: 99 }),
    ethDaily: makeCandles({ n: 250, drift: 0, noise: 0.01, seed: 98 }),
    ethBtcDaily: makeCandles({ n: 250, drift: 0, noise: 0.01, seed: 97 }),
    now: NOW,
    ...over,
  };
}
