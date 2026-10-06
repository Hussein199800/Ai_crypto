import type { FearGreedData } from "@/types/market";
import { ProviderError } from "./errors";
import { fetchJson } from "./http";

const NAME = "alternative.me";

export function classifyFearGreedAr(value: number): string {
  if (value <= 24) return "خوف شديد";
  if (value <= 44) return "خوف";
  if (value <= 55) return "محايد";
  if (value <= 75) return "طمع";
  return "طمع شديد";
}

export class AlternativeMeClient {
  readonly name = NAME;

  async fearGreed(limit = 30): Promise<FearGreedData> {
    const res = await fetchJson<{ data?: { value: string; value_classification: string; timestamp: string }[] }>(
      `https://api.alternative.me/fng/?limit=${limit}`,
      { provider: NAME, retries: 2, minIntervalMs: 500 },
    );
    const rows = res.data ?? [];
    if (rows.length === 0) throw new ProviderError(NAME, "لا توجد بيانات لمؤشر الخوف والطمع");
    const history = rows.map((r) => ({
      value: Number(r.value),
      classification: r.value_classification,
      timestamp: new Date(Number(r.timestamp) * 1000).toISOString(),
    }));
    const latest = history[0];
    return {
      value: latest.value,
      classification: latest.classification,
      classificationAr: classifyFearGreedAr(latest.value),
      timestamp: latest.timestamp,
      history: history.reverse(),
      meta: { source: NAME, fetchedAt: new Date().toISOString(), dataTime: latest.timestamp, isStale: false, isMock: false },
    };
  }
}
