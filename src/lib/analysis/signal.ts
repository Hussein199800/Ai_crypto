import { INDICATOR_WEIGHTS } from "@/config/scoring";
import { clamp } from "@/lib/indicators/utils";
import { directionOf } from "@/lib/scoring";
import type { IndicatorSignal, ScoreCategory } from "@/types/analysis";

interface SignalSpec {
  key: string;
  nameAr: string;
  nameEn: string;
  category: ScoreCategory;
  value: number | null;
  valueText: string;
  status: string;
  score: number;
  explanation: string;
  weight?: number;
}

export function makeSignal(spec: SignalSpec): IndicatorSignal {
  const score = clamp(spec.score, -1, 1);
  return {
    ...spec,
    score,
    weight: spec.weight ?? INDICATOR_WEIGHTS[spec.key] ?? 1,
    direction: directionOf(score),
    contribution: 0,
    available: true,
  };
}

/** إشارة غير متاحة — تُعرض للمستخدم لكنها لا تدخل في الحساب */
export function unavailableSignal(key: string, nameAr: string, nameEn: string, category: ScoreCategory, reason: string): IndicatorSignal {
  return {
    key,
    nameAr,
    nameEn,
    category,
    value: null,
    valueText: "غير متاح",
    status: "غير متاح",
    direction: "neutral",
    score: 0,
    weight: INDICATOR_WEIGHTS[key] ?? 1,
    contribution: 0,
    explanation: reason,
    available: false,
  };
}
