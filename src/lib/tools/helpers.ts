import { formatAssetValue, formatNumber, formatPercent } from "@/lib/formatters";
import type { ToolContext, Tone } from "./types";

export const px = (ctx: ToolContext, v: number | null | undefined) => formatAssetValue(v ?? null, ctx.kind);
export const num = (v: number | null | undefined, d = 2) => formatNumber(v ?? null, d);
export const pctText = (v: number | null | undefined, digits = 2) => formatPercent(v ?? null, { digits });
export const toneOf = (score: number): Tone => (score > 0.15 ? "positive" : score < -0.15 ? "negative" : "neutral");
export const actionAr = { BUY: "شراء", SELL: "بيع", NEUTRAL: "محايد" } as const;
export const actionTone = { BUY: "positive", SELL: "negative", NEUTRAL: "neutral" } as const;
export const MIN_CANDLES = 60;
