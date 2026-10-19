import { bidi, formatCompact } from "@/lib/formatters";
import { analyzeOrderBook } from "../analyzers/orderbook";
import { volumeDelta, volumeProfile } from "../analyzers/volume";
import { MIN_CANDLES, num, pctAbs, pctText, px } from "../helpers";
import { unavailable, verdictOf, type ToolDefinition } from "../types";

export const volumeTools: ToolDefinition[] = [
  {
    id: "volume-profile",
    nameAr: "ملف الحجم (VP)",
    nameEn: "Volume Profile",
    descriptionAr: "نقطة التحكم POC ومنطقة القيمة VAH / VAL",
    category: "volume",
    usesTimeframe: true,
    run(ctx) {
      const cs = ctx.candles.slice(-200);
      if (cs.length < MIN_CANDLES || cs.every((c) => c.volume <= 0)) return unavailable(this.id, "لا تتوفر بيانات حجم كافية");
      const vp = volumeProfile(cs);
      if (!vp) return unavailable(this.id, "تعذر حساب ملف الحجم");
      const price = ctx.price ?? cs[cs.length - 1].close;
      const pos = price > vp.vah ? 1 : price < vp.val ? -1 : 0;
      const top = [...vp.bins].sort((a, b) => b.volume - a.volume).slice(0, 3);
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(pos * 0.4),
        headline: pos > 0 ? "السعر فوق منطقة القيمة (قبول سعري أعلى)" : pos < 0 ? "السعر تحت منطقة القيمة (ضعف)" : "السعر داخل منطقة القيمة",
        score: pos * 0.4,
        metrics: [
          { label: "POC", value: px(ctx, vp.poc), tone: "info" },
          { label: "VAH", value: px(ctx, vp.vah) },
          { label: "VAL", value: px(ctx, vp.val) },
        ],
        details: [
          "تقريب من الشموع: يوزَّع حجم كل شمعة بالتساوي على مداها السعري (آخر 200 شمعة). POC هو السعر الأكثر تداولًا، ومنطقة القيمة تضم 70% من الحجم.",
          "المستويات ذات الحجم المرتفع تعمل غالبًا كدعم/مقاومة، والفجوات منخفضة الحجم يعبرها السعر بسرعة.",
        ],
        levels: [
          { label: "أعلى منطقة القيمة VAH", price: vp.vah, tone: "negative" },
          { label: "نقطة التحكم POC", price: vp.poc, tone: "info" },
          { label: "أسفل منطقة القيمة VAL", price: vp.val, tone: "positive" },
          ...top.slice(1).map((b, i) => ({ label: `عقدة حجم مرتفع ${i + 1}`, price: (b.low + b.high) / 2 })),
        ],
      };
    },
  },
  {
    id: "volume-delta",
    nameAr: "دلتا الحجم و CVD",
    nameEn: "Volume Delta (VDA)",
    descriptionAr: "تحليل تراكمي لتدفق أوامر الشراء والبيع المبادِرة",
    category: "volume",
    usesTimeframe: true,
    run(ctx) {
      const d = volumeDelta(ctx.candles);
      if (!d) return unavailable(this.id, "لا تتوفر بيانات حجم كافية");
      const score = Math.max(-1, Math.min(1, (d.buyShare20 - 50) / 15)) * 0.6 + (d.divergence === "BULLISH" ? 0.3 : d.divergence === "BEARISH" ? -0.3 : 0);
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score),
        headline: d.divergence !== "NONE"
          ? d.divergence === "BEARISH" ? "انفراج سلبي: السعر يرتفع وCVD ينخفض" : "انفراج إيجابي: السعر ينخفض وCVD يرتفع"
          : `حصة الشراء المبادر ${num(d.buyShare20, 0)}% (آخر 20 شمعة)`,
        score: Math.max(-1, Math.min(1, score)),
        metrics: [
          { label: "دلتا آخر شمعة", value: formatCompact(d.lastDelta, { currency: false }), tone: d.lastDelta > 0 ? "positive" : "negative" },
          { label: "دلتا 20 شمعة", value: formatCompact(d.sum20, { currency: false }), tone: d.sum20 > 0 ? "positive" : "negative" },
          { label: "تغير السعر 20 شمعة", value: pctText(d.priceChange20) },
        ],
        details: [
          d.exact ? "محسوبة من حجم الشراء المبادر (Taker Buy) الفعلي من Binance." : "تقديرية: لا يتوفر حجم الشراء المبادر لهذا المصدر، فقُدّرت من موقع الإغلاق داخل الشمعة.",
          "CVD (الدلتا التراكمية) الصاعد يعني أن المشترين المبادرين يسيطرون؛ تعارضه مع اتجاه السعر تحذير مبكر.",
        ],
      };
    },
  },
  {
    id: "order-book",
    nameAr: "دفتر الأوامر (جدران السيولة)",
    nameEn: "Order Book",
    descriptionAr: "عمق العروض والطلبات BIDS vs ASKS وأكبر الجدران",
    category: "volume",
    usesTimeframe: false,
    run(ctx) {
      if (!ctx.orderBook) return unavailable(this.id, "دفتر الأوامر غير متاح لهذا الأصل أو تعذر جلبه");
      const ob = analyzeOrderBook(ctx.orderBook);
      if (!ob) return unavailable(this.id, "دفتر الأوامر فارغ");
      const d2 = ob.depth.find((d) => d.pct === 2)!;
      const score = Math.max(-1, Math.min(1, d2.imbalance * 1.5)) * 0.5;
      return {
        id: this.id,
        status: "ok",
        verdict: verdictOf(score),
        headline: d2.imbalance > 0.15 ? "الطلبات (BIDS) أعمق — ضغط شرائي في الدفتر" : d2.imbalance < -0.15 ? "العروض (ASKS) أعمق — ضغط بيعي في الدفتر" : "دفتر متوازن نسبيًا",
        score,
        metrics: [
          { label: "الفارق Spread", value: pctAbs(ob.spreadPct, 3) },
          { label: "عدم التوازن ±2%", value: pctText(d2.imbalance * 100, 1), tone: d2.imbalance > 0 ? "positive" : "negative" },
        ],
        details: [
          "لقطة لحظية تتغير بسرعة، وقد تحتوي أوامر وهمية (Spoofing) تُسحب قبل التنفيذ. تُستخدم كقرينة إضافية فقط.",
          `المصدر: ${ctx.orderBook.meta.source}${ctx.orderBook.meta.isMock ? " (تجريبي)" : ""}.`,
        ],
        levels: [
          ...ob.askWalls.map((w) => ({ label: `جدار بيع ${bidi(formatCompact(w.notional))}`, price: w.price, tone: "negative" as const })),
          ...ob.bidWalls.map((w) => ({ label: `جدار شراء ${bidi(formatCompact(w.notional))}`, price: w.price, tone: "positive" as const })),
        ],
        table: {
          columns: ["النطاق", "الطلبات BIDS", "العروض ASKS", "عدم التوازن"],
          rows: ob.depth.map((d) => ({ cells: [`±${d.pct}%`, formatCompact(d.bids), formatCompact(d.asks), pctText(d.imbalance * 100, 1)], tone: d.imbalance > 0.1 ? "positive" : d.imbalance < -0.1 ? "negative" : "neutral" })),
        },
      };
    },
  },
];
