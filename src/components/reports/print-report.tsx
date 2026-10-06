"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalysisReportData } from "@/types/analysis";
import { ReportContent } from "./report-content";

export function PrintReport({ report }: { report: AnalysisReportData }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 800);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="mx-auto max-w-5xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
        <span>اختر «حفظ بتنسيق PDF» من نافذة الطباعة لتصدير التقرير.</span>
        <Button size="sm" onClick={() => window.print()}>
          <Printer />
          طباعة / حفظ PDF
        </Button>
      </div>
      <ReportContent report={report} printMode />
    </div>
  );
}
