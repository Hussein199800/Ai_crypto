import Link from "next/link";
import { FileDown, Lock, ExternalLink } from "lucide-react";
import { getAssetConfig } from "@/config/assets";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HorizonBadge, MockBadge, RecommendationBadge, RiskBadge } from "@/components/common/signal-badges";
import { ChangeBadge } from "@/components/common/change-badge";
import { formatAssetValue, formatDateTime } from "@/lib/formatters";
import type { ReportRecord } from "@/types/analysis";
import { reportPath, reportPrintPath } from "@/lib/routes";

export function ReportCard({ report }: { report: ReportRecord }) {
  const cfg = getAssetConfig(report.symbol);
  const kind = cfg?.kind ?? "CRYPTO";
  const href = reportPath(report.symbol, report.id);
  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{cfg?.display ?? report.symbol}</span>
            {!report.isPublic && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="تقرير خاص">
                <Lock className="h-3.5 w-3.5" aria-hidden />
                خاص
              </span>
            )}
          </div>
          <div className="truncate text-xs text-muted-foreground">{cfg?.nameAr ?? report.assetName}</div>
        </div>
        <RecommendationBadge value={report.recommendation} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">السعر وقت التحليل</div>
          <div className="num font-semibold">{formatAssetValue(report.priceAtAnalysis, kind)}</div>
          <ChangeBadge value={report.change24h} label="24 ساعة" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">درجة التحليل</div>
          <div className="num text-lg font-bold">
            {report.score}
            <span className="text-xs font-normal text-muted-foreground"> / 100</span>
          </div>
          <Progress value={report.score} className="mt-1 h-1.5" label="درجة التحليل" indicatorClassName={report.score >= 65 ? "bg-positive" : report.score >= 45 ? "bg-warning" : "bg-negative"} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
          الثقة: <span className="num ms-1 font-semibold">{report.confidence}%</span>
        </span>
        <RiskBadge value={report.riskLevel} />
        <HorizonBadge value={report.horizon} />
        {report.isMock && <MockBadge />}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">{formatDateTime(report.createdAt)}</span>
        <div className="flex gap-1.5">
          {report.id && (
            <Button asChild variant="ghost" size="sm" title="تصدير PDF">
              <Link href={reportPrintPath(report.symbol, report.id)} target="_blank" rel="noopener">
                <FileDown />
                <span className="sr-only sm:not-sr-only">PDF</span>
              </Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link href={href}>
              <ExternalLink />
              فتح التقرير
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
