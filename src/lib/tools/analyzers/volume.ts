import type { OHLCV } from "@/types/market";

export interface VolumeProfile {
  bins: { low: number; high: number; volume: number }[];
  poc: number;
  vah: number;
  val: number;
  total: number;
}

/** ملف الحجم: توزيع حجم كل شمعة بالتساوي على نطاقها السعري، ثم POC ومنطقة القيمة (70%) */
export function volumeProfile(candles: OHLCV[], binsCount = 40, valueArea = 0.7): VolumeProfile | null {
  if (candles.length < 20) return null;
  const lo = Math.min(...candles.map((c) => c.low));
  const hi = Math.max(...candles.map((c) => c.high));
  if (!(hi > lo)) return null;
  const size = (hi - lo) / binsCount;
  const bins = Array.from({ length: binsCount }, (_, i) => ({ low: lo + i * size, high: lo + (i + 1) * size, volume: 0 }));
  for (const c of candles) {
    if (c.volume <= 0) continue;
    const a = Math.max(0, Math.floor((c.low - lo) / size));
    const b = Math.min(binsCount - 1, Math.floor((c.high - lo) / size));
    const share = c.volume / (b - a + 1);
    for (let i = a; i <= b; i++) bins[i].volume += share;
  }
  const total = bins.reduce((s, b) => s + b.volume, 0);
  if (total === 0) return null;
  let pocIdx = 0;
  bins.forEach((b, i) => (b.volume > bins[pocIdx].volume ? (pocIdx = i) : 0));
  let l = pocIdx;
  let h = pocIdx;
  let acc = bins[pocIdx].volume;
  while (acc / total < valueArea && (l > 0 || h < binsCount - 1)) {
    const down = l > 0 ? bins[l - 1].volume : -1;
    const up = h < binsCount - 1 ? bins[h + 1].volume : -1;
    if (up >= down) acc += bins[++h].volume;
    else acc += bins[--l].volume;
  }
  return { bins, poc: (bins[pocIdx].low + bins[pocIdx].high) / 2, vah: bins[h].high, val: bins[l].low, total };
}

export interface DeltaAnalysis {
  exact: boolean;
  lastDelta: number;
  sum20: number;
  buyShare20: number;
  cvd: number[];
  cvdChange20: number;
  priceChange20: number;
  divergence: "BULLISH" | "BEARISH" | "NONE";
}

/**
 * دلتا الحجم وCVD: الدلتا = حجم الشراء المبادر − حجم البيع المبادر.
 * إذا لم يتوفر حجم الشراء المبادر تُقدَّر الدلتا من موقع الإغلاق داخل الشمعة (تقريب).
 */
export function volumeDelta(candles: OHLCV[], lookback = 100): DeltaAnalysis | null {
  const slice = candles.slice(-lookback);
  if (slice.length < 25 || slice.every((c) => c.volume <= 0)) return null;
  const exact = slice.every((c) => typeof c.takerBuyVolume === "number");
  const deltas = slice.map((c) => {
    if (exact) return 2 * (c.takerBuyVolume as number) - c.volume;
    const range = c.high - c.low;
    return range > 0 ? c.volume * ((c.close - c.open) / range) : 0;
  });
  const cvd: number[] = [];
  deltas.reduce((acc, d) => {
    cvd.push(acc + d);
    return acc + d;
  }, 0);
  const last20 = slice.slice(-20);
  const vol20 = last20.reduce((s, c) => s + c.volume, 0) || 1;
  const sum20 = deltas.slice(-20).reduce((s, d) => s + d, 0);
  const cvdChange20 = cvd[cvd.length - 1] - cvd[cvd.length - 21];
  const p0 = slice[slice.length - 21].close;
  const priceChange20 = ((slice[slice.length - 1].close - p0) / p0) * 100;
  const scale = vol20 * 0.05;
  const divergence = priceChange20 > 1 && cvdChange20 < -scale ? "BEARISH" : priceChange20 < -1 && cvdChange20 > scale ? "BULLISH" : "NONE";
  return { exact, lastDelta: deltas[deltas.length - 1], sum20, buyShare20: ((vol20 + sum20) / 2 / vol20) * 100, cvd, cvdChange20, priceChange20, divergence };
}
