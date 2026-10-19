import { arima, dominantCycles, garch11, gaussianHmm, logReturns, monteCarloGBM } from "@/lib/stats";
import { MONTHS_AR, seasonality } from "../analyzers/seasonality";
import { num, pctAbs, pctText, px } from "../helpers";
import { unavailable, verdictOf, type ToolDefinition } from "../types";

const STAT_NOTE = "نموذج إحصائي مبني على البيانات التاريخية فقط — النتائج نطاقات احتمالية وليست توقعًا مؤكدًا، ولا تأخذ الأخبار أو الأحداث المفاجئة بالحسبان.";

export const statisticsTools: ToolDefinition[] = [
  {
    id: "monte-carlo",
    nameAr: "محاكاة مونت كارلو",
    nameEn: "Monte Carlo (GBM)",
    descriptionAr: "2000 مسار سعري محتمل لـ 30 يومًا (حركة براونية هندسية)",
    category: "statistics",
    usesTimeframe: false,
    run(ctx) {
      const daily = ctx.byTf["1d"];
      if (!daily || daily.length < 120) return unavailable(this.id, "يتطلب 120 شمعة يومية على الأقل");
      const closes = daily.slice(-365).map((c) => c.close);
      const mc = monteCarloGBM(closes, 30, 2000, Math.round(closes[closes.length - 1] * 1000) % 100000);
      if (!mc) return unavailable(this.id, "تعذر تشغيل المحاكاة");
      const s0 = closes[closes.length - 1];
      return {
        id: this.id,
        status: "ok",
        verdict: "info",
        headline: `احتمال الإغلاق أعلى من السعر الحالي بعد 30 يومًا: ${num(mc.probAbove * 100, 0)}% (حسب التاريخ)`,
        score: null,
        metrics: [
          { label: "الوسيط (50%)", value: px(ctx, mc.percentiles.p50), tone: "info" },
          { label: "نطاق 50% (25–75)", value: `${px(ctx, mc.percentiles.p25)} – ${px(ctx, mc.percentiles.p75)}` },
          { label: "نطاق 90% (5–95)", value: `${px(ctx, mc.percentiles.p5)} – ${px(ctx, mc.percentiles.p95)}` },
          { label: "التقلب اليومي", value: pctAbs(mc.volatility * 100) },
        ],
        details: [`بارامترات من آخر ${closes.length} يومًا: متوسط العائد اليومي ${pctText(mc.drift * 100, 3)}.`, STAT_NOTE],
        levels: [
          { label: "الحد الأعلى 95%", price: mc.percentiles.p95, tone: "positive" },
          { label: "السعر الحالي", price: s0, tone: "info" },
          { label: "الحد الأدنى 5%", price: mc.percentiles.p5, tone: "negative" },
        ],
        table: {
          columns: ["اليوم", "5%", "الوسيط", "95%"],
          rows: mc.bands.filter((b) => [1, 7, 14, 30].includes(b.day)).map((b) => ({ cells: [String(b.day), px(ctx, b.p5), px(ctx, b.p50), px(ctx, b.p95)] })),
        },
        timeframe: "1d",
      };
    },
  },
  {
    id: "garch",
    nameAr: "تباين GARCH",
    nameEn: "GARCH(1,1) Volatility",
    descriptionAr: "النطاقات الإحصائية للتقلب المتوقع",
    category: "statistics",
    usesTimeframe: false,
    run(ctx) {
      const daily = ctx.byTf["1d"];
      if (!daily || daily.length < 150) return unavailable(this.id, "يتطلب 150 شمعة يومية على الأقل");
      const r = logReturns(daily.map((c) => c.close));
      const g = garch11(r);
      if (!g) return unavailable(this.id, "تعذر تقدير النموذج");
      const price = ctx.price ?? daily[daily.length - 1].close;
      const rising = g.currentVol > g.longRunVol;
      const band = (days: number) => g.forecast.find((f) => f.days === days)!.vol;
      return {
        id: this.id,
        status: "ok",
        verdict: "info",
        headline: rising ? "التقلب الحالي أعلى من متوسطه طويل المدى" : "التقلب الحالي أدنى من متوسطه طويل المدى",
        score: null,
        metrics: [
          { label: "التقلب اليومي الحالي", value: pctAbs(g.currentVol * 100), tone: rising ? "warning" : "neutral" },
          { label: "التقلب طويل المدى", value: pctAbs(g.longRunVol * 100) },
          { label: "الاستمرارية α+β", value: num(g.persistence, 3) },
        ],
        details: [`المعاملات: α=${num(g.alpha, 2)}، β=${num(g.beta, 2)}. استمرارية قريبة من 1 تعني أن صدمات التقلب تدوم طويلًا.`, STAT_NOTE],
        table: {
          columns: ["الأفق", "التقلب المتوقع", "نطاق ±1σ", "نطاق ±2σ"],
          rows: [1, 7, 30].map((d) => {
            const v = band(d);
            return { cells: [`${d} يوم`, pctAbs(v * 100), `${px(ctx, price * Math.exp(-v))} – ${px(ctx, price * Math.exp(v))}`, `${px(ctx, price * Math.exp(-2 * v))} – ${px(ctx, price * Math.exp(2 * v))}`] };
          }),
        },
        timeframe: "1d",
      };
    },
  },
  {
    id: "hmm-regimes",
    nameAr: "نموذج ماركوف (HMM)",
    nameEn: "Hidden Markov Regimes",
    descriptionAr: "تحليل أنظمة السوق الاحتمالية (هبوط / عرضي / صعود)",
    category: "statistics",
    usesTimeframe: false,
    run(ctx) {
      const daily = ctx.byTf["1d"];
      if (!daily || daily.length < 200) return unavailable(this.id, "يتطلب 200 شمعة يومية على الأقل");
      const r = logReturns(daily.map((c) => c.close));
      const hmm = gaussianHmm(r, 3, 50);
      if (!hmm) return unavailable(this.id, "تعذر تقدير النموذج");
      const names = ["نظام هابط", "نظام عرضي", "نظام صاعد"];
      const cur = hmm.current.indexOf(Math.max(...hmm.current));
      const score = hmm.current[2] - hmm.current[0];
      // مدة بقاء الحالة الحالية
      let streak = 0;
      for (let i = hmm.path.length - 1; i >= 0 && hmm.path[i] === cur; i--) streak++;
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score, 0.3),
        headline: `النظام الأرجح حاليًا: ${names[cur]} (${num(hmm.current[cur] * 100, 0)}%) منذ ${streak} يوم`,
        score,
        metrics: hmm.current.map((p, i) => ({ label: names[i], value: pctAbs(p * 100, 0), tone: i === 2 ? "positive" : i === 0 ? "negative" : "neutral" })),
        details: ["نموذج يفترض أن السوق ينتقل بين 3 حالات خفية لكل منها متوسط عائد وتقلب مختلف، ويقدّرها من العوائد اليومية (Baum-Welch).", STAT_NOTE],
        table: {
          columns: ["الحالة", "متوسط العائد اليومي", "التقلب", "احتمال البقاء"],
          rows: hmm.states.map((s, i) => ({ cells: [names[i], pctText(s.mean * 100, 3), pctAbs(s.std * 100), pctAbs(hmm.transition[i][i] * 100, 0)], tone: i === 2 ? "positive" : i === 0 ? "negative" : "neutral" })),
        },
        timeframe: "1d",
      };
    },
  },
  {
    id: "fourier-cycles",
    nameAr: "معادلة Fourier (الدورات)",
    nameEn: "Fourier Cycles (FFT)",
    descriptionAr: "تحليل الدورات الزمنية المهيمنة",
    category: "statistics",
    usesTimeframe: true,
    run(ctx) {
      const cs = ctx.candles.slice(-256);
      if (cs.length < 64) return unavailable(this.id, "يتطلب 64 شمعة على الأقل");
      const cycles = dominantCycles(cs.map((c) => Math.log(c.close)), 3, 6);
      if (cycles.length === 0) return unavailable(this.id, "لم تُرصد دورات واضحة");
      const main = cycles[0];
      const score = (main.phase === "RISING" ? 1 : -1) * Math.min(0.5, main.power * 2);
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score),
        headline: `الدورة المهيمنة ~${num(main.period, 0)} شمعة وهي في مرحلة ${main.phase === "RISING" ? "صعود" : "هبوط"}`,
        score,
        metrics: [
          { label: "طول الدورة", value: `${num(main.period, 0)} شمعة` },
          { label: "حصة الطيف", value: pctAbs(main.power * 100, 0), tone: main.power > 0.2 ? "info" : "neutral" },
          { label: "التحول التالي تقريبًا", value: `بعد ~${main.barsToTurn} شمعة` },
        ],
        details: ["تحويل فورييه على لوغاريتم السعر بعد إزالة الاتجاه الخطي. الدورات في الأسواق غير ثابتة وقد تتغير أطوالها، وحصة طيف منخفضة تعني دورة ضعيفة.", STAT_NOTE],
        table: { columns: ["الدورة (شمعة)", "حصة الطيف", "المرحلة", "التحول بعد"], rows: cycles.map((c) => ({ cells: [num(c.period, 1), pctAbs(c.power * 100, 0), c.phase === "RISING" ? "صعود" : "هبوط", `${c.barsToTurn} شمعة`], tone: c.phase === "RISING" ? "positive" : "negative" })) },
      };
    },
  },
  {
    id: "arima",
    nameAr: "السلاسل الزمنية (ARIMA)",
    nameEn: "ARIMA(5,1,0)",
    descriptionAr: "نمذجة إحصائية للمسار القريب مع نطاقات الثقة",
    category: "statistics",
    usesTimeframe: false,
    run(ctx) {
      const daily = ctx.byTf["1d"];
      if (!daily || daily.length < 120) return unavailable(this.id, "يتطلب 120 شمعة يومية على الأقل");
      const closes = daily.slice(-365).map((c) => c.close);
      const m = arima(closes, 5, 7);
      if (!m) return unavailable(this.id, "تعذر تقدير النموذج");
      const last = closes[closes.length - 1];
      const f7 = m.forecast[m.forecast.length - 1];
      const drift = ((f7.mean - last) / last) * 100;
      return {
        id: this.id,
        status: "ok",
        verdict: "info",
        headline: `المسار الإحصائي لـ 7 أيام: ${pctText(drift)} (نطاق 80%: ${px(ctx, f7.lo80)} – ${px(ctx, f7.hi80)})`,
        score: null,
        metrics: [
          { label: "القيمة المتوقعة بعد 7 أيام", value: px(ctx, f7.mean), tone: "info" },
          { label: "نطاق 95%", value: `${px(ctx, f7.lo95)} – ${px(ctx, f7.hi95)}` },
        ],
        details: ["نموذج انحدار ذاتي من الرتبة 5 على العوائد اليومية (مقدّر بالمربعات الصغرى). اتساع نطاق الثقة مقارنة بالتغير المتوقع يعني أن القوة التنبؤية ضعيفة — وهو المعتاد في الأسواق.", STAT_NOTE],
        table: { columns: ["اليوم", "المتوقع", "نطاق 80%", "نطاق 95%"], rows: m.forecast.map((f) => ({ cells: [String(f.step), px(ctx, f.mean), `${px(ctx, f.lo80)} – ${px(ctx, f.hi80)}`, `${px(ctx, f.lo95)} – ${px(ctx, f.hi95)}`] })) },
        timeframe: "1d",
      };
    },
  },
  {
    id: "seasonality",
    nameAr: "الأداء الموسمي (Matrix Q)",
    nameEn: "Seasonality",
    descriptionAr: "الأداء الشهري والربع سنوي التاريخي",
    category: "statistics",
    usesTimeframe: false,
    run(ctx) {
      const weekly = ctx.byTf["1w"];
      const src = weekly && weekly.length >= 60 ? weekly : ctx.byTf["1d"];
      if (!src || src.length < 60) return unavailable(this.id, "لا يتوفر تاريخ كافٍ");
      const s = seasonality(src);
      if (!s || s.years.length < 2) return unavailable(this.id, "لا يتوفر تاريخ كافٍ (سنتان على الأقل)");
      const month = new Date(ctx.now).getUTCMonth();
      const cur = s.monthStats[month];
      const quarter = Math.floor(month / 3);
      const q = s.quarterStats[quarter];
      const score = cur.avg === null || cur.samples < 3 ? 0 : Math.max(-0.4, Math.min(0.4, ((cur.winRate ?? 50) - 50) / 100));
      return {
        id: this.id,
        status: "ok",
        verdict: cur.samples >= 3 ? verdictOf(score) : "info",
        headline: cur.avg !== null ? `${MONTHS_AR[month]} تاريخيًا: متوسط ${pctText(cur.avg)} ونسبة إغلاق إيجابي ${num(cur.winRate, 0)}% (${cur.samples} سنوات)` : "لا تتوفر بيانات للشهر الحالي",
        score: cur.samples >= 3 ? score : null,
        metrics: [
          { label: `الربع ${q.quarter} (متوسط)`, value: pctText(q.avg), tone: (q.avg ?? 0) > 0 ? "positive" : "negative" },
          { label: "السنوات المتاحة", value: `${s.years[0]}–${s.years[s.years.length - 1]}` },
        ],
        details: ["الأداء الموسمي وصف لما حدث تاريخيًا، وعدد السنوات قليل في العملات الرقمية، لذلك لا يصلح وحده للتوقع.", "مبني على الشموع الأسبوعية (إغلاق آخر أسبوع في الشهر)."],
        table: {
          columns: ["الشهر", "المتوسط", "نسبة الإيجابي", "العينات"],
          rows: s.monthStats.map((m) => ({ cells: [MONTHS_AR[m.month], pctText(m.avg), m.winRate === null ? "—" : `${num(m.winRate, 0)}%`, String(m.samples)], tone: m.avg === null ? "neutral" : m.avg > 0 ? "positive" : "negative" })),
        },
        timeframe: weekly && weekly.length >= 60 ? "1w" : "1d",
      };
    },
  },
];
