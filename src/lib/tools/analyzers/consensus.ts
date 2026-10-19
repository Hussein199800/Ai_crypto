import { cci, ema, last, macd, momentum, rsi, sma, stochastic, williamsR } from "@/lib/indicators";
import type { OHLCV } from "@/types/market";

export type Action = "BUY" | "SELL" | "NEUTRAL";

export interface ConsensusItem {
  name: string;
  value: number | null;
  action: Action;
}

export interface ConsensusSummary {
  items: ConsensusItem[];
  buy: number;
  sell: number;
  neutral: number;
  /** من -1 إلى +1 */
  score: number;
  label: string;
}

function summarize(items: ConsensusItem[]): ConsensusSummary {
  const valid = items.filter((i) => i.value !== null);
  const buy = valid.filter((i) => i.action === "BUY").length;
  const sell = valid.filter((i) => i.action === "SELL").length;
  const neutral = valid.length - buy - sell;
  const score = valid.length ? (buy - sell) / valid.length : 0;
  const label = score > 0.5 ? "ميل شرائي قوي" : score > 0.1 ? "ميل شرائي" : score < -0.5 ? "ميل بيعي قوي" : score < -0.1 ? "ميل بيعي" : "محايد";
  return { items, buy, sell, neutral, score, label };
}

/** إجماع 12 متوسطًا متحركًا: SMA وEMA للفترات 10/20/30/50/100/200 */
export function maConsensus(candles: OHLCV[]): ConsensusSummary {
  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];
  const items: ConsensusItem[] = [];
  for (const p of [10, 20, 30, 50, 100, 200]) {
    for (const [name, fn] of [
      ["EMA", ema],
      ["SMA", sma],
    ] as const) {
      const v = last(fn(closes, p));
      const action: Action = v === null ? "NEUTRAL" : price > v * 1.001 ? "BUY" : price < v * 0.999 ? "SELL" : "NEUTRAL";
      items.push({ name: `${name} ${p}`, value: v, action });
    }
  }
  return summarize(items);
}

/** إجماع 6 مذبذبات: RSI، MACD، Stochastic، CCI، Williams %R، Momentum */
export function oscillatorConsensus(candles: OHLCV[]): ConsensusSummary {
  const closes = candles.map((c) => c.close);
  const r = last(rsi(closes, 14));
  const m = macd(closes);
  const mv = last(m.macd);
  const ms = last(m.signal);
  const st = last(stochastic(candles, 14, 3, 3).k);
  const cc = last(cci(candles, 20));
  const wr = last(williamsR(candles, 14));
  const mo = last(momentum(closes, 10));
  const items: ConsensusItem[] = [
    { name: "RSI (14)", value: r, action: r === null ? "NEUTRAL" : r < 30 ? "BUY" : r > 70 ? "SELL" : "NEUTRAL" },
    { name: "MACD (12,26,9)", value: mv, action: mv === null || ms === null ? "NEUTRAL" : mv > ms ? "BUY" : mv < ms ? "SELL" : "NEUTRAL" },
    { name: "Stoch %K (14,3,3)", value: st, action: st === null ? "NEUTRAL" : st < 20 ? "BUY" : st > 80 ? "SELL" : "NEUTRAL" },
    { name: "CCI (20)", value: cc, action: cc === null ? "NEUTRAL" : cc < -100 ? "BUY" : cc > 100 ? "SELL" : "NEUTRAL" },
    { name: "Williams %R (14)", value: wr, action: wr === null ? "NEUTRAL" : wr < -80 ? "BUY" : wr > -20 ? "SELL" : "NEUTRAL" },
    { name: "Momentum (10)", value: mo, action: mo === null ? "NEUTRAL" : mo > 0 ? "BUY" : mo < 0 ? "SELL" : "NEUTRAL" },
  ];
  if (mv === null || ms === null) items[1].value = null;
  return summarize(items);
}
