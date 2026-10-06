/**
 * ذاكرة مؤقتة في الذاكرة مع TTL، ودمج الطلبات المتزامنة، والرجوع إلى آخر قيمة
 * معروفة (مع وسمها كقديمة) عند فشل المزود.
 * ملاحظة: في بيئة متعددة الخوادم يُفضّل استبدالها بـ Redis عبر نفس الواجهة.
 */
interface Entry<T> {
  value: T;
  storedAt: number;
  expiresAt: number;
}

const globalForCache = globalThis as unknown as {
  __csCache?: Map<string, Entry<unknown>>;
  __csInflight?: Map<string, Promise<unknown>>;
};
const store: Map<string, Entry<unknown>> = (globalForCache.__csCache ??= new Map());
const inflight: Map<string, Promise<unknown>> = (globalForCache.__csInflight ??= new Map());

const MAX_ENTRIES = 2000;
/** المدة القصوى للاحتفاظ بقيمة قديمة كاحتياطي */
const STALE_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface CachedResult<T> {
  value: T;
  stale: boolean;
  storedAt: number;
}

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<CachedResult<T>> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) return { value: hit.value, stale: false, storedAt: hit.storedAt };

  const existing = inflight.get(key) as Promise<T> | undefined;
  const p = existing ?? loader();
  if (!existing) inflight.set(key, p);
  try {
    const value = await p;
    if (!existing) {
      store.set(key, { value, storedAt: Date.now(), expiresAt: Date.now() + ttlMs });
      evict();
    }
    return { value, stale: false, storedAt: Date.now() };
  } catch (err) {
    if (hit && now - hit.storedAt < STALE_RETENTION_MS) {
      return { value: hit.value, stale: true, storedAt: hit.storedAt };
    }
    throw err;
  } finally {
    if (!existing) inflight.delete(key);
  }
}

function evict() {
  if (store.size <= MAX_ENTRIES) return;
  const keys = [...store.keys()].slice(0, store.size - MAX_ENTRIES);
  for (const k of keys) store.delete(k);
}

export function clearCache() {
  store.clear();
  inflight.clear();
}
