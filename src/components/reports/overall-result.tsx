import { Info, ShieldAlert, Target } from "lucide-react";
import { ConfidenceRing, ScoreGauge } from "@/components/common/score-gauge";
import { FactorBalance } from "@/components/common/factor-balance";
import { RecommendationBadge, RiskBadge } from "@/components/common/signal-badges";
import { Progress } from "@/components/ui/progress";
import { HORIZON_DESCRIPTIONS, RECOMMENDATION_TONE } from "@/lib/formatters/labels";
import type { AnalysisReportData } from "@/types/analysis";
import { cn } from "@/lib/utils";

const TONE_RING = {
  positive: "border-positive/50 shadow-glow",
  negative: "border-negative/50 shadow-glow-red",
  warning: "border-warning/50",
  info: "border-info/50",
  neutral: "",
};

export function OverallResult({ report }: { report: AnalysisReportData }) {
  const s = report.scoring;
  const tone = RECOMMENDATION_TONE[s.recommendation];
  return (
    <section id="result" aria-labelledby="result-title" className={cn("print-avoid-break rounded-xl border-2 bg-card p-4 sm:p-6", TONE_RING[tone])}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="result-title" className="flex items-center gap-2 text-lg font-bold">
          <Target className="h-5 w-5 text-positive" aria-hidden />
          النتيجة العامة — إشارة تحليلية
        </h2>
        <span className="text-xs text-muted-foreground">تقييم آلي · ليس نصيحة مالية</span>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_auto_auto] lg:items-center">
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">التقييم</div>
          <div className="flex flex-wrap items-center gap-2">
            <RecommendationBadge value={s.recommendation} className="px-3 py-1 text-base" />
            <span className="rounded-full border px-2.5 py-0.5 text-xs">{s.bandLabel}</span>
          </div>
          <p className="text-sm leading-relaxed">{report.summary.headline}</p>
          {report.indicatorReading && (
            <p className="flex gap-2 rounded-lg border border-info/40 bg-info/10 p-3 text-sm leading-relaxed">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
              {report.indicatorReading}
            </p>
          )}
          {s.guards.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              {s.guards.map((g) => (
                <li key={g} className="flex gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                  {g}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <RiskBadge value={report.risk.level} />
            <span className="rounded-full border px-2.5 py-0.5 text-xs">الإطار الزمني: {HORIZON_DESCRIPTIONS[report.horizon]}</span>
          </div>
        </div>
        <ScoreGauge value={s.adjustedScore} label="الدرجة بعد تعديل جودة البيانات" />
        <ConfidenceRing value={s.confidence} label="مستوى الثقة" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-background/40 p-3">
          <div className="mb-2 text-sm font-medium">توازن العوامل الإيجابية والسلبية</div>
          <FactorBalance counts={s.counts} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="الدرجة الخام" value={`${s.rawScore}`} />
          <Metric label="بعد تعديل الجودة" value={`${s.adjustedScore}`} />
          <Metric label="جودة البيانات" value={`${s.dataQuality}%`} />
        </div>
      </div>

      <details className="mt-4 rounded-lg border bg-background/40 p-3 [&[open]>summary]:mb-3" open>
        <summary className="cursor-pointer text-sm font-medium">تفصيل الدرجة حسب الفئات والأوزان</summary>
        <div className="grid gap-2 sm:grid-cols-2">
          {s.breakdown.map((b) => (
            <div key={b.category} className="flex items-center gap-3 text-sm">
              <div className="w-40 shrink-0 truncate" title={b.labelAr}>
                {b.labelAr} <span className="num text-xs text-muted-foreground">({Math.round(b.weight * 100)}%)</span>
              </div>
              {b.available && b.score != null ? (
                <>
                  <Progress value={b.score} className="h-2 flex-1" label={b.labelAr} indicatorClassName={b.score >= 60 ? "bg-positive" : b.score >= 45 ? "bg-warning" : "bg-negative"} />
                  <span className="num w-10 text-end text-xs">{b.score}</span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">غير متاح (استُبعد من الحساب)</span>
              )}
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/40 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="num mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
