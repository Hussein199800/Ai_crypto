import { LineChart as LineIcon } from "lucide-react";
import { Disclaimer } from "@/components/common/disclaimer";
import type { AnalysisReportData } from "@/types/analysis";
import { MarketSection, MomentumSection, RiskSection, TrendSection, VolumeSection } from "./analysis-sections";
import { DataQualityNotice, LevelsSection, ScenariosSection, SummarySection } from "./outcome-sections";
import { OverallResult } from "./overall-result";
import { ReportHeader } from "./report-header";
import { ReportPriceChart } from "./report-price-chart";
import { ReportSection } from "./report-section";
import { TechnicalSection } from "./technical-section";

const TOC = [
  ["result", "النتيجة"],
  ["technical", "التحليل الفني"],
  ["trend", "الاتجاه"],
  ["momentum", "الزخم"],
  ["volume", "الحجم"],
  ["market", "السوق العام"],
  ["scenarios", "السيناريوهات"],
  ["levels", "المستويات"],
  ["summary", "الملخص"],
] as const;

export function ReportContent({ report, actions, printMode = false }: { report: AnalysisReportData; actions?: React.ReactNode; printMode?: boolean }) {
  return (
    <div className="space-y-5">
      <ReportHeader report={report} actions={actions} />
      <Disclaimer short />
      <DataQualityNotice report={report} />
      <OverallResult report={report} />
      {!printMode && (
        <nav className="no-print scroll-x flex gap-2 rounded-lg border bg-card p-2 text-sm" aria-label="أقسام التقرير">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
      )}
      {!printMode && (
        <ReportSection id="chart" title="الرسم البياني" icon={LineIcon}>
          <ReportPriceChart report={report} />
        </ReportSection>
      )}
      <TechnicalSection report={report} printMode={printMode} />
      <TrendSection report={report} />
      <MomentumSection report={report} />
      <VolumeSection report={report} />
      <MarketSection report={report} />
      <RiskSection report={report} />
      <ScenariosSection report={report} />
      <LevelsSection report={report} />
      <SummarySection report={report} />
      <Disclaimer />
    </div>
  );
}
