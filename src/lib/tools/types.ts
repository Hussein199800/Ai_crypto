import type { OHLCV, OrderBook, Timeframe } from "@/types/market";

export type ToolCategory = "consensus" | "trend" | "momentum" | "volume" | "smc" | "patterns" | "volatility" | "statistics" | "risk";

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  consensus: "الإجماع والتصويت",
  trend: "الاتجاه وهيكل السوق",
  momentum: "الزخم والتذبذب",
  volume: "الحجم والسيولة",
  smc: "مفاهيم SMC / ICT",
  patterns: "أنماط الشارت",
  volatility: "التقلب",
  statistics: "النماذج الإحصائية",
  risk: "إدارة المخاطر",
};

export type ToolVerdict = "bullish" | "bearish" | "neutral" | "info";
export type Tone = "positive" | "negative" | "warning" | "info" | "neutral";

export interface ToolMetric {
  label: string;
  value: string;
  tone?: Tone;
}

export interface ToolLevel {
  label: string;
  price: number;
  tone?: Tone;
}

export interface ToolTable {
  columns: string[];
  rows: { cells: string[]; tone?: Tone }[];
}

export interface ToolResult {
  id: string;
  status: "ok" | "unavailable";
  verdict: ToolVerdict;
  headline: string;
  /** من -1 (سلبي) إلى +1 (إيجابي) — null للأدوات المعلوماتية */
  score: number | null;
  metrics: ToolMetric[];
  details: string[];
  levels?: ToolLevel[];
  table?: ToolTable;
  /** الإطار الزمني الذي حُسبت عليه الأداة فعليًا */
  timeframe?: Timeframe;
  note?: string;
}

export interface ToolContext {
  symbol: string;
  kind: string;
  timeframe: Timeframe;
  /** الشموع المكتملة للإطار المختار */
  candles: OHLCV[];
  /** الشمعة الجارية (غير المكتملة) للإطار المختار إن وُجدت */
  forming: OHLCV | null;
  /** الشموع المكتملة لكل إطار */
  byTf: Partial<Record<Timeframe, OHLCV[]>>;
  price: number | null;
  orderBook: OrderBook | null;
  now: number;
}

export interface ToolDefinition {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  category: ToolCategory;
  /** هل تتأثر الأداة باختيار الإطار الزمني */
  usesTimeframe: boolean;
  run(ctx: ToolContext): ToolResult;
}

export function unavailable(id: string, reason: string): ToolResult {
  return { id, status: "unavailable", verdict: "info", headline: reason, score: null, metrics: [], details: [] };
}

export function verdictOf(score: number, threshold = 0.15): ToolVerdict {
  return score > threshold ? "bullish" : score < -threshold ? "bearish" : "neutral";
}
