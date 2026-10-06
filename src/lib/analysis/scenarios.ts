import { formatPrice } from "@/lib/formatters";
import type { KeyLevels, MarketContext, Scenario } from "@/types/analysis";
import type { Timeframe } from "@/types/market";
import { TIMEFRAME_LABELS } from "@/lib/timeframes";

/** ثلاثة سيناريوهات محتملة — صياغة شرطية وليست توقعات مؤكدة */
export function buildScenarios(score: number, levels: KeyLevels, market: MarketContext, tf: Timeframe): Scenario[] {
  const tfl = TIMEFRAME_LABELS[tf];
  const f = (v: number | null) => (v == null ? "غير متاح" : formatPrice(v));
  const pos: Scenario["likelihood"] = score >= 60 ? "أعلى نسبيًا" : score <= 40 ? "أقل نسبيًا" : "متوسط";
  const neg: Scenario["likelihood"] = score <= 40 ? "أعلى نسبيًا" : score >= 60 ? "أقل نسبيًا" : "متوسط";
  const neu: Scenario["likelihood"] = score > 40 && score < 60 ? "أعلى نسبيًا" : "متوسط";

  const r1 = levels.resistance1;
  const r2 = levels.resistance2;
  const s1 = levels.support1;
  const s2 = levels.support2;

  return [
    {
      type: "POSITIVE",
      title: "السيناريو الإيجابي",
      likelihood: pos,
      conditions: [
        r1 != null ? `إغلاق شمعة ${tfl} فوق المقاومة الأولى ${f(r1)}` : "اختراق أعلى قمة حديثة بإغلاق واضح",
        "استمرار MACD فوق خط الإشارة مع هيستوجرام إيجابي",
        "ارتفاع حجم التداول مع الاختراق",
        "استقرار أو انخفاض هيمنة تيثر USDT.D",
      ],
      levels: [
        { label: "المقاومة الأولى (هدف أول محتمل)", value: r1 },
        { label: "المقاومة الثانية (هدف ثانٍ محتمل)", value: r2 },
      ],
      confirmations: ["ثبات السعر فوق المستوى المخترق عند إعادة اختباره", "تحسن مؤشر RSI دون الدخول في تشبع مفرط", market.marketTrend === "UP" ? "استمرار صعود السوق الكلي" : "تحول السوق الكلي إلى الصعود"],
      invalidations: [s1 != null ? `إغلاق ${tfl} دون الدعم الأول ${f(s1)}` : "كسر آخر قاع مهم", "فشل الاختراق مع حجم ضعيف"],
      watch: [],
    },
    {
      type: "NEUTRAL",
      title: "السيناريو المحايد",
      likelihood: neu,
      conditions: ["استمرار التداول داخل النطاق بين الدعم والمقاومة", "تراجع الحجم وغياب محفز واضح"],
      levels: [
        { label: "الحد السفلي للنطاق", value: s1 },
        { label: "الحد العلوي للنطاق", value: r1 },
      ],
      range: { low: s1, high: r1 },
      confirmations: ["تذبذب المتوسطات القصيرة حول بعضها", "ADX دون 20"],
      invalidations: ["خروج السعر من النطاق بإغلاق واضح وحجم مرتفع"],
      watch: ["انتظار إغلاق واضح خارج النطاق قبل اتخاذ قرار", "مراقبة بيانات الهيمنة ومعنويات السوق"],
    },
    {
      type: "NEGATIVE",
      title: "السيناريو السلبي",
      likelihood: neg,
      conditions: [
        s1 != null ? `كسر الدعم الأول ${f(s1)} بإغلاق ${tfl}` : "كسر آخر قاع مهم",
        "ارتفاع هيمنة تيثر USDT.D وتراجع السوق الكلي",
        "MACD تحت خط الإشارة مع تزايد الهيستوجرام السلبي",
      ],
      levels: [
        { label: "الدعم الأول", value: s1 },
        { label: "الدعم الثاني (مستوى خطر)", value: s2 },
        { label: "مستوى إبطال الفكرة الإيجابية", value: levels.invalidation },
      ],
      confirmations: ["هبوط مصحوب بحجم مرتفع", "تكوين قمم وقيعان أدنى"],
      invalidations: [r1 != null ? `استعادة المقاومة الأولى ${f(r1)}` : "استعادة آخر قمة مهمة"],
      watch: ["سلوك السعر عند الدعم الثاني", "تغيرات هيمنة البيتكوين وتيثر", "أي ارتفاع مفاجئ في التقلب ATR"],
    },
  ];
}
