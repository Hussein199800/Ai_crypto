import { adx, ema, last, macd, obv, rsi, slopePct } from "@/lib/indicators";
import { ichimoku } from "@/lib/indicators/extra";
import { TIMEFRAME_LABELS } from "@/lib/timeframes";
import { TIMEFRAMES } from "@/types/market";
import { maConsensus, oscillatorConsensus, type ConsensusSummary } from "../analyzers/consensus";
import { analyzeStructure } from "../analyzers/structure";
import { actionAr, actionTone, MIN_CANDLES, num, toneOf } from "../helpers";
import { unavailable, verdictOf, type ToolDefinition, type ToolResult } from "../types";

function consensusResult(id: string, c: ConsensusSummary, title: string): ToolResult {
  return {
    id,
    status: "ok",
    verdict: verdictOf(c.score),
    headline: `${title}: ${c.label}`,
    score: c.score,
    metrics: [
      { label: "شراء", value: String(c.buy), tone: "positive" },
      { label: "محايد", value: String(c.neutral), tone: "neutral" },
      { label: "بيع", value: String(c.sell), tone: "negative" },
    ],
    details: ["كل مؤشر يُصنَّف آليًا (شراء / محايد / بيع) بقواعد ثابتة، والنتيجة هي محصلة الأصوات وليست توصية."],
    table: {
      columns: ["المؤشر", "القيمة", "الإشارة"],
      rows: c.items.map((i) => ({ cells: [i.name, i.value === null ? "غير متاح" : num(i.value, 4), i.value === null ? "—" : actionAr[i.action]], tone: i.value === null ? "neutral" : actionTone[i.action] })),
    },
  };
}

