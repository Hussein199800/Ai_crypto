import { ASSETS, getAssetConfig } from "@/config/assets";
import { alignTime, TIMEFRAME_MS } from "@/lib/timeframes";
import type {
  AssetOverview,
  DataMeta,
  DominanceData,
  FearGreedData,
  GlobalMarketData,
  MarketDataProvider,
  MarketNewsResult,
  OHLCV,
  OHLCVSeries,
  Timeframe,
} from "@/types/market";
import { buildDominanceData } from "@/lib/analysis/dominance";
import { classifyFearGreedAr } from "./alternative-me";
import { UnknownSymbolError } from "./errors";

/**
 * مزود بيانات تجريبي — للاستخدام المحلي والاختبارات فقط.
 * البيانات مولّدة حتميًا (نفس الرمز = نفس السلسلة) وموسومة دائمًا isMock=true.
 * لا يُستخدم في الإنتاج (انظر isMockMode في lib/env.ts).
 */
const NAME = "Mock (بيانات تجريبية)";
const CANDLES = 500;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VOL_BY_TF: Record<Timeframe, number> = { "15m": 0.004, "1h": 0.008, "4h": 0.016, "1d": 0.035, "1w": 0.08 };

function meta(note?: string): DataMeta {
  return { source: NAME, fetchedAt: new Date().toISOString(), isStale: false, isMock: true, note: note ?? "بيانات تجريبية غير لحظية" };
}

export function generateMockCandles(symbol: string, tf: Timeframe, now = Date.now(), count = CANDLES): OHLCV[] {
  const cfg = getAssetConfig(symbol);
  if (!cfg) throw new UnknownSymbolError(symbol);
  const rand = mulberry32(hashString(`${cfg.symbol}:${tf}`));
  const isStable = cfg.kind === "STABLECOIN";
  const isDominance = cfg.kind === "DOMINANCE";
  const vol = VOL_BY_TF[tf] * (isStable ? 0.02 : isDominance ? 0.25 : cfg.symbol === "BTC" ? 0.8 : 1.2);
  const end = alignTime(now, tf) - TIMEFRAME_MS[tf]; // آخر شمعة مكتملة
  const start = end - (count - 1) * TIMEFRAME_MS[tf];

  // نظام أنظمة سوقية (صعود/هبوط/عرضي) لإنتاج سيناريوهات متنوعة
  const path: number[] = [];
  let p = 1;
  let drift = 0;
  let regimeLeft = 0;
  for (let i = 0; i < count; i++) {
    if (regimeLeft <= 0) {
      const r = rand();
      drift = (r < 0.4 ? 1 : r < 0.75 ? -1 : 0) * vol * (0.08 + rand() * 0.22);
      regimeLeft = 30 + Math.floor(rand() * 90);
    }
    regimeLeft--;
    const shock = (rand() - 0.5) * 2 * vol;
    p = isStable ? 1 + (p - 1) * 0.6 + shock : Math.max(0.05, p * (1 + drift + shock));
    path.push(p);
  }
  const scale = cfg.mockBasePrice / path[path.length - 1];
  const baseVolume = cfg.kind === "INDEX" ? cfg.mockBasePrice * 0.04 : cfg.mockBasePrice * (cfg.symbol === "BTC" ? 4e5 : 2e6);

  const candles: OHLCV[] = [];
  let prevClose = path[0] * scale;
  for (let i = 0; i < count; i++) {
    const close = path[i] * scale;
    const open = i === 0 ? close * (1 - (rand() - 0.5) * vol) : prevClose;
    const wick = Math.abs(close - open) + close * vol * rand() * 0.6;
    const high = Math.max(open, close) + wick * rand();
    const low = Math.max(0, Math.min(open, close) - wick * rand());
    const move = Math.abs(close - open) / Math.max(open, 1e-12);
    const volume = isDominance ? 0 : baseVolume * (0.6 + rand() * 0.8) * (1 + move / Math.max(vol, 1e-9) * 0.4);
    candles.push({ time: start + i * TIMEFRAME_MS[tf], open, high, low, close, volume });
    prevClose = close;
  }
  return candles;
}

function pctChange(candles: OHLCV[], barsAgo: number): number | null {
  if (candles.length <= barsAgo) return null;
  const a = candles[candles.length - 1 - barsAgo].close;
  const b = candles[candles.length - 1].close;
  return a === 0 ? null : ((b - a) / a) * 100;
}

const SUPPLY: Record<string, number> = { BTC: 19.75e6, ETH: 120.4e6, USDT: 118e9, USDC: 34e9 };

export class MockProvider implements MarketDataProvider {
  readonly name = NAME;

  async getOHLCV(symbol: string, timeframe: Timeframe): Promise<OHLCVSeries> {
    const cfg = getAssetConfig(symbol);
    if (!cfg) throw new UnknownSymbolError(symbol);
    return { symbol: cfg.symbol, timeframe, candles: generateMockCandles(cfg.symbol, timeframe), meta: meta() };
  }

