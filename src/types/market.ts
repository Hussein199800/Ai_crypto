// أنواع بيانات السوق الموحدة — مستقلة عن أي مزود بيانات

export const TIMEFRAMES = ["15m", "1h", "4h", "1d", "1w"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export type AssetKind = "CRYPTO" | "STABLECOIN" | "DOMINANCE" | "INDEX" | "PAIR";

/** معلومات تُرفق بكل استجابة لتوضيح المصدر وحداثة البيانات */
export interface DataMeta {
  source: string;
  fetchedAt: string; // ISO
  /** وقت البيانات الفعلي لدى المزود إن توفر */
  dataTime?: string;
  /** البيانات من ذاكرة مؤقتة قديمة بعد فشل المزود */
  isStale: boolean;
  isMock: boolean;
  note?: string;
}

export interface OHLCV {
  time: number; // بداية الشمعة بالميلي ثانية (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OHLCVSeries {
  symbol: string;
  timeframe: Timeframe;
  candles: OHLCV[];
  meta: DataMeta;
}

export interface AssetOverview {
  symbol: string;
  name: string;
  nameAr?: string;
  kind: AssetKind;
  image?: string | null;
  price: number | null;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  marketCap: number | null;
  fullyDilutedValuation?: number | null;
  volume24h: number | null;
  high24h: number | null;
  low24h: number | null;
  ath: number | null;
  athDate: string | null;
  atl: number | null;
  atlDate: string | null;
  circulatingSupply: number | null;
  maxSupply: number | null;
  rank: number | null;
  /** فرق سعر الشراء والبيع كنسبة مئوية إن توفر */
  spreadPct?: number | null;
  meta: DataMeta;
}

export interface GlobalMarketData {
  totalMarketCap: number;
  totalVolume24h: number | null;
  marketCapChange24h: number | null; // نسبة مئوية
  btcMarketCap: number | null;
  ethMarketCap: number | null;
  usdtMarketCap: number | null;
  btcChange24h: number | null;
  ethChange24h: number | null;
  usdtChange24h: number | null;
  activeCryptocurrencies: number | null;
  meta: DataMeta;
}

export interface DominanceData {
  btcDominance: number | null;
  ethDominance: number | null;
  usdtDominance: number | null;
  /** التغير بالنقاط المئوية خلال 24 ساعة */
  btcDominanceChange24h: number | null;
  usdtDominanceChange24h: number | null;
  total: number | null;
  total2: number | null;
  total3: number | null;
  /** طريقة الحساب ومصدرها */
  method: string;
  meta: DataMeta;
}

export interface FearGreedPoint {
  value: number;
  classification: string;
  timestamp: string;
}

export interface FearGreedData {
  value: number;
  classification: string;
  classificationAr: string;
  timestamp: string;
  history: FearGreedPoint[];
  meta: DataMeta;
}

export interface MarketNews {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment?: "positive" | "negative" | "neutral";
}

export interface MarketNewsResult {
  items: MarketNews[];
  meta: DataMeta;
}

/** الواجهة الموحدة لمزودي البيانات — يمكن تبديل المزود دون تعديل بقية التطبيق */
export interface MarketDataProvider {
  readonly name: string;
  getAssetOverview(symbol: string): Promise<AssetOverview>;
  getAssetsOverview?(symbols: string[]): Promise<AssetOverview[]>;
  getOHLCV(symbol: string, timeframe: Timeframe): Promise<OHLCVSeries>;
  getGlobalMarketData(): Promise<GlobalMarketData>;
  getDominanceData(): Promise<DominanceData>;
  getFearGreedIndex(): Promise<FearGreedData>;
  getMarketNews(): Promise<MarketNewsResult>;
}
