import { getAssetConfig } from "@/config/assets";
import { getEnv } from "@/lib/env";
import type { AssetOverview, GlobalMarketData } from "@/types/market";
import { NotSupportedError, ProviderError } from "./errors";
import { fetchJson } from "./http";

const NAME = "CoinMarketCap";
const BASE = "https://pro-api.coinmarketcap.com";

interface CmcQuote {
  name: string;
  symbol: string;
  cmc_rank: number | null;
  circulating_supply: number | null;
  max_supply: number | null;
  last_updated: string;
  quote: {
    USD: {
      price: number;
      market_cap: number;
      volume_24h: number;
      percent_change_1h: number;
      percent_change_24h: number;
      percent_change_7d: number;
      percent_change_30d: number;
      fully_diluted_market_cap?: number;
    };
  };
}

/** يعمل فقط عند توفر COINMARKETCAP_API_KEY */
export class CoinMarketCapClient {
  readonly name = NAME;

  get enabled() {
    return Boolean(getEnv().COINMARKETCAP_API_KEY);
  }

  private get<T>(path: string) {
    const key = getEnv().COINMARKETCAP_API_KEY;
    if (!key) throw new NotSupportedError(NAME, "لا يوجد مفتاح API");
    return fetchJson<T>(`${BASE}${path}`, {
      provider: NAME,
      headers: { "X-CMC_PRO_API_KEY": key },
      minIntervalMs: 300,
      retries: 2,
    });
  }

  async quotes(symbols: string[]): Promise<AssetOverview[]> {
    const list = symbols.map((s) => getAssetConfig(s)).filter((a) => a && (a.kind === "CRYPTO" || a.kind === "STABLECOIN"));
    if (list.length === 0) return [];
    const syms = list.map((a) => a!.coinmarketcapSymbol ?? a!.symbol).join(",");
    const res = await this.get<{ data: Record<string, CmcQuote[]> }>(`/v2/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(syms)}`);
    const fetchedAt = new Date().toISOString();
    return list.flatMap((cfg) => {
      const q = res.data?.[cfg!.coinmarketcapSymbol ?? cfg!.symbol]?.[0];
      if (!q) return [];
      const usd = q.quote.USD;
      const o: AssetOverview = {
        symbol: cfg!.symbol,
        name: cfg!.name,
        nameAr: cfg!.nameAr,
        kind: cfg!.kind,
        image: null,
        price: usd.price,
        change1h: usd.percent_change_1h,
        change24h: usd.percent_change_24h,
        change7d: usd.percent_change_7d,
        change30d: usd.percent_change_30d,
        marketCap: usd.market_cap,
        fullyDilutedValuation: usd.fully_diluted_market_cap ?? null,
        volume24h: usd.volume_24h,
        high24h: null,
        low24h: null,
        ath: null,
        athDate: null,
        atl: null,
        atlDate: null,
        circulatingSupply: q.circulating_supply,
        maxSupply: q.max_supply,
        rank: q.cmc_rank,
        spreadPct: null,
        meta: { source: NAME, fetchedAt, dataTime: q.last_updated, isStale: false, isMock: false },
      };
      return [o];
    });
  }

  async global(): Promise<GlobalMarketData> {
    const [g, majors] = await Promise.all([
      this.get<{
        data: {
          active_cryptocurrencies: number;
          last_updated: string;
          quote: { USD: { total_market_cap: number; total_volume_24h: number; total_market_cap_yesterday_percentage_change: number } };
        };
      }>("/v1/global-metrics/quotes/latest"),
      this.quotes(["BTC", "ETH", "USDT"]),
    ]);
    const usd = g.data?.quote?.USD;
    if (!usd?.total_market_cap) throw new ProviderError(NAME, "بيانات السوق العامة غير مكتملة");
    const find = (s: string) => majors.find((m) => m.symbol === s);
    return {
      totalMarketCap: usd.total_market_cap,
      totalVolume24h: usd.total_volume_24h,
      marketCapChange24h: usd.total_market_cap_yesterday_percentage_change,
      btcMarketCap: find("BTC")?.marketCap ?? null,
      ethMarketCap: find("ETH")?.marketCap ?? null,
      usdtMarketCap: find("USDT")?.marketCap ?? null,
      btcChange24h: find("BTC")?.change24h ?? null,
      ethChange24h: find("ETH")?.change24h ?? null,
      usdtChange24h: find("USDT")?.change24h ?? null,
      activeCryptocurrencies: g.data.active_cryptocurrencies,
      meta: { source: NAME, fetchedAt: new Date().toISOString(), dataTime: g.data.last_updated, isStale: false, isMock: false },
    };
  }
}
