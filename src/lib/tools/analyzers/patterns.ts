import { swingPoints, type Pivot } from "@/lib/indicators/levels";
import { linearRegression } from "@/lib/indicators/extra";
import type { OHLCV } from "@/types/market";

export interface DetectedPattern {
  key: string;
  nameAr: string;
  bias: "bullish" | "bearish" | "neutral";
  status: "CONFIRMED" | "FORMING";
  confidence: "منخفضة" | "متوسطة" | "مرتفعة";
  levels: { label: string; price: number }[];
  description: string;
}

const pct = (a: number, b: number) => Math.abs(a - b) / ((a + b) / 2);

/**
 * ماسح أنماط مبني على نقاط الارتكاز الحقيقية. الأنماط تقديرية بطبيعتها وتعطي إشارات كاذبة كثيرة،
 * لذلك يُذكر دائمًا إن كان النمط "قيد التشكل" أو "مؤكدًا" بكسر خط العنق/الحد.
 */
export function scanPatterns(candles: OHLCV[], lookback = 150): DetectedPattern[] {
  const slice = candles.slice(-lookback);
  if (slice.length < 40) return [];
  const piv = swingPoints(slice, 3, 3);
  const highs = piv.filter((p) => p.type === "high");
  const lows = piv.filter((p) => p.type === "low");
  const close = slice[slice.length - 1].close;
  const out: DetectedPattern[] = [];

  const lowestBetween = (a: Pivot, b: Pivot) => Math.min(...slice.slice(a.index, b.index + 1).map((c) => c.low));
  const highestBetween = (a: Pivot, b: Pivot) => Math.max(...slice.slice(a.index, b.index + 1).map((c) => c.high));

  // القمة المزدوجة / القاع المزدوج
  if (highs.length >= 2) {
    const [a, b] = highs.slice(-2);
    const neck = lowestBetween(a, b);
    const depth = (Math.max(a.price, b.price) - neck) / neck;
    if (pct(a.price, b.price) <= 0.015 && depth >= 0.03 && b.index > a.index + 5) {
      const confirmed = close < neck;
      out.push({
        key: "double_top",
        nameAr: "قمة مزدوجة",
        bias: "bearish",
        status: confirmed ? "CONFIRMED" : "FORMING",
        confidence: confirmed ? "متوسطة" : "منخفضة",
        levels: [
          { label: "القمتان", price: Math.max(a.price, b.price) },
          { label: "خط العنق", price: neck },
          { label: "هدف القياس (سيناريو)", price: neck - (Math.max(a.price, b.price) - neck) },
        ],
        description: confirmed ? "كُسر خط العنق بالإغلاق — النمط مؤكد فنيًا." : "قمتان متقاربتان؛ لا يكتمل النمط إلا بإغلاق دون خط العنق.",
      });
    }
  }
  if (lows.length >= 2) {
    const [a, b] = lows.slice(-2);
    const neck = highestBetween(a, b);
    const height = (neck - Math.min(a.price, b.price)) / neck;
    if (pct(a.price, b.price) <= 0.015 && height >= 0.03 && b.index > a.index + 5) {
      const confirmed = close > neck;
      out.push({
        key: "double_bottom",
        nameAr: "قاع مزدوج",
        bias: "bullish",
        status: confirmed ? "CONFIRMED" : "FORMING",
        confidence: confirmed ? "متوسطة" : "منخفضة",
        levels: [
          { label: "القاعان", price: Math.min(a.price, b.price) },
          { label: "خط العنق", price: neck },
          { label: "هدف القياس (سيناريو)", price: neck + (neck - Math.min(a.price, b.price)) },
        ],
        description: confirmed ? "اختُرق خط العنق بالإغلاق — النمط مؤكد فنيًا." : "قاعان متقاربان؛ يكتمل النمط بإغلاق فوق خط العنق.",
      });
    }
  }

  // الرأس والكتفين / المعكوس
  if (highs.length >= 3) {
    const [l, h, r] = highs.slice(-3);
    if (h.price > l.price * 1.015 && h.price > r.price * 1.015 && pct(l.price, r.price) <= 0.03) {
      const neck = (lowestBetween(l, h) + lowestBetween(h, r)) / 2;
      const confirmed = close < neck;
      out.push({
        key: "head_shoulders",
        nameAr: "رأس وكتفين",
        bias: "bearish",
        status: confirmed ? "CONFIRMED" : "FORMING",
        confidence: confirmed ? "مرتفعة" : "منخفضة",
        levels: [
          { label: "الرأس", price: h.price },
          { label: "خط العنق", price: neck },
          { label: "هدف القياس (سيناريو)", price: neck - (h.price - neck) },
        ],
        description: "نمط انعكاسي هابط وفق تصنيف Bulkowski؛ التأكيد بالإغلاق دون خط العنق مع حجم مرتفع.",
      });
    }
  }
  if (lows.length >= 3) {
    const [l, h, r] = lows.slice(-3);
    if (h.price < l.price / 1.015 && h.price < r.price / 1.015 && pct(l.price, r.price) <= 0.03) {
      const neck = (highestBetween(l, h) + highestBetween(h, r)) / 2;
      const confirmed = close > neck;
      out.push({
        key: "inverse_head_shoulders",
        nameAr: "رأس وكتفين معكوس",
        bias: "bullish",
        status: confirmed ? "CONFIRMED" : "FORMING",
        confidence: confirmed ? "مرتفعة" : "منخفضة",
        levels: [
          { label: "الرأس", price: h.price },
          { label: "خط العنق", price: neck },
          { label: "هدف القياس (سيناريو)", price: neck + (neck - h.price) },
        ],
        description: "نمط انعكاسي صاعد؛ التأكيد بالإغلاق فوق خط العنق مع حجم مرتفع.",
      });
    }
  }

  // المثلثات والأوتاد: خطان مُلائمان لآخر القمم والقيعان
  const recentHighs = highs.filter((p) => p.index >= slice.length - 80).slice(-4);
  const recentLows = lows.filter((p) => p.index >= slice.length - 80).slice(-4);
  if (recentHighs.length >= 3 && recentLows.length >= 3) {
    const fit = (pts: Pivot[]) => {
      const x0 = pts[0].index;
      const xs = pts.map((p) => p.index - x0);
      const n = pts.length;
      const mx = xs.reduce((s, v) => s + v, 0) / n;
      const my = pts.reduce((s, p) => s + p.price, 0) / n;
      const slope = xs.reduce((s, x, i) => s + (x - mx) * (pts[i].price - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
      return { at: (idx: number) => my + slope * (idx - x0 - mx), slope };
    };
    const up = fit(recentHighs);
    const lo = fit(recentLows);
    const last = slice.length - 1;
    const width0 = up.at(Math.min(recentHighs[0].index, recentLows[0].index)) - lo.at(Math.min(recentHighs[0].index, recentLows[0].index));
    const widthNow = up.at(last) - lo.at(last);
    const norm = (s: number) => (s / close) * 100; // ميل كنسبة مئوية لكل شمعة
    const su = norm(up.slope);
    const sl = norm(lo.slope);
    const flat = 0.03;
    if (widthNow > 0 && widthNow < width0 * 0.85) {
      let key = "";
      let nameAr = "";
      let bias: DetectedPattern["bias"] = "neutral";
      if (Math.abs(su) < flat && sl > flat) [key, nameAr, bias] = ["ascending_triangle", "مثلث صاعد", "bullish"];
      else if (Math.abs(sl) < flat && su < -flat) [key, nameAr, bias] = ["descending_triangle", "مثلث هابط", "bearish"];
      else if (su < -flat && sl > flat) [key, nameAr, bias] = ["symmetric_triangle", "مثلث متماثل", "neutral"];
      else if (su > 0 && sl > su) [key, nameAr, bias] = ["rising_wedge", "وتد صاعد", "bearish"];
      else if (sl < 0 && su < sl) [key, nameAr, bias] = ["falling_wedge", "وتد هابط", "bullish"];
      if (key) {
        const upper = up.at(last);
        const lower = lo.at(last);
        const breakout = close > upper ? "UP" : close < lower ? "DOWN" : null;
        const apex = up.slope !== lo.slope ? Math.round((lo.at(last) - up.at(last)) / (up.slope - lo.slope)) : null;
        out.push({
          key,
          nameAr,
          bias: breakout === "UP" ? "bullish" : breakout === "DOWN" ? "bearish" : bias,
          status: breakout ? "CONFIRMED" : "FORMING",
          confidence: breakout ? "متوسطة" : "منخفضة",
          levels: [
            { label: "الحد العلوي الحالي", price: upper },
            { label: "الحد السفلي الحالي", price: lower },
          ],
          description: breakout
            ? `حدث ${breakout === "UP" ? "اختراق صاعد" : "كسر هابط"} لحدود النمط.`
            : `السعر داخل النمط${apex !== null && apex > 0 ? `، ويقترب من الرأس خلال ~${apex} شمعة تقريبًا` : ""}. يُنتظر كسر واضح بالإغلاق.`,
        });
      }
    }
  }

  // الكوب والعروة (تقريبي)
  if (slice.length >= 90) {
    const w = slice.slice(-120);
    const third = Math.floor(w.length / 3);
    const leftIdx = w.slice(0, third).reduce((bi, c, i, arr) => (c.high > arr[bi].high ? i : bi), 0);
    const bottomIdx = third + w.slice(third, 2 * third).reduce((bi, c, i, arr) => (c.low < arr[bi].low ? i : bi), 0);
    const rightPart = w.slice(2 * third);
    const rightIdx = 2 * third + rightPart.reduce((bi, c, i, arr) => (c.high > arr[bi].high ? i : bi), 0);
    const left = w[leftIdx].high;
    const bottom = w[bottomIdx].low;
    const right = w[rightIdx].high;
    const depth = (left - bottom) / left;
    const handleLow = Math.min(...w.slice(rightIdx).map((c) => c.low));
    const handleDepth = (right - handleLow) / (right - bottom || 1);
    if (pct(left, right) <= 0.04 && depth >= 0.12 && depth <= 0.5 && w.length - rightIdx >= 3 && handleDepth > 0.05 && handleDepth < 0.35) {
      const confirmed = close > Math.max(left, right);
      out.push({
        key: "cup_handle",
        nameAr: "كوب وعروة",
        bias: "bullish",
        status: confirmed ? "CONFIRMED" : "FORMING",
        confidence: "منخفضة",
        levels: [
          { label: "حافة الكوب", price: Math.max(left, right) },
          { label: "قاع الكوب", price: bottom },
          { label: "قاع العروة", price: handleLow },
        ],
        description: confirmed ? "اختُرقت حافة الكوب." : "تشكل محتمل لكوب وعروة؛ التأكيد باختراق حافة الكوب بحجم مرتفع.",
      });
    }
  }
  return out;
}

export { linearRegression };
