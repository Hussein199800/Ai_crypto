/**
 * محدد معدل بنافذة منزلقة في الذاكرة.
 * مناسب لخادم واحد؛ في النشر متعدد الخوادم استبدله بـ Redis (نفس الواجهة).
 */
const g = globalThis as unknown as { __csRate?: Map<string, number[]> };
const buckets: Map<string, number[]> = (g.__csRate ??= new Map<string, number[]>());

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    const retry = Math.ceil((windowMs - (now - arr[0])) / 1000);
    return { ok: false, remaining: 0, retryAfterSec: Math.max(1, retry) };
  }
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
  return { ok: true, remaining: limit - arr.length, retryAfterSec: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}

/** عنوان العميل من ترويسات الوكيل العكسي */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
