import { getAssetConfig } from "@/config/assets";
import { SCORING_RULES } from "@/config/scoring";
import { buildDominanceData } from "@/lib/analysis/dominance";
import { aggregatePoints, TIMEFRAME_MS } from "@/lib/timeframes";
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
import { AlternativeMeClient } from "./alternative-me";
import { BinanceClient } from "./binance";
import { cached } from "./cache";
import { CoinGeckoClient } from "./coingecko";
import { CoinMarketCapClient } from "./coinmarketcap";
import { CryptoPanicClient } from "./cryptopanic";
import { ProviderError, UnknownSymbolError } from "./errors";
import type { SnapshotPoint, SnapshotStore } from "./snapshot-store";

const OHLCV_TTL: Record<Timeframe, number> = {
  "15m": 60_000,
  "1h": 120_000,
  "4h": 300_000,
  "1d": 900_000,
  "1w": 3_600_000,
};

export interface LiveProviderDeps {
  coingecko?: CoinGeckoClient;
  binance?: BinanceClient;
  cmc?: CoinMarketCapClient;
  alternative?: AlternativeMeClient;
  news?: CryptoPanicClient;
  snapshots?: SnapshotStore | null;
}

/** يجرب المصادر بالترتيب ويعيد أول نتيجة ناجحة */
async function firstSuccess<T>(attempts: (() => Promise<T>)[]): Promise<T> {
  const errors: string[] = [];
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new ProviderError("composite", `فشلت جميع المصادر: ${errors.join(" | ")}`);
}

function markStale<T extends { meta: DataMeta }>(value: T, stale: boolean, storedAt: number): T {
  if (!stale) return value;
  return {
    ...value,
    meta: {
      ...value.meta,
      isStale: true,
      note: `تعذّر التحديث من المصدر — تُعرض آخر بيانات محفوظة من ${new Date(storedAt).toISOString()}`,
    },
  };
}

/**
 * المزود الحي المركّب: يوزع كل طلب على أنسب مصدر مع بدائل احتياطية:
 * - الأسعار والقيم السوقية: CoinGecko ← CoinMarketCap (عند توفر المفتاح)
 * - الشموع OHLCV: Binance ← CoinGecko (شموع مجمّعة)
 * - BTC.D / USDT.D / TOTAL: محسوبة من بيانات السوق العامة، وتاريخها من CoinGecko Pro أو اللقطات المحفوظة
 * - الخوف والطمع: alternative.me
 */
export class LiveProvider implements MarketDataProvider {
  readonly name = "Live";
  private cg: CoinGeckoClient;
  private binance: BinanceClient;
  private cmc: CoinMarketCapClient;
  private alt: AlternativeMeClient;
  private news: CryptoPanicClient;
  private snapshots: SnapshotStore | null;

  constructor(deps: LiveProviderDeps = {}) {
    this.cg = deps.coingecko ?? new CoinGeckoClient();
    this.binance = deps.binance ?? new BinanceClient();
    this.cmc = deps.cmc ?? new CoinMarketCapClient();
    this.alt = deps.alternative ?? new AlternativeMeClient();
    this.news = deps.news ?? new CryptoPanicClient();
    this.snapshots = deps.snapshots ?? null;
  }

  // ───────────── نظرة عامة على الأصل ─────────────

  async getAssetOverview(symbol: string): Promise<AssetOverview> {
    const cfg = getAssetConfig(symbol);
    if (!cfg) throw new UnknownSymbolError(symbol);
    if (cfg.kind === "PAIR") return this.pairOverview(cfg.symbol);
    if (cfg.kind === "DOMINANCE" || cfg.kind === "INDEX") return this.indexOverview(cfg.symbol);

    const r = await cached(`ov:${cfg.symbol}`, 60_000, async () => {
      const list = await firstSuccess<AssetOverview[]>([
        () => this.cg.markets([cfg.symbol]),
        () => (this.cmc.enabled ? this.cmc.quotes([cfg.symbol]) : Promise.reject(new Error("CMC غير مفعّل"))),
      ]);
      const o = list[0];
      if (!o) throw new ProviderError("composite", `لا توجد بيانات للرمز ${cfg.symbol}`);
      if (this.binance.supports(cfg.symbol)) {
        o.spreadPct = await this.binance.spreadPct(cfg.symbol).catch(() => null);
      }
      return o;
    });
    return markStale(r.value, r.stale, r.storedAt);
  }

