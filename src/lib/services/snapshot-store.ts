import { prisma } from "@/lib/db";
import { logError } from "@/lib/logger";
import type { SnapshotPoint, SnapshotStore } from "@/lib/providers/snapshot-store";
import type { GlobalMarketData } from "@/types/market";
import { calculateDominance } from "@/lib/analysis/dominance";

const MIN_INTERVAL_MS = 10 * 60_000;
let lastRecordedAt = 0;

/** تنفيذ مخزن اللقطات عبر Prisma (جدول MarketSnapshot) */
export class PrismaSnapshotStore implements SnapshotStore {
  async record(g: GlobalMarketData, fearGreed?: number | null, force = false): Promise<void> {
    if (!force && Date.now() - lastRecordedAt < MIN_INTERVAL_MS) return;
    lastRecordedAt = Date.now();
    try {
      await prisma.marketSnapshot.create({
        data: {
          source: g.meta.source,
          totalMarketCap: g.totalMarketCap,
          totalVolume24h: g.totalVolume24h,
          btcMarketCap: g.btcMarketCap,
          ethMarketCap: g.ethMarketCap,
          usdtMarketCap: g.usdtMarketCap,
          btcDominance: calculateDominance(g.btcMarketCap, g.totalMarketCap),
          ethDominance: calculateDominance(g.ethMarketCap, g.totalMarketCap),
          usdtDominance: calculateDominance(g.usdtMarketCap, g.totalMarketCap),
          marketCapChange24h: g.marketCapChange24h,
          fearGreed: fearGreed ?? null,
          isMock: g.meta.isMock,
        },
      });
    } catch (e) {
      logError("snapshot.record", e);
    }
  }

  async history(sinceMs: number): Promise<SnapshotPoint[]> {
    try {
      const rows = await prisma.marketSnapshot.findMany({
        where: { createdAt: { gte: new Date(sinceMs) }, isMock: false },
        orderBy: { createdAt: "asc" },
        take: 20_000,
      });
      return rows.map((r) => ({
        time: r.createdAt.getTime(),
        total: r.totalMarketCap,
        btc: r.btcMarketCap,
        eth: r.ethMarketCap,
        usdt: r.usdtMarketCap,
        volume: r.totalVolume24h,
      }));
    } catch (e) {
      logError("snapshot.history", e);
      return [];
    }
  }
}
