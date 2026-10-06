import { isMockMode } from "@/lib/env";
import { logProviderCall } from "@/lib/services/provider-log";
import { PrismaSnapshotStore } from "@/lib/services/snapshot-store";
import type { MarketDataProvider } from "@/types/market";
import { setProviderLogger } from "./http";
import { LiveProvider } from "./live";
import { MockProvider } from "./mock";

export * from "./errors";
export { MockProvider } from "./mock";
export { LiveProvider } from "./live";

const g = globalThis as unknown as { __csProvider?: MarketDataProvider; __csProviderMode?: string };

/**
 * يعيد مزود البيانات النشط. التبديل بين المصادر يتم هنا فقط،
 * وبقية التطبيق يتعامل مع الواجهة الموحدة MarketDataProvider.
 */
export function getMarketDataProvider(): MarketDataProvider {
  const mode = isMockMode() ? "mock" : "live";
  if (g.__csProvider && g.__csProviderMode === mode) return g.__csProvider;
  if (mode === "mock") {
    g.__csProvider = new MockProvider();
  } else {
    setProviderLogger(logProviderCall);
    g.__csProvider = new LiveProvider({ snapshots: new PrismaSnapshotStore() });
  }
  g.__csProviderMode = mode;
  return g.__csProvider;
}
