import type { GlobalMarketData } from "@/types/market";

/** نقطة تاريخية لبيانات السوق العامة */
export interface SnapshotPoint {
  time: number;
  total: number;
  btc: number | null;
  eth: number | null;
  usdt: number | null;
  volume: number | null;
}

/**
 * مخزن لقطات السوق — يُستخدم لبناء تاريخ BTC.D وUSDT.D وTOTAL عند عدم توفر
 * بيانات تاريخية من المزود (الخطط المجانية). التنفيذ الفعلي في lib/services.
 */
export interface SnapshotStore {
  record(g: GlobalMarketData, fearGreed?: number | null): Promise<void>;
  history(sinceMs: number): Promise<SnapshotPoint[]>;
}
