import type { KeyLevels, Recommendation } from "@/types/analysis";
import type { ComputedIndicators } from "./timeframe";

/**
 * المستويات المهمة — مشتقة فقط من نقاط ارتكاز حقيقية في البيانات.
 * لا تُخترع أرقام: أي مستوى غير متوفر يُعاد null ويُعرض "غير متاح".
 */
export function computeKeyLevels(c: ComputedIndicators | null, recommendation: Recommendation, insufficient: boolean): KeyLevels {
  const empty: KeyLevels = {
    available: false,
    support1: null,
    support2: null,
    resistance1: null,
    resistance2: null,
    entryZone: null,
    invalidation: null,
    targets: [],
    fibonacci: [],
    method: "غير متاح",
    notes: ["البيانات غير كافية لتحديد مستويات موثوقة."],
  };
  if (!c || insufficient) return empty;
  const notes: string[] = [];
  const s1 = c.supports[0]?.price ?? null;
  const s2 = c.supports[1]?.price ?? null;
  const r1 = c.resistances[0]?.price ?? null;
  const r2 = c.resistances[1]?.price ?? null;
  const atr = c.atr14;

  let entryZone: KeyLevels["entryZone"] = null;
  const positive = recommendation === "POSSIBLE_BUY" || recommendation === "GRADUAL_BUY" || recommendation === "NEUTRAL";
  if (s1 != null && atr != null && positive) {
    const high = Math.min(c.price, s1 + atr);
    if (high > s1) entryZone = { low: s1, high };
    if (c.price - s1 > atr * 3) notes.push("السعر بعيد عن الدعم الأقرب؛ منطقة الاهتمام تتطلب تصحيحًا للوصول إليها.");
  } else if (!positive) {
    notes.push("لا تُقترح منطقة دخول في ظل التقييم السلبي الحالي.");
  }
  // مستوى الإبطال: أسفل الدعم الأول بمسافة ATR واحدة (لتجنب الكسر الكاذب)
  const invalidation = s1 != null && atr != null ? Math.max(0, s1 - atr) : null;
  const targets = [r1, r2].filter((x): x is number => x != null);
  if (targets.length === 0) notes.push("لا توجد مقاومات تاريخية واضحة فوق السعر الحالي — الأهداف غير متاحة.");
  return {
    available: s1 != null || r1 != null,
    support1: s1,
    support2: s2,
    resistance1: r1,
    resistance2: r2,
    entryZone,
    invalidation,
    targets,
    fibonacci: c.fib?.levels ?? [],
    method: `مستويات مشتقة من تجميع القمم والقيعان المحلية على إطار ${c.timeframe} (آخر 200 شمعة)، ومستوى الإبطال = الدعم الأول − ATR(14).`,
    notes,
  };
}
