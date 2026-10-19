import { describe, expect, it } from "vitest";
import { cci, choppiness, ichimoku, last, linearRegression, mfi, stochastic, tdSequential, williamsR } from "@/lib/indicators";
import { maConsensus, oscillatorConsensus } from "@/lib/tools/analyzers/consensus";
import { analyzeStructure } from "@/lib/tools/analyzers/structure";
import { fairValueGaps } from "@/lib/tools/analyzers/smc";
import { liquidityPools } from "@/lib/tools/analyzers/liquidity";
import { scanPatterns } from "@/lib/tools/analyzers/patterns";
import { volumeDelta, volumeProfile } from "@/lib/tools/analyzers/volume";
import { analyzeOrderBook } from "@/lib/tools/analyzers/orderbook";
import { seasonality } from "@/lib/tools/analyzers/seasonality";
import { candleAnatomy } from "@/lib/tools/analyzers/candle";
import { arima, dominantCycles, garch11, gaussianHmm, monteCarloGBM, normalSampler, seededRandom } from "@/lib/stats";
import { runTools, TOOLS } from "@/lib/tools/registry";
import { buildToolContext } from "@/lib/tools/context";
import { MockProvider } from "@/lib/providers/mock";
import type { OHLCV } from "@/types/market";
import { makeCandles } from "./helpers";

const C = (time: number, open: number, high: number, low: number, close: number, volume = 100): OHLCV => ({ time, open, high, low, close, volume });

/** سلسلة من أسعار إغلاق مع شموع ضيقة حولها */
function fromCloses(closes: number[]): OHLCV[] {
  return closes.map((c, i) => C(i * 3_600_000, c, c * 1.002, c * 0.998, c));
}

describe("مؤشرات إضافية", () => {
  const cs = makeCandles({ n: 200, noise: 0.03, seed: 11 });
  it("المذبذبات ضمن نطاقاتها", () => {
    for (const v of williamsR(cs)) if (v !== null) expect(v).toBeGreaterThanOrEqual(-100), expect(v).toBeLessThanOrEqual(0);
    for (const v of stochastic(cs).k) if (v !== null) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(100);
    for (const v of mfi(cs)) if (v !== null) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(100);
    for (const v of choppiness(cs)) if (v !== null) expect(v).toBeGreaterThan(0);
    expect(last(cci(cs))).not.toBeNull();
  });

  it("الانحدار الخطي يطابق خطًا مستقيمًا تمامًا", () => {
    const r = linearRegression([1, 3, 5, 7, 9])!;
    expect(r.slope).toBeCloseTo(2);
    expect(r.fair).toBeCloseTo(9);
    expect(r.r2).toBeCloseTo(1);
  });

  it("TD Sequential يكمل إعداد 9 في هبوط متواصل", () => {
    const down = fromCloses(Array.from({ length: 20 }, (_, i) => 100 - i));
    const td = tdSequential(down);
    expect(td.buySetup).toBe(9);
    expect(td.lastCompleted?.type).toBe("BUY");
  });

  it("إيشيموكو: تنكان = منتصف أعلى/أدنى 9 شموع", () => {
    const cs2 = makeCandles({ n: 100, drift: 0.005, seed: 3 });
    const ich = ichimoku(cs2);
    const w = cs2.slice(-9);
    expect(last(ich.tenkan)).toBeCloseTo((Math.max(...w.map((c) => c.high)) + Math.min(...w.map((c) => c.low))) / 2);
  });
});

describe("الإجماع", () => {
  it("سلسلة صاعدة: كل المتوسطات الـ12 إشارة شراء، وRSI المرتفع يُصنَّف بيعًا (تشبع)", () => {
    const up = fromCloses(Array.from({ length: 250 }, (_, i) => 100 + i));
    const ma = maConsensus(up);
    expect(ma.items).toHaveLength(12);
    expect(ma.buy).toBe(12);
    expect(ma.label).toBe("ميل شرائي قوي");
    const osc = oscillatorConsensus(up);
    expect(osc.items).toHaveLength(6);
    expect(osc.items.find((i) => i.name.startsWith("RSI"))!.action).toBe("SELL");
    expect(osc.buy + osc.sell + osc.neutral).toBe(osc.items.filter((i) => i.value !== null).length);
  });
});

