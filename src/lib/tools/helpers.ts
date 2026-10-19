import { bidi, formatAssetValue, formatNumber, formatPercent } from "@/lib/formatters";
import type { ToolContext, Tone } from "./types";

// القيم معزولة اتجاهيًا لأنها تُدرج غالبًا داخل جمل عربية (يمنع انقلاب $ و% و-)
export const px = (ctx: ToolContext, v: number | null | undefined) => bidi(formatAssetValue(v ?? null, ctx.kind));
export const num = (v: number | null | undefined, d = 2) => formatNumber(v ?? null, d);
export const pctText = (v: number | null | undefined, digits = 2) => bidi(formatPercent(v ?? null, { digits }));
/** نسبة غير موقّعة (للأحجام والاحتمالات والتقلب) */
export const pctAbs = (v: number | null | undefined, digits = 2) => bidi(formatPercent(v ?? null, { digits, sign: false }));
export const toneOf = (score: number): Tone => (score > 0.15 ? "positive" : score < -0.15 ? "negative" : "neutral");
export const actionAr = { BUY: "شراء", SELL: "بيع", NEUTRAL: "محايد" } as const;
export const actionTone = { BUY: "positive", SELL: "negative", NEUTRAL: "neutral" } as const;
export const MIN_CANDLES = 60;
