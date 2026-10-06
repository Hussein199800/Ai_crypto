import { ProviderError } from "./errors";

export interface ProviderCallLog {
  provider: string;
  endpoint: string;
  status: number | null;
  ok: boolean;
  durationMs: number;
  error?: string;
}

type Logger = (entry: ProviderCallLog) => void;
let logger: Logger | null = null;

/** يسمح بحقن مسجل (مثل الحفظ في جدول DataProviderLog) دون ربط الطبقة بقاعدة البيانات */
export function setProviderLogger(fn: Logger | null) {
  logger = fn;
}

/** محدد معدل بسيط لكل مزود: حد أدنى للفاصل الزمني بين الطلبات */
const lastCallAt = new Map<string, number>();
const queues = new Map<string, Promise<void>>();

async function throttle(provider: string, minIntervalMs: number) {
  if (minIntervalMs <= 0) return;
  const prev = queues.get(provider) ?? Promise.resolve();
  const next = prev.then(async () => {
    const wait = (lastCallAt.get(provider) ?? 0) + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt.set(provider, Date.now());
  });
  queues.set(provider, next.catch(() => undefined));
  await next;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface FetchJsonOptions {
  provider: string;
  headers?: Record<string, string>;
  retries?: number;
  timeoutMs?: number;
  minIntervalMs?: number;
  /** أساس التأخير الأسي بالميلي ثانية */
  backoffBaseMs?: number;
}

/** مسار الطلب دون معاملات الاستعلام — حتى لا تُسجَّل مفاتيح أو بيانات حساسة */
export function safeEndpoint(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return "invalid-url";
  }
}

/**
 * جلب JSON مع: مهلة زمنية، إعادة المحاولة مع تأخير أسي وعشوائية،
 * احترام ترويسة Retry-After عند تجاوز حد الطلبات (429)، وتسجيل النتيجة.
 */
export async function fetchJson<T>(url: string, opts: FetchJsonOptions): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.backoffBaseMs ?? 500;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle(opts.provider, opts.minIntervalMs ?? 0);
    const started = Date.now();
    let status: number | null = null;
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json", ...opts.headers },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
        cache: "no-store",
      });
      status = res.status;
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        const err = new ProviderError(opts.provider, `HTTP ${res.status}`, res.status, retryable);
        logger?.({ provider: opts.provider, endpoint: safeEndpoint(url), status, ok: false, durationMs: Date.now() - started, error: err.message });
        if (!retryable || attempt === retries) throw err;
        const retryAfter = Number(res.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 15_000) : backoff(base, attempt);
        lastErr = err;
        await sleep(delay);
        continue;
      }
      const json = (await res.json()) as T;
      logger?.({ provider: opts.provider, endpoint: safeEndpoint(url), status, ok: true, durationMs: Date.now() - started });
      return json;
    } catch (e) {
      if (e instanceof ProviderError && (!e.retryable || attempt === retries)) throw e;
      if (!(e instanceof ProviderError)) {
        const msg = e instanceof Error ? e.name : "unknown";
        logger?.({ provider: opts.provider, endpoint: safeEndpoint(url), status, ok: false, durationMs: Date.now() - started, error: msg });
        lastErr = new ProviderError(opts.provider, `فشل الاتصال (${msg})`);
        if (attempt === retries) throw lastErr;
        await sleep(backoff(base, attempt));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new ProviderError(opts.provider, "فشل غير معروف");
}

function backoff(base: number, attempt: number) {
  const exp = base * 2 ** attempt;
  return Math.min(exp + Math.random() * base, 10_000);
}
