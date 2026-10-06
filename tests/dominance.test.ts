import { describe, expect, it } from "vitest";
import { buildDominanceData, calculateDominance, deriveDominanceChange24h } from "@/lib/analysis/dominance";
import { neutralGlobal } from "./helpers";

describe("حساب هيمنة البيتكوين BTC.D", () => {
  it("BTC.D = القيمة السوقية للبيتكوين / إجمالي السوق × 100", () => {
    expect(calculateDominance(1.2e12, 2.4e12)).toBeCloseTo(50);
    expect(calculateDominance(1.344e12, 2.4e12)).toBeCloseTo(56);
  });

  it("يعيد null عند نقص البيانات أو القيم غير المنطقية بدل اختلاق رقم", () => {
    expect(calculateDominance(null, 2.4e12)).toBeNull();
    expect(calculateDominance(1e12, null)).toBeNull();
    expect(calculateDominance(1e12, 0)).toBeNull();
    expect(calculateDominance(3e12, 2e12)).toBeNull();
    expect(calculateDominance(-1, 2e12)).toBeNull();
    expect(calculateDominance(Number.NaN, 2e12)).toBeNull();
  });
});

describe("حساب هيمنة تيثر USDT.D", () => {
  it("USDT.D = القيمة السوقية لتيثر / إجمالي السوق × 100", () => {
    expect(calculateDominance(120e9, 2.4e12)).toBeCloseTo(5);
  });

  it("buildDominanceData يحسب BTC.D وUSDT.D وTOTAL2/TOTAL3", () => {
    const g = neutralGlobal({ totalMarketCap: 2e12, btcMarketCap: 1.1e12, ethMarketCap: 0.25e12, usdtMarketCap: 0.1e12 });
    const d = buildDominanceData(g);
    expect(d.btcDominance).toBeCloseTo(55);
    expect(d.usdtDominance).toBeCloseTo(5);
    expect(d.total2).toBeCloseTo(0.9e12);
    expect(d.total3).toBeCloseTo(0.65e12);
    expect(d.method).toContain("÷");
  });

  it("تغير الهيمنة خلال 24 ساعة مشتق من تغير القيم السوقية", () => {
    // تيثر ثابتة (0%) والسوق انخفض 10% => الهيمنة ارتفعت
    const change = deriveDominanceChange24h(100e9, 0, 2e12, -10);
    const prev = (100e9 / (2e12 / 0.9)) * 100; // 4.5%
    expect(change).toBeCloseTo(5 - prev);
    expect(change!).toBeGreaterThan(0);
    expect(deriveDominanceChange24h(100e9, null, 2e12, -10)).toBeNull();
  });
});
