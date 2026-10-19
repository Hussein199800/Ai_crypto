import { ema, last } from "@/lib/indicators";
import { ichimoku, linearRegression, tdSequential, williamsFractals } from "@/lib/indicators/extra";
import { analyzeStructure } from "../analyzers/structure";
import { MIN_CANDLES, num, pctAbs, pctText, px, toneOf } from "../helpers";
import { unavailable, verdictOf, type ToolDefinition } from "../types";

export const trendTools: ToolDefinition[] = [
  {
    id: "market-structure",
    nameAr: "هيكل السوق (MS)",
    nameEn: "Market Structure",
    descriptionAr: "تتبع HH/HL ورصد الكسور BOS / CHOCH",
    category: "trend",
    usesTimeframe: true,
    run(ctx) {
      if (ctx.candles.length < MIN_CANDLES) return unavailable(this.id, "بيانات غير كافية");
      const ms = analyzeStructure(ctx.candles);
      const ev = ms.lastEvent;
      const score = ms.trend === "UP" ? (ev?.type === "CHOCH" ? 0.5 : 0.7) : ms.trend === "DOWN" ? (ev?.type === "CHOCH" ? -0.5 : -0.7) : 0;
      const labels = ms.swings.filter((s) => s.label).slice(-4).map((s) => s.label).join(" ← ");
      const barsAgo = ev ? ctx.candles.length - 1 - ev.index : null;
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score),
        headline: ev
          ? `آخر حدث: ${ev.type === "BOS" ? "كسر هيكل BOS" : "تغير الطابع CHOCH"} ${ev.direction === "UP" ? "صاعد" : "هابط"} قبل ${barsAgo} شمعة`
          : "لم يُرصد كسر هيكلي بعد",
        score,
        metrics: [
          { label: "الترند الهيكلي", value: ms.trend === "UP" ? "صاعد" : ms.trend === "DOWN" ? "هابط" : "غير محدد", tone: toneOf(score) },
          { label: "آخر القمم/القيعان", value: labels || "—" },
        ],
        details: [
          "BOS: إغلاق يكسر آخر قمة/قاع في اتجاه الترند (استمرار). CHOCH: كسر عكس الترند الحالي — أول علامة على احتمال تغير الاتجاه وتحتاج تأكيدًا.",
          "الكسور محسوبة بالإغلاق وليس بالذيل، وعلى نقاط ارتكاز مؤكدة فقط.",
        ],
        levels: [
          ...(ms.lastSwingHigh !== null ? [{ label: "آخر قمة هيكلية", price: ms.lastSwingHigh, tone: "negative" as const }] : []),
          ...(ms.lastSwingLow !== null ? [{ label: "آخر قاع هيكلي", price: ms.lastSwingLow, tone: "positive" as const }] : []),
          ...(ev ? [{ label: `مستوى ${ev.type}`, price: ev.level, tone: "info" as const }] : []),
        ],
        table: {
          columns: ["الحدث", "الاتجاه", "المستوى", "منذ"],
          rows: ms.events.slice(-5).reverse().map((e) => ({ cells: [e.type, e.direction === "UP" ? "صاعد" : "هابط", px(ctx, e.level), `${ctx.candles.length - 1 - e.index} شمعة`], tone: e.direction === "UP" ? "positive" : "negative" })),
        },
      };
    },
  },
  {
    id: "ichimoku",
    nameAr: "إيشيموكو (Triple Lens)",
    nameEn: "Ichimoku Kinko Hyo",
    descriptionAr: "السحابة وتقاطع تنكان/كيجون والسحابة المستقبلية",
    category: "trend",
    usesTimeframe: true,
    run(ctx) {
      const cs = ctx.candles;
      if (cs.length < 80) return unavailable(this.id, "يتطلب 80 شمعة على الأقل");
      const ich = ichimoku(cs);
      const price = cs[cs.length - 1].close;
      const t = last(ich.tenkan)!;
      const k = last(ich.kijun)!;
      const a = last(ich.spanA);
      const b = last(ich.spanB);
      const cloudTop = a !== null && b !== null ? Math.max(a, b) : null;
      const cloudBot = a !== null && b !== null ? Math.min(a, b) : null;
      const pos = cloudTop === null ? 0 : price > cloudTop ? 1 : price < cloudBot! ? -1 : 0;
      const tk = t > k ? 1 : t < k ? -1 : 0;
      const future = ich.futureSpanA !== null && ich.futureSpanB !== null ? Math.sign(ich.futureSpanA - ich.futureSpanB) : 0;
      const chikou = cs.length > 26 ? Math.sign(price - cs[cs.length - 27].close) : 0;
      const score = (pos * 2 + tk + future + chikou) / 5;
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score),
        headline: pos > 0 ? "السعر فوق السحابة" : pos < 0 ? "السعر تحت السحابة" : "السعر داخل السحابة (منطقة حياد)",
        score,
        metrics: [
          { label: "تنكان / كيجون", value: tk > 0 ? "تنكان أعلى (إيجابي)" : tk < 0 ? "تنكان أدنى (سلبي)" : "متساويان", tone: tk > 0 ? "positive" : tk < 0 ? "negative" : "neutral" },
          { label: "السحابة المستقبلية", value: future > 0 ? "خضراء" : future < 0 ? "حمراء" : "—", tone: future > 0 ? "positive" : future < 0 ? "negative" : "neutral" },
          { label: "تشيكو سبان", value: chikou > 0 ? "فوق السعر السابق" : chikou < 0 ? "تحت السعر السابق" : "—", tone: chikou > 0 ? "positive" : chikou < 0 ? "negative" : "neutral" },
        ],
        details: ["إعدادات قياسية 9/26/52 مع إزاحة 26. السحابة تعمل كدعم/مقاومة ديناميكية، والسعر داخلها يعني غياب اتجاه واضح."],
        levels: [
          { label: "تنكان سين", price: t },
          { label: "كيجون سين", price: k, tone: "info" },
          ...(cloudTop !== null ? [{ label: "أعلى السحابة", price: cloudTop }, { label: "أسفل السحابة", price: cloudBot! }] : []),
        ],
      };
    },
  },
  {
    id: "ema-ribbon",
    nameAr: "شريط المتوسطات (EMA Ribbon)",
    nameEn: "EMA Ribbon",
    descriptionAr: "شريط 8 متوسطات فيبوناتشي 8 → 233",
    category: "trend",
    usesTimeframe: true,
    run(ctx) {
      const closes = ctx.candles.map((c) => c.close);
      if (closes.length < 240) return unavailable(this.id, "يتطلب 240 شمعة على الأقل");
      const periods = [8, 13, 21, 34, 55, 89, 144, 233];
      const series = periods.map((p) => ema(closes, p));
      const nowV = series.map((s) => last(s)!);
      const prevV = series.map((s) => s[s.length - 6]!);
      let bullPairs = 0;
      for (let i = 0; i < nowV.length - 1; i++) if (nowV[i] > nowV[i + 1]) bullPairs++;
      const pairs = nowV.length - 1;
      const score = (2 * bullPairs - pairs) / pairs;
      const price = closes[closes.length - 1];
      const width = ((Math.max(...nowV) - Math.min(...nowV)) / price) * 100;
      const widthPrev = ((Math.max(...prevV) - Math.min(...prevV)) / closes[closes.length - 6]) * 100;
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score, 0.4),
        headline: bullPairs === pairs ? "الشريط مرتب صعوديًا بالكامل" : bullPairs === 0 ? "الشريط مرتب هبوطيًا بالكامل" : `ترتيب مختلط (${bullPairs}/${pairs} صعودي)`,
        score,
        metrics: [
          { label: "عرض الشريط", value: pctAbs(width), tone: "info" },
          { label: "الاتساع", value: width > widthPrev ? "يتسع (الاتجاه يتقوى)" : "يضيق (الاتجاه يضعف)", tone: width > widthPrev ? "positive" : "warning" },
        ],
        details: ["الترتيب الكامل للمتوسطات من الأقصر إلى الأطول يدل على اتجاه ناضج، والتشابك يدل على تذبذب أو بداية انعكاس."],
        table: { columns: ["المتوسط", "القيمة"], rows: periods.map((p, i) => ({ cells: [`EMA ${p}`, px(ctx, nowV[i])], tone: price > nowV[i] ? "positive" : "negative" })) },
      };
    },
  },
  {
    id: "linear-regression",
    nameAr: "الانحدار الخطي (القيمة العادلة)",
    nameEn: "Linear Regression 100D",
    descriptionAr: "القيمة العادلة لـ 100 يوم وقناة ±2σ",
    category: "trend",
    usesTimeframe: false,
    run(ctx) {
      const daily = ctx.byTf["1d"];
      if (!daily || daily.length < 100) return unavailable(this.id, "يتطلب 100 شمعة يومية");
      const closes = daily.slice(-100).map((c) => c.close);
      const reg = linearRegression(closes)!;
      const price = ctx.price ?? closes[closes.length - 1];
      const z = reg.stdDev > 0 ? (price - reg.fair) / reg.stdDev : 0;
      const slopePctDay = (reg.slope / reg.fair) * 100;
      const score = Math.max(-1, Math.min(1, -z / 2.5)) * 0.5 + Math.sign(slopePctDay) * 0.3;
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score),
        headline: Math.abs(z) < 1 ? "السعر قريب من القيمة العادلة" : z > 0 ? `السعر أعلى من القيمة العادلة بـ ${num(z, 1)}σ` : `السعر أدنى من القيمة العادلة بـ ${num(Math.abs(z), 1)}σ`,
        score,
        metrics: [
          { label: "القيمة العادلة", value: px(ctx, reg.fair), tone: "info" },
          { label: "الانحراف (z)", value: num(z, 2), tone: Math.abs(z) > 2 ? "warning" : "neutral" },
          { label: "الميل اليومي", value: pctText(slopePctDay, 3), tone: slopePctDay > 0 ? "positive" : "negative" },
          { label: "R²", value: num(reg.r2, 2) },
        ],
        details: ["الابتعاد أكثر من 2σ عن خط الانحدار نادر إحصائيًا ويشير إلى امتداد قد يتبعه رجوع للمتوسط، لكنه ليس توقيتًا للانعكاس. R² منخفض يعني أن الخط لا يصف الحركة جيدًا."],
        levels: [
          { label: "+2σ", price: reg.fair + 2 * reg.stdDev, tone: "negative" },
          { label: "القيمة العادلة", price: reg.fair, tone: "info" },
          { label: "-2σ", price: reg.fair - 2 * reg.stdDev, tone: "positive" },
        ],
        timeframe: "1d",
      };
    },
  },
  {
    id: "fractals",
    nameAr: "كاشف الفراكتلات",
    nameEn: "Fractal Detector",
    descriptionAr: "نقاط الانعكاس الرياضية (Williams)",
    category: "trend",
    usesTimeframe: true,
    run(ctx) {
      const cs = ctx.candles;
      if (cs.length < 30) return unavailable(this.id, "بيانات غير كافية");
      const f = williamsFractals(cs);
      const up = f.up[f.up.length - 1];
      const down = f.down[f.down.length - 1];
      const price = cs[cs.length - 1].close;
      const brokeUp = up && price > up.price;
      const brokeDown = down && price < down.price;
      const score = brokeUp ? 0.5 : brokeDown ? -0.5 : 0;
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score),
        headline: brokeUp ? "السعر اخترق آخر فراكتل علوي" : brokeDown ? "السعر كسر آخر فراكتل سفلي" : "السعر بين آخر فراكتلين",
        score,
        metrics: [
          { label: "فراكتلات علوية", value: String(f.up.length) },
          { label: "فراكتلات سفلية", value: String(f.down.length) },
        ],
        details: ["الفراكتل العلوي قمة محلية أعلى من شمعتين على كل جانب، ويُستخدم كمقاومة قريبة؛ والسفلي كدعم قريب."],
        levels: [
          ...(up ? [{ label: "آخر فراكتل علوي", price: up.price, tone: "negative" as const }] : []),
          ...(down ? [{ label: "آخر فراكتل سفلي", price: down.price, tone: "positive" as const }] : []),
        ],
      };
    },
  },
  {
    id: "demark",
    nameAr: "مؤشر DeMark (TD Sequential)",
    nameEn: "TD Sequential",
    descriptionAr: "قياس الاستنفاد السعري والانعكاس (9 / 13)",
    category: "momentum",
    usesTimeframe: true,
    run(ctx) {
      const cs = ctx.candles;
      if (cs.length < 40) return unavailable(this.id, "بيانات غير كافية");
      const td = tdSequential(cs);
      const recent = td.lastCompleted && td.lastCompleted.barsAgo <= 3;
      let score = 0;
      if (recent) score = td.lastCompleted!.type === "BUY" ? 0.4 : -0.4;
      if (td.countdown >= 13) score = td.lastCompleted!.type === "BUY" ? 0.6 : -0.6;
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score),
        headline: td.countdown >= 13
          ? `اكتمل العد التنازلي 13 (${td.lastCompleted!.type === "BUY" ? "استنفاد بيعي محتمل" : "استنفاد شرائي محتمل"})`
          : recent
            ? `اكتمل إعداد 9 ${td.lastCompleted!.type === "BUY" ? "شرائي (بعد هبوط)" : "بيعي (بعد صعود)"} قبل ${td.lastCompleted!.barsAgo} شمعة`
            : `العد الحالي: شراء ${td.buySetup} / بيع ${td.sellSetup}`,
        score,
        metrics: [
          { label: "إعداد شراء", value: `${td.buySetup}/9`, tone: td.buySetup >= 7 ? "warning" : "neutral" },
          { label: "إعداد بيع", value: `${td.sellSetup}/9`, tone: td.sellSetup >= 7 ? "warning" : "neutral" },
          { label: "العد التنازلي", value: td.lastCompleted ? `${td.countdown}/13` : "—" },
        ],
        details: ["إعداد 9 يعني 9 إغلاقات متتالية مقارنة بإغلاق ما قبل 4 شموع، وهو مؤشر إنهاك محتمل للحركة وليس إشارة انعكاس مؤكدة؛ اكتمال 13 أقوى.", "النسخة مبسطة (دون شروط الكمال perfection)."],
      };
    },
  },
];
