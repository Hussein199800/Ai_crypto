import { scanPatterns } from "../analyzers/patterns";
import { px } from "../helpers";
import { unavailable, verdictOf, type ToolDefinition } from "../types";

export const patternTools: ToolDefinition[] = [
  {
    id: "pattern-scanner",
    nameAr: "ماسح أنماط الشارت",
    nameEn: "Chart Pattern Scanner",
    descriptionAr: "قمة/قاع مزدوج · رأس وكتفين · مثلثات · أوتاد · كوب وعروة",
    category: "patterns",
    usesTimeframe: true,
    run(ctx) {
      if (ctx.candles.length < 60) return unavailable(this.id, "بيانات غير كافية");
      const pats = scanPatterns(ctx.candles);
      const weight = (p: (typeof pats)[number]) => (p.status === "CONFIRMED" ? 0.5 : 0.2) * (p.bias === "bullish" ? 1 : p.bias === "bearish" ? -1 : 0);
      const score = Math.max(-1, Math.min(1, pats.reduce((s, p) => s + weight(p), 0)));
      return {
        id: this.id,
        status: "ok",
        verdict: pats.length ? verdictOf(score) : "info",
        headline: pats.length ? pats.map((p) => `${p.nameAr} (${p.status === "CONFIRMED" ? "مؤكد" : "قيد التشكل"})`).join(" · ") : "لم يُرصد نمط واضح",
        score: pats.length ? score : null,
        metrics: [{ label: "أنماط مرصودة", value: String(pats.length) }],
        details: [
          ...pats.map((p) => `${p.nameAr}: ${p.description} (الثقة: ${p.confidence})`),
          "رصد الأنماط آلي وتقديري ويعطي إشارات كاذبة كثيرة؛ النمط «قيد التشكل» ليس إشارة، والأهداف المقيسة سيناريوهات وليست ضمانًا.",
        ],
        levels: pats.flatMap((p) => p.levels.map((l) => ({ label: `${p.nameAr} — ${l.label}`, price: l.price, tone: (p.bias === "bullish" ? "positive" : p.bias === "bearish" ? "negative" : "neutral") as "positive" | "negative" | "neutral" }))),
        table: pats.length
          ? { columns: ["النمط", "الحالة", "الثقة", "المستوى الرئيسي"], rows: pats.map((p) => ({ cells: [p.nameAr, p.status === "CONFIRMED" ? "مؤكد" : "قيد التشكل", p.confidence, px(ctx, p.levels[1]?.price ?? p.levels[0]?.price)], tone: p.bias === "bullish" ? "positive" : p.bias === "bearish" ? "negative" : "neutral" })) }
          : undefined,
      };
    },
  },
];