  async getAssetsOverview(symbols: string[]): Promise<AssetOverview[]> {
    const coins = symbols.filter((s) => {
      const k = getAssetConfig(s)?.kind;
      return k === "CRYPTO" || k === "STABLECOIN";
    });
    const others = symbols.filter((s) => !coins.includes(s) && getAssetConfig(s));
    const key = `ovs:${[...coins].sort().join(",")}`;
    const batch = coins.length
      ? await cached(key, 60_000, () =>
          firstSuccess<AssetOverview[]>([
            () => this.cg.markets(coins),
            () => (this.cmc.enabled ? this.cmc.quotes(coins) : Promise.reject(new Error("CMC غير مفعّل"))),
          ]),
        )
          .then((r) => r.value.map((v) => markStale(v, r.stale, r.storedAt)))
          .catch(() => [] as AssetOverview[])
      : [];
    const rest = await Promise.all(others.map((s) => this.getAssetOverview(s).catch(() => null)));
    return [...batch, ...rest.filter((x): x is AssetOverview => x !== null)];
  }

  private async pairOverview(symbol: string): Promise<AssetOverview> {
    const cfg = getAssetConfig(symbol)!;
    const r = await cached(`ov:${symbol}`, 60_000, async () => {
      const [t, daily, hourly] = await Promise.all([
        this.binance.ticker24h(symbol),
        this.binance.klines(symbol, "1d", 40),
        this.binance.klines(symbol, "1h", 3),
      ]);
      const change = (c: OHLCV[], n: number) =>
        c.length > n ? ((c[c.length - 1].close - c[c.length - 1 - n].close) / c[c.length - 1 - n].close) * 100 : null;
      const o: AssetOverview = {
        symbol,
        name: cfg.name,
        nameAr: cfg.nameAr,
        kind: cfg.kind,
        price: t.price,
        change1h: change(hourly, 1),
        change24h: t.change24h,
        change7d: change(daily, 7),
        change30d: change(daily, 30),
        marketCap: null,
        volume24h: t.quoteVolume,
        high24h: t.high,
        low24h: t.low,
        ath: null,
        athDate: null,
        atl: null,
        atlDate: null,
        circulatingSupply: null,
        maxSupply: null,
        rank: null,
        spreadPct: await this.binance.spreadPct(symbol).catch(() => null),
        meta: { source: "Binance", fetchedAt: new Date().toISOString(), isStale: false, isMock: false },
      };
      return o;
    });
    return markStale(r.value, r.stale, r.storedAt);
  }