describe("هيكل السوق و SMC", () => {
  it("يرصد BOS صاعدًا في اتجاه صاعد ثم CHOCH عند الكسر الهابط", () => {
    const zig: number[] = [];
    let p = 100;
    for (let leg = 0; leg < 8; leg++) {
      for (let i = 0; i < 6; i++) zig.push((p += 2));
      for (let i = 0; i < 4; i++) zig.push((p -= 1.5));
    }
    for (let i = 0; i < 15; i++) zig.push((p -= 5));
    const ms = analyzeStructure(fromCloses(zig));
    expect(ms.events.some((e) => e.type === "BOS" && e.direction === "UP")).toBe(true);
    const lastEv = ms.lastEvent!;
    expect(lastEv.direction).toBe("DOWN");
    expect(ms.events.some((e) => e.type === "CHOCH" && e.direction === "DOWN")).toBe(true);
  });

  it("يرصد فجوة القيمة العادلة الصاعدة", () => {
    const cs = [C(0, 10, 10.5, 9.8, 10.4), C(1, 10.4, 12, 10.4, 11.9), C(2, 11.9, 12.5, 11, 12.4), C(3, 12.4, 12.8, 12.1, 12.6)];
    const g = fairValueGaps(cs, 10);
    expect(g[0]).toMatchObject({ type: "BULLISH", bottom: 10.5, top: 11, mitigated: false });
  });

  it("يرصد قممًا متساوية ثم اصطياد السيولة فوقها", () => {
    const closes = [100, 103, 106, 110, 106, 103, 100, 103, 106, 110, 106, 103, 100, 101, 102];
    const cs = fromCloses(closes);
    // قمتان متساويتان تقريبًا عند ~110 ثم ذيل يتجاوزهما وإغلاق تحتهما
    cs.push(C(99, 102, 111.5, 101.5, 105));
    cs.push(C(100, 105, 106, 103, 104));
    const pools = liquidityPools(cs, 0.3);
    const eqh = pools.find((p) => p.side === "BUY_SIDE");
    expect(eqh).toBeDefined();
    expect(eqh!.swept).toBe(true);
  });

  it("يرصد قمة مزدوجة مؤكدة بكسر خط العنق", () => {
    const closes: number[] = [];
    for (let i = 0; i < 20; i++) closes.push(100 + i * 1.5);
    for (let i = 0; i < 10; i++) closes.push(130 - i * 1.5);
    for (let i = 0; i < 10; i++) closes.push(115 + i * 1.5);
    for (let i = 0; i < 25; i++) closes.push(130 - i * 1.5);
    const pats = scanPatterns(fromCloses(closes));
    const dt = pats.find((p) => p.key === "double_top");
    expect(dt).toBeDefined();
    expect(dt!.status).toBe("CONFIRMED");
  });
});

describe("الحجم ودفتر الأوامر", () => {
  it("POC عند السعر الأكثر تداولًا", () => {
    const cs = Array.from({ length: 50 }, (_, i) => C(i, 100, 101, 99, 100, i % 5 === 0 ? 1000 : 10));
    cs.push(C(60, 120, 121, 119, 120, 5));
    const vp = volumeProfile(cs)!;
    expect(vp.poc).toBeGreaterThan(98);
    expect(vp.poc).toBeLessThan(102);
    expect(vp.val).toBeLessThanOrEqual(vp.poc);
    expect(vp.vah).toBeGreaterThanOrEqual(vp.poc);
  });

  it("دلتا دقيقة من حجم الشراء المبادر", () => {
    const cs = makeCandles({ n: 60, seed: 4 }).map((c) => ({ ...c, takerBuyVolume: c.volume * 0.7 }));
    const d = volumeDelta(cs)!;
    expect(d.exact).toBe(true);
    expect(d.buyShare20).toBeCloseTo(70, 5);
  });

  it("عدم توازن الدفتر وجدران السيولة", () => {
    const bids = Array.from({ length: 100 }, (_, i) => ({ price: 99.9 - i * 0.02, quantity: i === 10 ? 500 : 10 }));
    const asks = Array.from({ length: 100 }, (_, i) => ({ price: 100.1 + i * 0.02, quantity: 5 }));
    const a = analyzeOrderBook({ symbol: "X", bids, asks, meta: { source: "t", fetchedAt: "", isStale: false, isMock: true } })!;
    expect(a.depth.find((d) => d.pct === 2)!.imbalance).toBeGreaterThan(0.3);
    expect(a.bidWalls[0].price).toBeCloseTo(99.7);
  });
});

describe("الموسمية والشموع", () => {
  it("يحسب العوائد الشهرية من الإغلاقات", () => {
    const cs: OHLCV[] = [];
    let price = 100;
    for (let y = 2020; y <= 2023; y++) {
      for (let m = 0; m < 12; m++) {
        price *= m === 0 ? 1.1 : 0.99;
        for (let w = 0; w < 4; w++) cs.push(C(Date.UTC(y, m, 1 + w * 7), price, price, price, price));
      }
    }
    const s = seasonality(cs)!;
    expect(s.monthStats[0].avg).toBeCloseTo(10, 5);
    expect(s.monthStats[0].winRate).toBe(100);
    expect(s.monthStats[5].avg).toBeCloseTo(-1, 5);
  });

  it("يتعرف على المطرقة بعد هبوط والابتلاع الشرائي", () => {
    const hammer = candleAnatomy(C(0, 100, 102.4, 90, 102), null, 5, "DOWN");
    expect(hammer.patterns.some((p) => p.nameAr.includes("مطرقة"))).toBe(true);
    const engulf = candleAnatomy(C(1, 94, 101, 93.5, 100.5), C(0, 99, 99.5, 94.5, 95), 3, "DOWN");
    expect(engulf.patterns.some((p) => p.nameAr === "ابتلاع شرائي")).toBe(true);
  });
});

