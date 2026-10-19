import { atr, bollinger, last, macd, obv, rsi, sma } from "@/lib/indicators";
import { choppiness, keltner, linearRegression, mfi } from "@/lib/indicators/extra";
import { TIMEFRAME_LABELS, TIMEFRAME_MS } from "@/lib/timeframes";
import type { Timeframe } from "@/types/market";
import { candleAnatomy } from "../analyzers/candle";
import { genericDivergence } from "../analyzers/divergence";
import { analyzeStructure } from "../analyzers/structure";
import { MIN_CANDLES, num, pctText } from "../helpers";
import { unavailable, verdictOf, type ToolDefinition } from "../types";

const DIV_AR = { BULLISH: "انفراج إيجابي", BEARISH: "انفراج سلبي", HIDDEN_BULLISH: "انفراج مخفي إيجابي (استمرار صعود)", HIDDEN_BEARISH: "انفراج مخفي سلبي (استمرار هبوط)" } as const;

export const momentumTools: ToolDefinition[] = [
  {
    id: "mfi-mtf",
    nameAr: "تدفق المال MFI (متعدد الأطر)",
    nameEn: "MFI MTF",
    descriptionAr: "تدفق المال والدايفرجنس (1H / 4H / 1D)",
    category: "volume",
    usesTimeframe: false,
    run(ctx) {
      const tfs: Timeframe[] = ["1h", "4h", "1d"];
      const rows = tfs.flatMap((tf) => {
        const cs = ctx.byTf[tf];
        if (!cs || cs.length < MIN_CANDLES || cs.every((c) => c.volume <= 0)) return [];
        const series = mfi(cs, 14);
        return [{ tf, value: last(series), div: genericDivergence(cs, series) }];
      });
      if (rows.length === 0) return unavailable(this.id, "لا تتوفر بيانات حجم لهذا الأصل");
      const score = rows.reduce((s, r) => s + (r.value === null ? 0 : r.value > 80 ? -0.4 : r.value < 20 ? 0.4 : (r.value - 50) / 75), 0) / rows.length +
        rows.reduce((s, r) => s + (r.div ? (r.div.type.includes("BULLISH") ? 0.2 : -0.2) : 0), 0);
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score),
        headline: rows.map((r) => `${TIMEFRAME_LABELS[r.tf]}: ${num(r.value, 0)}`).join(" · "),
        score: Math.max(-1, Math.min(1, score)),
        metrics: rows.map((r) => ({ label: `MFI ${TIMEFRAME_LABELS[r.tf]}`, value: num(r.value, 1), tone: r.value !== null && r.value > 80 ? "warning" : r.value !== null && r.value < 20 ? "info" : "neutral" })),
        details: ["MFI هو RSI مرجّح بالحجم: فوق 80 تشبع شرائي بالسيولة، وتحت 20 تشبع بيعي — تحذيرات وليست إشارات مباشرة.", ...rows.filter((r) => r.div).map((r) => `${TIMEFRAME_LABELS[r.tf]}: ${DIV_AR[r.div!.type]} قبل ${r.div!.barsAgo} شمعة`)],
      };
    },
  },
  {
    id: "chop",
    nameAr: "مؤشر التذبذب CHOP",
    nameEn: "Choppiness Index",
    descriptionAr: "قياس التذبذب مقابل قوة الاتجاه",
    category: "momentum",
    usesTimeframe: true,
    run(ctx) {
      const cs = ctx.candles;
      if (cs.length < 30) return unavailable(this.id, "بيانات غير كافية");
      const v = last(choppiness(cs, 14))!;
      return {
        id: this.id,
        status: "ok",
        verdict: "info",
        headline: v > 61.8 ? "سوق متذبذب — تجنب استراتيجيات الاتجاه" : v < 38.2 ? "سوق في اتجاه واضح" : "حالة انتقالية",
        score: null,
        metrics: [{ label: "CHOP (14)", value: num(v, 1), tone: v > 61.8 ? "warning" : v < 38.2 ? "info" : "neutral" }],
        details: ["فوق 61.8: تذبذب جانبي (إشارات الاتجاه أقل موثوقية). تحت 38.2: اتجاه قوي قد يقترب من الإنهاك. المؤشر لا يحدد الاتجاه بل طبيعة الحركة."],
      };
    },
  },
  {
    id: "divergence-scanner",
    nameAr: "ماسح الدايفرجنس",
    nameEn: "Divergence Scanner",
    descriptionAr: "رصد التباين بين السعر و RSI · MACD · OBV · MFI",
    category: "momentum",
    usesTimeframe: true,
    run(ctx) {
      const cs = ctx.candles;
      if (cs.length < MIN_CANDLES) return unavailable(this.id, "بيانات غير كافية");
      const closes = cs.map((c) => c.close);
      const hasVol = cs.some((c) => c.volume > 0);
      const checks = [
        { name: "RSI", hit: genericDivergence(cs, rsi(closes)) },
        { name: "MACD Histogram", hit: genericDivergence(cs, macd(closes).histogram) },
        ...(hasVol ? [{ name: "OBV", hit: genericDivergence(cs, obv(cs)) }, { name: "MFI", hit: genericDivergence(cs, mfi(cs)) }] : []),
      ];
      const hits = checks.filter((c) => c.hit && c.hit.barsAgo <= 15);
      const score = hits.reduce((s, c) => s + (c.hit!.type.includes("BULLISH") ? 0.3 : -0.3), 0);
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score),
        headline: hits.length ? `انفراجات حديثة: ${hits.length} (${hits.map((h) => h.name).join("، ")})` : "لا يوجد انفراج حديث",
        score: Math.max(-1, Math.min(1, score)),
        metrics: [{ label: "مؤشرات مفحوصة", value: String(checks.length) }],
        details: ["الانفراج العادي إشارة انعكاس محتملة، والمخفي إشارة استمرار. توافق عدة مؤشرات على نفس الانفراج يرفع أهميته."],
        table: {
          columns: ["المؤشر", "النتيجة"],
          rows: checks.map((c) => ({ cells: [c.name, c.hit ? `${DIV_AR[c.hit.type]} (قبل ${c.hit.barsAgo} شمعة)` : "لا يوجد"], tone: c.hit ? (c.hit.type.includes("BULLISH") ? "positive" : "negative") : "neutral" })),
        },
      };
    },
  },
  {
    id: "candle-analysis",
    nameAr: "تحليل الشمعة الحالية",
    nameEn: "Current Candle",
    descriptionAr: "تفسير لحظي لأبعاد الشمعة وأنماطها",
    category: "patterns",
    usesTimeframe: true,
    run(ctx) {
      const cs = ctx.candles;
      if (cs.length < 20) return unavailable(this.id, "بيانات غير كافية");
      const c = ctx.forming ?? cs[cs.length - 1];
      const prev = ctx.forming ? cs[cs.length - 1] : cs[cs.length - 2];
      const a = last(atr(cs, 14));
      const st = analyzeStructure(cs.slice(-60)).trend;
      const priorTrend = st === "UP" ? "UP" : st === "DOWN" ? "DOWN" : "SIDEWAYS";
      const an = candleAnatomy(c, prev, a, priorTrend);
      const score = an.patterns.reduce((s, p) => s + (p.bias === "bullish" ? 0.3 : p.bias === "bearish" ? -0.3 : 0), 0);
      const remaining = ctx.forming ? Math.max(0, ctx.forming.time + TIMEFRAME_MS[ctx.timeframe] - ctx.now) : null;
      const volAvg = sma(cs.map((x) => x.volume), 20);
      const elapsed = ctx.forming ? (ctx.now - ctx.forming.time) / TIMEFRAME_MS[ctx.timeframe] : 1;
      const volPace = last(volAvg) && elapsed > 0.05 ? c.volume / elapsed / last(volAvg)! : null;
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score),
        headline: an.patterns[0]?.nameAr ?? (an.direction === "UP" ? "شمعة صاعدة دون نمط مميز" : an.direction === "DOWN" ? "شمعة هابطة دون نمط مميز" : "شمعة محايدة"),
        score: Math.max(-1, Math.min(1, score)),
        metrics: [
          { label: "الجسم", value: pctText(an.bodyPct, 0) },
          { label: "الذيل العلوي", value: pctText(an.upperWickPct, 0) },
          { label: "الذيل السفلي", value: pctText(an.lowerWickPct, 0) },
          { label: "المدى / ATR", value: an.rangeVsAtr !== null ? `${num(an.rangeVsAtr, 2)}x` : "—", tone: an.rangeVsAtr !== null && an.rangeVsAtr > 1.5 ? "warning" : "neutral" },
          ...(volPace !== null ? [{ label: "وتيرة الحجم", value: `${num(volPace, 2)}x من المتوسط`, tone: volPace > 1.3 ? ("info" as const) : ("neutral" as const) }] : []),
        ],
        details: [
          ctx.forming ? `الشمعة جارية ولم تُغلق بعد${remaining !== null ? ` (متبقٍ ~${Math.ceil(remaining / 60_000)} دقيقة)` : ""} — قد يتغير شكلها بالكامل قبل الإغلاق.` : "آخر شمعة مكتملة.",
          ...an.patterns.slice(1).map((p) => p.nameAr),
        ],
      };
    },
  },
  {
    id: "squeeze",
    nameAr: "مؤشر الانضغاط (Squeeze)",
    nameEn: "Volatility Squeeze (ATR)",
    descriptionAr: "تحليل الانضغاط السعري ومؤشر الانفجار القادم",
    category: "volatility",
    usesTimeframe: true,
    run(ctx) {
      const cs = ctx.candles;
      if (cs.length < MIN_CANDLES) return unavailable(this.id, "بيانات غير كافية");
      const closes = cs.map((c) => c.close);
      const bb = bollinger(closes, 20, 2);
      const kc = keltner(cs, 20, 1.5);
      const on = (i: number) => bb.upper[i] !== null && kc.upper[i] !== null && bb.upper[i]! < kc.upper[i]! && bb.lower[i]! > kc.lower[i]!;
      const n = cs.length - 1;
      let bars = 0;
      for (let i = n; i >= 0 && on(i); i--) bars++;
      const fired = !on(n) && on(n - 1);
      // زخم الانضغاط: انحدار (السعر − متوسط منتصف دونشيان والمتوسط البسيط)
      const mom: number[] = [];
      const s20 = sma(closes, 20);
      for (let i = n - 19; i <= n; i++) {
        const w = cs.slice(i - 19, i + 1);
        const mid = (Math.max(...w.map((c) => c.high)) + Math.min(...w.map((c) => c.low))) / 2;
        mom.push(closes[i] - (mid + (s20[i] ?? closes[i])) / 2);
      }
      const reg = linearRegression(mom);
      const dir = reg ? Math.sign(reg.fair) : 0;
      const atrPct = (last(atr(cs, 14))! / closes[n]) * 100;
      const score = fired ? dir * 0.6 : bars > 0 ? dir * 0.2 : dir * 0.3;
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score),
        headline: fired ? `انطلق الانضغاط باتجاه ${dir > 0 ? "صاعد" : "هابط"}` : bars > 0 ? `انضغاط نشط منذ ${bars} شمعة — احتمال حركة قوية قادمة` : "لا يوجد انضغاط حاليًا",
        score,
        metrics: [
          { label: "الحالة", value: bars > 0 ? "مضغوط" : fired ? "انطلاق" : "طبيعي", tone: bars > 0 ? "warning" : fired ? "info" : "neutral" },
          { label: "اتجاه الزخم", value: dir > 0 ? "صاعد" : dir < 0 ? "هابط" : "مستوٍ", tone: dir > 0 ? "positive" : dir < 0 ? "negative" : "neutral" },
          { label: "ATR %", value: pctText(atrPct) },
        ],
        details: ["الانضغاط = دخول نطاقات بولينجر داخل قناة كيلتنر، أي انخفاض التقلب. بعد الانضغاط تأتي غالبًا حركة قوية، لكن اتجاهها غير مضمون؛ زخم الانضغاط يرجّح الاتجاه فقط."],
      };
    },
  },
];
