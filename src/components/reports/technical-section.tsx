"use client";

import { LineChart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HORIZON_TIMEFRAME_WEIGHTS } from "@/config/scoring";
import { TREND_LABELS } from "@/lib/formatters/labels";
import { TIMEFRAME_LABELS } from "@/lib/timeframes";
import type { AnalysisReportData, TimeframeAnalysis } from "@/types/analysis";
import { IndicatorTable } from "./indicator-table";
import { ReportSection } from "./report-section";
import { cn } from "@/lib/utils";

export function TechnicalSection({ report, printMode = false }: { report: AnalysisReportData; printMode?: boolean }) {
  const weights = HORIZON_TIMEFRAME_WEIGHTS[report.horizon];
  const defaultTf = report.timeframes.find((t) => t.available && weights[t.timeframe] === Math.max(...Object.values(weights)))?.timeframe ?? report.timeframes[0].timeframe;
  return (
    <ReportSection
      id="technical"
      title="التحليل الفني"
      icon={LineChart}
      subtitle="تحليل 5 أطر زمنية. المساهمة = أثر المؤشر بالنقاط على الدرجة النهائية بعد تطبيق وزن الفئة ووزن الإطار الزمني في الأفق المختار."
    >
      {report.consensus && <ConsensusBlock report={report} />}
      {printMode ? (
        <div className="space-y-6">
          {report.timeframes.map((t) => (
            <div key={t.timeframe}>
              <TfSummary t={t} weight={weights[t.timeframe]} />
              {t.available && <IndicatorTable signals={t.signals} />}
            </div>
          ))}
        </div>
      ) : (
        <Tabs defaultValue={defaultTf} dir="rtl">
          <div className="scroll-x">
            <TabsList>
              {report.timeframes.map((t) => (
                <TabsTrigger key={t.timeframe} value={t.timeframe} disabled={!t.available} className="gap-1.5">
                  {TIMEFRAME_LABELS[t.timeframe]}
                  {t.score != null && <span className={cn("num text-[11px]", t.score >= 60 ? "text-positive" : t.score >= 45 ? "text-warning" : "text-negative")}>{t.score}</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {report.timeframes.map((t) => (
            <TabsContent key={t.timeframe} value={t.timeframe}>
              <TfSummary t={t} weight={weights[t.timeframe]} />
              {t.available ? <IndicatorTable signals={t.signals} /> : <p className="text-sm text-muted-foreground">{t.note}</p>}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </ReportSection>
  );
}

function TfSummary({ t, weight }: { t: TimeframeAnalysis; weight: number }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full border px-2.5 py-0.5 font-medium">{TIMEFRAME_LABELS[t.timeframe]}</span>
      <span className="rounded-full border px-2.5 py-0.5">الاتجاه: {TREND_LABELS[t.trend]}</span>
      <span className="rounded-full border px-2.5 py-0.5">
        درجة الإطار: <span className="num">{t.score ?? "—"}</span>
      </span>
      <span className="rounded-full border px-2.5 py-0.5">
        الوزن في الأفق: <span className="num">{Math.round(weight * 100)}%</span>
      </span>
      <span className="rounded-full border px-2.5 py-0.5">
        الشموع: <span className="num">{t.candles}</span>
      </span>
      <span className="text-positive">▲ {t.counts.positive}</span>
      <span className="text-muted-foreground">● {t.counts.neutral}</span>
      <span className="text-negative">▼ {t.counts.negative}</span>
      {t.note && <span className="text-warning">{t.note}</span>}
    </div>
  );
}

function ConsensusBlock({ report }: { report: AnalysisReportData }) {
  const c = report.consensus!;
  const box = (title: string, x: typeof c.ma) => {
    const tone = x.score > 0.1 ? "text-positive" : x.score < -0.1 ? "text-negative" : "text-warning";
    return (
      <div className="rounded-lg border bg-background/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <span className={cn("text-sm font-bold", tone)}>{x.label}</span>
        </div>
        <div className="mt-2 flex gap-3 text-xs">
          <span className="text-positive">شراء: <span className="num">{x.buy}</span></span>
          <span className="text-muted-foreground">محايد: <span className="num">{x.neutral}</span></span>
          <span className="text-negative">بيع: <span className="num">{x.sell}</span></span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {x.items.filter((i) => i.value !== null).map((i) => (
            <span key={i.name} className={cn("rounded border px-1.5 py-0.5 text-[10px]", i.action === "BUY" ? "border-positive/40 text-positive" : i.action === "SELL" ? "border-negative/40 text-negative" : "text-muted-foreground")} dir="ltr">
              {i.name}
            </span>
          ))}
        </div>
      </div>
    );
  };
  return (
    <div className="mb-4">
      <div className="grid gap-3 md:grid-cols-2">
        {box("إجماع المتوسطات المتحركة (12)", c.ma)}
        {box("إجماع المذبذبات (6)", c.oscillators)}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">على إطار {TIMEFRAME_LABELS[c.timeframe]}. الإجماع معروض للمقارنة فقط ولا يُضاف إلى الدرجة لأن نفس المؤشرات داخلة فيها أصلًا (تجنبًا للحساب المزدوج).</p>
    </div>
  );
}
