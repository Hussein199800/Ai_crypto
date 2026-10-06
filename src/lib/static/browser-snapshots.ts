import type { SnapshotPoint, SnapshotStore } from "@/lib/providers/snapshot-store";
import type { GlobalMarketData } from "@/types/market";

/**
 * لقطات السوق في المتصفح — تبني تاريخًا تقريبيًا لـ BTC.D وUSDT.D وTOTAL مع تكرار الزيارات.
 * (في نسخة الخادم تُحفظ اللقطات في PostgreSQL عبر المهمة المجدولة.)
 */
const KEY = "cryptoscope:snapshots:v1";
const MIN_INTERVAL_MS = 10 * 60_000;
const MAX_POINTS = 3000;

function read(): SnapshotPoint[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as SnapshotPoint[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export class BrowserSnapshotStore implements SnapshotStore {
  async record(g: GlobalMarketData): Promise<void> {
    if (g.meta.isMock || g.meta.isStale) return;
    const list = read();
    const last = list[list.length - 1];
    if (last && Date.now() - last.time < MIN_INTERVAL_MS) return;
    list.push({ time: Date.now(), total: g.totalMarketCap, btc: g.btcMarketCap, eth: g.ethMarketCap, usdt: g.usdtMarketCap, volume: g.totalVolume24h });
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_POINTS)));
    } catch {
      /* التخزين ممتلئ أو غير متاح */
    }
  }

  async history(sinceMs: number): Promise<SnapshotPoint[]> {
    return read().filter((p) => p.time >= sinceMs);
  }
}
