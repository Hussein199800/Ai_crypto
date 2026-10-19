import { consensusTools } from "./definitions/consensus";
import { momentumTools } from "./definitions/momentum";
import { patternTools } from "./definitions/patterns";
import { riskTools } from "./definitions/risk";
import { smcTools } from "./definitions/smc";
import { statisticsTools } from "./definitions/statistics";
import { trendTools } from "./definitions/trend";
import { volumeTools } from "./definitions/volume";
import type { ToolContext, ToolDefinition, ToolResult } from "./types";
import { logError } from "@/lib/logger";

export const TOOLS: ToolDefinition[] = [
  ...consensusTools,
  ...trendTools,
  ...momentumTools,
  ...volumeTools,
  ...smcTools,
  ...patternTools,
  ...statisticsTools,
  ...riskTools,
];

const BY_ID = new Map(TOOLS.map((t) => [t.id, t]));

export function getTool(id: string): ToolDefinition | undefined {
  return BY_ID.get(id);
}

/** بيانات وصفية للواجهة (دون الدوال) */
export const TOOL_CATALOG = TOOLS.map(({ id, nameAr, nameEn, descriptionAr, category, usesTimeframe }) => ({ id, nameAr, nameEn, descriptionAr, category, usesTimeframe }));
export type ToolCatalogEntry = (typeof TOOL_CATALOG)[number];

/** تشغيل الأدوات مع عزل الأخطاء: فشل أداة لا يوقف البقية */
export function runTools(ctx: ToolContext, ids?: string[]): ToolResult[] {
  const list = ids?.length ? ids.map((id) => BY_ID.get(id)).filter((t): t is ToolDefinition => Boolean(t)) : TOOLS;
  return list.map((tool) => {
    try {
      const r = tool.run(ctx);
      return { ...r, timeframe: r.timeframe ?? (tool.usesTimeframe ? ctx.timeframe : undefined) };
    } catch (e) {
      logError(`tool.${tool.id}`, e);
      return { id: tool.id, status: "unavailable" as const, verdict: "info" as const, headline: "تعذر حساب هذه الأداة لهذا الأصل", score: null, metrics: [], details: [] };
    }
  });
}
