"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/common/section-title";
import { EmptyState, ErrorState } from "@/components/common/states";
import { ReportCard } from "@/components/reports/report-card";
import { apiGet, errorMessage } from "@/lib/client/fetcher";
import type { ReportRecord } from "@/types/analysis";

export function LatestReports() {
  const q = useQuery({
    queryKey: ["reports", "latest-home"],
    queryFn: () => apiGet<{ items: ReportRecord[] }>("/api/reports?pageSize=6&sort=newest"),
  });
  return (
    <section>
      <SectionTitle
        title="آخر التقارير"
        icon={FileText}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/reports">كل التقارير</Link>
          </Button>
        }
      />
      {q.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !q.data?.items.length ? (
        <EmptyState
          title="لا توجد تقارير بعد"
          description="أنشئ أول تقرير تحليلي لأي عملة من صفحة التقارير."
          action={
            <Button asChild size="sm">
              <Link href="/reports?new=1">إنشاء تقرير جديد</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {q.data.items.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </div>
      )}
    </section>
  );
}