  private async indexOverview(symbol: string): Promise<AssetOverview> {
    const cfg = getAssetConfig(symbol)!;
    const g = await this.getGlobalMarketData();
    const d = buildDominanceData(g);
    let value: number | null = null;
    let prev: number | null = null;
    const prevTotal = g.marketCapChange24h != null ? g.totalMarketCap / (1 + g.marketCapChange24h / 100) : null;
    const prevBtc = g.btcMarketCap != null && g.btcChange24h != null ? g.btcMarketCap / (1 + g.btcChange24h / 100) : null;
    const prevEth = g.ethMarketCap != null && g.ethChange24h != null ? g.ethMarketCap / (1 + g.ethChange24h / 100) : null;
    switch (symbol) {
      case "BTC.D":
        value = d.btcDominance;
        prev = value != null && d.btcDominanceChange24h != null ? value - d.btcDominanceChange24h : null;
        break;
      case "USDT.D":
        value = d.usdtDominance;
        prev = value != null && d.usdtDominanceChange24h != null ? value - d.usdtDominanceChange24h : null;
        break;
      case "TOTAL":
        value = d.total;
        prev = prevTotal;
        break;
      case "TOTAL2":
        value = d.total2;
        prev = prevTotal != null && prevBtc != null ? prevTotal - prevBtc : null;
        break;
      case "TOTAL3":
        value = d.total3;
        prev = prevTotal != null && prevBtc != null && prevEth != null ? prevTotal - prevBtc - prevEth : null;
        break;
    }
    // تغيرات 7 و30 يومًا من التاريخ إن توفر
    let change7d: number | null = null;
    let change30d: number | null = null;
    try {
      const hist = await this.getOHLCV(symbol, "1d");
      const c = hist.candles;
      if (value != null && c.length > 7) change7d = ((value - c[c.length - 8].close) / c[c.length - 8].close) * 100;
      if (value != null && c.length > 30) change30d = ((value - c[c.length - 31].close) / c[c.length - 31].close) * 100;
    } catch {
      /* لا تاريخ كافٍ */
    }
    return {
      symbol,
      name: cfg.name,
      nameAr: cfg.nameAr,
      kind: cfg.kind,
      price: value,
      change1h: null,
      change24h: value != null && prev != null && prev !== 0 ? ((value - prev) / prev) * 100 : null,
      change7d,
      change30d,
      marketCap: null,
      volume24h: cfg.kind === "INDEX" ? g.totalVolume24h : null,
      high24h: null,
      low24h: null,
      ath: null,
      athDate: null,
      atl: null,
      atlDate: null,
      circulatingSupply: null,
      maxSupply: null,
      rank: null,
      spreadPct: null,
      meta: { ...g.meta, note: d.method },
    };
  }

  // ───────────── الشموع ─────────────

  async getOHLCV(symbol: string, timeframe: Timeframe): Promise<OHLCVSeries> {
    const cfg = getAssetConfig(symbol);
    if (!cfg) throw new UnknownSymbolError(symbol);
    const r = await cached(`ohlcv:${cfg.symbol}:${timeframe}`, OHLCV_TTL[timeframe], async (): Promise<OHLCVSeries> => {
      if (cfg.kind === "DOMINANCE" || cfg.kind === "INDEX") return this.indexHistory(cfg.symbol, timeframe);
      const fetchedAt = new Date().toISOString();
      if (this.binance.supports(cfg.symbol)) {
        try {
          const candles = await this.binance.klines(cfg.symbol, timeframe);
          return { symbol: cfg.symbol, timeframe, candles, meta: { source: "Binance", fetchedAt, isStale: false, isMock: false } };
        } catch (e) {
          if (!cfg.coingeckoId) throw e;
        }
      }
      const { candles, note } = await this.cg.ohlcv(cfg.symbol, timeframe);
      return { symbol: cfg.symbol, timeframe, candles, meta: { source: "CoinGecko", fetchedAt, isStale: false, isMock: false, note } };
    });
    return markStale(r.value, r.stale, r.storedAt);
  }