export const consensusTools: ToolDefinition[] = [
  {
    id: "ma-consensus",
    nameAr: "إجماع المتوسطات المتحركة (12)",
    nameEn: "Moving Averages Consensus",
    descriptionAr: "تصويت 12 متوسطًا: SMA وEMA للفترات 10 إلى 200",
    category: "consensus",
    usesTimeframe: true,
    run(ctx) {
      if (ctx.candles.length < MIN_CANDLES) return unavailable(this.id, "بيانات غير كافية");
      return consensusResult(this.id, maConsensus(ctx.candles), "إجماع المتوسطات");
    },
  },
  {
    id: "oscillator-consensus",
    nameAr: "إجماع المذبذبات (6)",
    nameEn: "Oscillators Consensus",
    descriptionAr: "RSI · MACD · Stoch · CCI · %R · Momentum",
    category: "consensus",
    usesTimeframe: true,
    run(ctx) {
      if (ctx.candles.length < MIN_CANDLES) return unavailable(this.id, "بيانات غير كافية");
      return consensusResult(this.id, oscillatorConsensus(ctx.candles), "إجماع المذبذبات");
    },
  },
  {
    id: "tools6",
    nameAr: "التصويت الموحد (6 محركات)",
    nameEn: "Tools 6 — Unified Vote",
    descriptionAr: "تصويت موحد من الاتجاه والزخم والمتوسطات والهيكل والحجم وإيشيموكو",
    category: "consensus",
    usesTimeframe: true,
    run(ctx) {
      const cs = ctx.candles;
      if (cs.length < 100) return unavailable(this.id, "يتطلب 100 شمعة على الأقل");
      const closes = cs.map((c) => c.close);
      const price = closes[closes.length - 1];
      const e50 = last(ema(closes, 50));
      const e200 = last(ema(closes, 200));
      const trendVote = e50 === null ? 0 : price > e50 && (e200 === null || e50 > e200) ? 1 : price < e50 && (e200 === null || e50 < e200) ? -1 : 0;
      const osc = oscillatorConsensus(cs).score;
      const mas = maConsensus(cs).score;
      const st = analyzeStructure(cs).trend;
      const obvSlope = slopePct(obv(cs), 20);
      const volVote = cs.every((c) => c.volume <= 0) || obvSlope === null ? 0 : obvSlope > 0 ? 1 : -1;
      const ich = ichimoku(cs);
      const a = last(ich.spanA);
      const b = last(ich.spanB);
      const ichVote = a === null || b === null ? 0 : price > Math.max(a, b) ? 1 : price < Math.min(a, b) ? -1 : 0;
      const engines = [
        { name: "الاتجاه (EMA 50/200)", vote: trendVote },
        { name: "الزخم (إجماع المذبذبات)", vote: Math.sign(Math.round(osc * 3)) },
        { name: "المتوسطات (إجماع 12)", vote: Math.sign(Math.round(mas * 3)) },
        { name: "هيكل السوق (BOS/CHOCH)", vote: st === "UP" ? 1 : st === "DOWN" ? -1 : 0 },
        { name: "الحجم (OBV)", vote: volVote },
        { name: "إيشيموكو (السحابة)", vote: ichVote },
      ];
      const score = engines.reduce((s, e) => s + e.vote, 0) / engines.length;
      const up = engines.filter((e) => e.vote > 0).length;
      const down = engines.filter((e) => e.vote < 0).length;
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score, 0.2),
        headline: `محركات إيجابية: ${up} · سلبية: ${down} · محايدة: ${6 - up - down}`,
        score,
        metrics: [
          { label: "إيجابي", value: String(up), tone: "positive" },
          { label: "محايد", value: String(6 - up - down), tone: "neutral" },
          { label: "سلبي", value: String(down), tone: "negative" },
        ],
        details: ["التصويت يجمع محركات مختلفة الطبيعة لتقليل الاعتماد على مؤشر واحد. التوافق العالي (5 أو 6) أقوى من الأغلبية البسيطة."],
        table: {
          columns: ["المحرك", "الصوت"],
          rows: engines.map((e) => ({ cells: [e.name, e.vote > 0 ? "إيجابي" : e.vote < 0 ? "سلبي" : "محايد"], tone: e.vote > 0 ? "positive" : e.vote < 0 ? "negative" : "neutral" })),
        },
      };
    },
  },
  {
    id: "trend-compass",
    nameAr: "بوصلة الاتجاه",
    nameEn: "Trend Compass",
    descriptionAr: "تحديد الاتجاه من 5 مؤشرات",
    category: "trend",
    usesTimeframe: true,
    run(ctx) {
      const cs = ctx.candles;
      if (cs.length < MIN_CANDLES) return unavailable(this.id, "بيانات غير كافية");
      const closes = cs.map((c) => c.close);
      const price = closes[closes.length - 1];
      const e20 = last(ema(closes, 20));
      const e50 = last(ema(closes, 50));
      const e200 = last(ema(closes, 200));
      const m = macd(closes);
      const ad = adx(cs);
      const r = last(rsi(closes));
      const checks = [
        { name: "EMA 20 فوق EMA 50", ok: e20 !== null && e50 !== null ? e20 > e50 : null },
        { name: "السعر فوق EMA 200", ok: e200 !== null ? price > e200 : null },
        { name: "MACD فوق خط الإشارة", ok: last(m.macd) !== null && last(m.signal) !== null ? last(m.macd)! > last(m.signal)! : null },
        { name: "+DI أعلى من ‎-DI", ok: last(ad.plusDI) !== null ? last(ad.plusDI)! > last(ad.minusDI)! : null },
        { name: "RSI فوق 50", ok: r !== null ? r > 50 : null },
      ];
      const valid = checks.filter((c) => c.ok !== null);
      const pos = valid.filter((c) => c.ok).length;
      const score = valid.length ? (2 * pos - valid.length) / valid.length : 0;
      const strength = last(ad.adx);
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score, 0.3),
        headline: score > 0.3 ? "البوصلة تشير للصعود" : score < -0.3 ? "البوصلة تشير للهبوط" : "اتجاه غير محسوم",
        score,
        metrics: [
          { label: "توافق صاعد", value: `${pos}/${valid.length}`, tone: toneOf(score) },
          { label: "قوة الاتجاه ADX", value: num(strength, 1), tone: strength !== null && strength >= 25 ? "info" : "neutral" },
        ],
        details: [strength !== null && strength < 20 ? "ADX دون 20: الاتجاه ضعيف، والإشارات الاتجاهية أقل موثوقية." : "ADX يدل على وجود اتجاه يمكن الاعتماد عليه نسبيًا."],
        table: { columns: ["الشرط", "النتيجة"], rows: checks.map((c) => ({ cells: [c.name, c.ok === null ? "غير متاح" : c.ok ? "✓ نعم" : "✗ لا"], tone: c.ok === null ? "neutral" : c.ok ? "positive" : "negative" })) },
      };
    },
  },
  {
    id: "mtf-confluence",
    nameAr: "التقاء الفريمات (4×4)",
    nameEn: "MTF Confluence",
    descriptionAr: "توافق الاتجاه والزخم عبر الأطر الزمنية الخمسة",
    category: "consensus",
    usesTimeframe: false,
    run(ctx) {
      const rows: { tf: string; score: number; trend: string; rsiV: number | null; macdUp: boolean | null }[] = [];
      for (const tf of TIMEFRAMES) {
        const cs = ctx.byTf[tf];
        if (!cs || cs.length < MIN_CANDLES) continue;
        const closes = cs.map((c) => c.close);
        const price = closes[closes.length - 1];
        const e20 = last(ema(closes, 20));
        const e50 = last(ema(closes, 50));
        const trend = e20 !== null && e50 !== null ? (price > e50 && e20 > e50 ? 1 : price < e50 && e20 < e50 ? -1 : 0) : 0;
        const r = last(rsi(closes));
        const m = macd(closes);
        const mu = last(m.histogram);
        const s = (trend + (r !== null ? (r > 55 ? 1 : r < 45 ? -1 : 0) : 0) + (mu !== null ? Math.sign(mu) : 0)) / 3;
        rows.push({ tf: TIMEFRAME_LABELS[tf], score: s, trend: trend > 0 ? "صاعد" : trend < 0 ? "هابط" : "عرضي", rsiV: r, macdUp: mu === null ? null : mu > 0 });
      }
      if (rows.length < 2) return unavailable(this.id, "لا تتوفر بيانات كافية لعدة أطر");
      const score = rows.reduce((s, r) => s + r.score, 0) / rows.length;
      const aligned = rows.filter((r) => Math.sign(r.score) === Math.sign(score) && r.score !== 0).length;
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score, 0.25),
        headline: `أطر متوافقة مع الاتجاه العام: ${aligned} من ${rows.length}`,
        score,
        metrics: [{ label: "درجة التوافق", value: `${Math.round(((score + 1) / 2) * 100)}/100`, tone: toneOf(score) }],
        details: ["التوافق بين الأطر الصغيرة والكبيرة يزيد موثوقية الحركة؛ التعارض يعني غالبًا تصحيحًا داخل اتجاه أكبر."],
        table: {
          columns: ["الإطار", "الاتجاه", "RSI", "MACD"],
          rows: rows.map((r) => ({ cells: [r.tf, r.trend, num(r.rsiV, 1), r.macdUp === null ? "—" : r.macdUp ? "إيجابي" : "سلبي"], tone: toneOf(r.score) })),
        },
      };
    },
  },
];
