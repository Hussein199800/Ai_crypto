import { getAssetConfig } from "@/config/assets";
import { getEnv } from "@/lib/env";
import type { OHLCV, Timeframe } from "@/types/market";
import { NotSupportedError, ProviderError } from "./errors";
import { fetchJson } from "./http";

const NAME = "Binance";

type Kline = [number, string, string, string, string, string, number, string, number, string, string, string];

/**
 * بيانات Binance العامة (Market Data) — لا تحتاج مفتاحًا للشموع والأسعار.
 * إن وُجد BINANCE_API_KEY يُرسل كترويسة فقط (لا يُستخدم السر لأننا لا ننفذ أوامر تداول).
 */
export class BinanceClient {
  readonly name = NAME;

  private get base() {
    return getEnv().BINANCE_BASE_URL.replace(/\/$/, "");
  }

  private get headers(): Record<string, string> {
    const key = getEnv().BINANCE_API_KEY;
    return key ? { "X-MBX-APIKEY": key } : {};
  }

  supports(symbol: string) {
    return Boolean(getAssetConfig(symbol)?.binanceSymbol);
  }

  async klines(symbol: string, tf: Timeframe, limit = 500): Promise<OHLCV[]> {
    const pair = getAssetConfig(symbol)?.binanceSymbol;
    if (!pair) throw new NotSupportedError(NAME, symbol);
    const data = await fetchJson<Kline[]>(
      `${this.base}/api/v3/klines?symbol=${pair}&interval=${tf}&limit=${limit}`,
      { provider: NAME, headers: this.headers, minIntervalMs: 50, retries: 3 },
    );
    if (!Array.isArray(data)) throw new ProviderError(NAME, "استجابة غير متوقعة");
    // نستخدم حجم عملة التسعير (USDT) ليكون الحجم بالدولار تقريبًا
    return data.map((k) => ({
      time: k[0],
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[7]),
    }));
  }

  async spreadPct(symbol: string): Promise<number | null> {
    const pair = getAssetConfig(symbol)?.binanceSymbol;
    if (!pair) return null;
    const t = await fetchJson<{ bidPrice: string; askPrice: string }>(
      `${this.base}/api/v3/ticker/bookTicker?symbol=${pair}`,
      { provider: NAME, headers: this.headers, retries: 1 },
    );
    const bid = Number(t.bidPrice);
    const ask = Number(t.askPrice);
    if (!(bid > 0 && ask > 0)) return null;
    return ((ask - bid) / ((ask + bid) / 2)) * 100;
  }

  async ticker24h(symbol: string): Promise<{ price: number; change24h: number; high: number; low: number; quoteVolume: number }> {
    const pair = getAssetConfig(symbol)?.binanceSymbol;
    if (!pair) throw new NotSupportedError(NAME, symbol);
    const t = await fetchJson<{ lastPrice: string; priceChangePercent: string; highPrice: string; lowPrice: string; quoteVolume: string }>(
      `${this.base}/api/v3/ticker/24hr?symbol=${pair}`,
      { provider: NAME, headers: this.headers, retries: 2 },
    );
    return {
      price: Number(t.lastPrice),
      change24h: Number(t.priceChangePercent),
      high: Number(t.highPrice),
      low: Number(t.lowPrice),
      quoteVolume: Number(t.quoteVolume),
    };
  }
}
