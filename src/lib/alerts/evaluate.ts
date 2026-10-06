import { percentText, priceText } from "@/lib/formatters";
import type { TrendDirection } from "@/types/analysis";

export type AlertType = "PRICE_MOVE" | "SUPPORT_BREAK" | "RESISTANCE_BREAK" | "BTC_D_CHANGE" | "USDT_D_RISE" | "EMA_CROSS" | "TREND_CHANGE";

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  PRICE_MOVE: "تغير قوي في السعر",
  SUPPORT_BREAK: "كسر دعم",
  RESISTANCE_BREAK: "اختراق مقاومة",
  BTC_D_CHANGE: "تغير كبير في BTC.D",
  USDT_D_RISE: "ارتفاع USDT.D",
  EMA_CROSS: "تقاطع EMA 20/50",
  TREND_CHANGE: "تغير في الاتجاه",
};

/** العتبات الافتراضية — محافظة لتجنب التنبيهات الكثيرة أو المضللة */
export const DEFAULT_THRESHOLDS: Partial<Record<AlertType, number>> = {
  PRICE_MOVE: 8,
  BTC_D_CHANGE: 0.5,
  USDT_D_RISE: 0.15,
};

export interface AlertRule {
  type: AlertType;
  symbol: string;
  threshold: number | null;
  cooldownMinutes: number;
  lastTriggeredAt: Date | null;
  lastState: string | null;
}

export interface AlertContext {
  price: number | null;
  change24h: number | null;
  support1: number | null;
  resistance1: number | null;
  ema20: number | null;
  ema50: number | null;
  trend: TrendDirection;
  btcDominanceChange24h: number | null;
  usdtDominanceChange24h: number | null;
}

export interface AlertEvaluation {
  triggered: boolean;
  message: string | null;
  value: number | null;
  newState: string | null;
  suppressedByCooldown: boolean;
}

export function isInCooldown(lastTriggeredAt: Date | null, cooldownMinutes: number, now = Date.now()): boolean {
  if (!lastTriggeredAt) return false;
  return now - lastTriggeredAt.getTime() < cooldownMinutes * 60_000;
}

/**
 * تقييم تنبيه واحد. التنبيهات المعتمدة على الحالة (كسر/اختراق/تقاطع/اتجاه)
 * تُطلق فقط عند تغير الحالة، وليس في كل مرة يبقى فيها الشرط صحيحًا.
 */
export function evaluateAlert(rule: AlertRule, ctx: AlertContext, now = Date.now()): AlertEvaluation {
  const t = rule.threshold ?? DEFAULT_THRESHOLDS[rule.type] ?? null;
  let fire = false;
  let message: string | null = null;
  let value: number | null = null;
  let newState: string | null = rule.lastState;

  switch (rule.type) {
    case "PRICE_MOVE": {
      value = ctx.change24h;
      if (value != null && t != null && Math.abs(value) >= t) {
        fire = true;
        message = `${rule.symbol}: تغير السعر ${percentText(value)} خلال 24 ساعة (العتبة ${t}%).`;
      }
      break;
    }
    case "SUPPORT_BREAK":
    case "RESISTANCE_BREAK": {
      const isSupport = rule.type === "SUPPORT_BREAK";
      const level = rule.threshold ?? (isSupport ? ctx.support1 : ctx.resistance1);
      value = ctx.price;
      if (level == null || ctx.price == null) break;
      const state = ctx.price < level ? "below" : "above";
      const crossed = isSupport ? state === "below" && rule.lastState === "above" : state === "above" && rule.lastState === "below";
      if (crossed) {
        fire = true;
        message = isSupport
          ? `${rule.symbol}: كسر السعر مستوى الدعم ${priceText(level)} (السعر ${priceText(ctx.price)}).`
          : `${rule.symbol}: اخترق السعر مستوى المقاومة ${priceText(level)} (السعر ${priceText(ctx.price)}).`;
      }
      newState = state;
      break;
    }
    case "BTC_D_CHANGE": {
      value = ctx.btcDominanceChange24h;
      if (value != null && t != null && Math.abs(value) >= t) {
        fire = true;
        message = `هيمنة البيتكوين BTC.D ${value > 0 ? "ارتفعت" : "انخفضت"} ${Math.abs(value).toFixed(2)} نقطة خلال 24 ساعة.`;
      }
      break;
    }
    case "USDT_D_RISE": {
      value = ctx.usdtDominanceChange24h;
      if (value != null && t != null && value >= t) {
        fire = true;
        message = `هيمنة تيثر USDT.D ارتفعت ${value.toFixed(2)} نقطة خلال 24 ساعة — تراجع محتمل في شهية المخاطرة.`;
      }
      break;
    }
    case "EMA_CROSS": {
      if (ctx.ema20 == null || ctx.ema50 == null) break;
      const state = ctx.ema20 > ctx.ema50 ? "above" : "below";
      value = ctx.ema20;
      if (rule.lastState && rule.lastState !== state) {
        fire = true;
        message = `${rule.symbol}: تقاطع EMA 20 ${state === "above" ? "فوق" : "تحت"} EMA 50 على الإطار اليومي.`;
      }
      newState = state;
      break;
    }
    case "TREND_CHANGE": {
      if (ctx.trend === "UNKNOWN") break;
      if (rule.lastState && rule.lastState !== ctx.trend) {
        fire = true;
        const ar = { UP: "صاعد", DOWN: "هابط", SIDEWAYS: "عرضي" } as const;
        message = `${rule.symbol}: تغير الاتجاه اليومي من ${ar[rule.lastState as keyof typeof ar] ?? rule.lastState} إلى ${ar[ctx.trend]}.`;
      }
      newState = ctx.trend;
      break;
    }
  }

  if (fire && isInCooldown(rule.lastTriggeredAt, rule.cooldownMinutes, now)) {
    return { triggered: false, message: null, value, newState, suppressedByCooldown: true };
  }
  return { triggered: fire, message: fire ? message : null, value, newState, suppressedByCooldown: false };
}