describe("النماذج الإحصائية", () => {
  const rnd = normalSampler(seededRandom(7));

  it("مونت كارلو: نتائج حتمية ومئينات مرتبة", () => {
    const closes = makeCandles({ n: 300, noise: 0.03, seed: 9 }).map((c) => c.close);
    const a = monteCarloGBM(closes, 30, 500, 1)!;
    const b = monteCarloGBM(closes, 30, 500, 1)!;
    expect(a.percentiles).toEqual(b.percentiles);
    const p = a.percentiles;
    expect(p.p5).toBeLessThan(p.p25);
    expect(p.p25).toBeLessThan(p.p50);
    expect(p.p50).toBeLessThan(p.p75);
    expect(p.p75).toBeLessThan(p.p95);
    expect(a.probAbove).toBeGreaterThanOrEqual(0);
    expect(a.probAbove).toBeLessThanOrEqual(1);
  });

  it("GARCH يستعيد استمرارية التقلب من بيانات مُحاكاة", () => {
    const omega = 0.00001;
    const alpha = 0.1;
    const beta = 0.85;
    let v = omega / (1 - alpha - beta);
    const r: number[] = [];
    for (let t = 0; t < 2000; t++) {
      const e = Math.sqrt(v) * rnd();
      r.push(e);
      v = omega + alpha * e * e + beta * v;
    }
    const g = garch11(r)!;
    expect(g.persistence).toBeGreaterThan(0.85);
    expect(g.persistence).toBeLessThan(1);
    expect(g.forecast[2].vol).toBeGreaterThan(g.forecast[0].vol);
  });

  it("HMM يميّز نظامين مختلفين ويحدد الحالي", () => {
    const r: number[] = [];
    for (let i = 0; i < 300; i++) r.push(-0.01 + 0.01 * rnd());
    for (let i = 0; i < 300; i++) r.push(0.012 + 0.01 * rnd());
    const h = gaussianHmm(r, 2, 60)!;
    expect(h.states[0].mean).toBeLessThan(0);
    expect(h.states[1].mean).toBeGreaterThan(0);
    expect(h.current[1]).toBeGreaterThan(0.8);
  });

  it("فورييه يكتشف دورة جيبية بطول 20", () => {
    const vals = Array.from({ length: 200 }, (_, i) => Math.sin((2 * Math.PI * i) / 20) + i * 0.01);
    const c = dominantCycles(vals, 1)[0];
    expect(c.period).toBeCloseTo(20, 0);
  });

  it("ARIMA يستعيد معامل AR(1) ونطاقات الثقة تتسع مع الأفق", () => {
    const r: number[] = [0];
    for (let i = 1; i < 800; i++) r.push(0.5 * r[i - 1] + 0.01 * rnd());
    const closes = [100];
    for (const x of r) closes.push(closes[closes.length - 1] * Math.exp(x));
    const m = arima(closes, 1, 5)!;
    expect(m.coefficients[0]).toBeGreaterThan(0.4);
    expect(m.coefficients[0]).toBeLessThan(0.6);
    const f = m.forecast;
    expect(f[4].hi95 - f[4].lo95).toBeGreaterThan(f[0].hi95 - f[0].lo95);
  });
});

describe("سجل الأدوات", () => {
  it("كل الأدوات (29) تعمل على بيانات تجريبية دون أخطاء", async () => {
    expect(TOOLS).toHaveLength(29);
    const ids = new Set(TOOLS.map((t) => t.id));
    expect(ids.size).toBe(TOOLS.length);
    const { ctx } = await buildToolContext(new MockProvider(), "BTC", "4h");
    const res = runTools(ctx);
    expect(res).toHaveLength(29);
    for (const r of res) {
      expect(r.status, r.id).toBe("ok");
      if (r.score !== null) expect(Math.abs(r.score)).toBeLessThanOrEqual(1);
      expect(r.headline.length).toBeGreaterThan(3);
    }
  });

  it("فشل أداة لا يوقف البقية", async () => {
    const { ctx } = await buildToolContext(new MockProvider(), "ETH", "1d");
    const broken = { ...ctx, byTf: { ...ctx.byTf, "1d": undefined as unknown as OHLCV[] } } as typeof ctx;
    const res = runTools(broken, ["monte-carlo", "ma-consensus"]);
    expect(res.find((r) => r.id === "monte-carlo")!.status).toBe("unavailable");
    expect(res.find((r) => r.id === "ma-consensus")!.status).toBe("ok");
  });

  it("المؤشرات السوقية بلا حجم تُعلَّم أدوات الحجم بأنها غير متاحة بدل اختلاق قيم", async () => {
    const { ctx } = await buildToolContext(new MockProvider(), "BTC.D", "1d");
    const res = runTools(ctx, ["volume-profile", "volume-delta", "order-book"]);
    for (const r of res) expect(r.status, r.id).toBe("unavailable");
  });
});
