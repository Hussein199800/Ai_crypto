import { getEnv } from "@/lib/env";
import type { MarketNews } from "@/types/market";
import { NotSupportedError } from "./errors";
import { fetchJson } from "./http";

const NAME = "CryptoPanic";

/** مزود أخبار اختياري — يعمل فقط مع CRYPTOPANIC_API_KEY */
export class CryptoPanicClient {
  readonly name = NAME;

  get enabled() {
    return Boolean(getEnv().CRYPTOPANIC_API_KEY);
  }

  async news(): Promise<MarketNews[]> {
    const key = getEnv().CRYPTOPANIC_API_KEY;
    if (!key) throw new NotSupportedError(NAME, "لا يوجد مفتاح API");
    const res = await fetchJson<{
      results?: { id: number; title: string; url: string; published_at: string; source?: { title?: string }; votes?: { positive?: number; negative?: number } }[];
    }>(`https://cryptopanic.com/api/v1/posts/?auth_token=${encodeURIComponent(key)}&public=true&kind=news`, { provider: NAME, retries: 1 });
    return (res.results ?? []).slice(0, 20).map((r) => {
      const pos = r.votes?.positive ?? 0;
      const neg = r.votes?.negative ?? 0;
      return {
        id: String(r.id),
        title: r.title,
        url: r.url,
        source: r.source?.title ?? NAME,
        publishedAt: r.published_at,
        sentiment: pos > neg + 2 ? "positive" : neg > pos + 2 ? "negative" : "neutral",
      } satisfies MarketNews;
    });
  }
}
