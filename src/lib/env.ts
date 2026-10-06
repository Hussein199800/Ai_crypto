import { z } from "zod";

/**
 * متغيرات البيئة الخاصة بالخادم فقط. لا تُستورد هذه الوحدة من مكونات العميل،
 * ولا تُعرَّف أي مفاتيح بالبادئة NEXT_PUBLIC_ حتى لا تُكشف للمتصفح.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),
  COINGECKO_API_PLAN: z.enum(["demo", "pro"]).default("demo"),
  COINMARKETCAP_API_KEY: z.string().optional(),
  BINANCE_API_KEY: z.string().optional(),
  BINANCE_API_SECRET: z.string().optional(),
  BINANCE_BASE_URL: z.string().url().default("https://data-api.binance.vision"),
  TRADINGVIEW_API_KEY: z.string().optional(),
  CRYPTOPANIC_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  DATA_MODE: z.enum(["live", "mock"]).default("live"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default("CryptoScope AI <no-reply@cryptoscope.local>"),
  REQUIRE_EMAIL_VERIFICATION: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
});

export type ServerEnv = z.infer<typeof schema>;

function emptyToUndefined(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) out[k] = v === "" ? undefined : v;
  return out;
}

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached && process.env.NODE_ENV !== "test") return cached;
  const parsed = schema.safeParse(emptyToUndefined(process.env));
  if (!parsed.success) {
    // لا نطبع القيم نفسها — أسماء المتغيرات فقط
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`إعدادات البيئة غير صالحة: ${fields}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * وضع البيانات التجريبية يعمل فقط خارج الإنتاج.
 * في الإنتاج يتم تجاهل DATA_MODE=mock تلقائيًا مع تحذير في السجل.
 */
export function isMockMode(): boolean {
  const env = getEnv();
  if (env.DATA_MODE !== "mock") return false;
  if (env.NODE_ENV === "production") {
    if (!warnedMockInProd) {
      console.warn("[CryptoScope] تم تجاهل DATA_MODE=mock في بيئة الإنتاج — يتم استخدام المصادر الحقيقية.");
      warnedMockInProd = true;
    }
    return false;
  }
  return true;
}
let warnedMockInProd = false;

export function isGoogleAuthEnabled(): boolean {
  const env = getEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
