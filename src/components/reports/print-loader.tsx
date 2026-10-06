"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/states";
import { ApiClientError, apiGet, errorMessage } from "@/lib/client/fetcher";
import type { ReportRecord } from "@/types/analysis";
import { PrintReport } from "./print-report";
import { reportPath } from "@/lib/routes";

/** يحمّل التقرير (بالمعرّف أو الأحدث) ثم يعرض نسخة الطباعة — يعمل مع الخادم والنسخة الثابتة */
export function PrintLoader({ symbol }: { symbol: string }) {
  const id = useSearchParams().get("id");
  const q = useQuery({
    queryKey: ["report-print", symbol, id],
    queryFn: async (): Promise<ReportRecord | null> => {
      if (id) return apiGet<ReportRecord>(`/api/reports/${encodeURIComponent(id)}`);
      return (await apiGet<{ report: ReportRecord | null }>(`/api/reports/latest?symbol=${encodeURIComponent(symbol)}`)).report;
    },
  });
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError && !(q.error instanceof ApiClientError && q.error.status === 404)) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  if (!q.data?.data || q.data.symbol !== symbol) {
    return (
      <EmptyState
        title="التقرير غير موجود"
        description="قد يكون التقرير خاصًا أو محذوفًا أو محفوظًا في متصفح آخر."
        action={
          <Button asChild>
            <Link href={reportPath(symbol)}>فتح أحدث تقرير</Link>
          </Button>
        }
      />
    );
  }
  return <PrintReport report={q.data.data} />;
}
