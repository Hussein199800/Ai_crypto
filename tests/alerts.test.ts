import { describe, expect, it } from "vitest";
import { evaluateAlert, isInCooldown, type AlertContext, type AlertRule } from "@/lib/alerts/evaluate";

const ctx: AlertContext = {
  price: 100,
  change24h: 10,
  support1: 95,
  resistance1: 110,
  ema20: 101,
  ema50: 99,
  trend: "UP",
  btcDominanceChange24h: 0.6,
  usdtDominanceChange24h: 0.2,
};
const rule = (over: Partial<AlertRule>): AlertRule => ({ type: "PRICE_MOVE", symbol: "BTC", threshold: null, cooldownMinutes: 240, lastTriggeredAt: null, lastState: null, ...over });

describe("نظام التنبيهات", () => {
  it("تغير قوي في السعر يتجاوز العتبة", () => {
    expect(evaluateAlert(rule({ threshold: 8 }), ctx).triggered).toBe(true);
    expect(evaluateAlert(rule({ threshold: 12 }), ctx).triggered).toBe(false);
  });

  it("فترة التهدئة تمنع تكرار التنبيه", () => {
    const now = Date.now();
    const recent = rule({ threshold: 5, lastTriggeredAt: new Date(now - 30 * 60_000) });
    const r = evaluateAlert(recent, ctx, now);
    expect(r.triggered).toBe(false);
    expect(r.suppressedByCooldown).toBe(true);
    expect(isInCooldown(new Date(now - 5 * 3_600_000), 240, now)).toBe(false);
  });

  it("كسر الدعم يُطلق فقط عند تغير الحالة", () => {
    const below: AlertContext = { ...ctx, price: 90 };
    expect(evaluateAlert(rule({ type: "SUPPORT_BREAK", lastState: null }), below).triggered).toBe(false);
    expect(evaluateAlert(rule({ type: "SUPPORT_BREAK", lastState: "above" }), below).triggered).toBe(true);
    expect(evaluateAlert(rule({ type: "SUPPORT_BREAK", lastState: "below" }), below).triggered).toBe(false);
  });

  it("اختراق المقاومة", () => {
    const above: AlertContext = { ...ctx, price: 115 };
    const r = evaluateAlert(rule({ type: "RESISTANCE_BREAK", lastState: "below" }), above);
    expect(r.triggered).toBe(true);
    expect(r.newState).toBe("above");
  });

  it("تقاطع EMA وتغير الاتجاه يعتمدان على الحالة السابقة", () => {
    expect(evaluateAlert(rule({ type: "EMA_CROSS", lastState: "below" }), ctx).triggered).toBe(true);
    expect(evaluateAlert(rule({ type: "EMA_CROSS", lastState: "above" }), ctx).triggered).toBe(false);
    expect(evaluateAlert(rule({ type: "TREND_CHANGE", lastState: "DOWN" }), ctx).triggered).toBe(true);
  });

  it("تنبيهات BTC.D وUSDT.D بعتبات افتراضية محافظة", () => {
    expect(evaluateAlert(rule({ type: "BTC_D_CHANGE" }), ctx).triggered).toBe(true);
    expect(evaluateAlert(rule({ type: "USDT_D_RISE" }), ctx).triggered).toBe(true);
    expect(evaluateAlert(rule({ type: "USDT_D_RISE" }), { ...ctx, usdtDominanceChange24h: 0.05 }).triggered).toBe(false);
  });
});
