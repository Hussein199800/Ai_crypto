import { Clock, Database } from "lucide-react";
import { ChangeBadge } from "@/components/common/change-badge";
import { MockBadge } from "@/components/common/signal-badges";
import { formatAssetValue, formatCompact, formatDateTime } from "@/lib/formatters";
import type { AnalysisReportData } from "@/types/analysis";

export function ReportHeader({ report, actions }: { report: AnalysisReportData; actions?: React.ReactNode }) {
  const o = report.overview;
  const changes: [string, number | null][] = [
    ["1 ساعة", o.change1h],
    ["24 ساعة", o.change24h],
    ["7 أيام", o.change7d],
    ["30 يومًا", o.change30d],
  ];
  return (
    <header className="panel panel-glow p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold sm:text-3xl">{report.nameAr}</h1>
            <span className="rounded-md border px-2 py-0.5 font-mono text-sm" dir="ltr">
              {report.display}
            </span>
            {report.isMock && <MockBadge />}
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground" dir="ltr">
            {report.name}
            {o.rank ? ` · #${o.rank}` : ""}
          </div>
          <div className="num mt-3 text-3xl font-bold">{formatAssetValue(o.price, report.kind)}</div>
          {o.marketCap != null && <div className="mt-1 text-xs text-muted-foreground">القيمة السوقية: <span className="num">{formatCompact(o.marketCap)}</span></div>}
        </div>
        {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {changes.map(([l, v]) => (
          <div key={l} className="rounded-lg border bg-background/40 px-3 py-2">
            <div className="text-xs text-muted-foreground">التغير {l}</div>
            <ChangeBadge value={v} label={l} className="text-sm" />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          وقت إنشاء التقرير: {formatDateTime(report.generatedAt)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Database className="h-3.5 w-3.5" aria-hidden />
          مصادر البيانات: {report.sources.join("، ") || "غير متاح"}
        </span>
      </div>
    </header>
  );
}
