import { beforeEach, describe, expect, it, vi } from "vitest";

// المستخدم الحالي قابل للتغيير في كل اختبار
const viewerState: { current: { id: string; role: "USER" | "ADMIN" } | null } = { current: null };
vi.mock("@/lib/auth/session", () => ({ getViewer: vi.fn(async () => viewerState.current) }));

// قاعدة بيانات وهمية للتقارير
const reports = new Map<string, Record<string, unknown>>();
vi.mock("@/lib/db", () => ({
  prisma: {
    analysisReport: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => reports.get(where.id) ?? null),
    },
  },
}));

vi.mock("@/lib/services/reports", async (orig) => {
  const actual = await orig<typeof import("@/lib/services/reports")>();
  return {
    ...actual,
    generateReport: vi.fn(async (input: { symbol: string }) => ({ id: "cmtestreport000000000000", symbol: input.symbol, persisted: true })),
  };
});

const { GET: getReport } = await import("@/app/api/reports/[id]/route");
const { POST: generate } = await import("@/app/api/reports/generate/route");
const { GET: getWatchlist, POST: postWatchlist } = await import("@/app/api/watchlist/route");
const { GET: getAlerts } = await import("@/app/api/alerts/route");
const { GET: getChart } = await import("@/app/api/charts/[symbol]/route");
const { GET: getAsset } = await import("@/app/api/assets/[symbol]/route");
const { resetRateLimits } = await import("@/lib/security/rate-limit");

const ORIGIN = "http://localhost:3000";
function post(url: string, body: unknown, headers: Record<string, string> = { origin: ORIGIN, host: "localhost:3000" }) {
  return new Request(`${ORIGIN}${url}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}
const params = <T,>(p: T) => ({ params: Promise.resolve(p) });

function makeReport(id: string, userId: string | null, isPublic: boolean) {
  reports.set(id, {
    id,
    symbol: "BTC",
    assetName: "Bitcoin",
    userId,
    isPublic,
    horizon: "MEDIUM",
    recommendation: "NEUTRAL",
    riskLevel: "LOW",
    rawScore: 50,
    score: 50,
    confidence: 50,
    dataQuality: 90,
    priceAtAnalysis: 1,
    change24h: 0,
    isMock: true,
    createdAt: new Date(),
    data: { ok: true },
  });
}

beforeEach(() => {
  viewerState.current = null;
  resetRateLimits();
});

describe("التحقق في مسارات الـ API", () => {
  it("معرّف تقرير غير صالح ← 400 برسالة عربية", async () => {
    const res = await getReport(new Request(`${ORIGIN}/api/reports/x`), params({ id: "../../etc" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("معرّف التقرير غير صالح");
  });

  it("رمز غير مدعوم في الرسوم ← 400", async () => {
    const res = await getChart(new Request(`${ORIGIN}/api/charts/FAKE`), params({ symbol: "FAKE" }));
    expect(res.status).toBe(400);
  });

  it("إطار زمني غير صالح ← 400", async () => {
    const res = await getChart(new Request(`${ORIGIN}/api/charts/BTC?timeframe=7m`), params({ symbol: "BTC" }));
    expect(res.status).toBe(400);
  });

  it("بيانات الأصل تعمل في الوضع التجريبي وتُوسم كتجريبية", async () => {
    const res = await getAsset(new Request(`${ORIGIN}/api/assets/btc`), params({ symbol: "btc" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.symbol).toBe("BTC");
    expect(body.meta.isMock).toBe(true);
  });

  it("الرسوم تعيد المؤشرات محسوبة", async () => {
    const res = await getChart(new Request(`${ORIGIN}/api/charts/ETH?timeframe=4h&limit=100`), params({ symbol: "ETH" }));
    const body = await res.json();
    expect(body.candles).toHaveLength(100);
    expect(body.indicators.rsi14).toHaveLength(100);
  });

  it("إنشاء تقرير بدون Origin ← 403 (حماية CSRF)", async () => {
    const res = await generate(post("/api/reports/generate", { symbol: "BTC" }, { host: "localhost:3000" }));
    expect(res.status).toBe(403);
  });

  it("إنشاء تقرير من مصدر مختلف ← 403", async () => {
    const res = await generate(post("/api/reports/generate", { symbol: "BTC" }, { origin: "https://evil.example", host: "localhost:3000" }));
    expect(res.status).toBe(403);
  });

  it("جسم طلب غير صالح ← 400", async () => {
    const res = await generate(post("/api/reports/generate", { symbol: "NOPE" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("الرمز غير مدعوم");
  });

  it("طلب صالح ← 201", async () => {
    const res = await generate(post("/api/reports/generate", { symbol: "btc", horizon: "SHORT" }));
    expect(res.status).toBe(201);
    expect((await res.json()).symbol).toBe("BTC");
  });

  it("تحديد المعدل لمسار إنشاء التقارير ← 429", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await generate(post("/api/reports/generate", { symbol: "BTC" }))).status);
    expect(statuses.slice(0, 3)).toEqual([201, 201, 201]);
    expect(statuses[3]).toBe(429);
  });
});

describe("صلاحيات المستخدم في الـ API", () => {
  it("المفضلة تتطلب تسجيل الدخول", async () => {
    expect((await getWatchlist()).status).toBe(401);
    expect((await postWatchlist(post("/api/watchlist", { symbol: "BTC" }))).status).toBe(401);
  });

  it("التنبيهات تتطلب تسجيل الدخول", async () => {
    expect((await getAlerts()).status).toBe(401);
  });

  it("التقرير الخاص لا يظهر للزائر ولا لمستخدم آخر (404 دون كشف وجوده)", async () => {
    makeReport("cprivatereport0000000000a", "owner-1", false);
    const req = () => new Request(`${ORIGIN}/api/reports/cprivatereport0000000000a`);
    expect((await getReport(req(), params({ id: "cprivatereport0000000000a" }))).status).toBe(404);
    viewerState.current = { id: "intruder", role: "USER" };
    expect((await getReport(req(), params({ id: "cprivatereport0000000000a" }))).status).toBe(404);
    viewerState.current = { id: "owner-1", role: "USER" };
    const ok = await getReport(req(), params({ id: "cprivatereport0000000000a" }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).isOwner).toBe(true);
  });

  it("التقرير العام يظهر للجميع", async () => {
    makeReport("cpublicreport00000000000b", "owner-1", true);
    const res = await getReport(new Request(`${ORIGIN}/api/reports/cpublicreport00000000000b`), params({ id: "cpublicreport00000000000b" }));
    expect(res.status).toBe(200);
  });

  it("التقرير الخاص يتطلب حسابًا عند الإنشاء", async () => {
    const { generateReport } = await vi.importActual<typeof import("@/lib/services/reports")>("@/lib/services/reports");
    await expect(generateReport({ symbol: "BTC", horizon: "MEDIUM", visibility: "private" }, null)).rejects.toThrow("يجب تسجيل الدخول");
  });
});
