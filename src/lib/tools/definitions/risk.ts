import { atr, last } from "@/lib/indicators";
import { supportResistance } from "@/lib/indicators/levels";
import { MIN_CANDLES, num, pctText, px } from "../helpers";
import { unavailable, type ToolDefinition } from "../types";

export const riskTools: ToolDefinition[] = [
  {
    id: "risk-plan",
    nameAr: "إدارة المخاطر",
    nameEn: "Risk Management",
    descriptionAr: "تخصيص رأس المال ووقف الخسارة المبني على ATR والدعوم",
    category: "risk",
    usesTimeframe: true,
    run(ctx) {
      const cs = ctx.candles;
      if (cs.length < MIN_CANDLES) return unavailable(this.id, "بيانات غير كافية");
      const price = ctx.price ?? cs[cs.length - 1].close;
      const a = last(atr(cs, 14))!;
      const { supports, resistances } = supportResistance(cs, price);
      const s1 = supports[0]?.price ?? null;
      const atrStop = price - 2 * a;
      const structStop = s1 !== null ? s1 - 0.5 * a : null;
      const stop = structStop !== null && structStop > price - 4 * a ? Math.max(structStop, price - 4 * a) : atrStop;
      const riskPerUnit = price - stop;
      const targets = [resistances[0]?.price, resistances[1]?.price].filter((t): t is number => typeof t === "number" && t > price);
      const rr = targets.map((t) => (t - price) / riskPerUnit);
      return {
        id: this.id,
        status: "ok",
        verdict: "info",
        headline: `وقف مقترح ${px(ctx, stop)} (${pctText((-riskPerUnit / price) * 100)})${rr[0] ? ` — العائد/المخاطرة للهدف الأول ${num(rr[0], 2)}R` : ""}`,
        score: null,
        metrics: [
          { label: "ATR (14)", value: `${px(ctx, a)} (${pctText((a / price) * 100)})` },
          { label: "الوقف المقترح", value: px(ctx, stop), tone: "negative" },
          ...targets.map((t, i) => ({ label: `الهدف ${i + 1} (مقاومة)`, value: `${px(ctx, t)} · ${num(rr[i], 2)}R`, tone: rr[i] >= 2 ? ("positive" as const) : ("warning" as const) })),
        ],
        details: [
          structStop !== null ? "الوقف تحت أقرب دعم بمسافة نصف ATR لتجنب الكسر الكاذب (بحد أقصى 4×ATR)." : "لا يوجد دعم قريب واضح، فاستُخدم وقف بمسافة 2×ATR.",
          ...(rr[0] !== undefined && rr[0] < 1 ? ["المقاومة الأولى قريبة جدًا مقارنة بمسافة الوقف — العائد لا يغطي المخاطرة عند الدخول من السعر الحالي."] : []),
          "قاعدة شائعة: لا تخاطر بأكثر من 1–2% من رأس المال في الصفقة الواحدة، وتجنب الصفقات التي عائدها أقل من 1.5R. استخدم الحاسبة لتحديد حجم المركز.",
        ],
        levels: [
          ...targets.map((t, i) => ({ label: `هدف ${i + 1}`, price: t, tone: "positive" as const })),
          { label: "سعر الدخول المرجعي", price, tone: "info" as const },
          { label: "وقف الخسارة", price: stop, tone: "negative" as const },
        ],
      };
    },
  },
];
