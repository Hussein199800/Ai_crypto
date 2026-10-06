import { describe, expect, it } from "vitest";
import { atr, bollinger, ema, last, macd, obv, rsi, sma, supportResistance, fibonacciRetracement } from "@/lib/indicators";
import { makeCandles } from "./helpers";

describe("المتوسط المتحرك الأسي EMA", () => {
  it("يبدأ بمتوسط بسيط ثم يطبق معامل التنعيم 2/(n+1)", () => {
    const out = ema([2, 4, 6, 8, 10, 12], 3);
    expect(out.slice(0, 2)).toEqual([null, null]);
    expect(out[2]).toBeCloseTo(4); // (2+4+6)/3
    expect(out[3]).toBeCloseTo(6); // 8*0.5 + 4*0.5
    expect(out[4]).toBeCloseTo(8);
    expect(out[5]).toBeCloseTo(10);
  });

  it("يعيد قيمًا فارغة عند نقص البيانات", () => {
    expect(ema([1, 2], 5).every((v) => v === null)).toBe(true);
  });

  it("يتقارب مع السلسلة الثابتة", () => {
    expect(last(ema(new Array(100).fill(42), 20))).toBeCloseTo(42);
  });
});

describe("المتوسط المتحرك البسيط SMA", () => {
  it("يحسب المتوسط الصحيح للنافذة", () => {
    expect(sma([1, 2, 3, 4, 5], 2)).toEqual([null, 1.5, 2.5, 3.5, 4.5]);
  });
});

describe("مؤشر القوة النسبية RSI (طريقة Wilder)", () => {
  // المثال المرجعي الشهير من StockCharts
  const closes = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.0, 46.03, 46.41, 46.22, 45.64,
  ];

  it("يطابق القيم المرجعية", () => {
    // جدول StockCharts يقرّب المتوسطات الوسيطة، لذا يختلف عن الحساب الدقيق بنحو 0.07
    const out = rsi(closes, 14);
    expect(out[13]).toBeNull();
    const reference = [70.53, 66.32, 66.55, 69.41, 66.36, 57.97];
    reference.forEach((ref, i) => expect(Math.abs(out[14 + i]! - ref)).toBeLessThan(0.15));
    // القيمة الدقيقة الأولى: متوسط الربح 0.2386 / متوسط الخسارة 0.0996
    expect(out[14]).toBeCloseTo(70.464, 2);
  });

  it("يساوي 100 عند الصعود المستمر و0 عند الهبوط المستمر", () => {
    const up = Array.from({ length: 30 }, (_, i) => 10 + i);
    const down = Array.from({ length: 30 }, (_, i) => 100 - i);
    expect(last(rsi(up))).toBe(100);
    expect(last(rsi(down))).toBeCloseTo(0);
  });

  it("يساوي 50 للسلسلة الثابتة", () => {
    expect(last(rsi(new Array(30).fill(5)))).toBe(50);
  });

  it("يبقى ضمن النطاق 0..100", () => {
    const c = makeCandles({ n: 300, noise: 0.05, seed: 7 }).map((x) => x.close);
    for (const v of rsi(c)) {
      if (v === null) continue;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe("مؤشر MACD", () => {
  it("يساوي صفرًا للسلسلة الثابتة", () => {
    const m = macd(new Array(100).fill(10));
    expect(last(m.macd)).toBeCloseTo(0);
    expect(last(m.signal)).toBeCloseTo(0);
    expect(last(m.histogram)).toBeCloseTo(0);
  });

  it("يتقارب إلى الفرق النظري في السلسلة الخطية (EMA12 - EMA26 = 7)", () => {
    const linear = Array.from({ length: 400 }, (_, i) => i);
    const m = macd(linear);
    expect(last(m.macd)).toBeCloseTo(7, 2);
    expect(last(m.signal)).toBeCloseTo(7, 2);
    expect(last(m.histogram)).toBeCloseTo(0, 2);
  });

  it("خط الإشارة يبدأ بعد 26 + 9 - 2 قيمة", () => {
    const m = macd(Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i)));
    expect(m.macd[24]).toBeNull();
    expect(m.macd[25]).not.toBeNull();
    expect(m.signal[32]).toBeNull();
    expect(m.signal[33]).not.toBeNull();
  });
});

describe("مؤشرات التقلب والحجم والمستويات", () => {
  it("بولينجر: النطاقات متطابقة في سلسلة ثابتة", () => {
    const b = bollinger(new Array(30).fill(7));
    expect(last(b.upper)).toBeCloseTo(7);
    expect(last(b.lower)).toBeCloseTo(7);
  });

  it("ATR يساوي المدى الثابت", () => {
    const candles = Array.from({ length: 40 }, (_, i) => ({ time: i, open: 10, high: 11, low: 9, close: 10, volume: 1 }));
    expect(last(atr(candles))).toBeCloseTo(2);
  });

  it("OBV يجمع الحجم في الصعود ويطرحه في الهبوط", () => {
    const c = [10, 11, 10.5, 12].map((close, i) => ({ time: i, open: close, high: close, low: close, close, volume: 100 }));
    expect(obv(c)).toEqual([0, 100, 0, 100]);
  });

  it("الدعم تحت السعر والمقاومة فوقه — ولا تُخترع مستويات لسلسلة بلا قمم", () => {
    const candles = makeCandles({ n: 200, wave: 0.02, noise: 0.004, seed: 3 });
    const price = candles.at(-1)!.close;
    const { supports, resistances } = supportResistance(candles, price);
    supports.forEach((s) => expect(s.price).toBeLessThan(price));
    resistances.forEach((r) => expect(r.price).toBeGreaterThan(price));
    const flat = Array.from({ length: 60 }, (_, i) => ({ time: i, open: 5, high: 5, low: 5, close: 5, volume: 1 }));
    expect(supportResistance(flat, 5)).toEqual({ supports: [], resistances: [] });
  });

  it("فيبوناتشي بين القمة والقاع", () => {
    const candles = makeCandles({ n: 120, drift: 0.01, noise: 0.002, seed: 4 });
    const f = fibonacciRetracement(candles)!;
    expect(f.trendUp).toBe(true);
    expect(f.levels.find((l) => l.level === 0.5)!.price).toBeCloseTo((f.high + f.low) / 2);
  });
});
