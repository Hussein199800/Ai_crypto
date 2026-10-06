import { getAssetConfig } from "@/config/assets";
import { getEnv } from "@/lib/env";
import { aggregatePoints } from "@/lib/timeframes";
import type { AssetOverview, GlobalMarketData, OHLCV, Timeframe } from "@/types/market";
import { NotSupportedError, ProviderError } from "./errors";
import { fetchJson } from "./http";

const NAME = "CoinGecko";

interface CgMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  fully_diluted_valuation: number | null;
  total_volume: number | null;
  high_24h: number | null;
  low_24h: number | null;
  circulating_supply: number | null;
  max_supply: number | null;
  ath: number | null;
  ath_date: string | null;
  atl: number | null;
  atl_date: string | null;
  last_updated: string | null;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_30d_in_currency?: number | null;
}

interface CgGlobal {
  data: {
    total_market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    market_cap_percentage: Record<string, number>;
    market_cap_change_percentage_24h_usd: number;
    active_cryptocurrencies: number;
    updated_at: number;
  };
}

interface CgChart {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export class CoinGeckoClient {
  readonly name = NAME;

  private get base() {
    return getEnv().COINGECKO_API_PLAN === "pro" ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3";
  }

  private get headers(): Record<string, string> {
    const env = getEnv();
    if (!env.COINGECKO_API_KEY) return {};
    return env.COINGECKO_API_PLAN === "pro"
      ? { "x-cg-pro-api-key": env.COINGECKO_API_KEY }
      : { "x-cg-demo-api-key": env.COINGECKO_API_KEY };
  }

  get isPro() {
    const env = getEnv();
    return env.COINGECKO_API_PLAN === "pro" && Boolean(env.COINGECKO_API_KEY);
  }

  private get(path: string) {
    const env = getEnv();
    return fetchJson<unknown>(`${this.base}${path}`, {
      provider: NAME,
      headers: this.headers,
      // الخطة المجانية محدودة الطلبات بالدقيقة
      minIntervalMs: env.COINGECKO_API_KEY ? 250 : 1500,
      retries: 3,
    });
  }

  async markets(symbols: string[]): Promise<AssetOverview[]> {
    const configs = symbols.map((s) => getAssetConfig(s)).filter((a) => a?.coingeckoId);
    if (configs.length === 0) return [];
    const ids = configs.map((a) => a!.coingeckoId).join(",");
    const data = (await this.get(
      `/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids)}&price_change_percentage=1h,24h,7d,30d&sparkline=false&per_page=250`,
    )) as CgMarket[];
    if (!Array.isArray(data)) throw new ProviderError(NAME, "استجابة غير متوقعة");
    const fetchedAt = new Date().toISOString();
    return data.flatMap((m) => {
      const cfg = configs.find((c) => c!.coingeckoId === m.id);
      if (!cfg) return [];
      const o: AssetOverview = {
        symbol: cfg.symbol,
        name: cfg.name,
        nameAr: cfg.nameAr,
        kind: cfg.kind,
        image: m.image,
        price: m.current_price,
        change1h: m.price_change_percentage_1h_in_currency ?? null,
        change24h: m.price_change_percentage_24h_in_currency ?? null,
        change7d: m.price_change_percentage_7d_in_currency ?? null,
        change30d: m.price_change_percentage_30d_in_currency ?? null,
        marketCap: m.market_cap,
        fullyDilutedValuation: m.fully_diluted_valuation,
        volume24h: m.total_volume,
        high24h: m.high_24h,
        low24h: m.low_24h,
        ath: m.ath,
        athDate: m.ath_date,
        atl: m.atl,
        atlDate: m.atl_date,
        circulatingSupply: m.circulating_supply,
        maxSupply: m.max_supply,
        rank: m.market_cap_rank,
        spreadPct: null,
        meta: { source: NAME, fetchedAt, dataTime: m.last_updated ?? undefined, isStale: false, isMock: false },
      };
      return [o];
    });
  }