  private async indexHistory(symbol: string, tf: Timeframe): Promise<OHLCVSeries> {
    const fetchedAt = new Date().toISOString();
    let points: SnapshotPoint[] = [];
    let source = "";
    let note = "";
    if (this.cg.isPro) {
      const days: Record<Timeframe, number> = { "15m": 1, "1h": 30, "4h": 90, "1d": 365, "1w": 1095 };
      const n = days[tf];
      const [total, btc, eth, usdt] = await Promise.all([
        this.cg.totalMarketCapHistory(n),
        this.cg.marketCapHistory("BTC", n),
        symbol === "TOTAL3" ? this.cg.marketCapHistory("ETH", n) : Promise.resolve([] as [number, number][]),
        symbol === "USDT.D" ? this.cg.marketCapHistory("USDT", n) : Promise.resolve([] as [number, number][]),
      ]);
      const vol = new Map(total.volumes);
      points = total.caps.map(([t, v]) => ({
        time: t,
        total: v,
        btc: nearest(btc, t),
        eth: nearest(eth, t),
        usdt: nearest(usdt, t),
        volume: vol.get(t) ?? null,
      }));
      source = "CoinGecko Pro";
      note = "تاريخ محسوب من القيم السوقية التاريخية (CoinGecko Pro)";
    } else if (this.snapshots) {
      points = await this.snapshots.history(Date.now() - TIMEFRAME_MS[tf] * 400);
      source = "لقطات السوق المحفوظة";
      note = "تاريخ مبني من لقطات السوق الدورية المحفوظة في قاعدة البيانات (يتحسن مع الوقت عبر مهمة /api/cron/snapshot)";
    } else {
      note = "لا يتوفر تاريخ لهذا المؤشر: أضف مفتاح CoinGecko Pro أو فعّل حفظ اللقطات";
    }

    const series: [number, number][] = [];
    for (const p of points) {
      const v = indexValue(symbol, p);
      if (v != null) series.push([p.time, v]);
    }
    const candles = aggregatePoints(series, tf);
    if (candles.length < SCORING_RULES.minCandles) {
      note = `${note}. البيانات التاريخية غير كافية (${candles.length} شمعة)`;
    }
    return { symbol, timeframe: tf, candles, meta: { source: source || "غير متاح", fetchedAt, isStale: false, isMock: false, note } };
  }

  // ───────────── السوق العام ─────────────

  async getGlobalMarketData(): Promise<GlobalMarketData> {
    const r = await cached("global", 120_000, async () => {
      const g = await firstSuccess<GlobalMarketData>([
        () => this.cg.global(),
        () => (this.cmc.enabled ? this.cmc.global() : Promise.reject(new Error("CMC غير مفعّل"))),
      ]);
      this.snapshots?.record(g).catch(() => undefined);
      return g;
    });
    return markStale(r.value, r.stale, r.storedAt);
  }

  async getDominanceData(): Promise<DominanceData> {
    return buildDominanceData(await this.getGlobalMarketData());
  }

  async getFearGreedIndex(): Promise<FearGreedData> {
    const r = await cached("fng", 30 * 60_000, () => this.alt.fearGreed(30));
    return markStale(r.value, r.stale, r.storedAt);
  }

  async getMarketNews(): Promise<MarketNewsResult> {
    if (!this.news.enabled) {
      return {
        items: [],
        meta: { source: "—", fetchedAt: new Date().toISOString(), isStale: false, isMock: false, note: "لم يُعدّ مزود أخبار (CRYPTOPANIC_API_KEY)" },
      };
    }
    const r = await cached("news", 10 * 60_000, async () => ({
      items: await this.news.news(),
      meta: { source: "CryptoPanic", fetchedAt: new Date().toISOString(), isStale: false, isMock: false } as DataMeta,
    }));
    return markStale(r.value, r.stale, r.storedAt);
  }
}

function nearest(series: [number, number][], t: number): number | null {
  if (series.length === 0) return null;
  let lo = 0;
  let hi = series.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid][0] < t) lo = mid + 1;
    else hi = mid;
  }
  const cands = [series[lo], series[lo - 1]].filter(Boolean) as [number, number][];
  const best = cands.reduce((a, b) => (Math.abs(a[0] - t) <= Math.abs(b[0] - t) ? a : b));
  // تجاهل التطابق إذا كان الفرق الزمني كبيرًا (أكثر من يومين)
  return Math.abs(best[0] - t) <= 2 * 86_400_000 ? best[1] : null;
}

export function indexValue(symbol: string, p: SnapshotPoint): number | null {
  switch (symbol) {
    case "TOTAL":
      return p.total;
    case "TOTAL2":
      return p.btc != null ? p.total - p.btc : null;
    case "TOTAL3":
      return p.btc != null && p.eth != null ? p.total - p.btc - p.eth : null;
    case "BTC.D":
      return p.btc != null && p.total > 0 ? (p.btc / p.total) * 100 : null;
    case "USDT.D":
      return p.usdt != null && p.total > 0 ? (p.usdt / p.total) * 100 : null;
    default:
      return null;
  }
}
