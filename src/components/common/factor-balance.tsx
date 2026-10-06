import type { SignalCounts } from "@/types/analysis";

/** شريط توازن العوامل الإيجابية والسلبية والمحايدة */
export function FactorBalance({ counts }: { counts: SignalCounts }) {
  const total = Math.max(1, counts.positive + counts.negative + counts.neutral);
  const p = (counts.positive / total) * 100;
  const n = (counts.negative / total) * 100;
  const z = 100 - p - n;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`عوامل إيجابية ${counts.positive}، سلبية ${counts.negative}، محايدة ${counts.neutral}`}>
        <div className="h-full bg-positive" style={{ width: `${p}%` }} />
        <div className="h-full bg-muted-foreground/40" style={{ width: `${z}%` }} />
        <div className="h-full bg-negative" style={{ width: `${n}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs">
        <span className="text-positive">▲ إيجابي: <span className="num">{counts.positive}</span></span>
        <span className="text-muted-foreground">● محايد: <span className="num">{counts.neutral}</span></span>
        <span className="text-negative">▼ سلبي: <span className="num">{counts.negative}</span></span>
      </div>
    </div>
  );
}
