import { fairValueGaps, orderBlocks } from "../analyzers/smc";
import { liquidityPools } from "../analyzers/liquidity";
import { MIN_CANDLES, px } from "../helpers";
import { unavailable, verdictOf, type ToolDefinition, type ToolLevel } from "../types";

export const smcTools: ToolDefinition[] = [
  {
    id: "smc-order-blocks",
    nameAr: "كتل الأوامر وفجوات القيمة",
    nameEn: "SMC Order Blocks + FVG",
    descriptionAr: "كتل الأوامر المؤسسية وفجوات القيمة العادلة غير المختبرة",
    category: "smc",
    usesTimeframe: true,
    run(ctx) {
      const cs = ctx.candles;
      if (cs.length < MIN_CANDLES) return unavailable(this.id, "بيانات غير كافية");
      const price = ctx.price ?? cs[cs.length - 1].close;
      const obs = orderBlocks(cs).filter((z) => !z.mitigated);
      const fvgs = fairValueGaps(cs).filter((z) => !z.mitigated);
      const nearest = <T extends { top: number; bottom: number }>(zs: T[], below: boolean) =>
        zs.filter((z) => (below ? z.top < price : z.bottom > price)).sort((a, b) => (below ? b.top - a.top : a.bottom - b.bottom))[0];
      const bullOb = nearest(obs.filter((z) => z.type === "BULLISH"), true);
      const bearOb = nearest(obs.filter((z) => z.type === "BEARISH"), false);
      const bullFvg = nearest(fvgs.filter((z) => z.type === "BULLISH"), true);
      const bearFvg = nearest(fvgs.filter((z) => z.type === "BEARISH"), false);
      const levels: ToolLevel[] = [];
      if (bearOb) levels.push({ label: `كتلة بيعية ${px(ctx, bearOb.bottom)}–${px(ctx, bearOb.top)}`, price: bearOb.bottom, tone: "negative" });
      if (bearFvg) levels.push({ label: `فجوة FVG هابطة ${px(ctx, bearFvg.bottom)}–${px(ctx, bearFvg.top)}`, price: bearFvg.bottom, tone: "negative" });
      if (bullFvg) levels.push({ label: `فجوة FVG صاعدة ${px(ctx, bullFvg.bottom)}–${px(ctx, bullFvg.top)}`, price: bullFvg.top, tone: "positive" });
      if (bullOb) levels.push({ label: `كتلة شرائية ${px(ctx, bullOb.bottom)}–${px(ctx, bullOb.top)}`, price: bullOb.top, tone: "positive" });
      const distBull = bullOb ? (price - bullOb.top) / price : Infinity;
      const distBear = bearOb ? (bearOb.bottom - price) / price : Infinity;
      const score = distBull < distBear ? 0.3 : distBear < distBull ? -0.3 : 0;
      return {
        id: this.id,
        status: "ok",
        verdict: levels.length ? verdictOf(score) : "info",
        headline: levels.length ? `كتل غير مختبرة: ${obs.length} · فجوات FVG مفتوحة: ${fvgs.length}` : "لا توجد مناطق SMC غير مختبرة قريبة",
        score: levels.length ? score : null,
        metrics: [
          { label: "كتل غير مختبرة", value: String(obs.length) },
          { label: "فجوات FVG مفتوحة", value: String(fvgs.length) },
        ],
        details: [
          "كتلة الأوامر الشرائية = آخر شمعة هابطة قبل اندفاع كسر الهيكل صعودًا (والعكس للبيعية)، ويُتوقع أن تعمل كمنطقة طلب/عرض عند أول عودة.",
          "فجوة القيمة العادلة FVG = فجوة بين ذيلي الشمعتين الأولى والثالثة، ويميل السعر لملئها. هذه مفاهيم تفسيرية وليست قواعد مضمونة.",
        ],
        levels,
      };
    },
  },
  {
    id: "liquidity-tracker",
    nameAr: "صائد السيولة (EQH / EQL)",
    nameEn: "Liquidity Tracker",
    descriptionAr: "القمم والقيعان المتساوية وعمليات اصطياد السيولة Sweeps",
    category: "smc",
    usesTimeframe: true,
    run(ctx) {
      const cs = ctx.candles;
      if (cs.length < MIN_CANDLES) return unavailable(this.id, "بيانات غير كافية");
      const pools = liquidityPools(cs);
      const price = ctx.price ?? cs[cs.length - 1].close;
      const recentSweeps = pools.filter((p) => p.swept && cs.length - 1 - (p.sweptIndex ?? 0) <= 10);
      const openPools = pools.filter((p) => !p.swept);
      const above = openPools.filter((p) => p.side === "BUY_SIDE" && p.price > price).sort((a, b) => a.price - b.price)[0];
      const below = openPools.filter((p) => p.side === "SELL_SIDE" && p.price < price).sort((a, b) => b.price - a.price)[0];
      const last = recentSweeps.sort((a, b) => (b.sweptIndex ?? 0) - (a.sweptIndex ?? 0))[0];
      // اصطياد سيولة بيعية (تحت القيعان) ثم العودة = إشارة انعكاس صاعد محتملة، والعكس
      const score = last ? (last.side === "SELL_SIDE" ? 0.5 : -0.5) : 0;
      return {
        id: this.id,
        status: "ok",
        verdict: last ? verdictOf(score) : "info",
        headline: last
          ? `اصطياد سيولة ${last.side === "SELL_SIDE" ? "بيعية تحت القيعان المتساوية" : "شرائية فوق القمم المتساوية"} قبل ${cs.length - 1 - (last.sweptIndex ?? 0)} شمعة`
          : `مجمعات سيولة مفتوحة: ${openPools.length}`,
        score: last ? score : null,
        metrics: [
          { label: "مجمعات مفتوحة", value: String(openPools.length) },
          { label: "اصطيادات حديثة", value: String(recentSweeps.length), tone: recentSweeps.length ? "warning" : "neutral" },
        ],
        details: [
          "فوق القمم المتساوية تتجمع أوامر وقف البائعين (سيولة شرائية) وتحت القيعان المتساوية أوامر وقف المشترين. يميل السعر لزيارة هذه المناطق.",
          "الاصطياد: ذيل يتجاوز المستوى ثم إغلاق يعود دونه — غالبًا ما يسبق حركة معاكسة، لكنه ليس مؤكدًا.",
        ],
        levels: [
          ...(above ? [{ label: `سيولة شرائية (EQH ×${above.touches})`, price: above.price, tone: "negative" as const }] : []),
          ...(below ? [{ label: `سيولة بيعية (EQL ×${below.touches})`, price: below.price, tone: "positive" as const }] : []),
        ],
      };
    },
  },
];
