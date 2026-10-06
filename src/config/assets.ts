import type { AssetKind } from "@/types/market";

export interface AssetConfig {
  symbol: string;
  /** الرمز المعروض (مثلًا ETH/BTC) */
  display: string;
  name: string;
  nameAr: string;
  kind: AssetKind;
  coingeckoId?: string;
  coinmarketcapSymbol?: string;
  binanceSymbol?: string;
  /** سعر تقريبي يُستخدم فقط لتوليد البيانات التجريبية في وضع mock */
  mockBasePrice: number;
}

// قائمة الأصول المدعومة. يمكن توسيعها دون تعديل منطق التحليل.
export const ASSETS: AssetConfig[] = [
  { symbol: "BTC", display: "BTC", name: "Bitcoin", nameAr: "بيتكوين", kind: "CRYPTO", coingeckoId: "bitcoin", binanceSymbol: "BTCUSDT", mockBasePrice: 64000 },
  { symbol: "ETH", display: "ETH", name: "Ethereum", nameAr: "إيثريوم", kind: "CRYPTO", coingeckoId: "ethereum", binanceSymbol: "ETHUSDT", mockBasePrice: 3100 },
  { symbol: "USDT", display: "USDT", name: "Tether", nameAr: "تيثر", kind: "STABLECOIN", coingeckoId: "tether", mockBasePrice: 1 },
  { symbol: "BNB", display: "BNB", name: "BNB", nameAr: "بي إن بي", kind: "CRYPTO", coingeckoId: "binancecoin", binanceSymbol: "BNBUSDT", mockBasePrice: 590 },
  { symbol: "SOL", display: "SOL", name: "Solana", nameAr: "سولانا", kind: "CRYPTO", coingeckoId: "solana", binanceSymbol: "SOLUSDT", mockBasePrice: 150 },
  { symbol: "XRP", display: "XRP", name: "XRP", nameAr: "ريبل", kind: "CRYPTO", coingeckoId: "ripple", binanceSymbol: "XRPUSDT", mockBasePrice: 0.6 },
  { symbol: "USDC", display: "USDC", name: "USD Coin", nameAr: "يو إس دي كوين", kind: "STABLECOIN", coingeckoId: "usd-coin", mockBasePrice: 1 },
  { symbol: "DOGE", display: "DOGE", name: "Dogecoin", nameAr: "دوجكوين", kind: "CRYPTO", coingeckoId: "dogecoin", binanceSymbol: "DOGEUSDT", mockBasePrice: 0.12 },
  { symbol: "ADA", display: "ADA", name: "Cardano", nameAr: "كاردانو", kind: "CRYPTO", coingeckoId: "cardano", binanceSymbol: "ADAUSDT", mockBasePrice: 0.45 },
  { symbol: "TRX", display: "TRX", name: "TRON", nameAr: "ترون", kind: "CRYPTO", coingeckoId: "tron", binanceSymbol: "TRXUSDT", mockBasePrice: 0.15 },
  { symbol: "AVAX", display: "AVAX", name: "Avalanche", nameAr: "أفالانش", kind: "CRYPTO", coingeckoId: "avalanche-2", binanceSymbol: "AVAXUSDT", mockBasePrice: 28 },
  { symbol: "LINK", display: "LINK", name: "Chainlink", nameAr: "تشين لينك", kind: "CRYPTO", coingeckoId: "chainlink", binanceSymbol: "LINKUSDT", mockBasePrice: 13 },
  { symbol: "TON", display: "TON", name: "Toncoin", nameAr: "تون كوين", kind: "CRYPTO", coingeckoId: "the-open-network", binanceSymbol: "TONUSDT", mockBasePrice: 5.5 },
  { symbol: "DOT", display: "DOT", name: "Polkadot", nameAr: "بولكادوت", kind: "CRYPTO", coingeckoId: "polkadot", binanceSymbol: "DOTUSDT", mockBasePrice: 6 },
  { symbol: "LTC", display: "LTC", name: "Litecoin", nameAr: "لايتكوين", kind: "CRYPTO", coingeckoId: "litecoin", binanceSymbol: "LTCUSDT", mockBasePrice: 70 },
  { symbol: "BCH", display: "BCH", name: "Bitcoin Cash", nameAr: "بيتكوين كاش", kind: "CRYPTO", coingeckoId: "bitcoin-cash", binanceSymbol: "BCHUSDT", mockBasePrice: 360 },
  { symbol: "NEAR", display: "NEAR", name: "NEAR Protocol", nameAr: "نير", kind: "CRYPTO", coingeckoId: "near", binanceSymbol: "NEARUSDT", mockBasePrice: 5 },
  { symbol: "UNI", display: "UNI", name: "Uniswap", nameAr: "يونيسواب", kind: "CRYPTO", coingeckoId: "uniswap", binanceSymbol: "UNIUSDT", mockBasePrice: 8 },
  { symbol: "APT", display: "APT", name: "Aptos", nameAr: "أبتوس", kind: "CRYPTO", coingeckoId: "aptos", binanceSymbol: "APTUSDT", mockBasePrice: 7 },
  { symbol: "SUI", display: "SUI", name: "Sui", nameAr: "سوي", kind: "CRYPTO", coingeckoId: "sui", binanceSymbol: "SUIUSDT", mockBasePrice: 1.5 },
  { symbol: "ARB", display: "ARB", name: "Arbitrum", nameAr: "أربيتروم", kind: "CRYPTO", coingeckoId: "arbitrum", binanceSymbol: "ARBUSDT", mockBasePrice: 0.7 },
  { symbol: "OP", display: "OP", name: "Optimism", nameAr: "أوبتيميزم", kind: "CRYPTO", coingeckoId: "optimism", binanceSymbol: "OPUSDT", mockBasePrice: 1.6 },
  { symbol: "ATOM", display: "ATOM", name: "Cosmos", nameAr: "كوزموس", kind: "CRYPTO", coingeckoId: "cosmos", binanceSymbol: "ATOMUSDT", mockBasePrice: 6.5 },
  { symbol: "FIL", display: "FIL", name: "Filecoin", nameAr: "فايل كوين", kind: "CRYPTO", coingeckoId: "filecoin", binanceSymbol: "FILUSDT", mockBasePrice: 4 },
  { symbol: "INJ", display: "INJ", name: "Injective", nameAr: "إنجكتيف", kind: "CRYPTO", coingeckoId: "injective-protocol", binanceSymbol: "INJUSDT", mockBasePrice: 20 },
  { symbol: "ETC", display: "ETC", name: "Ethereum Classic", nameAr: "إيثريوم كلاسيك", kind: "CRYPTO", coingeckoId: "ethereum-classic", binanceSymbol: "ETCUSDT", mockBasePrice: 22 },
  // مؤشرات السوق
  { symbol: "ETHBTC", display: "ETH/BTC", name: "ETH/BTC Ratio", nameAr: "نسبة الإيثريوم إلى البيتكوين", kind: "PAIR", binanceSymbol: "ETHBTC", mockBasePrice: 0.048 },
  { symbol: "BTC.D", display: "BTC.D", name: "Bitcoin Dominance", nameAr: "هيمنة البيتكوين", kind: "DOMINANCE", mockBasePrice: 56 },
  { symbol: "USDT.D", display: "USDT.D", name: "Tether Dominance", nameAr: "هيمنة تيثر", kind: "DOMINANCE", mockBasePrice: 5.2 },
  { symbol: "TOTAL", display: "TOTAL", name: "Total Crypto Market Cap", nameAr: "إجمالي القيمة السوقية", kind: "INDEX", mockBasePrice: 2.3e12 },
  { symbol: "TOTAL2", display: "TOTAL2", name: "Total Market Cap excl. BTC", nameAr: "القيمة السوقية دون البيتكوين", kind: "INDEX", mockBasePrice: 1.0e12 },
  { symbol: "TOTAL3", display: "TOTAL3", name: "Total Market Cap excl. BTC & ETH", nameAr: "القيمة السوقية دون BTC وETH", kind: "INDEX", mockBasePrice: 0.62e12 },
];

const BY_SYMBOL = new Map(ASSETS.map((a) => [a.symbol, a]));

/** يطبّع الرمز القادم من المستخدم: BTC، btc، ETH/BTC، eth-btc ... */
export function normalizeSymbol(input: string): string {
  const s = decodeURIComponent(input).trim().toUpperCase();
  if (s === "ETH/BTC" || s === "ETH-BTC" || s === "ETH_BTC") return "ETHBTC";
  return s;
}

export function getAssetConfig(symbol: string): AssetConfig | undefined {
  return BY_SYMBOL.get(normalizeSymbol(symbol));
}

export function isSupportedSymbol(symbol: string): boolean {
  return BY_SYMBOL.has(normalizeSymbol(symbol));
}

export const CRYPTO_ASSETS = ASSETS.filter((a) => a.kind === "CRYPTO" || a.kind === "STABLECOIN");
export const MARKET_INDICATORS = ASSETS.filter((a) => a.kind !== "CRYPTO" && a.kind !== "STABLECOIN");
export const CHART_SYMBOLS = ["BTC", "ETH", "BTC.D", "USDT.D", "TOTAL", "TOTAL2", "TOTAL3", "ETHBTC"];