  async global(): Promise<GlobalMarketData> {
    const [g, majors] = await Promise.all([
      this.get("/global") as Promise<CgGlobal>,
      this.markets(["BTC", "ETH", "USDT"]),
    ]);
    if (!g?.data?.total_market_cap?.usd) throw new ProviderError(NAME, "بيانات السوق العامة غير مكتملة");
    const find = (s: string) => majors.find((m) => m.symbol === s);
    return {
      totalMarketCap: g.data.total_market_cap.usd,
      totalVolume24h: g.data.total_volume?.usd ?? null,
      marketCapChange24h: g.data.market_cap_change_percentage_24h_usd ?? null,
      btcMarketCap: find("BTC")?.marketCap ?? null,
      ethMarketCap: find("ETH")?.marketCap ?? null,
      usdtMarketCap: find("USDT")?.marketCap ?? null,
      btcChange24h: find("BTC")?.change24h ?? null,
      ethChange24h: find("ETH")?.change24h ?? null,
      usdtChange24h: find("USDT")?.change24h ?? null,
      activeCryptocurrencies: g.data.active_cryptocurrencies ?? null,
      meta: {
        source: NAME,
        fetchedAt: new Date().toISOString(),
        dataTime: g.data.updated_at ? new Date(g.data.updated_at * 1000).toISOString() : undefined,
        isStale: false,
        isMock: false,
      },
    };
  }

  /** شموع مُجمّعة من نقاط الأسعار (احتياطي عند عدم توفر Binance) */
  async ohlcv(symbol: string, tf: Timeframe): Promise<{ candles: OHLCV[]; note: string }> {
    const cfg = getAssetConfig(symbol);
    if (!cfg?.coingeckoId) throw new NotSupportedError(NAME, `OHLCV ${symbol}`);
    const days: Record<Timeframe, number> = { "15m": 1, "1h": 30, "4h": 90, "1d": 365, "1w": 365 };
    const chart = (await this.get(
      `/coins/${cfg.coingeckoId}/market_chart?vs_currency=usd&days=${days[tf]}`,
    )) as CgChart;
    if (!Array.isArray(chart?.prices)) throw new ProviderError(NAME, "بيانات الرسم غير متوفرة");
    return {
      candles: aggregatePoints(chart.prices, tf, chart.total_volumes),
      note: "شموع مُجمّعة من نقاط سعرية (CoinGecko) — الحجم تقديري من حجم 24 ساعة المتحرك",
    };
  }

  /** تاريخ القيمة السوقية لعملة (للحساب الدقيق لـ BTC.D وUSDT.D تاريخيًا) */
  async marketCapHistory(symbol: string, days: number): Promise<[number, number][]> {
    const cfg = getAssetConfig(symbol);
    if (!cfg?.coingeckoId) throw new NotSupportedError(NAME, `market caps ${symbol}`);
    const chart = (await this.get(`/coins/${cfg.coingeckoId}/market_chart?vs_currency=usd&days=${days}`)) as CgChart;
    return chart.market_caps ?? [];
  }

  /** تاريخ إجمالي القيمة السوقية — متاح فقط بمفتاح Pro */
  async totalMarketCapHistory(days: number): Promise<{ caps: [number, number][]; volumes: [number, number][] }> {
    if (!this.isPro) throw new NotSupportedError(NAME, "global/market_cap_chart يتطلب مفتاح Pro");
    const res = (await this.get(`/global/market_cap_chart?days=${days}`)) as {
      market_cap_chart?: { market_cap: [number, number][]; volume: [number, number][] };
    };
    if (!res.market_cap_chart) throw new ProviderError(NAME, "بيانات تاريخ السوق غير متوفرة");
    return { caps: res.market_cap_chart.market_cap, volumes: res.market_cap_chart.volume };
  }
}