  async getAssetOverview(symbol: string): Promise<AssetOverview> {
    const cfg = getAssetConfig(symbol);
    if (!cfg) throw new UnknownSymbolError(symbol);
    const h = generateMockCandles(cfg.symbol, "1h");
    const d = generateMockCandles(cfg.symbol, "1d");
    const price = h[h.length - 1].close;
    const last24 = h.slice(-24);
    const supply = SUPPLY[cfg.symbol] ?? (cfg.kind === "CRYPTO" ? (5e9 / Math.max(cfg.mockBasePrice, 0.0001)) * (1 + (hashString(cfg.symbol) % 50) / 10) : null);
    const isMarketAsset = cfg.kind === "CRYPTO" || cfg.kind === "STABLECOIN";
    const allHigh = Math.max(...d.map((c) => c.high));
    const allLow = Math.min(...d.map((c) => c.low));
    const rankIdx = ASSETS.findIndex((a) => a.symbol === cfg.symbol);
    return {
      symbol: cfg.symbol,
      name: cfg.name,
      nameAr: cfg.nameAr,
      kind: cfg.kind,
      image: null,
      price,
      change1h: pctChange(h, 1),
      change24h: pctChange(h, 24),
      change7d: pctChange(d, 7),
      change30d: pctChange(d, 30),
      marketCap: isMarketAsset && supply ? price * supply : null,
      volume24h: isMarketAsset ? last24.reduce((s, c) => s + c.volume, 0) : null,
      high24h: Math.max(...last24.map((c) => c.high)),
      low24h: Math.min(...last24.map((c) => c.low)),
      ath: allHigh * (isMarketAsset ? 1.35 : 1),
      athDate: new Date(d[0].time).toISOString(),
      atl: allLow * (isMarketAsset ? 0.4 : 1),
      atlDate: new Date(d[0].time).toISOString(),
      circulatingSupply: isMarketAsset ? supply : null,
      maxSupply: cfg.symbol === "BTC" ? 21e6 : null,
      rank: isMarketAsset ? rankIdx + 1 : null,
      spreadPct: isMarketAsset ? 0.01 + (hashString(cfg.symbol) % 10) / 100 : null,
      meta: meta(),
    };
  }

  async getAssetsOverview(symbols: string[]): Promise<AssetOverview[]> {
    return Promise.all(symbols.filter((s) => getAssetConfig(s)).map((s) => this.getAssetOverview(s)));
  }

  async getGlobalMarketData(): Promise<GlobalMarketData> {
    const total = generateMockCandles("TOTAL", "1h");
    const btcD = generateMockCandles("BTC.D", "1h");
    const usdtD = generateMockCandles("USDT.D", "1h");
    const t = total[total.length - 1].close;
    const t24 = total[total.length - 25].close;
    const bd = btcD[btcD.length - 1].close;
    const bd24 = btcD[btcD.length - 25].close;
    const ud = usdtD[usdtD.length - 1].close;
    const ud24 = usdtD[usdtD.length - 25].close;
    const btcNow = (t * bd) / 100;
    const btcPrev = (t24 * bd24) / 100;
    const usdtNow = (t * ud) / 100;
    const usdtPrev = (t24 * ud24) / 100;
    const ethNow = t * 0.125;
    return {
      totalMarketCap: t,
      totalVolume24h: t * 0.035,
      marketCapChange24h: ((t - t24) / t24) * 100,
      btcMarketCap: btcNow,
      ethMarketCap: ethNow,
      usdtMarketCap: usdtNow,
      btcChange24h: ((btcNow - btcPrev) / btcPrev) * 100,
      ethChange24h: ((t - t24) / t24) * 100,
      usdtChange24h: ((usdtNow - usdtPrev) / usdtPrev) * 100,
      activeCryptocurrencies: 15000,
      meta: meta(),
    };
  }

  async getDominanceData(): Promise<DominanceData> {
    const d = buildDominanceData(await this.getGlobalMarketData());
    return { ...d, method: `${d.method} (بيانات تجريبية)`, meta: meta() };
  }

  async getFearGreedIndex(): Promise<FearGreedData> {
    const rand = mulberry32(hashString(`fng:${Math.floor(Date.now() / 86_400_000)}`));
    const history = Array.from({ length: 30 }, (_, i) => {
      const value = Math.round(35 + rand() * 45);
      return {
        value,
        classification: value > 55 ? "Greed" : value < 45 ? "Fear" : "Neutral",
        timestamp: new Date(Date.now() - (29 - i) * 86_400_000).toISOString(),
      };
    });
    const latest = history[history.length - 1];
    return { ...latest, classificationAr: classifyFearGreedAr(latest.value), history, meta: meta() };
  }

  async getMarketNews(): Promise<MarketNewsResult> {
    const now = Date.now();
    return {
      items: [
        { id: "mock-1", title: "خبر تجريبي: تقرير عن تدفقات صناديق المؤشرات", url: "#", source: "Mock", publishedAt: new Date(now - 3_600_000).toISOString(), sentiment: "neutral" },
        { id: "mock-2", title: "خبر تجريبي: تحديث شبكة إيثريوم المرتقب", url: "#", source: "Mock", publishedAt: new Date(now - 7_200_000).toISOString(), sentiment: "positive" },
      ],
      meta: meta("أخبار تجريبية — ليست حقيقية"),
    };
  }
}
